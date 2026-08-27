// ============================================================
// עמדות קבועות — מודול טהור (Phase 4).
//
// בלי React, בלי Supabase, בלי ייבוא מ-api.js. זהות שורה שבועית היא הצמד
// (positionId, date) בלבד, ונגזרת אך ורק משני ארגומנטים: `position.id`
// ו-`sundayISO` שהועבר לפונקציה. הקובץ הזה לעולם אינו קורא Date.now(),
// new Date() או Math.random() — כל תלות בשעון הקיר של תהליך ההרצה חייבת
// להיכנס כארגומנט מבחוץ, כדי ש-POS-03/POS-04 יהיו אמת גם כשההרצה חוזרת
// באלף סדר קלט שונה (04-RESEARCH.md, Pitfall 1).
//
// שתי צורות עמדה (D-01), הכרעת Task 1 (04-01-SUMMARY.md):
//   template — יום/שעה קבועים. מתממש כשורות gs_shifts, אחת לכל תאריך
//     שבו weekdays נופל בשבוע. תאריך הזהות הוא date עצמו.
//   weekly   — עמדה שחלה על השבוע כולו בלי שעות. מתממשת כשורת gs_tasks
//     אחת: startDate = יום ראשון של השבוע, dueDate = יום שבת שלו. תאריך
//     הזהות הוא dueDate (יום שבת) — נגזר אך ורק מ-sundayISO, ולכן דטרמיניסטי
//     בדיוק כמו הצורה השנייה.
//
// כל מיון בקובץ הזה מפורש (localeCompare) — לעולם לא סדר ההגעה של מערך
// שחזר מ-Postgres (Pitfall 1).
// ============================================================

import { weekFrom, fromISODate, addDays } from "./dates.js";
import { isQualified } from "./autoAssign.js";

/**
 * תאריכי הזהות של העמדה בשבוע שמתחיל ב-sundayISO.
 *
 * template: כל תאריך בשבוע שיום השבוע שלו (Date.getDay()) נמצא ב-weekdays.
 * weekly: מערך בעל איבר יחיד — יום שבת של השבוע, addDays(sundayISO, 6).
 */
export function expectedDatesForWeek(position, sundayISO) {
  if (position?.shape === "weekly") return [addDays(sundayISO, 6)];
  const days = new Set(position?.weekdays || []);
  return weekFrom(sundayISO).filter((d) => days.has(fromISODate(d).getDay()));
}

/**
 * שורות האפליקציה (camelCase) שהעמדה אמורה לייצר בשבוע הזה — מוכנות
 * למיפוי דרך shiftToRow/taskColumns, לפני שנבדק מה כבר קיים.
 */
export function plannedRowsForWeek(position, sundayISO) {
  const dates = expectedDatesForWeek(position, sundayISO);

  if (position?.shape === "weekly") {
    return [
      {
        positionId: position.id,
        title: position.title,
        category: position.category,
        startDate: sundayISO,
        dueDate: dates[0],
        startTime: null,
        endTime: null,
        assignees: [],
        priority: "medium",
      },
    ];
  }

  return dates.map((date) => ({
    positionId: position.id,
    date,
    label: position.title,
    startTime: position.startTime,
    endTime: position.endTime,
    requiredGuards: position.requiredGuards || 1,
    category: position.category,
    type: "custom",
    published: false,
  }));
}

/**
 * מסנן מ-plannedRowsForWeek כל שורה שתאריך הזהות שלה כבר קיים ב-realized
 * **עבור אותו positionId** — עמדה אחרת על אותו תאריך אינה מדכאת שורה
 * (POS-04). זה מה שהופך קריאה שנייה על שבוע שכבר מומש למערך ריק, בלי שום
 * כתיבה, בלי תלות בסדר שבו realized הגיע.
 */
export function missingRowsForWeek(position, sundayISO, realized = []) {
  const planned = plannedRowsForWeek(position, sundayISO);
  const existingDates = new Set(
    (realized || [])
      .filter((row) => row.positionId === position.id)
      .map((row) => row.date || row.dueDate)
  );
  return planned.filter((row) => !existingDates.has(row.date || row.dueDate));
}

/**
 * מי כשיר לעמדה — גזירה טהורה מעל isQualified() הקיים (D-04, POS-02),
 * ללא שינוי בו וללא כתיבה חדשה: שיוך אדם לעמדה אינו כתיבה, הוא הימצאות
 * category העמדה ברשימת qualifiedCategories של האדם.
 */
export function qualifiedGuardsForPosition(position, guards = []) {
  return guards.filter((g) => isQualified(g, position?.category));
}

/**
 * מי עובד השבוע בפועל בעמדה — איחוד ממוין לקסיקוגרפית של assignedGuards
 * משורות gs_shifts ו-assignees משורות gs_tasks שנושאות positionId זה
 * ותאריך זהות בתוך השבוע. נגזר משדה שונה לגמרי מ-qualifiedGuardsForPosition
 * (POS-05): שתי הרשימות לעולם אינן יכולות להתלכד כי אחת קוראת qualifiedCategories
 * והשנייה קוראת assignedGuards/assignees.
 */
export function workingGuardIdsForWeek(position, { shifts = [], tasks = [] } = {}, sundayISO) {
  const week = new Set(weekFrom(sundayISO));

  const fromShifts = (shifts || [])
    .filter((s) => s.positionId === position.id && week.has(s.date))
    .flatMap((s) => s.assignedGuards || []);

  const fromTasks = (tasks || [])
    .filter((t) => t.positionId === position.id && week.has(t.dueDate || t.startDate))
    .flatMap((t) => t.assignees || []);

  return [...new Set([...fromShifts, ...fromTasks])].sort((a, b) => String(a).localeCompare(String(b)));
}
