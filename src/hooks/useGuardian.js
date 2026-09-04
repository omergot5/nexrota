// ============================================================
// The app's single source of truth.
//
// Holds the session, the signed-in profile and the whole team dataset, and
// exposes actions that write to Supabase and then patch local state, so the
// UI stays responsive without a full refetch after every click.
//
// Three rules this file enforces, because getting any of them wrong shows up
// as a silent lie on screen:
//   1. Every action reports its failure. An awaited promise that rejects with
//      nobody listening is an error the user never learns about.
//   2. Every optimistic update can be rolled back. Painting a change before
//      the server agrees is fine; leaving it painted after the server refuses
//      is not.
//   3. `actions` is referentially stable. It is passed to every screen, so if
//      its identity changed with the data, memoised children would all
//      re-render on every keystroke.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import * as api from "../lib/api.js";
import { seedDemoTeam } from "../lib/demoData.js";
import { setTermProfile } from "../lib/terms.js";
// שכבת ה-state הראשונה שנוגעת במנוע (Phase 3, QUAL-04 מסלול 4): שיבוץ ידני
// מבצע כתיבה ישירה, ולכן חייב לשאול את אותה שאלה שהמנוע שואל לפני שהוא
// כותב — בדיוק כמו ששני מסכי ההחלפה כבר עושים לפני אישור.
import { checkQualification } from "../lib/autoAssign.js";
// Phase 4: המרת "עמדה קבועה פעילה" ל"מה חסר לשבוע הזה" היא גזירה טהורה —
// אותו עיקרון ש-checkQualification כבר נוהג בו כאן: שכבת ה-state קוראת
// למנוע, לא מדמה אותו.
import { missingRowsForWeek } from "../lib/positions.js";

const EMPTY = {
  team: null,
  members: [],
  guards: [],
  supervisors: [],
  shifts: [],
  availability: {},
  swapRequests: [],
  tasks: [],
  taskTemplates: [],
  compatibility: [],
  positions: [],
};

/**
 * צילום אחרון של הנתונים, לקריאה כשאין רשת.
 *
 * ה-service worker לא יכול לעשות את זה: הנתונים מגיעים מ-Supabase ב-POST
 * וב-WebSocket, לא כ-GET שאפשר למטמן. הם נשמרים כאן במלואם — הצוות, הסידור
 * והזמינות — כך שמאבטח במוצב בלי קליטה רואה בדיוק את מה שראה לאחרונה.
 *
 * המטמון הוא לקריאה בלבד ואף פעם לא מקור אמת: ברגע שהרשת חוזרת, `refresh`
 * דורס אותו. חריגה שקטה בכתיבה מכוונת — מכסת אחסון מלאה או גלישה פרטית לא
 * אמורות למנוע מהאפליקציה לעבוד.
 */
const OFFLINE_KEY = "gs-offline";

const saveOffline = (profile, team) => {
  try {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify({ profile, team }));
  } catch {
    /* אין מקום או שהאחסון חסום — נמשיך בלי מצב לא־מקוון */
  }
};

const readOffline = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * True when this page load came from a password-recovery email. Read once at
 * module load: supabase-js strips the fragment as soon as it exchanges the
 * token, so by the time a component effect runs the evidence is gone.
 */
const AROSE_FROM_RECOVERY =
  typeof window !== "undefined" && window.location.hash.includes("type=recovery");

