// ============================================================
// One-click demo data.
//
// Builds a week that is deliberately *not* trivial to solve: a couple of
// guards are blocked on the busiest nights, one is on reserve duty midweek,
// and two shifts need double staffing. That way the smart assignment has
// something real to reason about instead of filling empty slots at random.
// ============================================================

import { supabase } from "./supabaseClient.js";
import { SHIFT_TONES } from "../design/shiftPalette.js";
import { weekByOffset } from "./dates.js";
import { shiftFromRow, shiftRowToWorkItem, SHIFT_SELECT, positionFromRow, positionToRow } from "./api.js";
import { missingRowsForWeek } from "./positions.js";
import { ARMY_DEMO_SOLDIERS, demoAvailabilityCode, planArmyDemoPositions } from "./armyDemo.js";

// 7 הראשונים שומרים על הדפוס הידני המקורי (PATTERN למטה) — קנה מידה
// שממחיש חלוקה-לא-1:1 (יותר תקנים מאנשים) בלי לרוקן את הדוגמה לשישה
// אנשים. הדגמת הצבא פותחת עד 30 חיילים (ARMY_DEMO_SOLDIERS, armyDemo.js),
// אז המאגר מחזיק 30 שמות אמיתיים — לא שמות גנריים ("שומר 8"). מ-8 ומעלה
// אין PATTERN ידני — `fallbackStatus` (למטה) כבר מכסה אותם דטרמיניסטית.
/** שם צוות ההדגמה האורחת. ההדגמה צבאית בלבד — המסך מזהה אותה לפי השם הזה. */
export const DEMO_TEAM_NAME = "פלוגת הדגמה";

const DEMO_GUARDS = [
  { name: "גיא לוי", phone: "050-1234567" },
  { name: "מיכל כהן", phone: "052-2345678" },
  { name: "אבי ישראלי", phone: "054-3456789" },
  { name: "רינה שמיר", phone: "058-4567890" },
  { name: "דן מזרחי", phone: "050-5678901" },
  { name: "נועה ברק", phone: "053-6789012" },
  { name: "יובל אברהם", phone: "052-1112222" },
  { name: "עידן פרץ", phone: "054-1113333" },
  { name: "שירה גולן", phone: "050-1114444" },
  { name: "אורי חדד", phone: "052-1115555" },
  { name: "טל אביטן", phone: "053-1116666" },
  { name: "מאיה סבג", phone: "058-1117777" },
  { name: "רועי בן-דוד", phone: "050-1118888" },
  { name: "ליאור כספי", phone: "054-1119999" },
  { name: "הדר וקנין", phone: "052-2223333" },
  { name: "עומר טל", phone: "053-2224444" },
  { name: "יעל מלכה", phone: "058-2225555" },
  { name: "נתן אוחיון", phone: "050-2226666" },
  { name: "אלה ביטון", phone: "054-2227777" },
  { name: "אסף רז", phone: "052-2228888" },
  { name: "אביב דהן", phone: "050-3330001" },
  { name: "בר שטרן", phone: "052-3330002" },
  { name: "גלעד נחמיאס", phone: "054-3330003" },
  { name: "דנה אלון", phone: "058-3330004" },
  { name: "הראל גבאי", phone: "053-3330005" },
  { name: "זיו קליין", phone: "050-3330006" },
  { name: "חן עמר", phone: "052-3330007" },
  { name: "טליה רוזנברג", phone: "054-3330008" },
  { name: "ינון שלום", phone: "058-3330009" },
  { name: "כרמל פרץ", phone: "053-3330010" },
];

const DAY = { label: "משמרת יום", startTime: "07:00", endTime: "19:00", type: "morning", color: SHIFT_TONES.morning };
const NIGHT = { label: "משמרת לילה", startTime: "19:00", endTime: "07:00", type: "night", color: SHIFT_TONES.night };

/**
 * Availability pattern, indexed by guard order and day index.
 * a = available, u = unavailable, m = maybe, ? = never submitted.
 * Two guards are left partially blank on purpose so the supervisor can see
 * how the engine treats "no answer" differently from "available".
 */
