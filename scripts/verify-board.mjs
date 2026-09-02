// Standalone sanity check for the unified board's merge (Phase 5, BOARD-01).
//   node scripts/verify-board.mjs
//
// Pure module only — no browser, no database. Covers the merge-completeness
// contract (nothing is ever silently dropped, Pitfall 2), the timeless-item
// anchoring rule, and determinism (CLAUDE.md iron rule 1).

import {
  boardItemsForDates,
  boardShapeOf,
  formatDateHe,
  rangeTextHe,
  weekFrom,
} from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const shuffle = (arr, seed) => {
  // דטרמיניסטי בכוונה — Math.random() אסור אפילו בבדיקה שמוכיחה דטרמיניזם.
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// ============================================================
console.log("\nBOARD-01 · boardItemsForDates — פיקסצ'ר שבוע קבוע (2026-09-06)\n");
// ============================================================

const sunday = "2026-09-06";
const weekDates = weekFrom(sunday);

const shifts = [
  { id: "s1", date: "2026-09-06", startTime: "08:00", endTime: "16:00", label: "בוקר", assignedGuards: [], category: "" },
  { id: "s2", date: "2026-09-06", startTime: "16:00", endTime: "22:00", label: "ערב", assignedGuards: [], category: "" },
];

const tasks = [
  // [0] engine-eligible: יום בודד, שתי שעות
  {
    id: "t-eligible", title: "משימה במנוע", category: "", assignees: [], status: "open", priority: "medium",
    startDate: "2026-09-07", dueDate: "2026-09-07", startTime: "09:00", endTime: "11:00", positionId: null,
  },
  // [1] קפואה: dueDate בלבד, בלי שעות
  {
    id: "t-frozen", title: "משימה קפואה", category: "", assignees: [], status: "open", priority: "medium",
    startDate: null, dueDate: "2026-09-08", startTime: null, endTime: null, positionId: null,
  },
  // [2] מרובת ימים: startDate < dueDate, בלי שעות
  {
    id: "t-multi", title: "משימה מרובת ימים", category: "", assignees: [], status: "open", priority: "medium",
    startDate: "2026-09-06", dueDate: "2026-09-09", startTime: null, endTime: null, positionId: null,
  },
  // [3] שורת עמדה שבועית — בדיוק כמו plannedRowsForWeek's weekly branch
  {
    id: "t-weekly-pos", title: "עמדה שבועית", category: "כוננות", assignees: [], status: "open", priority: "medium",
    startDate: sunday, dueDate: "2026-09-12", startTime: null, endTime: null, positionId: "pos-weekly-1",
  },
  // [4] תאריך עוגן מחוץ לשבוע המוצג
  {
    id: "t-outside", title: "משימה בשבוע אחר", category: "", assignees: [], status: "open", priority: "medium",
    startDate: null, dueDate: "2026-09-20", startTime: null, endTime: null, positionId: null,
  },
  // [5] בלי שום תאריך עוגן
  {
    id: "t-nodate", title: "משימה בלי תאריך", category: "", assignees: [], status: "open", priority: "medium",
    startDate: null, dueDate: null, startTime: null, endTime: null, positionId: null,
  },
];

const result = boardItemsForDates(shifts, tasks, weekDates);

const totalPlaced = result.days.reduce((sum, d) => sum + d.timeless.length + d.timed.length, 0);
check(
  "סכום הפריטים בימים + outside + undated שווה בדיוק ל-shifts.length + tasks.length",
  totalPlaced + result.outside + result.undated === shifts.length + tasks.length,
  `placed=${totalPlaced} outside=${result.outside} undated=${result.undated} expected=${shifts.length + tasks.length}`
);
check("משימה עם תאריך עוגן מחוץ לשבוע נספרת ב-outside", result.outside === 1, `outside=${result.outside}`);
check("משימה בלי שום תאריך עוגן נספרת ב-undated", result.undated === 1, `undated=${result.undated}`);

check("boardShapeOf מחזיר null למשימה שכן נכנסת למנוע", boardShapeOf(tasks[0]) === null);
check("boardShapeOf מחזיר לא-null למשימה הקפואה (חד-יומית, בלי שעות)", boardShapeOf(tasks[1]) !== null);
check("boardShapeOf מחזיר לא-null למשימה מרובת-הימים", boardShapeOf(tasks[2]) !== null);
check("boardShapeOf מחזיר לא-null לשורת העמדה השבועית", boardShapeOf(tasks[3]) !== null);

const frozenShape = boardShapeOf(tasks[1]);
check("לפריט timeless אין בכלל startTime (in operator)", !("startTime" in frozenShape));
check("לפריט timeless אין בכלל endTime (in operator)", !("endTime" in frozenShape));
check("התאריך של הפריט הקפוא שווה ל-dueDate שלו", frozenShape.date === tasks[1].dueDate);

check(
  "המשימה מרובת-הימים מופיעה פעם אחת בלבד בכל השבוע, לא פעם ליום",
  result.days.filter((d) => [...d.timeless, ...d.timed].some((it) => it.id === "t-multi")).length === 1
);

const satGroup = result.days.find((d) => d.date === "2026-09-12");
check(
  "שורת העמדה השבועית נוחתת בקבוצת timeless של יום שבת (dueDate = יום שבת)",
  Boolean(satGroup) && satGroup.timeless.some((it) => it.id === "t-weekly-pos")
);

const sundayGroup = result.days.find((d) => d.date === "2026-09-06");
check(
  "בתוך יום ראשון, timed יוצא לפי startTime עולה",
  sundayGroup.timed.length === 2 && sundayGroup.timed[0].id === "s1" && sundayGroup.timed[1].id === "s2"
);

// ---- דטרמיניזם ----
const run1 = boardItemsForDates(shifts, tasks, weekDates);
const run2 = boardItemsForDates(shifts, tasks, weekDates);
const run3 = boardItemsForDates(shifts, tasks, weekDates);
check(
  "שלוש קריאות רצופות על אותו קלט מייצרות JSON זהה",
  JSON.stringify(run1) === JSON.stringify(run2) && JSON.stringify(run2) === JSON.stringify(run3)
);

const shuffledResult = boardItemsForDates(shuffle(shifts, 3), shuffle(tasks, 11), weekDates);
check(
  "shifts ו-tasks מעורבבים דטרמיניסטית מייצרים JSON זהה לתוצאה הלא-מעורבבת",
  JSON.stringify(shuffledResult) === JSON.stringify(run1)
);

// ---- rangeTextHe ----
check(
  "rangeTextHe מחזיר משפט דו-תאריכי למשימה מרובת ימים",
  rangeTextHe(tasks[2]) === `${formatDateHe(tasks[2].startDate)} – ${formatDateHe(tasks[2].dueDate)}`
);
check(
  "rangeTextHe מחזיר משפט חד-תאריכי למשימה חד-יומית",
  rangeTextHe(tasks[1]) === formatDateHe(tasks[1].dueDate)
);

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
