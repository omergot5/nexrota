// ============================================================
// מצב השבוע לדף הבקרה — טהור (בלי React ובלי רשת), כדי שנבדק ב-Node ישירות.
//
// השאלה שהמפקד פותח את האפליקציה כדי לענות עליה: "איפה השבוע שלי עומד, ומה
// הדבר הבא שצריך לעשות". לכן כאן שלושה מספרים שהם שלבי השבוע עצמם — מי דיווח,
// כמה מהמקומות מאוישים, כמה פורסם — ועוד צעד אחד מומלץ.
//
// כל מספר נגזר מאותה הגדרה שהמסך שבו עובדים משתמש בה: "הגיש" כמו ב-reminders,
// "יום" כמו בגריד השבועי (opDayOf), כך שדף הבקרה לא יכול לסתור את בניית השבוע.
// ============================================================

import { guardsWhoHaveNotReported } from "./reminders.js";
import { isAfterMidnight, opDayOf, orderShiftsByPost } from "./postWeek.js";

/**
 * @returns {{
 *   shiftCount: number,
 *   reported: {done: number, total: number},
 *   slots: {filled: number, need: number, assigned: number},
 *   published: {done: number, total: number},
 *   next: {id: "shifts"|"availability"|"smart"|"schedule"|"done", label: string},
 * }}
 */
export function weekStatus({ shifts = [], guards = [], availability = {}, weekDates = [], operationalDay = true }) {
  const inWeek = new Set(weekDates);
  const dayOf = operationalDay ? opDayOf : (s) => s.date;
  const week = shifts.filter((s) => inWeek.has(dayOf(s)));

  let need = 0;
  let filled = 0;
  let assigned = 0;
  for (const s of week) {
    const req = Math.max(1, s.requiredGuards || 1);
    const have = (s.assignedGuards || []).length;
    need += req;
    filled += Math.min(req, have);
    assigned += have;
  }

  const notReported = guardsWhoHaveNotReported({ guards, shifts: week, availability, weekDates: week.map((s) => s.date) });
  const reported = { done: guards.length - notReported.length, total: guards.length };
  const published = { done: week.filter((s) => s.published).length, total: week.length };

  let next;
  if (!week.length) next = { id: "shifts", label: "להגדיר את משמרות השבוע" };
  else if (assigned === 0 && reported.done < reported.total) {
    const n = reported.total - reported.done;
    next = { id: "availability", label: n === 1 ? "לתזכר את מי שעוד לא דיווח" : `לתזכר ${n} שעוד לא דיווחו` };
  } else if (filled < need) next = { id: "smart", label: assigned === 0 ? "לבנות את הסידור" : "להשלים את השיבוץ" };
  else if (published.done < published.total) next = { id: "schedule", label: "לפרסם את הסידור" };
  else next = { id: "done", label: "הכול מוכן" };

  return { shiftCount: week.length, reported, slots: { filled, need, assigned }, published, next };
}

/**
 * היום שהדף מציג "מי על מה": היום המבצעי של היום אם יש בו משמרות, אחרת היום
 * הקרוב שיש בו. כך בערב שלפני שבוע חדש הדף לא מציג "אין כלום" בזמן שהשבוע
 * כבר בנוי. יום שכל מה שיש בו הוא לילה אחרי חצות (הזנב של השבוע הקודם) לא נחשב
 * "הקרוב" — אלא אם זה היום עצמו.
 * @returns {{date: string, isToday: boolean, shifts: object[]}|null} משמרות לפי עמדה ושעה
 */
export function focusDay({ shifts = [], today, mode = "army" }) {
  const days = [...new Set(shifts.filter((s) => opDayOf(s) === today || !isAfterMidnight(s.startTime)).map(opDayOf))]
    .filter((d) => d >= today)
    .sort();
  const date = days[0];
  if (!date) return null;
  return {
    date,
    isToday: date === today,
    shifts: orderShiftsByPost(shifts.filter((s) => opDayOf(s) === date), mode),
  };
}
