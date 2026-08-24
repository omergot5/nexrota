// Standalone sanity check for the conflict matrix and the fairness engine.
//   node scripts/verify-planning.mjs
//
// Both modules are pure, so they run here with no browser and no database.

import { compatIndex, findConflicts, pairKey, pairRule, taskWindow } from "../src/lib/conflicts.js";
import { fairnessHint, fairnessPlan, loadShareHint, meanShiftLoad, rollingLoad } from "../src/lib/fairness.js";
import {
  addDays,
  todayISO,
  isSingleDayTask,
  isTaskEngineEligible,
  taskInterval,
  shiftInterval,
  windowsOverlap,
} from "../src/lib/dates.js";
import { shiftLoad, teamAverages } from "../src/lib/autoAssign.js";
import { loadTable } from "../src/lib/loadTable.js";
import { chartTheme } from "../src/design/chartTheme.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
console.log("\nמטריצת ההתנגשויות\n");
// ============================================================

const rules = [
  { a: "כוננות", b: "מטבח", rule: "allow", note: "", teamCode: null },
  { a: "מטבח", b: "שמירות", rule: "block", note: "עמדה דורשת נוכחות", teamCode: null },
  { a: "סיור", b: "שמירות", rule: "block", note: "", teamCode: null },
];
const index = compatIndex(rules);

check("המפתח סימטרי", pairKey("שמירות", "מטבח") === pairKey("מטבח", "שמירות"));
check("זוג חסום נקרא משני הכיוונים",
  pairRule(index, "שמירות", "מטבח").rule === "block" &&
  pairRule(index, "מטבח", "שמירות").rule === "block");
check("זוג מותר במפורש נשאר מותר", pairRule(index, "מטבח", "כוננות").rule === "allow");
check("זוג שלא נרשם — מותר", pairRule(index, "ניקיון", "ציוד").rule === "allow");

// כלל של צוות גובר על המובנה, ולא משנה באיזה סדר הגיעו השורות.
const teamFirst = compatIndex([
  { a: "מטבח", b: "שמירות", rule: "allow", teamCode: "ABC123" },
  { a: "מטבח", b: "שמירות", rule: "block", teamCode: null },
]);
const builtinFirst = compatIndex([
  { a: "מטבח", b: "שמירות", rule: "block", teamCode: null },
  { a: "מטבח", b: "שמירות", rule: "allow", teamCode: "ABC123" },
]);
check("כלל של הצוות גובר על המובנה — בכל סדר טעינה",
  pairRule(teamFirst, "מטבח", "שמירות").rule === "allow" &&
  pairRule(builtinFirst, "מטבח", "שמירות").rule === "allow");

const mon = todayISO();
const wed = addDays(mon, 2);
const fri = addDays(mon, 4);
const nextWeek = addDays(mon, 9);

const existing = [
  { id: "t1", title: "עמדה 1", category: "שמירות", assignees: ["g1"], startDate: mon, dueDate: wed, status: "open" },
  { id: "t2", title: "מטבח ערב", category: "מטבח", assignees: ["g2"], startDate: mon, dueDate: wed, status: "open" },
  { id: "t3", title: "עמדה 2", category: "שמירות", assignees: ["g3"], startDate: nextWeek, dueDate: nextWeek, status: "open" },
  { id: "t4", title: "עמדה ישנה", category: "שמירות", assignees: ["g4"], startDate: mon, dueDate: wed, status: "done" },
];

const candidate = { id: "new", title: "מטבח בוקר", category: "מטבח", startDate: mon, dueDate: fri };

check("חלון של משימה עם תאריך יחיד נסגר על עצמו",
  taskWindow({ dueDate: mon })?.from === mon && taskWindow({ dueDate: mon })?.to === mon);
check("משימה בלי תאריכים לא מייצרת חלון", taskWindow({}) === null);

const hit = findConflicts({ candidate, assignees: ["g1"], tasks: existing, compat: index });
check("חפיפה בין זוג חסום נתפסת", hit.length === 1 && hit[0].taskId === "t1", JSON.stringify(hit));
check("הסיבה מהטבלה מגיעה עם הממצא", hit[0]?.note === "עמדה דורשת נוכחות");

check("זוג מותר לא נחסם",
  findConflicts({ candidate, assignees: ["g2"], tasks: existing, compat: index }).length === 0);
check("חוסר חפיפה בזמן לא נחסם",
  findConflicts({ candidate, assignees: ["g3"], tasks: existing, compat: index }).length === 0);
check("משימה שהושלמה כבר לא תופסת אף אחד",
  findConflicts({ candidate, assignees: ["g4"], tasks: existing, compat: index }).length === 0);
check("עריכת משימה לא מתנגשת עם עצמה",
  findConflicts({ candidate: existing[0], assignees: ["g1"], tasks: existing, compat: index }).length === 0);
