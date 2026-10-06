// ============================================================
// איפה היומן נפתח — טהור, כדי שנבדק ב-Node ישירות.
// ============================================================

import { startOfWeek, todayISO } from "./dates.js";

/**
 * היומן נפתח על השבוע שהמפקד עובד עליו: השבוע הנוכחי אם יש בו משמרות, אחרת
 * הקרוב שיש בו, ואם אין קדימה — האחרון שהיה. בלי זה הוא נפתח על גריד ריק
 * של השבוע הזה בזמן שהשבוע הבא כבר נבנה.
 * @returns {string} תאריך ISO
 */
export function initialCursor(shifts = [], today = todayISO()) {
  const dates = shifts.map((s) => s.date).filter(Boolean).sort();
  if (!dates.length) return today;
  const thisWeek = startOfWeek(today);
  if (dates.some((d) => startOfWeek(d) === thisWeek)) return today;
  const next = dates.find((d) => d >= today);
  return next || dates[dates.length - 1];
}
