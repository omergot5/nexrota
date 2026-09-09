// ============================================================
// המרה ל-אירועי react-big-calendar (RBC-01).
//
// לא בונה מיזוג חדש: `boardItemsForDates` (Phase 5, BOARD-01) כבר פותר
// "אילו פריטים חלים על היום הזה", כולל timeless/engine-eligible — הפונקציה
// כאן רק ממירה את הפלט שלו לצורה ש-RBC דורש (Date אמיתי, לא ISO string).
//
// פריט עם שעה (`timed`) הופך לאירוע רגיל, ממוקם על ציר השעות לפי
// `shiftInterval` (dates.js) — אותו חישוב midnight-wrap בדיוק שהמנוע
// עצמו נשען עליו, כדי שמשמרת 19:00–07:00 תיפרש נכון גם כאן. פריט timeless
// (משימה בלי שעות, או שורת עמדה שבועית) הופך ל-`allDay: true` — שורת
// הכותרת של RBC, לא נעלם בשקט כמו שהמסמך של Phase 5 מזהיר.
// ============================================================

import { boardItemsForDates, fromISODate, shiftInterval } from "./dates.js";

/**
 * `{ id, title, start, end, allDay, resource: { category, type, assignedGuards, requiredGuards, timeless, raw } }[]`
 *
 * הסדר תואם ל-`boardItemsForDates`: לפי יום (סדר `dates`), ובתוך יום —
 * timeless לפני timed, ואז לפי `startTime`/מזהה — אותו סדר קבוע כמו
 * UnifiedBoard/CalendarView, כדי שלא ייווצר סדר רביעי לאותם פריטים בדיוק.
 */
export function toCalendarEvents({ shifts = [], tasks = [], dates = [] } = {}) {
  const { days } = boardItemsForDates(shifts, tasks, dates);
  const events = [];

  for (const day of days) {
    for (const item of day.timeless) {
      const dayStart = fromISODate(item.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = fromISODate(item.date);
      dayEnd.setHours(23, 59, 59, 999);
      events.push({
        id: item.id,
        title: item.label,
        start: dayStart,
        end: dayEnd,
        allDay: true,
        resource: {
          category: item.category || "",
          type: item.type,
          assignedGuards: item.assignedGuards || [],
          requiredGuards: null,
          timeless: true,
          raw: item,
        },
      });
    }
    for (const item of day.timed) {
      const { start, end } = shiftInterval(item);
      events.push({
        id: item.id,
        title: item.label,
        start: new Date(start),
        end: new Date(end),
        allDay: false,
        resource: {
          category: item.category || "",
          type: item.type,
          assignedGuards: item.assignedGuards || [],
          requiredGuards: item.requiredGuards ?? null,
          timeless: false,
          raw: item,
        },
      });
    }
  }

  return events;
}