check("משימה בלי תאריכים לא חוסמת",
  findConflicts({ candidate: { category: "מטבח" }, assignees: ["g1"], tasks: existing, compat: index }).length === 0);

const many = findConflicts({ candidate, assignees: ["g1", "g2", "g3"], tasks: existing, compat: index });
check("שורה אחת לכל אדם מתנגש, לא ספירה מצטברת",
  many.length === 1 && many[0].personId === "g1", JSON.stringify(many));

// ============================================================
console.log("\nאיחוד משימה ומשמרת — חלון אחד (UNIF-01/03/04/06)\n");
// ============================================================

// --- fixtures (D-01) ---
const engineTask = {
  id: "et1", title: "מטבח בוקר", category: "מטבח",
  startDate: mon, dueDate: mon, startTime: "06:00", endTime: "14:00", assignees: ["g1"],
};
const frozenTask = {
  id: "ft1", title: "מטבח ישן", category: "מטבח",
  startDate: mon, dueDate: mon, assignees: ["g1"],
};
const spanTask = {
  id: "st1", title: "מטבח שבוע", category: "מטבח",
  startDate: mon, dueDate: wed, startTime: "06:00", endTime: "14:00", assignees: ["g1"],
};

// Test A (D-01, eligibility) — כל מקרה קצה מקבל assertion משלו, כדי שנסיגה תזהה את עצמה.
check("UNIF-01 · משימה חד-יומית עם שתי שעות היא engine-eligible",
  isTaskEngineEligible(engineTask) === true);
check("UNIF-01 · אותה משימה בלי שעת התחלה אינה eligible",
  isTaskEngineEligible({ ...engineTask, startTime: undefined }) === false);
check("UNIF-01 · אותה משימה בלי שעת סיום אינה eligible",
  isTaskEngineEligible({ ...engineTask, endTime: undefined }) === false);
check("UNIF-01 · משימה רב-יומית עם שתי שעות אינה eligible (D-01)",
  isTaskEngineEligible(spanTask) === false && isSingleDayTask(spanTask) === false);
check("UNIF-01 · משימה בלי תאריכים ובלי שעות אינה eligible",
  isTaskEngineEligible({}) === false);

// Test B (UNIF-03, resolution branch) — taskWindow עצמו מסתעף לפי eligibility.
check("UNIF-03 · taskWindow על משימה eligible מחזיר גבולות מיליסניה סופיים",
  Number.isFinite(taskWindow(engineTask)?.start) && Number.isFinite(taskWindow(engineTask)?.end));
check("UNIF-03 · taskWindow על משימה קפואה מחזיר זוג from/to כמו היום",
  taskWindow(frozenTask)?.from === mon && taskWindow(frozenTask)?.to === mon);

// Test C (UNIF-03, semantics preserved) — ארבעת מקרי הגבול שהמחקר הוכיח ביד.
const touchShiftA = { date: mon, startTime: "07:00", endTime: "15:00" };
const touchShiftB = { date: mon, startTime: "15:00", endTime: "23:00" };
check("UNIF-03 · שתי משמרות נוגעות קצה-לקצה לא חופפות",
  windowsOverlap(shiftInterval(touchShiftA), shiftInterval(touchShiftB)) === false);
const realOverlapA = { date: mon, startTime: "07:00", endTime: "16:00" };
const realOverlapB = { date: mon, startTime: "15:00", endTime: "23:00" };
check("UNIF-03 · שתי משמרות שבאמת חופפות בשעות מזוהות ככאלה",
  windowsOverlap(shiftInterval(realOverlapA), shiftInterval(realOverlapB)) === true);
check("UNIF-03 · שני חלונות תאריך-בלבד באותו טווח חופפים",
  windowsOverlap({ from: mon, to: wed }, { from: mon, to: wed }) === true);
check("UNIF-03 · שני חלונות תאריך-בלבד ביום בודד וסמוך לא חופפים",
  windowsOverlap({ from: mon, to: mon }, { from: addDays(mon, 1), to: addDays(mon, 1) }) === false);

// Test D (UNIF-03, mixed resolution — המקרה ששני המנועים לא יכלו לבטא לפני כן)
const mixedInterval = taskInterval(engineTask); // mon 06:00–14:00
check("UNIF-03 · משימה עם שעות ביום שני חופפת לחלון תאריך-בלבד שמכיל אותו",
  windowsOverlap(mixedInterval, { from: mon, to: wed }) === true);
check("UNIF-03 · משימה עם שעות ביום שני לא חופפת לחלון תאריך-בלבד שלא כולל אותו",
  windowsOverlap(mixedInterval, { from: addDays(mon, 3), to: addDays(mon, 3) }) === false);