export function useGuardian() {
  // booting | anonymous | recovery | needs-team | ready | error
  const [status, setStatus] = useState("booting");
  const [user, setUser] = useState(null); // the app profile, not the auth user
  const [data, setData] = useState(EMPTY);

  // תחום הפעילות הוא תכונה של הצוות, ולכן הוא מוחל מכאן ולא מהמסך שמשנה
  // אותו: כך הוא נכון גם בטעינה ראשונה, גם מהמטמון הלא-מקוון, וגם כששותף
  // אחר החליף אותו וההודעה הגיעה ב-realtime.
  useEffect(() => {
    setTermProfile(data.team?.mode || "civil");
  }, [data.team?.mode]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // "הנתונים על המסך הם צילום ישן". מוצג, ולא מוסתר: משתמש שרואה סידור בלי
  // לדעת שהוא לא מעודכן הוא בדיוק הכשל שהמצב הלא־מקוון אמור למנוע.
  const [offline, setOffline] = useState(false);
  const mounted = useRef(true);

  // Mirror of `data` for async callbacks. Reading state straight out of a
  // closure gives you whatever it was when the callback was created; this is
  // always the last committed value.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // StrictMode mounts, unmounts and remounts in dev. The flag has to be raised
  // again on every mount, or the cleanup from the first pass leaves it false
  // and every setState below is silently skipped.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ---------- bootstrap ----------

  const hydrate = useCallback(async (profile) => {
    const team = await api.loadTeam(profile.teamCode);
    if (!mounted.current) return;
    setData(team);
    setUser(profile);
    setStatus("ready");
  }, []);

  // אחרי כתיבה טרייה (הרשמה/הצטרפות/הדגמה), getMyProfile() יכול להחזיר
  // null על עיכוב קריאה-אחרי-כתיבה — אותו race ש-login() כבר שולל דרך
  // NO_TEAM. בלי השומר הזה hydrate(null) קורס עם TypeError גולמי באנגלית
  // (profile.teamCode על null) במקום הודעה בעברית שאפשר לפעול לפיה.
  const hydrateSelf = useCallback(async () => {
    const profile = await api.getMyProfile();
    if (!profile) {
      throw new Error("הפרופיל עוד לא מוכן — נסה שוב בעוד רגע");
    }
    await hydrate(profile);
  }, [hydrate]);

  const boot = useCallback(async () => {
    try {
      // A recovery link carries a valid session, so this has to be checked
      // before the profile lookup — otherwise the user is silently logged
      // into their account instead of being asked for a new password.
      if (AROSE_FROM_RECOVERY) {
        if (mounted.current) setStatus("recovery");
        return;
      }
      const profile = await api.getMyProfile();
      if (!mounted.current) return;
      if (!profile) {
        setStatus("anonymous");
        return;
      }
      await hydrate(profile);
    } catch (e) {
      if (!mounted.current) return;
      // נפילה בזמן שאין רשת היא ההסבר הסביר היחיד להגיש נתונים ישנים. אם
      // הדפדפן מדווח שיש חיבור, הכשל הוא משהו אחר — שגיאת הרשאה, למשל —
      // ולהציג צילום ישן במקומה זו הטעיה.
      const cached = !navigator.onLine && readOffline();
      if (cached?.profile && cached?.team) {
        setData(cached.team);
        setUser(cached.profile);
        setOffline(true);
        setStatus("ready");
        return;
      }
      setError(e.message || "לא הצלחנו לטעון את הנתונים");
      setStatus("error");
    }
  }, [hydrate]);

  useEffect(() => {
    boot();
  }, [boot]);

  const refresh = useCallback(async () => {
    const teamCode = dataRef.current.team?.code;
    if (!teamCode) return;
    try {
      const team = await api.loadTeam(teamCode);
      if (mounted.current) {
        setData(team);
        setOffline(false);
      }
    } catch (e) {
      if (mounted.current) setError(e.message);
    }
  }, []);

  // צילום המטמון נכתב ממקום אחד — כל מצב "ready" שנצבע נשמר. שמירה בכל
  // פעולה בנפרד הייתה נשכחת בפעולה הבאה שמישהו יוסיף.
  useEffect(() => {
    if (status === "ready" && user && data.team && !offline) saveOffline(user, data);
  }, [status, user, data, offline]);

  // חזרת הרשת מרעננת מיד. בלי זה המשתמש נשאר עם צילום ישן עד לפעולה הבאה,
  // ובאבטחה זה בדיוק הזמן שבו הסידור השתנה.
  useEffect(() => {
    const back = () => refresh();
    window.addEventListener("online", back);
    const gone = () => setOffline(true);
    window.addEventListener("offline", gone);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", gone);
    };
  }, [refresh]);

  // ---------- live updates ----------
  // Everyone on a team shares one channel; any write nudges the others to
  // refetch. RLS already limits which rows reach this client, so no filter is
  // needed here — a change you are not allowed to see never arrives.
  const teamCode = user?.teamCode;
  useEffect(() => {
    if (!teamCode) return;
    const onChange = () => refresh();
    const channel = supabase.channel(`team-${teamCode}`);
    for (const table of [
      "gs_shifts", "gs_assignments", "gs_availability", "gs_profiles", "gs_swap_requests",
    ]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamCode, refresh]);

  // ---------- action plumbing ----------

  /**
   * Runs an async action with a busy flag and centralised error reporting.
   *
   * @param rethrow  auth screens render their own inline message and need the
   *                 original error (they branch on `e.code`), so they opt in.
   *                 Data actions are fire-and-forget from the UI's point of
   *                 view and must not produce an unhandled rejection.
   */
  const run = useCallback(async (fn, { rethrow = false } = {}) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      if (mounted.current) setError(e.message || "הפעולה נכשלה — נסה שוב");
      if (rethrow) throw e;
      return undefined;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  /**
   * Paints `patch` immediately, then does the real write. If the write fails
   * the previous dataset is restored, so the screen never keeps showing a
   * change the server rejected.
   */
  const optimistic = useCallback(
    (patch, work) =>
      run(async () => {
        const snapshot = dataRef.current;
        setData(patch);
        try {
          await work();
        } catch (e) {
          if (mounted.current) setData(snapshot);
          throw e;
        }
      }),
    [run]
  );

  /**
   * פעולה הפיכה — בלי חלונית אישור.
   *
   * "האם אתה בטוח?" עוצר את כולם כדי להגן מפני הטעות של אחד, ומי שלוחץ עשר
   * פעמים ביום מפסיק לקרוא אותה בלאו הכי. במקום זה: המסך מתעדכן מיד, הכתיבה
   * לשרת ממתינה שמונה שניות, ובחלון הזה "ביטול" פשוט מבטל את הטיימר — לא
   * מריץ פעולה הפוכה. לכן אין מה שיכשל בביטול, ואין שורה שנמחקה ונוצרה מחדש
   * עם מזהה אחר.
   *
   * המחיר: הכתיבה חייבת להישלח גם אם עוזבים את המסך. `flush` נקרא לפני כל
   * פעולה נדחית חדשה, ובפריקת הרכיב.
   */
  const pendingRef = useRef(null);
  // `flush` נקרא מתוך טיימר שנוצר לפניו — הפניה דרך ref שוברת את המעגל.
  const flushRef = useRef(null);
  const [pending, setPending] = useState(null);

  const flush = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    setPending(null);
    run(async () => {
      try {
        await p.work();
      } catch (e) {
        if (mounted.current) setData(p.snapshot);
        throw e;
      }
    });
  }, [run]);

  const undo = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    setPending(null);
    setData(p.snapshot);
  }, []);

  const deferred = useCallback(
    (label, patch, work) => {
      flush();
      const snapshot = dataRef.current;
      setData(patch);
      const timer = setTimeout(() => flushRef.current(), 8000);
      pendingRef.current = { label, work, snapshot, timer };
      setPending({ label });
    },
    [flush]
  );

  flushRef.current = flush;

  // עזיבת המסך שולחת את מה שממתין. אחרת פעולה שהמשתמש כבר ראה מתבצעת
  // הייתה נעלמת ברענון הבא.
  useEffect(() => () => flushRef.current(), []);

  // ---------- auth actions ----------

  const register = useCallback(
    (form) =>
      run(
        async () => {
          const { teamCode: code } = await api.registerSupervisor(form);
          await hydrateSelf();
          return code;
        },
        { rethrow: true }
      ),
    [run, hydrateSelf]
  );

  const login = useCallback(
    (form) =>
      run(
        async () => {
          try {
            const profile = await api.loginSupervisor(form);
            await hydrate(profile);
            return profile;
          } catch (e) {
            // Credentials were fine, there is just no team yet. Stay signed in
            // and hand the caller a finish-setup step rather than logging the
            // user straight back out.
            if (e.code === "NO_TEAM" && mounted.current) setStatus("needs-team");
            throw e;
          }
        },
        { rethrow: true }
      ),
    [run, hydrate]
  );

  /** Second half of onboarding, for a session that authenticated with no team. */
  const completeSetup = useCallback(
    (form) =>
      run(
        async () => {
          await api.createTeamForCurrentUser(form);
          await hydrateSelf();
        },
        { rethrow: true }
      ),
    [run, hydrateSelf]
  );

  const requestPasswordReset = useCallback(
    (email) => run(() => api.requestPasswordReset(email), { rethrow: true }),
    [run]
  );

  const setNewPassword = useCallback(
    (password) =>
      run(
        async () => {
          await api.updatePassword(password);
          // Drop the recovery fragment so a refresh does not reopen this screen.
          window.history.replaceState(null, "", window.location.pathname);
          const profile = await api.getMyProfile();
          if (profile) await hydrate(profile);
          else if (mounted.current) setStatus("needs-team");
        },
        { rethrow: true }
      ),
    [run, hydrate]
  );

  const joinTeam = useCallback(
    (form) =>
      run(
        async () => {
          const profile = await api.joinAsGuard(form);
          await hydrate(profile);
          return profile;
        },
        { rethrow: true }
      ),
    [run, hydrate]
  );

  /** Guest entry: an anonymous supervisor with a fully seeded demo team. */
  const startGuestDemo = useCallback(
    () =>
      run(
        async () => {
          const session = await api.getSession();
          if (!session) {
            const { error: e } = await supabase.auth.signInAnonymously();
            if (e) throw new Error("לא הצלחנו לפתוח הדגמה — בדוק את החיבור לאינטרנט");
          } else {
            // session קיים כבר יכול להחזיק צוות הדגמה מביקור קודם (אותה
            // אנונימית נשמרת ב-localStorage) — בלי הבדיקה הזאת כל לחיצה
            // נוספת על "הפעל הדגמה" יוצרת עוד "מוקד הדגמה" חדש בבסיס
            // הנתונים, גם כשהמשתמש כבר בתוך אחד. תריסרי הצוותים היתומים
            // שכבר קיימים שם הם בדיוק התוצאה של החוסר הזה.
            const existing = await api.getMyProfile();
            if (existing) {
              await hydrate(existing);
              return existing.teamCode;
            }
          }
          const { data: rows, error: rpcErr } = await supabase.rpc("gs_create_team", {
            p_team_name: "מוקד הדגמה",
            p_full_name: "מנהל הדגמה",
          });
          if (rpcErr) throw new Error("פתיחת ההדגמה נכשלה — נסה שוב");
          const row = Array.isArray(rows) ? rows[0] : rows;

          await seedDemoTeam({ teamCode: row.team_code, existingGuards: [], existingShifts: [] });
          await hydrateSelf();
          return row.team_code;
        },
        { rethrow: true }
      ),
    [run, hydrate, hydrateSelf]
  );

  const logout = useCallback(async () => {
    await api.logout();
    // הצילום הלא־מקוון יורד ביציאה. טלפון עובר בין אנשים, ומי שנכנס אחריו
    // לא אמור לראות את הסידור של הקודם רק כי אין קליטה.
    try {
      localStorage.removeItem(OFFLINE_KEY);
    } catch {
      /* אחסון חסום — אין מה לנקות */
    }
    if (!mounted.current) return;
    setOffline(false);
    setUser(null);
    setData(EMPTY);
    setError(null);
    setStatus("anonymous");
  }, []);

  // ---------- data actions ----------
  //
  // Deliberately depends only on stable callbacks, never on `data` — the
  // current dataset is read through `dataRef` at call time instead. That
  // keeps this object identical across renders.

  const actions = useMemo(
    () => ({
      seedDemo: () =>
        run(async () => {
          const { team, guards, shifts } = dataRef.current;
          const res = await seedDemoTeam({
            teamCode: team?.code,
            existingGuards: guards,
            existingShifts: shifts,
          });
          await refresh();
          return res;
        }),

      addShifts: (shifts) =>
        run(async () => {
          await api.createShifts(shifts, dataRef.current.team?.code);
          await refresh();
        }),

      updateShift: (id, patch) =>
        run(async () => {
          await api.updateShift(id, patch, dataRef.current.team?.code);
          await refresh();
        }),

      deleteShift: (id) =>
        deferred(
          "המשמרת נמחקה",
          (d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== id) }),
          () => api.deleteShift(id)
        ),

      /**
       * מחיקת אצווה — למשל כל השבוע. עוברת דרך `deferred` בדיוק כמו מחיקה
       * בודדת, ולכן מקבלים שמונה שניות של "ביטול" במקום דיאלוג אישור.
       */
      deleteShifts: (ids, label = "המשמרות נמחקו") =>
        deferred(
          label,
          (d) => ({ ...d, shifts: d.shifts.filter((s) => !ids.includes(s.id)) }),
          () => api.deleteShifts(ids)
        ),

      /**
       * החלפת תוכן השבוע: מה שהיה יורד, ומה שנבחר עולה במקומו.
       *
       * עכשיו כן עובר דרך `deferred`, בניגוד להערה הישנה כאן — ההערה חששה
       * ממה שקורה כששני `deferred` נפרדים (מחיקה, ואז הוספה) רצים זה לצד
       * זה: כל אחד עם חלון-ביטול משלו, שמתחרים ומראים שבוע כפול. הפתרון
       * הוא לא לוותר על הביטול — זו בדיוק הפעולה ההרסנית ביותר במסך הזה,
       * ו-clearWeek הצמוד אליה כבר מקבל 8 שניות — אלא לצייר את שני הצדדים
       * (מה שיורד, מה שעולה) כ-patch אחד, אטומי, בקריאת deferred אחת. אין
       * שני חלונות שמתחרים כי יש רק אחד. השורות החדשות מקבלות מזהה זמני
       * (temp-) רק כדי שהתצוגה האופטימית תוכל למפות אותן — refresh() בסוף
       * ה-work מחליף אותן במזהים האמיתיים מהשרת בכל מקרה.
       */
      replaceShifts: (ids, rows, label = "השבוע הוחלף") =>
        deferred(
          label,
          (d) => ({
            ...d,
            shifts: [
              ...d.shifts.filter((s) => !ids.includes(s.id)),
              ...rows.map((r, i) => ({
                id: `temp-${Date.now()}-${i}`,
                assignedGuards: [],
                published: false,
                category: null,
                requiredGuards: 1,
                ...r,
              })),
            ],
          }),
          () => run(async () => {
            if (ids.length) await api.deleteShifts(ids);
            if (rows.length) await api.createShifts(rows, dataRef.current.team?.code);
            await refresh();
          })
        ),

      publish: (shiftIds, published) =>
        optimistic(
          (d) => ({
            ...d,
            shifts: d.shifts.map((s) => (shiftIds.includes(s.id) ? { ...s, published } : s)),
          }),
          () => api.setPublished(shiftIds, published)
        ),

      toggleAssignment: (shiftId, guardId) => {
        const shift = dataRef.current.shifts.find((s) => s.id === shiftId);
        const guard = dataRef.current.guards.find((g) => g.id === guardId);
        const assigned = Boolean(shift?.assignedGuards.includes(guardId));

        // חסימת כשירות בלבד (P-01) — ולא יותר מזה. המסלול הזה לא אכף שום
        // אילוץ קשיח לפני היום: לא מנוחה, לא רצף שעות, לא תקרה שבועית ואפילו
        // לא זמינות. זה פער אמיתי ורחב יותר, והוא נשאר פתוח בכוונה — סגירתו
        // הייתה מתחילה לחסום שיבוצים שאחמ"ש תמיד יכל לעשות ביד (למשל לכסות
        // חור ב-3 לפנות בוקר שמפר מנוחה כי אין מי שיחליף), וזו שיחת מוצר
        // בפני עצמה, לא תופעת לוואי של עבודת הכשירות. רק כיוון השיבוץ נבדק:
        // הסרה אף פעם לא נחסמת, כי מנהל שצמצם כשירות חייב להיות מסוגל להוריד
        // מהמשמרות שהאדם כבר לא כשיר להן.
        if (!assigned) {
          const check = checkQualification({ guard, shift });
          if (!check.ok) {
            return run(async () => {
              throw new Error(check.reason);
            });
          }
        }

        return optimistic(
          (d) => ({
            ...d,
            shifts: d.shifts.map((s) =>
              s.id !== shiftId
                ? s
                : {
                    ...s,
                    assignedGuards: assigned
                      ? s.assignedGuards.filter((g) => g !== guardId)
                      : [...s.assignedGuards, guardId],
                  }
            ),
          }),
          () =>
            assigned
              ? api.unassignGuard({ shiftId, guardId })
              : api.assignGuard({ shiftId, guardId, source: "manual" })
        );
      },

      applyPlan: (shiftIds, assignments) =>
        run(async () => {
          await api.applyPlan({ shiftIds, assignments });
          await refresh();
        }),

      clearAssignments: (shiftIds) =>
        deferred(
          "השיבוץ נוקה",
          (d) => ({
            ...d,
            shifts: d.shifts.map((s) =>
              shiftIds.includes(s.id) ? { ...s, assignedGuards: [] } : s
            ),
          }),
          () => api.clearAssignments(shiftIds)
        ),

      setAvailability: (shiftId, guardId, status, comment) =>
        optimistic(
          (d) => ({
            ...d,
            availability: {
              ...d.availability,
              [`${guardId}-${shiftId}`]: { status, comment: comment || "" },
            },
          }),
          () => api.setAvailability({ shiftId, guardId, status, comment })
        ),

      addGuard: (name, phone) =>
        run(async () => {
          await api.addGuard({ name, phone, teamCode: dataRef.current.team?.code });
          await refresh();
        }),

      removeGuard: (id) =>
        deferred(
          "האדם הוסר מהצוות",
          (d) => ({ ...d, guards: d.guards.filter((g) => g.id !== id) }),
          () => api.removeGuard(id)
        ),

      updateTeamSettings: (patch) =>
        optimistic(
          (d) => ({ ...d, team: { ...d.team, ...patch } }),
          () => api.updateTeamSettings(dataRef.current.team?.code, patch)
        ),

      setGuardExempt: (id, exempt) =>
        optimistic(
          (d) => ({
            ...d,
            guards: d.guards.map((g) => (g.id === id ? { ...g, deadlineExempt: exempt } : g)),
            members: d.members.map((g) => (g.id === id ? { ...g, deadlineExempt: exempt } : g)),
          }),
          () => api.setGuardExempt(id, exempt)
        ),

      setGuardQualifications: (id, categories) =>
        optimistic(
          (d) => ({
            ...d,
            guards: d.guards.map((g) => (g.id === id ? { ...g, qualifiedCategories: categories } : g)),
            members: d.members.map((g) => (g.id === id ? { ...g, qualifiedCategories: categories } : g)),
          }),
          () => api.setGuardQualifications(id, categories)
        ),

      setGuardWeekendPreference: (id, preference) =>
        optimistic(
          (d) => ({
            ...d,
            guards: d.guards.map((g) => (g.id === id ? { ...g, weekendPreference: preference } : g)),
            members: d.members.map((g) => (g.id === id ? { ...g, weekendPreference: preference } : g)),
          }),
          () => api.setGuardWeekendPreference(id, preference)
        ),

      createSwap: (payload) =>
        run(async () => {
          await api.createSwap({ ...payload, teamCode: dataRef.current.team?.code });
          await refresh();
        }),

      // "אשר"/"דחה" הן כפתורים צמודים על אותה שורה — טעות-לחיצה בין השניים
      // היא בדיוק המקרה ש"ביטול במקום אישור" (CLAUDE.md) קיים בשבילו, אבל
      // עד עכשיו זו הייתה הפעולה ההרסנית היחידה במוצר בלי אף הגנה: לא
      // confirm() (וזה טוב — המוצר לא רוצה את זה), אבל גם לא deferred/undo.
      // עכשיו כן: הכתיבה בפועל (כולל העברת המשמרת בין השומרים, אם אושר)
      // ממתינה כמו כל פעולה הרסנית אחרת, וה-patch כאן מצייר מראש בדיוק את
      // מה ש-api.decideSwap יעשה בסוף, כדי שהמסך לא "יתקן את עצמו" ברגע
      // שהכתיבה האמיתית מגיעה.
      decideSwap: (swap, status) =>
        deferred(
          status === "approved" ? "בקשת ההחלפה אושרה" : "בקשת ההחלפה נדחתה",
          (d) => ({
            ...d,
            swapRequests: d.swapRequests.map((r) => (r.id === swap.id ? { ...r, status } : r)),
            shifts:
              status === "approved" && swap.shiftId && swap.fromGuard && swap.toGuard
                ? d.shifts.map((s) =>
                    s.id === swap.shiftId
                      ? {
                          ...s,
                          assignedGuards: s.assignedGuards
                            .filter((id) => id !== swap.fromGuard)
                            .concat(swap.toGuard),
                        }
                      : s
                  )
                : d.shifts,
          }),
          () => api.decideSwap(swap, status)
        ),

      createTask: (task) =>
        run(async () => {
          await api.createTask(task, dataRef.current.team?.code);
          await refresh();
        }),

      createTasks: (list) =>
        run(async () => {
          await api.createTasks(list, dataRef.current.team?.code);
          await refresh();
        }),

      editTask: (id, task) =>
        run(async () => {
          await api.updateTask(id, { ...task, full: true });
          await refresh();
        }),

      toggleTask: (id, status) =>
        optimistic(
          (d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }),
          () => api.updateTask(id, { status })
        ),

      deleteTask: (id) =>
        deferred(
          "המשימה נמחקה",
          (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }),
          () => api.deleteTask(id)
        ),

      // ---------- positions (Phase 4) ----------

      addPosition: (position) =>
        run(async () => {
          await api.createPosition(position, dataRef.current.team?.code);
          await refresh();
        }),

      updatePosition: (id, patch) =>
        run(async () => {
          await api.updatePosition(id, { ...patch, teamCode: dataRef.current.team?.code });
          await refresh();
        }),

      deletePosition: (id) =>
        deferred(
          "העמדה נמחקה",
          (d) => ({ ...d, positions: d.positions.filter((p) => p.id !== id) }),
          () => api.deletePosition(id)
        ),

      /**
       * מממש שורות שבועיות חסרות לכל עמדת template פעילה (POS-01, POS-04).
       * שער ה-DoS (T-04-05): אם אין חוסרים, חוזר מיד עם {created: 0} בלי שום
       * כתיבה ובלי refresh() — כי המסך שקורא לזה יכול לקרוא בכל שינוי שבוע,
       * ו-refresh() ללא תנאי מכאן היה לולאה. עמדות shape==="weekly" מדולגות
       * במפורש כאן — הרוטציה השבועית היא 04-03.
       */
      ensurePositionsForWeek: (sundayISO) =>
        run(async () => {
          const { positions, shifts, team } = dataRef.current;
          const active = (positions || []).filter((p) => p.active && p.shape === "template");
          const rows = active.flatMap((p) => missingRowsForWeek(p, sundayISO, shifts));
          if (!rows.length) return { created: 0 };
          await api.materializeTemplateShifts(rows, team?.code);
          await refresh();
          return { created: rows.length };
        }),
    }),
    [run, optimistic, deferred, refresh]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    status,
    user,
    error,
    busy,
    ...data,
    register,
    login,
    completeSetup,
    requestPasswordReset,
    setNewPassword,
    joinTeam,
    startGuestDemo,
    logout,
    refresh,
    actions,
    clearError,
    pending,
    undo,
    offline,
  };
}
