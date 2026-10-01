// ============================================================
// המרה ל-אירועי react-big-calendar (RBC-01).
//
// לא בונה מיזוג חדש: `boardItemsForDates` (Phase 5, BOARD-01) כבר פותר
// "אילו פריטים חלים על היום הזה", כולל timeless/engine-eligible — הפונקציה
// כאן רק ממירה את הפלט שלו לצורה ש-RBC דורש (Date אמיתי, לא ISO string).
//
// פריט עם שעה (`timed`) הופך לאירוע רגיל, ממוקם על ציר השעות לפי
// `shiftInterval` (dates.js) — אותו חישוב midnight-wrap בדיוק שהמנוע
// עצמו נשען עליו. משמרת שחוצה חצות (19:00–07:00) מתפצלת כאן לשני אירועים
// — אחד בעמודת היום שמתחיל (19:00 עד סוף היום) ואחד בעמודת היום שאחריו
// (תחילת היום עד 07:00) — כי RBC מקדם כל אירוע שחוצה יום-לוח לשורת
// ה-all-day, בלי קשר לכמה שעות הוא נמשך בפועל; בלי הפיצול, משמרת לילה
// הייתה נוחתת כפס עליון מחוץ לציר השעות במקום על השעה האמיתית שלה —
// בדיוק הבאג שדווח חי. אותו רעיון בדיוק ש-Google Calendar עצמו מיישם
// לאירועים חוצי-חצות. פריט timeless (משימה בלי שעות) נשאר `allDay: true`
// כרגיל — הפיצול חל רק על פריטים עם שעה אמיתית.
// ============================================================

import { boardItemsForDates, fromISODate, shiftInterval } from "./dates.js";

function timedEvent(item, start, end, extra = {}) {
  return {
    id: item.id,
    title: item.label,
    start,
    end,
    allDay: false,
    resource: {
      category: item.category || "",
      type: item.type,
      assignedGuards: item.assignedGuards || [],
      requiredGuards: item.requiredGuards ?? null,
      timeless: false,
      raw: item,
      ...extra,
    },
  };
}

/**
 * `{ id, title, start, end, allDay, resource: { category, type, assignedGuards, requiredGuards, timeless, continuesAfter?, continuesBefore?, raw } }[]`
 *
 * הסדר תואם ל-`boardItemsForDates`: לפי יום (סדר `dates`), ובתוך יום —
 * timeless לפני timed, ואז לפי `startTime`/מזהה — אותו סדר קבוע כמו
 * UnifiedBoard/CalendarView, כדי שלא ייווצר סדר רביעי לאותם פריטים בדיוק.
 * פריט חוצה-חצות מייצר שני רשומות רצופות במקום אחת (`id` משותף, `start`
 * שונה) — לא שני `id` שונים, כדי שקריאה חוזרת עדיין תזהה את שניהם כאותה
 * משמרת בפועל.
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
      const startDate = new Date(start);
      const endDate = new Date(end);

      const midnight = new Date(startDate);
      midnight.setHours(24, 0, 0, 0); // חצות שאחרי יום ההתחלה, בדיוק

      if (endDate.getTime() <= midnight.getTime()) {
        events.push(timedEvent(item, startDate, endDate));
        continue;
      }

      const endOfStartDay = new Date(midnight.getTime() - 1); // 23:59:59.999
      events.push(timedEvent(item, startDate, endOfStartDay, { continuesAfter: true }));
      events.push(timedEvent(item, midnight, endDate, { continuesBefore: true }));
    }
  }

  return events;
}