// Test E (UNIF-06, קריטריון ההצלחה השלישי של המפת-דרכים) — אותו זוג חסום,
// שתי הכרעות שונות לפי שעות, מאותה פונקציה. reuse ה-index שנבנה למעלה.
const unifGuard = "g-unif";
const taskMorning = {
  id: "ue1", title: "מטבח בוקר", category: "מטבח",
  startDate: mon, dueDate: mon, startTime: "06:00", endTime: "08:00", assignees: [unifGuard],
};
const taskEvening = {
  id: "ue2", title: "עמדה ערב", category: "שמירות",
  startDate: mon, dueDate: mon, startTime: "20:00", endTime: "22:00", assignees: [unifGuard],
};
const noHourOverlap = findConflicts({ candidate: taskMorning, assignees: [unifGuard], tasks: [taskEvening], compat: index });
check("UNIF-06 · שתי משימות באותו יום, שעות לא-חופפות, זוג חסום — אין התנגשות",
  noHourOverlap.length === 0, JSON.stringify(noHourOverlap));

const taskMorningMoved = { ...taskMorning, startTime: "20:00", endTime: "22:00" };
const realHourOverlap = findConflicts({ candidate: taskMorningMoved, assignees: [unifGuard], tasks: [taskEvening], compat: index });
check("UNIF-06 · אותו זוג בשעות שבאמת חופפות מייצר התנגשות אחת עם ההערה מהמטריצה",
  realHourOverlap.length === 1 && realHourOverlap[0].note === "עמדה דורשת נוכחות",
  JSON.stringify(realHourOverlap));

// Test G (degenerate input) — windowsOverlap לעולם לא זורק, ותמיד false על קלט מנוון.
check("UNIF-03 · windowsOverlap על undefined/undefined לא זורק וקובע אי-חפיפה",
  windowsOverlap(undefined, undefined) === false);
check("UNIF-03 · windowsOverlap על null מול חלון תקין לא זורק וקובע אי-חפיפה",
  windowsOverlap(null, { from: mon, to: mon }) === false);
check("UNIF-03 · windowsOverlap על שני אובייקטים ריקים לא זורק וקובע אי-חפיפה",
  windowsOverlap({}, {}) === false);
check("UNIF-03 · windowsOverlap על משימה עם שעה לא-קריאה לא זורק וקובע אי-חפיפה",
  windowsOverlap(taskInterval({ dueDate: mon, startTime: "not-a-time", endTime: "14:00" }), { from: mon, to: mon }) === false);
check("UNIF-03 · windowsOverlap בין חלון תאריך תקין לחלון מיליסניה פגום לא זורק וקובע אי-חפיפה",
  windowsOverlap({ from: mon, to: mon }, { start: NaN, end: 100 }) === false);

// ============================================================
console.log("\nמנוע ההוגנות\n");
// ============================================================

const guards = [
  { id: "g1", name: "אלה" },
  { id: "g2", name: "יניר" },
  { id: "g3", name: "נועה" },
];

const day = (date, assigned) => ({
  id: `d-${date}-${assigned}`, date, type: "morning",
  startTime: "07:00", endTime: "19:00", assignedGuards: [assigned],
});
const night = (date, assigned) => ({
  id: `n-${date}-${assigned}`, date, type: "night",
  startTime: "19:00", endTime: "07:00", assignedGuards: [assigned],
});

const weekStart = addDays(todayISO(), 7);
// שבועיים אחורה: אלה נשאה ארבע, יניר אחת, נועה כלום.
const history = [
  day(addDays(weekStart, -12), "g1"), day(addDays(weekStart, -10), "g1"),
  day(addDays(weekStart, -6), "g1"), day(addDays(weekStart, -3), "g1"),
  day(addDays(weekStart, -5), "g2"),
  // מחוץ לחלון — חייב להיות מתעלם.
  day(addDays(weekStart, -40), "g3"), day(addDays(weekStart, -39), "g3"),
];

const past = rollingLoad({ guards, shifts: history, until: weekStart, days: 14 });
check("החלון חותך מה שקדם לו",
  past.per.g3.count === 0, JSON.stringify(past.per.g3));
check("מה שבתוך החלון נספר", past.per.g1.count === 4 && past.per.g2.count === 1);

const plan = fairnessPlan({ guards, history, planned: [], until: weekStart, days: 14 });
const byId = Object.fromEntries(plan.rows.map((r) => [r.id, r]));

check("מי שנשא הכי הרבה יושב בתחתית ההמלצה",
  plan.rows[plan.rows.length - 1].id === "g1", JSON.stringify(plan.rows.map((r) => r.id)));
check("מי שלא נשא כלום מקבל את החוב הגדול ביותר", plan.rows[0].id === "g3");
check("החוב מתורגם למספר משמרות שאפשר לפעול לפיו",
  byId.g3.needs >= 1 && byId.g2.needs >= 1, JSON.stringify({ g3: byId.g3.needs, g2: byId.g2.needs }));
