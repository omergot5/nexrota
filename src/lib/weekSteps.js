// ============================================================
// שלבי מסך "השבוע" — אילו שלבים יש בכל תחום, ולאן נופל כל מזהה ניווט.
//
// בצבא הלוח ("תמונת מצב שבועית") התמזג לתוך "בניית שבוע": הגריד לפי עמדות
// כבר מציג שמות, ומאפשר להוסיף, להסיר ולגרור אותם — אז שני מסכים שמציגים את
// אותו שבוע היו בדיוק הכפילות שהמוצר מבטיח לא להכיל. בתחומים האחרים הלוח
// נשאר שלב נפרד, כי שם בניית השבוע עוד לא יושבת על עמדות.
//
// טהור (בלי React), כדי שנבדק ב-Node ישירות — ו-SupervisorApp, WeekFlow והבדיקה
// קוראים לאותו מקור ולא לשלוש גרסאות של אותה רשימה.
// ============================================================

const STEPS_ARMY = ["shifts", "availability", "smart", "schedule"];
const STEPS_DEFAULT = ["shifts", "board", "availability", "smart", "schedule"];

/** מזהי הניווט הישנים ממשיכים לעבוד — כל אחד נופל לשלב שלו. */
const TARGET_OF = {
  shifts: "shifts",
  board: "board",
  availability: "availability",
  smart: "smart",
  assignment: "smart",
  assign: "smart",
  schedule: "schedule",
  publish: "schedule",
};

/** @returns {string[]} מזהי השלבים לפי הסדר שבו הם מוצגים */
export const stepIdsFor = (mode) => (mode === "army" ? STEPS_ARMY : STEPS_DEFAULT);

/** האם המזהה הוא יעד בתוך מסך השבוע (ולא מסך אחר באפליקציה). */
export const isWeekTarget = (id) => id in TARGET_OF;

/**
 * האינדקס של יעד ניווט בתוך השלבים של התחום. יעד "board" בתחום שבו הלוח
 * התמזג נופל ל"בניית שבוע" — שם הוא נמצא עכשיו.
 * @returns {number}
 */
export function stepIndex(id, mode) {
  const ids = stepIdsFor(mode);
  const target = TARGET_OF[id];
  if (!target) return 0;
  const resolved = target === "board" && !ids.includes("board") ? "shifts" : target;
  return Math.max(0, ids.indexOf(resolved));
}

/** שלב שהאינדקס שלו חורג (למשל אחרי החלפת תחום) חוזר לשלב האחרון הקיים. */
export const clampStep = (step, mode) => Math.min(Math.max(0, step | 0), stepIdsFor(mode).length - 1);