const PATTERN = {
  //         day:  0    1    2    3    4    5    6
  0: { day: ["a", "a", "a", "u", "a", "a", "m"], night: ["u", "a", "a", "u", "a", "m", "a"] },
  1: { day: ["a", "u", "a", "a", "a", "m", "a"], night: ["u", "u", "a", "a", "a", "a", "m"] },
  2: { day: ["m", "a", "a", "a", "u", "a", "a"], night: ["u", "a", "m", "a", "a", "a", "a"] },
  3: { day: ["a", "a", "u", "u", "u", "a", "a"], night: ["a", "a", "u", "u", "u", "a", "a"] },
  4: { day: ["a", "a", "a", "a", "a", "u", "u"], night: ["a", "m", "a", "a", "a", "u", "u"] },
  5: { day: ["?", "?", "a", "a", "a", "a", "?"], night: ["?", "?", "a", "a", "m", "a", "?"] },
};

const COMMENTS = {
  "3-2": "מילואים",
  "3-3": "מילואים",
  "3-4": "מילואים",
  "0-3": "אירוע משפחתי",
  "4-5": "חתונה של אחותי",
};

const STATUS = { a: "available", u: "unavailable", m: "maybe" };

// זמינות לשומרי הדגמה מעבר לששת הראשונים (שיש להם PATTERN ידני למעלה) —
// דטרמיניסטית, ומוגדרת ב-armyDemo.js כדי שגם בדיקת הכיסוי ב-Node תשתמש
// בדיוק באותו תמהיל.
const fallbackStatus = demoAvailabilityCode;

/**
 * מה שכבר יושב בצוות נקרא **מהשרת**, ולא רק ממה שהקורא מסר.
 *
 * `gs_create_team` אידמפוטנטית בכוונה: משתמש שכבר יש לו פרופיל מקבל בחזרה
 * את הצוות הקיים שלו במקום צוות חדש. לכן "פתח הדגמה" בפעם השנייה הגיע
 * לכאן עם צוות מלא ועם `existingGuards: []`, ניסה להכניס שוב את אותם שישה
 * שומרים, ונפל על `gs_profiles_one_name_per_team`. ההבטחה "safe to re-run"
 * הייתה תלויה בכך שכל קורא יזכור למסור את המצב — וזו הבטחה שאי אפשר
 * לקיים. עכשיו היא נכונה מעצם המבנה, ומשותפת לשני מסלולי ההדגמה
 * (seedDemoTeam הכללי ו-seedArmyRoster) כדי ששניהם לא יכפילו שומרים.
 */
/** תפקידי ההדגמה בצבא: סמל, מפקץ ו-4 מפקדי כיתה — לפי הסדר ברשימת החיילים. */
const ARMY_DEMO_ROLES = ["sergeant", "platoon", "squad", "squad", "squad", "squad"];
const ARMY_COMMAND_CATEGORIES = ["סיור", "כוננות"];

async function ensureDemoGuards(teamCode, existingGuards, guardCount, { withRoles = false } = {}) {
  const pool = DEMO_GUARDS.slice(0, Math.min(Math.max(guardCount, 1), DEMO_GUARDS.length));

  const { data: rosterData, error: rosterError } = await supabase
    .from("gs_profiles")
    .select("id, full_name")
    .eq("team_code", teamCode)
    .eq("role", "guard")
    .order("created_at");
  if (rosterError) throw new Error(`קריאת הצוות נכשלה: ${rosterError.message}`);

  const knownGuards = mergeById(
    existingGuards.map((g) => ({ id: g.id, name: g.name })),
    (rosterData || []).map((r) => ({ id: r.id, name: r.full_name }))
  );

  const have = new Set(knownGuards.map((g) => g.name.trim()));
  const toAdd = pool.filter((g) => !have.has(g.name));
  let guardRows = [];
  if (toAdd.length) {
    const { data, error } = await supabase
      .from("gs_profiles")
      .insert(toAdd.map((g) => ({
        full_name: g.name, phone: g.phone, role: "guard", team_code: teamCode,
      })))
      .select();
    if (error) throw new Error(`יצירת שומרי הדגמה נכשלה: ${error.message}`);
    guardRows = data || [];
  }

  const allGuards = [
    ...knownGuards.map((g) => ({ id: g.id, full_name: g.name })),
    ...guardRows.map((r) => ({ id: r.id, full_name: r.full_name })),
  ];

  // בצבא: ששת הראשונים הם בעלי התפקיד (סמל, מפקץ, ארבעה מפקדי כיתה), ומוגבלים לסיור ולכוננות —
  // בדרך כלל הם לא עושים שמירה או מטבח. כתיבה חוזרת בטוחה: אותו ערך על אותה שורה.
  if (withRoles) {
    const byName = new Map(allGuards.map((g) => [g.full_name.trim(), g.id]));
    await Promise.all(
      ARMY_DEMO_ROLES.map((role, i) => {
        const id = byName.get(DEMO_GUARDS[i]?.name);
        if (!id) return null;
        return supabase.from("gs_profiles").update({ duty_role: role, qualified_categories: ARMY_COMMAND_CATEGORIES }).eq("id", id);
      })
    );
  }

  return { allGuards, guardsAdded: guardRows.length };
}