check("מי שמעל הממוצע מקבל מספר שלילי", byId.g1.needs <= -1, String(byId.g1.needs));
check("סכום החובות מתאפס בקירוב",
  Math.abs(plan.rows.reduce((a, r) => a + r.deficit, 0)) < 0.01,
  String(plan.rows.reduce((a, r) => a + r.deficit, 0)));

check("ההמלצה מנוסחת למי שחסר לו", fairnessHint(byId.g3)?.level === "under");
check("ההמלצה מזהירה את מי שמעל", fairnessHint(byId.g1)?.level === "over");
check("מי שמאוזן לא מקבל תג", fairnessHint({ needs: 0 }) === null);

// שיבוץ לשבוע הנוכחי מקטין את החוב תוך כדי עבודה.
const withPlanned = fairnessPlan({
  guards, history, planned: [day(weekStart, "g3"), day(addDays(weekStart, 1), "g3")],
  until: weekStart, days: 14,
});
const g3After = withPlanned.rows.find((r) => r.id === "g3");
check("שיבוץ לשבוע שנבנה מוריד את ההמלצה",
  g3After.needs < byId.g3.needs, JSON.stringify({ before: byId.g3.needs, after: g3After.needs }));

// לילה שוקל יותר מיום — שתי ספירות זהות אינן בהכרח נטל זהה.
const evenCount = fairnessPlan({
  guards: guards.slice(0, 2), history: [night(addDays(weekStart, -3), "g1"), day(addDays(weekStart, -3), "g2")],
  planned: [], until: weekStart, days: 14,
});
const nightHolder = evenCount.rows.find((r) => r.id === "g1");
check("נטל ולא ספירה — מי שנשא לילה נחשב עמוס יותר",
  nightHolder.deficit < 0, JSON.stringify(evenCount.rows));

check("צוות ריק לא מפיל את החישוב", fairnessPlan({ guards: [] }).rows.length === 0);

// ============================================================
console.log("\nloadShareHint — תג עומס-מעל/מתחת (FAIR-02, Phase 1 Plan 01-02)\n");
// ============================================================

// Test A — מי שנמצא בדיוק על הממוצע לא מקבל תג. שתיקה היא תשובה לגיטימית.
check("FAIR-02 · על הממוצע בדיוק — בלי תג",
  loadShareHint({ load: 20, meanLoad: 20, perShiftLoad: 8 }) === null);

// Test B — משמרת ממוצעת שלמה מעל הממוצע: over, טקסט לא ריק, tone בטוח.
const overHint = loadShareHint({ load: 28, meanLoad: 20, perShiftLoad: 8 });
check("FAIR-02 · משמרת שלמה מעל הממוצע מסומן over עם טקסט וטון תקינים",
  overHint?.level === "over" && typeof overHint.text === "string" && overHint.text.length > 0 &&
    ["brand", "warn", "danger", "accent", "info"].includes(overHint.tone),
  JSON.stringify(overHint));

// Test C — משמרת ממוצעת שלמה מתחת לממוצע: under, טקסט לא ריק, tone בטוח.
const underHint = loadShareHint({ load: 12, meanLoad: 20, perShiftLoad: 8 });
check("FAIR-02 · משמרת שלמה מתחת לממוצע מסומן under עם טקסט וטון תקינים",
  underHint?.level === "under" && typeof underHint.text === "string" && underHint.text.length > 0 &&
    ["brand", "warn", "danger", "accent", "info"].includes(underHint.tone),
  JSON.stringify(underHint));

// Test D (D-05) — הכיוון קריא גם בלי הצבע: שני הכיוונים מייצרים טקסטים שונים.
check("FAIR-02 · over ו-under מייצרים טקסט שונה (D-05 — לא רק גוון)",
  overHint.text !== underHint.text, JSON.stringify({ over: overHint.text, under: underHint.text }));

// Test E (D-02) — סף הרעש נגזר מהרוסטר, לא קבוע: אותה סטייה מוחלטת (3) נשארת
// בשקט על רוסטר של משמרות כבדות (perShiftLoad=10 -> סף 5) ומקבלת תג על רוסטר
// של משמרות קלות (perShiftLoad=2 -> סף 1). קבוע קשיח לא יכול לעבור את זה.
const sameDeviationHeavy = loadShareHint({ load: 23, meanLoad: 20, perShiftLoad: 10 });
const sameDeviationLight = loadShareHint({ load: 23, meanLoad: 20, perShiftLoad: 2 });
check("FAIR-02 · סף הרעש נגזר מ-perShiftLoad — שקט על משמרות כבדות",
  sameDeviationHeavy === null, JSON.stringify(sameDeviationHeavy));
check("FAIR-02 · סף הרעש נגזר מ-perShiftLoad — מקבל תג על משמרות קלות (אותה סטייה)",
  sameDeviationLight !== null && sameDeviationLight.level === "over", JSON.stringify(sameDeviationLight));

