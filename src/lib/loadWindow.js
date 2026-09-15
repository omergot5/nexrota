// ============================================================
// בחירת חלון-הצגת-עומס: "recent" (14 יום אחרונים, תואם למה שהמנוע בפועל
// משתמש בו ב-rollingLoad/fairness.js) או "all" (מצטבר, כל היסטוריית הצוות).
//
// אחסון גלובלי אחד (לא state לכל מסך): כרטיס "עומס השומרים" בדשבורד, מסך
// הדוחות, ו"הנטל שלי" של המשתתף חייבים להסכים על אותה בחירה בו-זמנית —
// אותו דפוס בדיוק כמו useTheme.js/terms.js (module-level store +
// useSyncExternalStore), כדי שבחירה במסך אחד תשתקף מיידית בשני האחרים
// בלי prop-drilling ובלי שני עותקי state שיכולים להיסחף זה מזה.
// ============================================================

export const STORAGE_KEY = "gs-load-window";
export const RECENT_DAYS = 14;
const MODES = ["recent", "all"];

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(saved) ? saved : "recent";
  } catch {
    return "recent";
  }
}

let mode = typeof window === "undefined" ? "recent" : readStored();
const listeners = new Set();

export function subscribeLoadWindow(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadWindowMode() {
  return mode;
}

export function setLoadWindowMode(next) {
  if (!MODES.includes(next) || next === mode) return;
  mode = next;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* אחסון חסום — הבחירה תקפה לשיחה הזאת בלבד */
  }
  for (const fn of listeners) fn();
}
