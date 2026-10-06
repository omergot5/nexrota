// ============================================================
// הדגמת צבא — המבנה עצמו, בלי Supabase (נבדק ב-scripts/verify-army-demo.mjs).
//
// שני גדלים, כי מבנה צריך להתאים לצוות שמאייש אותו (מדוד בסקריפט, לא מנחוש):
//
//   רגיל (עד 30 חיילים): עמדת שמירה אחת מאוישת 24/7 בארבע משמרות של 6 שעות,
//   סיור בשלוש משמרות של 8 שעות, כוננות בשתי משמרות של 12 שעות עם 6 חיילים
//   במקביל, ותורנות מטבח 06:30–20:30 (א'–ו'). 139 מקומות בשבוע.
//
//   קטן (עד 20 חיילים): אותו דבר עם כוננות של 4. 111 מקומות.
//
//   למה לא כוננות של 6 גם ב-20: 84 מקומות כוננות לבדם הם 70% ממה ש-20 חיילים
//   יכולים לעשות בשבוע (תקרה של 6 תורנויות לחייל = 120). עם עמדת שמירה, סיור
//   ומטבח יוצאים 139 מקומות — 23 נשארים פתוחים (נמדד, scripts/explore-standby.mjs).
//
//   בעלי תפקיד: בסיור ובכוננות חייב בעל תפקיד בכל משמרת (סמל, מפקץ, מפקד כיתה).
//   ההדגמה מגדירה שישה כאלה. 35 משמרות פיקוד בשבוע על שישה אנשים עם תקרה של
//   שש תורנויות — המנוע מכסה את רובן, וכמה נשארות מסומנות בלי בעל תפקיד.
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
  ...divided("סיור", 8, "סיור", 1),
  ...divided("כוננות", 12, "כוננות", 6),
  kitchen(1),
];

const SMALL_POSITIONS = [
  ...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1),
  ...divided("סיור", 8, "סיור", 1),
  ...divided("כוננות", 12, "כוננות", 4),
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