// Test F — קלטים מנוונים: perShiftLoad אפס/שלילי/חסר, ושורה חסרה. לעולם לא
// NaN, לא undefined בטקסט, ולא קריסה.
const degenerate = [
  loadShareHint({ load: 10, meanLoad: 5, perShiftLoad: 0 }),
  loadShareHint({ load: 10, meanLoad: 5, perShiftLoad: -3 }),
  loadShareHint({ load: 10, meanLoad: 5 }),
  loadShareHint(undefined),
  loadShareHint({}),
];
check("FAIR-02 · קלטים מנוונים לעולם לא מייצרים NaN בטקסט, בלי קריסה",
  degenerate.every((r) => !String(r?.text ?? "").includes("NaN")),
  JSON.stringify(degenerate));

// ============================================================
console.log("\nloadTable — טבלת מסך הדוחות (FAIR-02, Phase 1 Plan 01-03)\n");
// ============================================================

const ltDate1 = weekStart;
const ltDate2 = addDays(weekStart, 1);

// Test A (the whole point of the task) — שני שומרים עם אותה ספירה, אחד
// נושא לילות. אותם תאריכים משני הצדדים כדי שמכפיל הסופ"ש יהיה זהה בין
// השניים ורק מכפיל הסוג יסביר את הפער.
const ltGuardsA = [
  { id: "la1", name: "רועי כהן" },
  { id: "la2", name: "דנה לוי" },
];
const ltShiftsA = [
  day(ltDate1, "la1"), day(ltDate2, "la1"),
  night(ltDate1, "la2"), night(ltDate2, "la2"),
];
const tableA = loadTable(ltGuardsA, ltShiftsA);
const rowA1 = tableA.rows.find((r) => r.guardId === "la1");
const rowA2 = tableA.rows.find((r) => r.guardId === "la2");
check("FAIR-02 · loadTable · אותה ספירה, נטל שונה — מי שנשא לילה נחשב עמוס יותר",
  rowA1.count === rowA2.count && rowA1.load !== rowA2.load && rowA2.load > rowA1.load,
  JSON.stringify({ rowA1, rowA2 }));

// Test B (chain of custody) — כל שורה, לכל שומר, תואמת בדיוק את
// teamAverages לאותו שומר. לא שורה אחת — כולן.
const ltGuardsB = [
  { id: "g1", name: "אלה" },
  { id: "g2", name: "יניר" },
  { id: "g3", name: "נועה" },
];
const ltShiftsB = [
  day(ltDate1, "g1"), day(ltDate2, "g1"),
  night(ltDate1, "g2"), night(ltDate2, "g2"),
  day(ltDate1, "g3"),
];
const tableB = loadTable(ltGuardsB, ltShiftsB);
const taB = teamAverages(ltGuardsB, ltShiftsB);
const chainOfCustody = tableB.rows.every((r) => {
  const src = taB.perGuard[r.guardId];
  return (
    Math.abs(r.load - Math.round(src.load * 10) / 10) < 1e-9 &&
    r.hours === Math.round(src.hours) &&
    r.count === src.count &&
    r.nights === src.nights
  );
});
check("FAIR-02 · loadTable · כל שורה תואמת את teamAverages לאותו שומר — לא רק שורה אחת",
  chainOfCustody && tableB.rows.length === ltGuardsB.length, JSON.stringify(tableB.rows));

// Test C (the regression that would otherwise be silent) — לפחות שומר
// אחד שבו הנטל שונה מהשעות בדיוק שהטבלה מדפיסה.
check("FAIR-02 · loadTable · עמודת הנטל אינה עמודת השעות בהסוואה",
  tableB.rows.some((r) => r.load !== r.hours), JSON.stringify(tableB.rows));

// Test D (the team average is not a fourth formula) — meanLoad זהה
// בדיוק ל-teamAverages().avg.load, כולל כלל האוכלוסייה שלו: שומר שלא
// שובץ בכלל עדיין נספר במכנה, והממוצע יורד כשמוסיפים אותו.
check("FAIR-02 · loadTable · meanLoad זהה בדיוק ל-teamAverages().avg.load",
  tableB.meanLoad === taB.avg.load, JSON.stringify({ table: tableB.meanLoad, ta: taB.avg.load }));
const ltGuardsD = [...ltGuardsB, { id: "g4", name: "עומר" }];
const tableD = loadTable(ltGuardsD, ltShiftsB);
check("FAIR-02 · loadTable · שומר שלא שובץ עדיין נספר במכנה — הממוצע יורד",
  tableD.meanLoad < tableB.meanLoad, JSON.stringify({ before: tableB.meanLoad, after: tableD.meanLoad }));

