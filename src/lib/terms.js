/**
 * מילון המונחים — כל מילה שהמשתמש רואה ושמתארת *מה הוא עושה* חיה כאן.
 *
 * שתי סיבות לקובץ הזה, ורק שתיים:
 *
 * 1. עקביות. אם מסך אחד קורא לזה "פרסום סידור" ומסך אחר "שלח לצוות", המשתמש
 *    חושב שאלה שני דברים. כשהשם יושב במקום אחד, אי אפשר שהם יסטו.
 *
 * 2. פרופילים. אותה יכולת בדיוק נקראת אחרת בצבא ובמסעדה — "תורנות" מול
 *    "משמרת", "הצוות" מול "העובדים". ההבדל הזה הוא *אוצר מילים*, לא מבנה,
 *    ולכן הוא נפתר כאן ולא בעוד עץ רכיבים. אבן דרך ב' תמלא את
 *    `PROFILE_TERMS.army` — שום מסך לא ישתנה בגללה.
 *
 * הכלל: מונח שהוא שם של *יכולת* ("שיבוץ חכם") הוא באג. מונח הוא שם של
 * *פעולה* בגוף ראשון או שנייה ("סדר לי את השבוע").
 */

/** אוצר המילים של אבטחה — ברירת המחדל, וגם הבסיס שכל פרופיל אחר יורש ממנו. */
const BASE = {
  // האדם שמשובץ למשמרת — לא רק שם ניווט (guard.nav.*, שמדבר *אל* אותו
  // אדם), אלא איך שמדברים *עליו* במסכי הניהול: "הוסף שומר", "3 שומרים
  // הגישו". יחיד ורבים כמפתחות נפרדים, לא הטיה אוטומטית: עברית מטה שם
  // עצם לרבים בסיומת, לא בקידומת, אז "noun.memberPlural".replace() היה
  // באג-שפה מובטח (בדיוק כמו שקרה כבר פעם אחת בקובץ הזה עם "משמרות" →
  // "משמרה" השגוי). קידומות (ה/ל/מ) כן בטוחות לצירוף ישיר — "ה"+"שומרים".
  "noun.member":       "שומר",
  "noun.memberPlural": "שומרים",

  // ניווט אחמ"ש
  "nav.dashboard":   "לוח בקרה",
  "nav.calendar":    "יומן",
  "nav.shifts":      "בניית השבוע",
  "nav.availability": "מי הגיש",
  "nav.smart":       "סדר לי את השבוע",
  "nav.assignment":  "לשבץ בעצמי",
  "nav.schedule":    "שלח לצוות",
  "nav.swaps":       "בקשות החלפה",
  "nav.tasks":       "משימות",
  "nav.analytics":   "דוחות",
  "nav.team":        "הצוות שלי",
  "nav.positions":   "עמדות קבועות",

  // ניווט משתתף
  "guard.nav.schedule":     "התורנויות שלי",
  "guard.nav.availability": "מתי אני יכול",
  "guard.nav.swaps":        "החלפות",

  // עמדות קבועות (Phase 4, POS-01/POS-05)
  "positions.shape.template": "תבנית משמרת",
  "positions.shape.weekly":   "שבועית ללא שעות",
  "positions.qualified":      "מי כשיר לעמדה",
  "positions.working":        "מי עובד בה השבוע",
  "positions.mine":           "העמדות שאני כשיר/ה להן",

  // פעולות חוזרות
  "action.rerun":   "הרץ מחדש",
  "action.publish": "שלח לצוות",
  "action.publishAll":       "פרסם הכל",
  "action.unpublish":        "בטל פרסום",
  "action.publishDay":       "פרסם יום",
  "action.unpublishShort":   "בטל",

  // יחידות מידה בכיתובי עומס והוגנות
  "unit.load":   "נטל",
  "unit.shifts": "משמרות",
  "unit.nights": "לילות",
  "unit.hours":  "שעות",

  // הלוח המאוחד (Phase 5, BOARD-01/02)
  "nav.board":        "השבוע במבט אחד",
  "positions.forward": "4 השבועות הקרובים",
  "positions.planned": "מתוכנן",
};

/**
 * דריסות לפי פרופיל — רק המילים שבאמת שונות.
 *
 * מה שלא מופיע כאן יורש מ-BASE, וזה מכוון: פרופיל שמגדיר מחדש את כל אוצר
 * המילים הוא מוצר שני שמתחזה לפרופיל. ההבדל בין מפקד לאחמ"ש הוא כמה מילים,
 * לא כמה מסכים.
 */
