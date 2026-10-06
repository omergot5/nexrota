// ============================================================
// הדגמת צבא — המבנה עצמו, בלי Supabase (נבדק ב-scripts/verify-army-demo.mjs).
//
// שני גדלים, כי מבנה צריך להתאים לצוות שמאייש אותו (מדוד בסקריפט, לא מנחוש):
//
//   רגיל (עד 30 חיילים): שתי עמדות שמירה מאוישות 24/7 בארבע משמרות של 6
//   שעות (חייל אחד בכל משמרת), סיור בשלוש משמרות של 8 שעות (2 חיילים), כוננות
//   בשתי משמרות של 12 שעות (3 חיילים במקביל) ותורנות מטבח 06:30–20:30 (2
//   חיילים, א'–ו'). 152 מקומות בשבוע, כ-5 תורנויות לחייל — מתאייש במלואו.
//
//   קטן (עד 20 חיילים): עמדת שמירה אחת, סיור של חייל אחד, כוננות של 3 ומטבח
//   של אחד. 97 מקומות, כ-5 לחייל.
//
// המבנה הראשון של ההדגמה (229 מקומות, 45 חיילים) היה מוגזם: צוות דוגמה
// צריך להיראות כמו פלוגה שאפשר להכיר, לא כמו גדוד. 30 חיילים על 229 מקומות
// מתאיישים רק ב-79%, ו-20 ב-52% — לכן המבנה מתכווץ יחד עם הצוות.
//
// שימו לב: תורנות המטבח היא 14 שעות רצופות, ובכללי ברירת המחדל (מקסימום
// 12) המנוע לא משבץ אליה. בצוות צבאי היא מותרת ארוכה (LONG_SHIFT_DEFAULTS,
// הגדרת הצוות "משמרות ארוכות") — אמת על המבנה, לא הסתרה.
// ============================================================

import { buildDivisionRows } from "./positions.js";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** עמדה 24/7 שמחולקת לבלוקים שווים מ-00:00 — כל בלוק עמדת-תבנית נפרדת. */
const divided = (title, hours, category, requiredGuards) =>
  buildDivisionRows(title, hours).map((row) => ({ ...row, category, weekdays: ALL_DAYS, requiredGuards }));

const kitchen = (requiredGuards) => ({
  title: "תורנות מטבח",
  category: "תורנות מטבח",
  weekdays: [0, 1, 2, 3, 4, 5],
  startTime: "06:30",
  endTime: "20:30",
  requiredGuards,
});

const STANDARD_POSITIONS = [
  ...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1),
  ...divided("עמדת שמירה 2", 6, "תורנות שמירה", 1),
  ...divided("סיור", 8, "סיור", 2),
  ...divided("כוננות", 12, "כוננות", 3),
  kitchen(2),
];

const SMALL_POSITIONS = [
  ...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1),
  ...divided("סיור", 8, "סיור", 1),
  ...divided("כוננות", 12, "כוננות", 3),
  kitchen(1),
];

/** כמה חיילים ההדגמה פותחת כברירת מחדל — המקסימום שהמבנה הרגיל מחזיק (ר' ראש הקובץ). */
export const ARMY_DEMO_SOLDIERS = 30;

/** עד כמה חיילים המבנה הקטן מספיק; מעל זה — הרגיל. */
export const ARMY_DEMO_SMALL_MAX = 20;

/** המבנה שמתאים לצוות בגודל הזה. */
export const armyDemoPositions = (soldiers = ARMY_DEMO_SOLDIERS) =>
  soldiers <= ARMY_DEMO_SMALL_MAX ? SMALL_POSITIONS : STANDARD_POSITIONS;

/** המבנה הרגיל — מה שההדגמה פותחת כברירת מחדל. */
export const ARMY_DEMO_POSITIONS = STANDARD_POSITIONS;

/**
 * זמינות לדוגמה — דטרמיניסטית וקבועה בין הרצות, לא Math.random. בצבא החייל עונה
 * "יכול" או "לא יכול" בלבד (בלי "אולי"), אז גם ההדגמה: כ-10% לא זמין, השאר
 * זמין. זה מספיק כדי שלשיבוץ יהיה על מה להתלבט, בלי להקליד דפוס יד לכל חייל.
 * @returns {"a"|"u"}
 */
export function demoAvailabilityCode(guardIndex, dayIndex, kind) {
  const seed = (guardIndex * 7 + dayIndex * 3 + (kind === "night" ? 1 : 0)) % 10;
  return seed === 0 ? "u" : "a";
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
 * `soldiers` בוחר את המבנה (רגיל או קטן) — אותו דבר שההדגמה פותחת לצוות בגודל הזה.
 * @returns {{insert: object[], update: {id: string, patch: object}[], deactivate: string[]}}
 */
export function planArmyDemoPositions(active = [], { reconcile = false, soldiers = ARMY_DEMO_SOLDIERS } = {}) {
  const PLAN = armyDemoPositions(soldiers);
  const byTitle = new Map(active.map((p) => [p.title, p]));
  const insert = PLAN.filter((p) => !byTitle.has(p.title));
  if (!reconcile) return { insert, update: [], deactivate: [] };

  const planned = new Set(PLAN.map((p) => p.title));
  const update = PLAN.filter((p) => byTitle.has(p.title) && !matchesPlan(byTitle.get(p.title), p)).map(
    (p) => ({ id: byTitle.get(p.title).id, patch: { ...p, shape: "template", active: true } })
  );
  const deactivate = active.filter((p) => !planned.has(p.title)).map((p) => p.id);
  return { insert, update, deactivate };
}