// Test E (`meanShiftLoad` is behaviour-preserving) — אותה תוצאה כמו חישוב
// עצמאי מאותה רשימת משמרות, ו-fairnessPlan עדיין מחזיר perShiftLoad תקין.
const independentMean = ltShiftsB.length
  ? ltShiftsB.reduce((a, s) => a + shiftLoad(s), 0) / ltShiftsB.length
  : 1;
check("FAIR-02 · loadTable · meanShiftLoad זהה לחישוב עצמאי מאותה רשימת משמרות",
  meanShiftLoad(ltShiftsB) === independentMean,
  JSON.stringify({ meanShiftLoad: meanShiftLoad(ltShiftsB), independentMean }));
const planWithExtracted = fairnessPlan({ guards: ltGuardsB, history: ltShiftsB, planned: [], until: weekStart, days: 14 });
check("FAIR-02 · loadTable · fairnessPlan עדיין מחזיר perShiftLoad תקין אחרי המיצוי ל-meanShiftLoad",
  Math.abs(planWithExtracted.perShiftLoad - Math.round(independentMean * 10) / 10) < 1e-9,
  String(planWithExtracted.perShiftLoad));

// Test F (determinism and ordering, D-04) — מיון יורד לפי נטל, שובר שוויון
// לקסיקוגרפי יציב על מזהה השומר, ושתי הרצות על אותו קלט מזהות לחלוטין.
const ltGuardsF = [
  { id: "fz2", name: "שני" },
  { id: "fz1", name: "אחד" },
];
const ltShiftsF = [day(ltDate1, "fz1"), day(ltDate1, "fz2")]; // נטל זהה בדיוק
const tableF1 = loadTable(ltGuardsF, ltShiftsF);
const tableF2 = loadTable(ltGuardsF, ltShiftsF);
check("FAIR-02 · loadTable · שני שומרים בנטל זהה ממוינים לקסיקוגרפית לפי מזהה",
  tableF1.rows[0].guardId === "fz1" && tableF1.rows[1].guardId === "fz2",
  JSON.stringify(tableF1.rows.map((r) => r.guardId)));
check("FAIR-02 · loadTable · שתי הרצות על אותו קלט מחזירות תוצאה זהה לחלוטין (דטרמיניזם)",
  JSON.stringify(tableF1) === JSON.stringify(tableF2));
const tableBAgain = loadTable(ltGuardsB, ltShiftsB);
check("FAIR-02 · loadTable · הסדר יורד לפי נטל על פני רוסטר מעורב, ועקבי בין הרצות",
  tableB.rows.every((r, i) => i === 0 || tableB.rows[i - 1].load >= r.load) &&
    JSON.stringify(tableB) === JSON.stringify(tableBAgain));

// Test G (degenerate input) — צוות ריק, משמרות ריקות, ומשמרת ששייכת
// לשומר שכבר לא בצוות — לעולם לא קריסה, NaN או undefined בשורה.
const emptyTable = loadTable([], []);
check("FAIR-02 · loadTable · צוות ומשמרות ריקים לא מפילים את החישוב",
  emptyTable.rows.length === 0 && emptyTable.meanLoad === 0 && emptyTable.totalAssigned === 0 &&
    emptyTable.guardCount === 0 && !Number.isNaN(emptyTable.perShiftLoad),
  JSON.stringify(emptyTable));
const ghostTable = loadTable(
  [{ id: "real", name: "קיים" }],
  [day(ltDate1, "ghost"), day(ltDate1, "real")]
);
check("FAIR-02 · loadTable · משמרת של שומר שהוסר מהצוות לא קורסת ולא מייצרת NaN/undefined",
  ghostTable.rows.length === 1 && ghostTable.rows[0].guardId === "real" &&
    !Number.isNaN(ghostTable.rows[0].load) && ghostTable.rows[0].load !== undefined,
  JSON.stringify(ghostTable));

// ============================================================
console.log("\nchartTheme — צבעי המסגרת של תרשימי הדוחות (FAIR-02, Phase 1 Plan 01-03)\n");
// ============================================================

// ערכי הטוקנים כפי שהם נקראים ישירות מתוך tokens.css, בשתי הערכות.
const LIGHT_CHART_TOKENS = {
  "--text-muted": "74 106 100",
  "--hairline": "rgba(28, 59, 55, 0.11)",
  "--surface-raised": "rgba(255, 255, 255, 0.97)",
  "--text": "28 59 55",
};
const DARK_CHART_TOKENS = {
  "--text-muted": "160 190 182",
  "--hairline": "rgba(174, 222, 210, 0.13)",
  "--surface-raised": "rgba(19, 45, 41, 0.88)",
  "--text": "239 238 226",
};

