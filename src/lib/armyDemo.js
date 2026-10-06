// ============================================================
// הדגמת צבא — המבנה עצמו, בלי Supabase (נבדק ב-scripts/verify-army-demo.mjs).
//
// המבנה הוא מה שמפקד אמיתי בנה ושלח כדוגמה: שתי עמדות שמירה מאוישות
// 24/7 בארבע משמרות של 6 שעות (חייל אחד בכל משמרת), סיור בשלוש משמרות של
// 8 שעות (3 חיילים), כוננות בשתי משמרות של 12 שעות (7 חיילים במקביל),
// ותורנות מטבח 06:30–20:30 (2 חיילים, א'–ו').
//
// זה 229 מקומות בשבוע. עם תקרה של 6 תורנויות לחייל ו-3 לילות, 15–20
// חיילים מכסים רק חצי מהם — ולכן ההדגמה פותחת 45 חיילים, שזה מה שהמבנה
// הזה דורש בפועל.
//
// תורנות המטבח היא 14 שעות רצופות — יותר ממקסימום ה-12. היא מאוישת כי
// בצבא "תורנות מטבח" ו"כוננות" מותרות כמשמרות ארוכות (יש בהן הפסקות —
// LONG_SHIFT_DEFAULTS ב-autoAssign.js, ניתן לשינוי בהגדרות הצוות).
// ============================================================

import { buildDivisionRows } from "./positions.js";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** עמדה 24/7 שמחולקת לבלוקים שווים מ-00:00 — כל בלוק עמדת-תבנית נפרדת. */
const divided = (title, hours, category, requiredGuards) =>
  buildDivisionRows(title, hours).map((row) => ({ ...row, category, weekdays: ALL_DAYS, requiredGuards }));

export const ARMY_DEMO_POSITIONS = [
  ...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1),
  ...divided("עמדת שמירה 2", 6, "תורנות שמירה", 1),
  ...divided("סיור", 8, "סיור", 3),
  ...divided("כוננות", 12, "כוננות", 7),
  {
    title: "תורנות מטבח",
    category: "תורנות מטבח",
    weekdays: [0, 1, 2, 3, 4, 5],
    startTime: "06:30",
    endTime: "20:30",
    requiredGuards: 2,
  },
];

/** כמה חיילים ההדגמה פותחת — מה שהמבנה למעלה צריך כדי להתאייש (ר' ראש הקובץ). */
export const ARMY_DEMO_SOLDIERS = 45;

/**
 * זמינות לדוגמה — דטרמיניסטית וקבועה בין הרצות, לא Math.random. תמהיל גס
 * (כ-10% לא-זמין, 20% אולי, השאר זמין) שמספיק כדי שלשיבוץ יהיה על מה
 * להתלבט, בלי להקליד דפוס יד לכל חייל.
 * @returns {"a"|"u"|"m"}
 */
export function demoAvailabilityCode(guardIndex, dayIndex, kind) {
  const seed = (guardIndex * 7 + dayIndex * 3 + (kind === "night" ? 1 : 0)) % 10;
  if (seed === 0) return "u";
  if (seed === 1 || seed === 2) return "m";
  return "a";
}

const sameDays = (a = [], b = []) => [...a].sort().join() === [...b].sort().join();
const matchesPlan = (pos, plan) =>
  pos.shape === "template" &&
  pos.category === plan.category &&
  pos.startTime === plan.startTime &&
  pos.endTime === plan.endTime &&
  (pos.requiredGuards || 1) === plan.requiredGuards &&
  sameDays(pos.weekdays, plan.weekdays);

/**
 * מה לשנות בעמדות הפעילות של צוות כדי שיתאימו להדגמה.
 *
 * צוות אמיתי (reconcile=false): רק מוסיפים מה שחסר, לפי שם — לעולם לא
 * נוגעים בעמדה שמפקד הגדיר בעצמו.
 * צוות ההדגמה עצמו (reconcile=true): גם מעדכנים עמדה באותו שם שהוגדרה
 * אחרת, ומכבים עמדות שאינן במבנה — כדי ש"מלא נתוני הדגמה" על הדגמה ישנה
 * ייתן בדיוק את המבנה הנוכחי, ולא תערובת של הישן והחדש.
 *
 * @returns {{insert: object[], update: {id: string, patch: object}[], deactivate: string[]}}
 */
export function planArmyDemoPositions(active = [], { reconcile = false } = {}) {
  const byTitle = new Map(active.map((p) => [p.title, p]));
  const insert = ARMY_DEMO_POSITIONS.filter((p) => !byTitle.has(p.title));
  if (!reconcile) return { insert, update: [], deactivate: [] };

  const planned = new Set(ARMY_DEMO_POSITIONS.map((p) => p.title));
  const update = ARMY_DEMO_POSITIONS.filter((p) => byTitle.has(p.title) && !matchesPlan(byTitle.get(p.title), p)).map(
    (p) => ({ id: byTitle.get(p.title).id, patch: { ...p, shape: "template", active: true } })
  );
  const deactivate = active.filter((p) => !planned.has(p.title)).map((p) => p.id);
  return { insert, update, deactivate };
}
