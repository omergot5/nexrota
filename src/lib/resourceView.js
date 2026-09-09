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

import { boardItemsForDates } from "./dates.js";
import { folderIcon, foldersFor, UNFILED } from "./categories.js";

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

  const byCategory = new Map();
  for (const day of days) {
    const pool = [...day.timed, ...day.timeless];
    for (const item of pool) {
      const category = item.category || UNFILED;
      if (!byCategory.has(category)) byCategory.set(category, new Map());
      const byDate = byCategory.get(category);
      if (!byDate.has(day.date)) byDate.set(day.date, []);
      byDate.get(day.date).push(item);
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