/**
 * Seeds guards + next week's shifts + availability for a team.
 * Safe to re-run: it only adds what is missing.
 */
export async function seedDemoTeam({ teamCode, existingGuards = [], existingShifts = [], guardCount = 7 }) {
  const dates = weekByOffset(1);

  const [{ allGuards, guardsAdded }, weekRes] = await Promise.all([
    ensureDemoGuards(teamCode, existingGuards, guardCount),
    supabase
      .from("gs_work_items")
      .select(SHIFT_SELECT)
      .eq("team_code", teamCode)
      .eq("kind", "shift")
      .in("start_date", dates),
  ]);
  if (weekRes.error) throw new Error(`קריאת השבוע נכשלה: ${weekRes.error.message}`);

  const knownShifts = mergeById(existingShifts, (weekRes.data || []).map(shiftFromRow));

  // ---- shifts ----
  const alreadyCovered = new Set(knownShifts.map((s) => `${s.date}|${s.startTime}`));
  const shiftPayload = [];
  dates.forEach((date, i) => {
    for (const tpl of [DAY, NIGHT]) {
      if (alreadyCovered.has(`${date}|${tpl.startTime}`)) continue;
      shiftPayload.push({
        team_code: teamCode,
        date,
        label: tpl.label,
        start_time: tpl.startTime,
        end_time: tpl.endTime,
        type: tpl.type,
        color: tpl.color,
        location: "כניסה ראשית",
        required_guards: 1,
        is_demo: true,
      });
    }
  });

  let shiftRows = [];
  if (shiftPayload.length) {
    const { data, error } = await supabase
      .from("gs_work_items").insert(shiftPayload.map(shiftRowToWorkItem))
      .select(SHIFT_SELECT);
    if (error) throw new Error(`יצירת משמרות הדגמה נכשלה: ${error.message}`);
    shiftRows = data || [];
  }

  const shifts = [...knownShifts, ...shiftRows.map(shiftFromRow)];

  // ---- availability ----
  const byDate = new Map();
  for (const s of shifts) {
    if (!byDate.has(s.date)) byDate.set(s.date, {});
    byDate.get(s.date)[s.type === "night" ? "night" : "day"] = s;
  }

  const availRows = [];
  allGuards.forEach((guard, gi) => {
    const pattern = PATTERN[gi];
    dates.forEach((date, di) => {
      const slots = byDate.get(date);
      if (!slots) return;
      for (const kind of ["day", "night"]) {
        const shift = slots[kind];
        const code = pattern ? pattern[kind][di] : fallbackStatus(gi, di, kind);
        if (!shift || code === "?") continue;
        availRows.push({
          shift_id: shift.id,
          guard_id: guard.id,
          status: STATUS[code],
          comment: COMMENTS[`${gi}-${di}`] || null,
        });
      }
    });
  });

  if (availRows.length) {
    const { error } = await supabase
      .from("gs_availability").upsert(availRows, { onConflict: "shift_id,guard_id" });
    if (error) throw new Error(`הגשות זמינות ההדגמה נכשלו: ${error.message}`);
  }

  return {
    guardsAdded,
    shiftsAdded: shiftRows.length,
    availabilityAdded: availRows.length,
    weekStart: dates[0],
  };
}

// ============================================================
// הדגמת צבא — סד"כ מלא, לא שתי משמרות גנריות ליום.
//
// seedDemoTeam למעלה (הכללי) לא נוגע בצבא בכלל. המבנה עצמו — אילו עמדות,
// כמה משמרות, כמה חיילים בכל אחת — חי ב-armyDemo.js (טהור, נבדק ב-Node);
// כאן רק כותבים אותו לשרת.
// ============================================================

/**
 * מביא את עמדות הצוות למבנה ההדגמה (ר' planArmyDemoPositions). מחזיר את
 * העמדות הפעילות אחרי השינוי, ואת מזהי העמדות שהשתנו או כובו — שהמשמרות
 * שכבר מומשו מהן השבוע צריכות להיבנות מחדש.
 */