// Test H — סימון הערוצים המופרדים ברווח הופך ל-rgb() בפסיקים, גם כשהערך
// מגיע עם הרווח המוביל ש-getComputedStyle מחזיר בדפדפן אמיתי.
const themeChannels = chartTheme((name) => (name === "--text-muted" ? "74 106 100" : ""));
check("FAIR-02 · chartTheme · ערוץ RGB מופרד-ברווח הופך ל-rgb() בפסיקים",
  themeChannels.axis === "rgb(74, 106, 100)", themeChannels.axis);
const themeChannelsPadded = chartTheme((name) => (name === "--text-muted" ? " 74 106 100" : ""));
check("FAIR-02 · chartTheme · רווח מוביל אמיתי (getComputedStyle) לא שובר את הצורה",
  themeChannelsPadded.axis === themeChannels.axis, themeChannelsPadded.axis);

// Test I — ערך rgba() מוגמר עובר בייט-לבייט, גם עם רווח מוביל — ה-alpha
// הוא העיצוב ולעולם לא נדרס.
const themeRgba = chartTheme((name) => (name === "--hairline" ? "rgba(28, 59, 55, 0.11)" : ""));
check("FAIR-02 · chartTheme · rgba() מוגמר עובר ללא שינוי — ה-alpha הוא העיצוב",
  themeRgba.grid === "rgba(28, 59, 55, 0.11)", themeRgba.grid);
const themeRgbaPadded = chartTheme((name) => (name === "--hairline" ? " rgba(28, 59, 55, 0.11)" : ""));
check("FAIR-02 · chartTheme · אותו rgba() עם רווח מוביל מייצר תוצאה זהה בייט-לבייט",
  themeRgbaPadded.grid === themeRgba.grid, themeRgbaPadded.grid);

// Test J — שום ערך לא ריק, לא NaN, ולא הפניה שלא נפתרה — גם כשהקורא לא
// מחזיר כלום (המקרה של "אין DOM").
const themeNoDom = chartTheme(() => "");
const flatValues = [themeNoDom.axis, themeNoDom.grid, themeNoDom.tooltip.background, themeNoDom.tooltip.color];
check("FAIR-02 · chartTheme · שום ערך אינו ריק, NaN או הפניה שלא נפתרה",
  flatValues.every((v) => typeof v === "string" && v.length > 0 && !v.includes("NaN") && !v.includes("var(")),
  JSON.stringify(themeNoDom));

// Test K — הערכה משיגה בפועל את התרשים: בהיר וכהה מייצרים ציר, רשת
// ורקע/טקסט tooltip שונים.
const themeLight = chartTheme((name) => LIGHT_CHART_TOKENS[name] ?? "");
const themeDark = chartTheme((name) => DARK_CHART_TOKENS[name] ?? "");
check("FAIR-02 · chartTheme · ערכת בהיר וכהה מייצרות ציר, רשת ו-tooltip שונים",
  themeLight.axis !== themeDark.axis &&
    themeLight.grid !== themeDark.grid &&
    themeLight.tooltip.background !== themeDark.tooltip.background &&
    themeLight.tooltip.color !== themeDark.tooltip.color,
  JSON.stringify({ light: themeLight, dark: themeDark }));

// Test L — הרשימה הלבנה היא החוזה: בדיוק ארבעת הטוקנים האלה, לא פחות
// ולא יותר, ולא אף אחד אחר.
const requestedTokens = new Set();
chartTheme((name) => {
  requestedTokens.add(name);
  return LIGHT_CHART_TOKENS[name] ?? "";
});
check("FAIR-02 · chartTheme · הרשימה הלבנה של הטוקנים היא בדיוק מה שהמודול מבקש",
  JSON.stringify([...requestedTokens].sort()) ===
    JSON.stringify(["--hairline", "--surface-raised", "--text", "--text-muted"]),
  JSON.stringify([...requestedTokens].sort()));

// Test M — הפולבק לא צובע ערכים אמיתיים (נבדק מול כהה, כי הפולבק שווה
// בכוונה לערכי הבהיר עצמם), וקורא בלי DOM עדיין מחזיר תוצאה שלמה.
check("FAIR-02 · chartTheme · כשיש ערכים אמיתיים (כהה), אף ערך פולבק לא מופיע בתוצאה",
  themeDark.axis !== themeNoDom.axis &&
    themeDark.grid !== themeNoDom.grid &&
    themeDark.tooltip.background !== themeNoDom.tooltip.background &&
    themeDark.tooltip.color !== themeNoDom.tooltip.color,
  JSON.stringify({ dark: themeDark, fallback: themeNoDom }));
check("FAIR-02 · chartTheme · קורא בלי DOM עדיין מחזיר תוצאה שלמה ולא ריקה, בלי קריסה",
  typeof themeNoDom.axis === "string" && themeNoDom.axis.length > 0 &&
    typeof themeNoDom.grid === "string" && themeNoDom.grid.length > 0 &&
    typeof themeNoDom.tooltip.background === "string" && themeNoDom.tooltip.background.length > 0 &&
    typeof themeNoDom.tooltip.color === "string" && themeNoDom.tooltip.color.length > 0,
  JSON.stringify(themeNoDom));

