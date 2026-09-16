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
import { buildDivisionRows, missingRowsForWeek } from "./positions.js";

// 7 הראשונים שומרים על הדפוס הידני המקורי (PATTERN למטה) — קנה מידה
// שממחיש חלוקה-לא-1:1 (יותר תקנים מאנשים) בלי לרוקן את הדוגמה לשישה
// אנשים. מעבר לשבעה, שם הצוות (פלוגה/מחלקה אמיתית) גדול הרבה יותר
// (15-25 איש) — אז המאגר הורחב ל-20 כדי ש-`guardCount` יוכל לבקש
// גם 14/15/20 בלי לייצר שמות גנריים ("שומר 8"). מ-8 ומעלה אין PATTERN
// ידני — `fallbackStatus` (למטה) כבר מכסה אותם דטרמיניסטית.
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

/**
 * זמינות לשומרי הדגמה מעבר לששת הראשונים (שיש להם PATTERN ידני
 * למעלה) — דטרמיניסטית וקבועה בין הרצות, לא Math.random. תמהיל גס
 * (כ-10% לא-זמין, 20% אולי, השאר זמין) שמספיק כדי שהשיבוץ החכם יהיה
 * לו על מה להתלבט, בלי להקליד דפוס יד לכל שומר/ת נוסף/ת.
 */