async function ensureArmyPositions(teamCode, existingPositions, { reconcile = false, soldiers } = {}) {
  const readActive = async () => {
    const { data, error } = await supabase
      .from("gs_positions")
      .select("*")
      .eq("team_code", teamCode)
      .eq("active", true);
    if (error) throw new Error(`קריאת עמדות הצוות נכשלה: ${error.message}`);
    return (data || []).map(positionFromRow);
  };

  const known = mergeById(existingPositions.filter((p) => p.active !== false), await readActive());
  const { insert, update, deactivate } = planArmyDemoPositions(known, { reconcile, soldiers });

  for (const { id, patch } of update) {
    const { data, error } = await supabase
      .from("gs_positions").update(positionToRow(patch, teamCode)).eq("id", id).select("id");
    if (error || !data?.length) throw new Error(`עדכון עמדת ההדגמה "${patch.title}" נכשל`);
  }
  if (deactivate.length) {
    const { error } = await supabase.from("gs_positions").update({ active: false }).in("id", deactivate).select("id");
    if (error) throw new Error(`כיבוי עמדות ההדגמה הישנות נכשל: ${error.message}`);
  }
  if (insert.length) {
    const { error } = await supabase
      .from("gs_positions")
      .insert(insert.map((p) => positionToRow({ ...p, shape: "template", active: true }, teamCode)))
      .select("id");
    if (error) throw new Error(`יצירת עמדות ההדגמה נכשלה: ${error.message}`);
  }

  const touched = update.length || deactivate.length || insert.length;
  return {
    allPositions: touched ? await readActive() : known,
    positionsAdded: insert.length,
    changedIds: new Set([...update.map((u) => u.id), ...deactivate]),
  };
}

/**
 * הדגמה מלאה למצב army: `guardCount` חיילים + מבנה העמדות של armyDemo.js
 * + זמינות דטרמיניסטית לכל המשמרות שמומשו מהן לשבוע הבא. Safe to re-run —
 * כל שלב מוסיף רק מה שחסר. `reconcile` (רק לצוות ההדגמה עצמו) מיישר גם
 * עמדות ישנות למבנה הנוכחי, ובונה מחדש את משמרות-ההדגמה של השבוע שלהן.
 */