// Test N (T-01-11) — ערך זבל שלא מזוהה כאף צורה נופל לפולבק, ולא מוזרק
// כמו שהוא לתוך אובייקט ה-style.
const themeJunk = chartTheme((name) => (name === "--text-muted" ? "javascript:alert(1)" : ""));
check("FAIR-02 · chartTheme · ערך זבל/לא-מזוהה נופל לפולבק ולעולם לא מוזרק כמו שהוא",
  themeJunk.axis === themeNoDom.axis && themeJunk.axis !== "javascript:alert(1)",
  themeJunk.axis);

// ============================================================
console.log("\nloadShareHint על מסך הדוחות — התג ההוגנות דרך שדות loadTable (FAIR-02, Phase 1 Plan 01-03 Task 3)\n");
// ============================================================

// Test O — התג הוא ההכרעה המשותפת, לא אחת מקומית: מזין את loadShareHint
// אך ורק בשדות שהטבלה כבר חושפת (row.load, table.meanLoad,
// table.perShiftLoad) על רוסטר שבו אחד ברור מעל הממוצע והשני ברור
// מתחתיו. ה-level שנבדק נגדו נלקח מהתפיסה החיה של הפרקונדישן, לא הונח.
const ltGuardsO = [
  { id: "o1", name: "עמוס" }, // שלושה לילות — כבד
  { id: "o2", name: "קלה" }, // יום אחד — קל
];
const ltShiftsO = [
  night(ltDate1, "o1"), night(ltDate2, "o1"), night(addDays(weekStart, 2), "o1"),
  day(ltDate1, "o2"),
];
const tableO = loadTable(ltGuardsO, ltShiftsO);
const rowO1 = tableO.rows.find((r) => r.guardId === "o1");
const rowO2 = tableO.rows.find((r) => r.guardId === "o2");
const hintO1 = loadShareHint({ load: rowO1.load, meanLoad: tableO.meanLoad, perShiftLoad: tableO.perShiftLoad });
const hintO2 = loadShareHint({ load: rowO2.load, meanLoad: tableO.meanLoad, perShiftLoad: tableO.perShiftLoad });
check("FAIR-02 · loadTable · loadShareHint מזהה מי מעל הממוצע ומי מתחתיו, אך ורק דרך שדות הטבלה",
  hintO1?.level === "over" && hintO2?.level === "under",
  JSON.stringify({ rowO1, rowO2, meanLoad: tableO.meanLoad, perShiftLoad: tableO.perShiftLoad, hintO1, hintO2 }));

// Test P — שתיקה היא עדיין תשובה לגיטימית: מי שבדיוק על הממוצע (שני
// שומרים בנטל זהה, tableF1 מ-Task 1) לא מקבל תג, גם דרך שדות הטבלה.
const rowAtMean = tableF1.rows[0];
const hintAtMean = loadShareHint({ load: rowAtMean.load, meanLoad: tableF1.meanLoad, perShiftLoad: tableF1.perShiftLoad });
check("FAIR-02 · loadTable · מי שבדיוק על הממוצע לא מקבל תג, גם דרך שדות הטבלה",
  hintAtMean === null,
  JSON.stringify({ row: rowAtMean, meanLoad: tableF1.meanLoad, perShiftLoad: tableF1.perShiftLoad }));

// Test Q — מילים, לא רק גוון: שני הכיוונים מייצרים טקסטים שונים ולא ריקים.
check("FAIR-02 · loadTable · שני הכיוונים (מעל/מתחת) מייצרים טקסט שונה ולא ריק — לא רק גוון",
  hintO1.text !== hintO2.text && hintO1.text.length > 0 && hintO2.text.length > 0,
  JSON.stringify({ over: hintO1.text, under: hintO2.text }));

// Test R (D-02) — אין סף שני קבוע: אותה סטייה מוחלטת נשארת בשקט על
// משמרת ממוצעת כבדה ומקבלת תג על משמרת ממוצעת קלה. תכונת 01-02 עצמה,
// נבדקת מחדש כאן דרך שם השדות שהמסך הזה מספק (meanLoad, perShiftLoad).
const sameDeviationHeavyViaTable = loadShareHint({ load: 23, meanLoad: 20, perShiftLoad: 10 });
const sameDeviationLightViaTable = loadShareHint({ load: 23, meanLoad: 20, perShiftLoad: 2 });
check("FAIR-02 · loadTable · שום סף שני קבוע — אותה סטייה שקטה על משמרת כבדה, מתויגת על משמרת קלה",
  sameDeviationHeavyViaTable === null && sameDeviationLightViaTable?.level === "over",
  JSON.stringify({ heavy: sameDeviationHeavyViaTable, light: sameDeviationLightViaTable }));

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