const PROFILE_TERMS = {
  // אבטחה. זהה ל-BASE — כל אוצר המילים הקיים (שומר, משמרת) כבר היה
  // אבטחה-מוטה מההתחלה, גם כשהפרופיל עוד נקרא "civil" וכיסה גם מסעדנות
  // ומוקד בבת אחת (מיגרציה 0011 מפרקת את שלושתם).
  security: {},

  // מסעדנות. "עובד/ים" במקום "שומר/ים" — מילה אחת ששינויה. "משמרת"
  // עצמה נשארת: היא לא ספציפית לאבטחה, ומלצר/ה גם "עושה משמרת".
  restaurant: {
    "noun.member":       "עובד",
    "noun.memberPlural": "עובדים",
  },

  // צבאי. "סד\"כ" במקום "סידור", "תורנות" במקום "משמרת", ולשון פיקוד
  // במקום לשון שירות: מפקד *מפיץ* סד"כ, הוא לא "שולח לצוות".
  army: {
    "noun.member":       "כפוף",
    "noun.memberPlural": "כפופים",
    "nav.shifts":       "בניית סד\"כ",
    "nav.availability": "מי דיווח",
    "nav.smart":        "בנה לי סד\"כ",
    "nav.assignment":   "לשבץ בעצמי",
    "nav.schedule":     "הפץ סד\"כ",
    "nav.swaps":        "בקשות חילוף",
    "nav.tasks":        "משימות",
    "nav.team":         "הכפופים לי",
    "nav.positions":    "עמדות קבע",
    "guard.nav.schedule":     "התורנויות שלי",
    "guard.nav.availability": "דיווח זמינות",
    "guard.nav.swaps":        "חילופים",
    "action.publish":   "הפץ סד\"כ",
    "action.publishAll":     "הפץ הכל",
    "action.unpublish":      "בטל הפצה",
    "action.publishDay":     "הפץ יום",
    "unit.shifts":      "תורנויות",
    "positions.working": "מי מחזיק בה השבוע",
    "nav.board":        "תמונת מצב שבועית",
  },
};

/** התצוגה של הפרופילים במסך הבחירה. הסדר כאן הוא הסדר על המסך. */
export const PROFILES = [
  {
    id: "security",
    label: "אבטחה",
    hint: "משמרות שמירה, סידור שבועי, החלפות בין שומרים",
    icon: "users",
  },
  {
    id: "restaurant",
    label: "מסעדנות",
    hint: "משמרות מטבח והגשה, סידור שבועי, החלפות בין עובדים",
    icon: "clipboard",
  },
  {
    id: "army",
    label: "צבא",
    hint: 'סד"כ תורנויות, לשון פיקוד, כפיפות',
    icon: "shield",
  },
];

const STORE_KEY = "gs-profile";

const readStored = () => {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return PROFILE_TERMS[v] ? v : "security";
  } catch {
    return "security";
  }
};

let active = readStored();
let terms = { ...BASE, ...PROFILE_TERMS[active] };

/**
 * מנוי על שינויי פרופיל.
 *
 * בלי זה החלפת פרופיל לא הייתה נראית: מערכי הניווט נבנים פעם אחת בטעינת
 * המודול, אז `t()` שנקרא שם מקבע את המילה הראשונה לכל אורך החיים של הדף.
 * הרכיבים נרשמים דרך `useSyncExternalStore` ומחשבים את התוויות מחדש.
 */
const listeners = new Set();
export function subscribeTerms(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** נקרא בטעינת הצוות ובכל החלפת פרופיל. */
export function setTermProfile(profile) {
  const next = PROFILE_TERMS[profile] ? profile : "security";
  if (next === active) return;
  active = next;
  terms = { ...BASE, ...PROFILE_TERMS[active] };
  try {
    localStorage.setItem(STORE_KEY, active);
  } catch {
    /* אחסון חסום — הבחירה תקפה לשיחה הזאת בלבד */
  }
  for (const fn of listeners) fn();
}

export function termProfile() {
  return active;
}

/** מחזיר את המונח. מפתח לא מוכר חוזר כמו שהוא — רועש בממשק, וזו הכוונה. */
export function t(key) {
  return terms[key] ?? key;
}
