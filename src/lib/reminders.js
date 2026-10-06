// ============================================================
// תזכורת הגשת זמינות — מנוע טהור (בלי React ובלי רשת).
//
// שני דברים נבנים כאן, ושניהם נגזרים מאותו מקור (availStatus), כדי שהמסך של
// המפקד ("מי דיווח") והבאנר אצל החייל לא יוכלו לחלוק על מי עוד חייב להגיש:
//   1. כמה משמרות נשארו ללא מענה אצל חייל אחד — הבאנר אצלו.
//   2. ההודעה לוואטסאפ — למי שלא הגיש. האפליקציה לא שולחת כלום בעצמה: היא
//      פותחת קישור wa.me עם נוסח מוכן, והמפקד לוחץ "שלח" בעצמו.
// ============================================================

import { availStatus } from "./autoAssign.js";
import { dayName, toISODate, withEngineTasks } from "./dates.js";

/**
 * כמה פריטים (משמרות, ומשימות שעתיות שנכנסות למנוע) יש לחייל בשבוע הזה, וכמה
 * מהם עוד בלי תשובה. "unknown" הוא בדיוק מה ש-availStatus מחזיר למי שלא ענה —
 * אותה הגדרה שהשיבוץ והמסך של המפקד משתמשים בה.
 * @returns {{total: number, answered: number, remaining: number}}
 */
export function availabilityProgress({ userId, shifts = [], tasks = [], availability = {}, weekDates = [] }) {
  const inWeek = new Set(weekDates);
  const shiftsInWeek = shifts.filter((s) => inWeek.has(s.date));
  const tasksInWeek = tasks.filter((tk) => inWeek.has(tk.dueDate || tk.startDate));
  const items = withEngineTasks(shiftsInWeek, tasksInWeek);
  const answered = items.filter((s) => availStatus(availability, userId, s.id) !== "unknown").length;
  return { total: items.length, answered, remaining: items.length - answered };
}

/**
 * מי מהצוות עוד לא ענה על שום פריט בשבוע. מי שענה על חלק — הגיש. זו אותה
 * הגדרה ש-WeekFlow ו-SmartAssign כבר סופרות ("הגיש" = נגע לפחות במשמרת אחת),
 * כך שהמספר כאן לא יכול לסתור את הספירה בפס השלבים.
 */
export function guardsWhoHaveNotReported({ guards = [], shifts = [], availability = {}, weekDates = [] }) {
  const inWeek = new Set(weekDates);
  const weekShifts = shifts.filter((s) => inWeek.has(s.date));
  return guards.filter((g) => !weekShifts.some((s) => availStatus(availability, g.id, s.id) !== "unknown"));
}

/**
 * מספר טלפון ישראלי בפורמט ש-wa.me דורש: ספרות בלבד, עם קידומת מדינה.
 * 050-000-0000 → 972500000000; +972… ו-972… נשארים. מספר שלא נראה כמו טלפון
 * (קצר מדי) מחזיר null — עדיף לפתוח וואטסאפ בלי נמען מאשר לשלוח למספר שגוי.
 * @returns {string|null}
 */
export function waPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

/**
 * נוסח ההודעה. לאדם אחד פונים בשמו; לקבוצה — מפרטים מי עוד חסר, כדי שלא
 * יצטרכו לנחש אם זה נוגע אליהם.
 * @param {{names?: string[], name?: string, range: string, deadline: string, teamCode?: string}} p
 */
export function reminderText({ names, name, range, deadline, teamCode }) {
  const head = name
    ? `היי ${name}, עוד לא הגשת זמינות לשבוע ${range}.`
    : `תזכורת: עוד לא הוגשה זמינות לשבוע ${range}.`;
  const lines = [head, `צריך להגיש עד ${deadline}.`];
  if (!name && names?.length) lines.push(`טרם הגישו: ${names.join(", ")}.`);
  lines.push(teamCode ? `כניסה לאפליקציה עם קוד הצוות ${teamCode} — "הזמינות שלי".` : 'באפליקציה, ב"הזמינות שלי".');
  return lines.join("\n");
}

/** קישור לפתיחת וואטסאפ עם הודעה מוכנה. בלי טלפון — נפתח בלי נמען והמפקד בוחר שיחה. */
export function whatsappLink({ phone, text }) {
  const p = waPhone(phone);
  return `https://wa.me/${p || ""}?text=${encodeURIComponent(text)}`;
}

/** "חמישי, 8.10.2026 בשעה 18:00" — אותו ניסוח אצל המפקד, אצל החייל ובהודעה. */
export function deadlineLabelHe(deadline) {
  return `${dayName(toISODate(deadline))}, ${deadline.toLocaleDateString("he-IL")} בשעה ${String(deadline.getHours()).padStart(2, "0")}:00`;
}
