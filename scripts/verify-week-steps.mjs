// Standalone check for the week screen steps (weekSteps.js).
//   node scripts/verify-week-steps.mjs
//
// בצבא הלוח התמזג לתוך "בניית שבוע". מה שנבדק כאן: שאף יעד ניווט ישן לא
// נופל לשלב לא נכון אחרי המיזוג, ושהתחומים האחרים נשארו כמו שהיו.

import { clampStep, isWeekTarget, stepIdsFor, stepIndex } from "../src/lib/weekSteps.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

console.log("\nצבא — ארבעה שלבים, בלי לוח נפרד\n");
check("הסדר: בניית שבוע, זמינות, שיבוץ, פרסום", stepIdsFor("army").join() === "shifts,availability,smart,schedule");
check("יעד 'board' הישן נופל לבניית שבוע", stepIndex("board", "army") === 0);
check("זמינות היא שלב 1", stepIndex("availability", "army") === 1);
check("'smart', 'assign', 'assignment' — כולם שלב השיבוץ", ["smart", "assign", "assignment"].every((id) => stepIndex(id, "army") === 2));
check("'schedule' ו-'publish' — שלב הפרסום", ["schedule", "publish"].every((id) => stepIndex(id, "army") === 3));

console.log("\nתחומים אחרים — חמישה שלבים כמו קודם\n");
for (const mode of ["security", "restaurant", undefined]) {
  check(`${mode ?? "ללא תחום"}: הסדר ללא שינוי`, stepIdsFor(mode).join() === "shifts,board,availability,smart,schedule");
}
check("הלוח נשאר שלב 1", stepIndex("board", "security") === 1);
check("פרסום הוא שלב 4", stepIndex("publish", "security") === 4);

console.log("\nמזהים לא מוכרים והחלפת תחום\n");
check("מזהה שאינו שלב אינו יעד בתוך השבוע", !isWeekTarget("team") && !isWeekTarget("dashboard") && isWeekTarget("publish"));
check("יעד לא מוכר נופל לשלב הראשון", stepIndex("nope", "army") === 0);
check("שלב 4 בתחום אזרחי, אחרי מעבר לצבא — נחתך לשלב האחרון", clampStep(4, "army") === 3);
check("שלב תקין לא משתנה", clampStep(2, "army") === 2 && clampStep(4, "security") === 4);
check("ערך שלילי או לא מספרי נופל ל-0", clampStep(-3, "army") === 0 && clampStep(undefined, "army") === 0);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