function fallbackStatus(gi, di, kind) {
  const seed = (gi * 7 + di * 3 + (kind === "night" ? 1 : 0)) % 10;
  if (seed === 0) return "u";
  if (seed === 1 || seed === 2) return "m";
  return "a";
}

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
async function ensureDemoGuards(teamCode, existingGuards, guardCount) {
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

  return {
    allGuards: [
      ...knownGuards.map((g) => ({ id: g.id, full_name: g.name })),
      ...guardRows.map((r) => ({ id: r.id, full_name: r.full_name })),
    ],
    guardsAdded: guardRows.length,
  };
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
// seedDemoTeam למעלה (הכללי, גם למסלול האורח האנונימי) נשאר בדיוק כמו
// שהיה — הוא לא נוגע בצבא בכלל. הפונקציה הזו היא הרחבה נפרדת: מבקש
// שהדגמה במצב army תיתן תמונה אמיתית של "כמעט-שבוע-שלם" — חמש
// משימות בדיוק כמו שאשף בניית הסד"כ (RosterWizard) היה בונה ידנית,
// כולל שתי עמדות 24/7 שמחולקות למשמרות (לא "עמדה" יחידה בלי שעות),
// כדי שמפקד שלוחץ "מלא לי נתוני הדגמה" יראה מיד את התמונה המלאה שהוא
// עצמו יבנה בפועל — לא דוגמה ממוזערת.
// ============================================================

/** חמש הקטגוריות הקבועות של RosterWizard — לא עמדות 24/7, שעות רגילות. */
const ARMY_FIXED_POSITIONS = [
  { title: "סיור", category: "סיור", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "06:00", endTime: "18:00" },
  { title: "כוננות", category: "כוננות", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "18:00", endTime: "06:00" },
  { title: "תורנות מטבח", category: "תורנות מטבח", weekdays: [0, 1, 2, 3, 4, 5], startTime: "05:30", endTime: "13:30" },
];

// שתי עמדות שמירה, שתיהן 24/7 ומחולקות ל-3 משמרות של 8 שעות — בדיוק
// האופציה ש-RosterWizard מציע ("לכמה שעות לחלק כל שמירה?"), לא עמדת
// weekly רציפה בלי שעות: מפקד שמסתכל על ההדגמה אמור לראות איך חלוקה
// נראית בפועל, כי זו הדרך שרוב הצוותים באמת מאיישים עמדת שמירה קבועה.
const ARMY_GUARD_POSTS = ["עמדת שמירה 1", "עמדת שמירה 2"];
const ARMY_GUARD_POST_DIVISION_HOURS = 8;

/**
 * בונה את חמש המשימות הקבועות (כולל שתי עמדות השמירה, כל אחת מחולקת
 * ל-3 משמרות) עבור צוות army — רק את מה שחסר, לפי כותרת. מחזיר את כל
 * העמדות הפעילות של הצוות (קיימות + חדשות), כמו allGuards ב-ensureDemoGuards.
 */
async function ensureArmyPositions(teamCode, existingPositions) {
  const { data: rows, error } = await supabase
    .from("gs_positions")
    .select("*")
    .eq("team_code", teamCode)
    .eq("active", true);
  if (error) throw new Error(`קריאת עמדות הצוות נכשלה: ${error.message}`);

  const known = mergeById(existingPositions, (rows || []).map(positionFromRow));
  const haveTitles = new Set(known.map((p) => p.title));

  const planned = [
    ...ARMY_FIXED_POSITIONS,
    ...ARMY_GUARD_POSTS.flatMap((title) =>
      buildDivisionRows(title, ARMY_GUARD_POST_DIVISION_HOURS).map((row) => ({
        ...row,
        category: "תורנות שמירה",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      }))
    ),
  ].filter((p) => !haveTitles.has(p.title));

  let created = [];
  if (planned.length) {
    const { data, error: insErr } = await supabase
      .from("gs_positions")
      .insert(planned.map((p) => positionToRow({ ...p, shape: "template", requiredGuards: 1, active: true }, teamCode)))
      .select();
    if (insErr) throw new Error(`יצירת עמדות ההדגמה נכשלה: ${insErr.message}`);
    created = (data || []).map(positionFromRow);
  }

  return { allPositions: [...known, ...created], positionsAdded: created.length };
}

/**
 * הדגמה מלאה למצב army: `guardCount` כפופים (7/14/15/20) + חמש המשימות
 * הקבועות (כולל שתי עמדות 24/7 מחולקות) + זמינות דטרמיניסטית לכל
 * המשמרות שמומשו מהן לשבוע הבא. Safe to re-run — כל שלב מוסיף רק מה
 * שחסר, באותו אופן בדיוק כמו seedDemoTeam.
 */
export async function seedArmyRoster({ teamCode, existingGuards = [], existingPositions = [], guardCount = 20 }) {
  const dates = weekByOffset(1);
  const sundayISO = dates[0];

  const [{ allGuards, guardsAdded }, { allPositions, positionsAdded }] = await Promise.all([
    ensureDemoGuards(teamCode, existingGuards, guardCount),
    ensureArmyPositions(teamCode, existingPositions),
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
  const realizedShifts = (existingWorkItems || []).map(shiftFromRow);

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

  // ---- זמינות: כל כפוף/ה מול כל משמרת שקיימת בשבוע, יחס דטרמיניסטי
  // זהה ל-fallbackStatus הכללי (fallbackStatus(gi, di, kind))— כאן אין
  // "day"/"night" בינארי כמו בהדגמה הכללית, אז הדירוג נגזר מאינדקס
  // המשמרת בתוך היום במקום, עדיין בלי Math.random. ----
  const byDate = new Map();
  for (const s of shifts) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const availRows = [];
  allGuards.forEach((guard, gi) => {
    dates.forEach((date, di) => {
      const daily = byDate.get(date) || [];
      daily.forEach((shift, si) => {
        const code = fallbackStatus(gi, di * 5 + si, si % 2 === 0 ? "day" : "night");
        if (code === "?") return;
        availRows.push({ shift_id: shift.id, guard_id: guard.id, status: STATUS[code], comment: null });
      });
    });
  });

  if (availRows.length) {
    const { error } = await supabase
      .from("gs_availability").upsert(availRows, { onConflict: "shift_id,guard_id" });
    if (error) throw new Error(`הגשות זמינות ההדגמה נכשלו: ${error.message}`);
  }

  return {
    guardsAdded,
    positionsAdded,
    shiftsAdded: shiftRows.length,
    availabilityAdded: availRows.length,
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
    location: "כניסה ראשית",
    required_guards: row.requiredGuards || 1,
    category: row.category || null,
    position_id: row.positionId,
    type: "custom",
    published: false,
  };
}

/** איחוד לפי מזהה, כשהראשון מנצח. שומר על סדר יציב. */
function mergeById(primary, extra) {
  const seen = new Set(primary.map((x) => x.id));
  return [...primary, ...extra.filter((x) => !seen.has(x.id))];
}