export async function seedArmyRoster({
  teamCode, existingGuards = [], existingPositions = [], guardCount = ARMY_DEMO_SOLDIERS, reconcile = false,
}) {
  const dates = weekByOffset(1);
  const sundayISO = dates[0];

  const [{ allGuards, guardsAdded }, { allPositions, positionsAdded, changedIds }] = await Promise.all([
    ensureDemoGuards(teamCode, existingGuards, guardCount, { withRoles: true }),
    ensureArmyPositions(teamCode, existingPositions, { reconcile, soldiers: guardCount }),
  ]);

  // ---- מימוש המשמרות של השבוע מכל עמדה פעילה (כולן template — אין
  // weekly בהדגמה הזו, כל 24/7 מחולק). missingRowsForWeek דורשת realized
  // כדי לא לכפול שורות — שולפים אותה ממש כמו ensurePositionsForWeek. ----
  const { data: existingWorkItems, error: weekErr } = await supabase
    .from("gs_work_items")
    .select(SHIFT_SELECT)
    .eq("team_code", teamCode)
    .eq("kind", "shift")
    .in("start_date", dates);
  if (weekErr) throw new Error(`קריאת השבוע נכשלה: ${weekErr.message}`);
  let realizedShifts = (existingWorkItems || []).map(shiftFromRow);

  // משמרות-הדגמה של השבוע שנוצרו מעמדה שהשתנתה או כובתה עכשיו — נמחקות
  // ונבנות מחדש מהעמדה המעודכנת למטה. רק isDemo: משמרת שמפקד יצר בעצמו
  // לא נמחקת אף פעם. שיבוצים וזמינות שלהן נמחקים איתן (cascade).
  const stale = realizedShifts.filter((s) => s.isDemo && changedIds.has(s.positionId)).map((s) => s.id);
  if (stale.length) {
    const { error } = await supabase.from("gs_work_items").delete().in("id", stale).select("id");
    if (error) throw new Error(`ניקוי משמרות ההדגמה הישנות נכשל: ${error.message}`);
    const gone = new Set(stale);
    realizedShifts = realizedShifts.filter((s) => !gone.has(s.id));
  }

  const missing = allPositions
    .filter((p) => p.active && p.shape === "template")
    .flatMap((p) => missingRowsForWeek(p, sundayISO, realizedShifts));

  let shiftRows = [];
  if (missing.length) {
    const { data, error } = await supabase
      .from("gs_work_items")
      .upsert(
        missing.map((r) => shiftRowToWorkItem(positionPlanToShiftRow(r, teamCode))),
        { onConflict: "position_id,start_date", ignoreDuplicates: true }
      )
      .select(SHIFT_SELECT);
    if (error) throw new Error(`מימוש משמרות ההדגמה נכשל: ${error.message}`);
    shiftRows = data || [];
  }

  const shifts = [...realizedShifts, ...shiftRows.map(shiftFromRow)];

  // ---- זמינות: כל חייל/ת מול כל משמרת שקיימת בשבוע, יחס דטרמיניסטי
  // זהה ל-fallbackStatus הכללי (fallbackStatus(gi, di, kind))— כאן אין
  // "day"/"night" בינארי כמו בהדגמה הכללית, אז הדירוג נגזר מאינדקס
  // המשמרת בתוך היום במקום, עדיין בלי Math.random. ----
  const byDate = new Map();
  for (const s of shifts) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 30 חיילים × ~97 תורנויות ≈ 2,900 שורות. כ-JSON זה ~600KB, ובהעלאה איטית
  // ההדגמה חיכתה עליהן עשרות שניות. במקום זה: אות אחת לכל חייל×תורנות
  // (~10KB), והשרת פורש אותה לשורות (gs_seed_availability, מיגרציה 0030 —
  // עם אותן הרשאות RLS כמו כתיבה רגילה).
  const ordered = dates.flatMap((date) => byDate.get(date) || []);
  const position = new Map();
  dates.forEach((date, di) => (byDate.get(date) || []).forEach((shift, si) => position.set(shift.id, { di, si })));
  const codes = allGuards
    .map((_, gi) =>
      ordered
        .map((shift) => {
          const { di, si } = position.get(shift.id);
          return fallbackStatus(gi, di * 5 + si, si % 2 === 0 ? "day" : "night");
        })
        .join("")
    )
    .join("");

  let availabilityAdded = 0;
  if (ordered.length && allGuards.length) {
    const { data, error } = await supabase.rpc("gs_seed_availability", {
      p_shift_ids: ordered.map((s) => s.id),
      p_guard_ids: allGuards.map((g) => g.id),
      p_codes: codes,
    });
    if (error) throw new Error(`הגשות זמינות ההדגמה נכשלו: ${error.message}`);
    availabilityAdded = data ?? 0;
  }

  return {
    guardsAdded,
    positionsAdded,
    shiftsAdded: shiftRows.length,
    availabilityAdded,
    weekStart: sundayISO,
  };
}

/**
 * plannedRowsForWeek-style שורה (מ-missingRowsForWeek) → payload ל-shiftRowToWorkItem,
 * באותה צורה בדיוק ש-materializeTemplateShifts (api.js) מצפה לה.
 */
function positionPlanToShiftRow(row, teamCode) {
  return {
    team_code: teamCode,
    date: row.date,
    label: row.label,
    start_time: row.startTime,
    end_time: row.endTime,
    // המיקום הוא העמדה עצמה ("עמדת שמירה 1"), לא "כניסה ראשית" לכולן —
    // אחרת חייל לא יכול לדעת לאן ללכת בלי לנחש.
    location: String(row.label || "").split(" – ")[0] || "כניסה ראשית",
    required_guards: row.requiredGuards || 1,
    category: row.category || null,
    position_id: row.positionId,
    type: "custom",
    published: false,
    is_demo: true,
  };
}

/** איחוד לפי מזהה, כשהראשון מנצח. שומר על סדר יציב. */
function mergeById(primary, extra) {
  const seen = new Set(primary.map((x) => x.id));
  return [...primary, ...extra.filter((x) => !seen.has(x.id))];
}

/**
 * מזהי משמרות-הדגמה של שבוע מסוים (Phase 11, INLINE-03).
 *
 * "שיבוץ הדגמה" נגזר מ-`isDemo` על שורת gs_work_items עצמה, לא דגל נפרד
 * (11-CONTEXT.md open_questions מס' 2) — ה-cascade הקיים על
 * gs_work_item_assignments/gs_availability/gs_swap_requests כבר מנקה
 * שיבוצים/זמינות/בקשות-החלפה בחינם ברגע ששורת ה-gs_work_items הזו נמחקת,
 * בלי צורך לגעת בטבלאות האלה ישירות.
 */
export function demoShiftIdsForWeek(shifts, weekDates) {
  const weekSet = new Set(weekDates);
  return shifts.filter((s) => s.isDemo && weekSet.has(s.date)).map((s) => s.id);
}
