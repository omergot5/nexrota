// ============================================================
// צבע לפי קטגוריה — לא לפי זמן-ביום.
//
// shiftPalette.js מקודד "מתי" (בהיר=מוקדם, כהה=מאוחר) ומכוון בכוונה
// לגוון אחד מהמותג. מבט-המשאבים ולוח-השבוע-בסגנון-Google-Calendar
// צריכים את ההפך: "מה" — שמירה אדומה, סיור כחול, מטבח ירוק, כדי שהעין
// תבדיל בין קטגוריות בלי לקרוא תווית. שני מקורות צבע נפרדים בכוונה,
// כל אחד עונה על שאלה אחרת.
//
// הגוונים עצמם (--cat-*) חיים ב-src/design/tokens.css, לא כאן — כאן רק
// המיפוי "קטגוריה מסוימת בתחום מסוים → איזה גוון". שבעה גוונים קבועים
// חוזרים על עצמם בסבב (round-robin) לפי הסדר המוצהר ב-FOLDERS_BY_MODE,
// כדי שסדר הצבעים יהיה יציב וצפוי בכל תחום בלי צורך למפות כל קטגוריה
// ביד — ו"כללי" (UNFILED) תמיד מקבל את הגוון הנייטרלי.
//
// מחלקות ה-Tailwind למטה חייבות להופיע כמחרוזת מילולית שלמה איפשהו
// בקוד המקור — ה-scanner של Tailwind קורא טקסט גולמי, לא AST, ולכן
// הרכבה דינמית כמו `border-${tone}` בקומפוננטה קוראת לא הייתה מזוהה
// ולא הייתה נכנסת ל-build. הטבלה הזו היא המקום שבו כל שם מחלקה קיים
// כמחרוזת שלמה, פעם אחת, כדי שקריאה דינמית ל-`TONE_CLASSES[tone]`
// תישאר בטוחה בכל קובץ שמייבא אותה.
// ============================================================

import { foldersFor, UNFILED } from "../lib/categories.js";

const ROTATION = ["cat-red", "cat-blue", "cat-green", "cat-purple", "cat-amber", "cat-cyan"];
const NEUTRAL_TONE = "faint";

/** שם הגוון (מפתח לתוך TONE_CLASSES) לקטגוריה נתונה, בתוך תחום. */
export function categoryTone(category, mode) {
  if (!category || category === UNFILED) return NEUTRAL_TONE;
  const names = foldersFor(mode).map((f) => f.name);
  const idx = names.indexOf(category);
  // קטגוריה מותאמת-אישית (לא ברשימת ההצעה): ממשיכה את אותו סבב, לפי
  // מיקומה בסדר המוצהר — לא צבע קבוע אחד לכל "לא מוכר", כדי שריבוי
  // קטגוריות מותאמות עדיין יבדילו זו מזו בעין.
  const pos = idx >= 0 ? idx : names.length + hashIndex(category);
  return ROTATION[pos % ROTATION.length];
}

// גיבוב יציב (לא Math.random) לקטגוריה מותאמת-אישית — אותה קטגוריה
// מקבלת תמיד את אותו מיקום בסבב, בכל הרצה ובכל מסך.
function hashIndex(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/** מחרוזות מלאות בלבד — ר' הערת ה-scanner למעלה. */
export const TONE_CLASSES = {
  "cat-red": { text: "text-cat-red", border: "border-cat-red", bg: "bg-cat-red/15", dot: "bg-cat-red" },
  "cat-blue": { text: "text-cat-blue", border: "border-cat-blue", bg: "bg-cat-blue/15", dot: "bg-cat-blue" },
  "cat-green": { text: "text-cat-green", border: "border-cat-green", bg: "bg-cat-green/15", dot: "bg-cat-green" },
  "cat-purple": { text: "text-cat-purple", border: "border-cat-purple", bg: "bg-cat-purple/15", dot: "bg-cat-purple" },
  "cat-amber": { text: "text-cat-amber", border: "border-cat-amber", bg: "bg-cat-amber/15", dot: "bg-cat-amber" },
  "cat-cyan": { text: "text-cat-cyan", border: "border-cat-cyan", bg: "bg-cat-cyan/15", dot: "bg-cat-cyan" },
  faint: { text: "text-faint", border: "border-hairline-strong", bg: "bg-surface-sunken", dot: "bg-faint" },
};
