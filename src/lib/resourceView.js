// ============================================================
// מבט-משאבים שבועי (Resource View) — מנוע טהור, בלי React.
//
// היפוך של UnifiedBoard/CalendarView: שם השורה היא היום והעמודה היא
// הפריט; כאן השורה היא הקטגוריה (עמדה/סוג משימה) והעמודה היא היום — מבט
// אחד שבו מפקד רואה בו-זמנית מי מאייש כל עמדה בכל יום בשבוע, בלי לפתוח
// שבע לשוניות.
//
// לא בונה מיזוג חדש: `boardItemsForDates` (dates.js, Phase 5, BOARD-01)
// כבר פותר "אילו פריטים (משמרות+משימות) חלים על היום הזה", כולל את כל
// כללי ה-timeless/engine-eligible. הפונקציה כאן רק *מפַנה* (pivot) את
// הפלט שלו לפי קטגוריה במקום לפי תאריך — שני נתיבי קוד שממזגים לבד היו
// בדיוק הסיכון שדטרמיניזם ייסחף (03-RESEARCH.md, Pitfall 8).
// ============================================================

import { addDays, boardItemsForDates, shiftInterval } from "./dates.js";
import { folderIcon, foldersFor, UNFILED } from "./categories.js";

/**
 * האם פריט timed חוצה חצות (למשל 23:00–07:00) — אותו חישוב בדיוק
 * ש-`calendarEvents.js` מפעיל כדי לפצל אירוע ל-RBC. כאן התוצאה לא
 * מפוצלת לשני אירועים אלא רק קובעת אם להוסיף עותק-המשך בעמודת היום שאחרי.
 */
function crossesMidnight(item) {
  if (!item.startTime) return false; // timeless — אין חצייה
  const { start, end } = shiftInterval(item);
  const midnight = new Date(start);
  midnight.setHours(24, 0, 0, 0);
  return new Date(end).getTime() > midnight.getTime();
}

/**
 * `{ category, icon, days: [{ date, items: [...] }] }[]` — שורה אחת לכל
 * קטגוריה שבפועל יש לה משמרת/משימה בשבוע הזה (לא רשימת הצעה — קיבוץ של
 * שורות אמיתיות, כמו `folders` ב-TaskMgmt, לא `categoryOptions`). סדר
 * השורות: קודם התיקיות המוצעות של התחום לפי סדרן, ואחריהן כל קטגוריה
 * מותאמת-אישית לפי א"ב — אותו כלל סדר בדיוק כמו TaskMgmt/categoryOptions,
 * כדי שמפקד לא יראה שלוש רשימות שמסדרות את אותן קטגוריות בשלושה סדרים.
 *
 * `items` בכל תא ממוינים לפי שעת התחלה ואז מזהה — אותו מפתח מיון בדיוק
 * שבו `boardItemsForDates` כבר ממיין בתוך `timed`, כדי שלא ייווצר סדר
 * שלישי. פריט timeless (משימה בלי שעות) תמיד נופל אחרי כל הפריטים בעלי
 * שעה, כי `startTime` הריק שלו ממוין ראשון לקסיקוגרפית — אז הוא ממוקם
 * מחדש בסוף במפורש.
 */
export function buildResourceRows({ shifts = [], tasks = [], weekDates = [], mode = "security" } = {}) {
  const { days } = boardItemsForDates(shifts, tasks, weekDates);

  const dateSet = new Set(weekDates);
  const byCategory = new Map();
  const place = (category, date, item) => {
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const byDate = byCategory.get(category);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(item);
  };
  for (const day of days) {
    const pool = [...day.timed, ...day.timeless];
    for (const item of pool) {
      const category = item.category || UNFILED;
      place(category, day.date, item);
      // משמרת חוצה-חצות (19:00–07:00) ממשיכה גם בעמודת היום שאחריה —
      // אותה תפיסה ש-`calendarEvents.js` מיישם בפיצול ל-RBC, כדי
      // שמבט-המשאבים לא "יבלע" את חצי המשמרת שאחרי חצות.
      if (crossesMidnight(item)) {
        const nextDate = addDays(day.date, 1);
        // startTime מוחלף ל-00:00: העותק הזה מייצג רק את חצי-שאחרי-חצות
        // (endTime המקורי כבר נכון — המשמרת עדיין נגמרת באותה שעה). בלי
        // זה התא היה מציג את השעה המקורית (למשל "19:00–07:00") גם ביום
        // שאחרי, כאילו יש שם משמרת-לילה שלמה נוספת — ומתמיין בטעות בין
        // הפריטים המאוחרים של אותו יום במקום ראשון (00:00), כי המיון
        // למטה ממוין לפי startTime.
        if (dateSet.has(nextDate)) place(category, nextDate, { ...item, startTime: "00:00", continuesBefore: true });
      }
    }
  }

  const known = foldersFor(mode).map((f) => f.name);
  const used = [...byCategory.keys()];
  const custom = used.filter((n) => !known.includes(n)).sort();
  const order = [...known.filter((n) => byCategory.has(n)), ...custom];

  return order.map((category) => {
    const byDate = byCategory.get(category);
    return {
      category,
      icon: folderIcon(category),
      days: weekDates.map((date) => {
        const items = (byDate.get(date) || [])
          .slice()
          .sort((a, b) => {
            const at = a.startTime || "￿"; // timeless תמיד בסוף
            const bt = b.startTime || "￿";
            return at.localeCompare(bt) || String(a.id).localeCompare(String(b.id));
          });
        return { date, items };
      }),
    };
  });
}
