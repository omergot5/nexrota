// Standalone sanity check for standing positions (Phase 4).
//   node scripts/verify-positions.mjs
//
// Pure modules only — no browser, no database. Covers POS-02 through POS-05
// and the D-02 tracer slice: a template position filled end-to-end by the
// real, unmodified autoAssign().

import {
  expectedDatesForWeek,
  plannedRowsForWeek,
  missingRowsForWeek,
  qualifiedGuardsForPosition,
  workingGuardIdsForWeek,
} from "../src/lib/positions.js";
import { addDays, startOfWeek, diffInDays } from "../src/lib/dates.js";
import { autoAssign, isQualified } from "../src/lib/autoAssign.js";
import {
  shiftFromRow,
  shiftToRow,
  taskFromRow,
  taskColumns,
  positionFromRow,
  positionToRow,
} from "../src/lib/api.js";

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
console.log("\nPOS-03 · expectedDatesForWeek — תאריכי הזהות של עמדת תבנית\n");
// ============================================================

const templatePos = { id: "pos-1", shape: "template", category: "שמירות", weekdays: [0, 1, 2, 3, 4] };
const sunday = "2026-09-06";

const run1 = expectedDatesForWeek(templatePos, sunday);
const run2 = expectedDatesForWeek(templatePos, sunday);
const run3 = expectedDatesForWeek(templatePos, sunday);

check(
  "מחזיר בדיוק את חמשת התאריכים 2026-09-06..2026-09-10",
  JSON.stringify(run1) === JSON.stringify(["2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"]),
  JSON.stringify(run1)
);
check(
  "שלוש קריאות רצופות מחזירות מערכים זהים ב-JSON.stringify",
  JSON.stringify(run1) === JSON.stringify(run2) && JSON.stringify(run2) === JSON.stringify(run3)
);

// אותה עמדה על יום ראשון בעבר הרחוק ועל יום ראשון בעתיד הרחוק — התוצאה
// תלויה בארגומנטים בלבד, לא בשעון הקיר.
const mondayOnlyPos = { id: "pos-2", shape: "template", category: "שמירות", weekdays: [1] };
const pastSunday = startOfWeek("2001-03-11");
const futureSunday = startOfWeek("2099-07-19");
const pastDates = expectedDatesForWeek(mondayOnlyPos, pastSunday);
const futureDates = expectedDatesForWeek(mondayOnlyPos, futureSunday);
check(
  "היסט זהה מיום ראשון גם בעבר הרחוק וגם בעתיד הרחוק (תלוי בארגומנטים בלבד)",
  diffInDays(pastDates[0], pastSunday) === 1 && diffInDays(futureDates[0], futureSunday) === 1,
  `past offset=${diffInDays(pastDates[0], pastSunday)}, future offset=${diffInDays(futureDates[0], futureSunday)}`
);

const weeklyPos = { id: "pos-3", shape: "weekly", category: "כוננות" };
const weeklyDates = expectedDatesForWeek(weeklyPos, sunday);
check(
  "shape=weekly מחזיר בדיוק איבר אחד, addDays(sunday, 6)",
  weeklyDates.length === 1 && weeklyDates[0] === addDays(sunday, 6),
  JSON.stringify(weeklyDates)
);

// ============================================================
console.log("\nPOS-04 · missingRowsForWeek — אידמפוטנטיות\n");
// ============================================================

const planned = plannedRowsForWeek(templatePos, sunday);
check("plannedRowsForWeek מייצר 5 שורות template", planned.length === 5, `${planned.length}`);

const missingFirstRun = missingRowsForWeek(templatePos, sunday, []);
check("missingRowsForWeek(position, sunday, []) מחזיר 5 שורות", missingFirstRun.length === 5, `${missingFirstRun.length}`);

// מדמים שהשורות האלה כבר התממשו (קיבלו id אמיתי מ-DB) ומזינים אותן בחזרה.
const realized = missingFirstRun.map((r, i) => ({ ...r, id: `shift-${i}` }));
const missingSecondRun = missingRowsForWeek(templatePos, sunday, realized);
check("קריאה שנייה על אותו שבוע עם כל השורות שהתממשו מחזירה מערך ריק", missingSecondRun.length === 0);

const realizedShuffled = shuffle(realized, 7);
const missingShuffledRun = missingRowsForWeek(templatePos, sunday, realizedShuffled);
check(
  "אותה קריאה עם realized בסדר מעורבב מחזירה תוצאה זהה",
  JSON.stringify(missingSecondRun) === JSON.stringify(missingShuffledRun)
);

const otherPositionRow = { positionId: "some-other-position", date: planned[0].date, id: "shift-other" };
const missingWithOtherPosition = missingRowsForWeek(templatePos, sunday, [otherPositionRow]);
check(
  "realized שמכיל שורה של עמדה אחרת באותו תאריך אינו מדכא שורה",
  missingWithOtherPosition.length === 5,
  `${missingWithOtherPosition.length}`
);

// ============================================================
console.log("\nPOS-02/D-04 · qualifiedGuardsForPosition\n");
// ============================================================

const guardNoRestriction = { id: "g1", name: "בלי הגבלה", qualifiedCategories: null };
const guardEmptyList = { id: "g2", name: "רשימה ריקה", qualifiedCategories: [] };
const guardKitchenOnly = { id: "g3", name: "מטבח בלבד", qualifiedCategories: ["מטבח"] };
const guardGuardDuty = { id: "g4", name: "כשיר לשמירות", qualifiedCategories: ["שמירות"] };

const guardPos = { id: "pos-guard", shape: "template", category: "שמירות" };
check(
  "qualifiedCategories: null → כשיר",
  qualifiedGuardsForPosition(guardPos, [guardNoRestriction]).length === 1
);
check(
  "qualifiedCategories: [] → כשיר",
  qualifiedGuardsForPosition(guardPos, [guardEmptyList]).length === 1
);
check(
  'qualifiedCategories: ["מטבח"] → לא כשיר לעמדת "שמירות"',
  qualifiedGuardsForPosition(guardPos, [guardKitchenOnly]).length === 0
);

const noCategoryPos = { id: "pos-nocat", shape: "template", category: "" };
check(
  "עמדה בלי קטגוריה → כולם כשירים",
  qualifiedGuardsForPosition(noCategoryPos, [guardNoRestriction, guardEmptyList, guardKitchenOnly, guardGuardDuty]).length === 4
);

// ============================================================
console.log("\nPOS-05 · שתי הרשימות אינן נגזרות מאותו שדה\n");
// ============================================================

const posForWork = { id: "pos-work", shape: "template", category: "שמירות" };
const shiftsThisWeek = [
  { id: "s1", positionId: "pos-work", date: sunday, assignedGuards: ["g3"] }, // g3 לא כשיר, אבל עובד בפועל
];
const working = workingGuardIdsForWeek(posForWork, { shifts: shiftsThisWeek, tasks: [] }, sunday);
const qualified = qualifiedGuardsForPosition(posForWork, [guardKitchenOnly, guardGuardDuty]).map((g) => g.id);

check(
  "שומר לא-כשיר שמופיע ב-assignedGuards מופיע ב-workingGuardIdsForWeek",
  working.includes("g3")
);
check(
  "אותו שומר לא-כשיר אינו מופיע ב-qualifiedGuardsForPosition",
  !qualified.includes("g3")
);
check(
  "שומר כשיר בלי שורה מופיע רק ברשימת הכשירים",
  qualified.includes("g4") && !working.includes("g4")
);

// ============================================================
console.log("\nD-02 · מקצה לקצה — autoAssign() האמיתי מאייש עמדת תבנית\n");
// ============================================================

const e2ePosition = { id: "pos-e2e", shape: "template", category: "שמירות", weekdays: [0, 1, 2, 3, 4], startTime: "08:00", endTime: "16:00", requiredGuards: 1 };
const e2ePlanned = plannedRowsForWeek(e2ePosition, sunday).map((r, i) => ({
  id: `e2e-shift-${i}`,
  date: r.date,
  startTime: r.startTime,
  endTime: r.endTime,
  type: r.type,
  category: r.category,
  requiredGuards: r.requiredGuards,
  label: r.label,
  positionId: r.positionId,
  assignedGuards: [],
}));
check("e2e: חמש שורות תבנית מוכנות לאיוש", e2ePlanned.length === 5);

const e2eGuardsQualified = [
  { id: "qa", name: "כשיר א", qualifiedCategories: null },
  { id: "qb", name: "כשיר ב", qualifiedCategories: ["שמירות"] },
];
const e2eGuardsUnqualified = [
  { id: "ub", name: "מטבח בלבד", qualifiedCategories: ["מטבח"] },
];
const e2eGuards = [...e2eGuardsQualified, ...e2eGuardsUnqualified];

const e2eResult = autoAssign({ shifts: e2ePlanned, guards: e2eGuards, availability: {} });
const assignedGuardIds = new Set(e2eResult.assignments.map((a) => a.guardId));

check(
  "העמדה מאוישת — יש לפחות שיבוץ אחד",
  e2eResult.assignments.length > 0,
  `assignments=${e2eResult.assignments.length}`
);
check(
  "אף שומר לא-כשיר אינו נבחר",
  !assignedGuardIds.has("ub")
);
check(
  "כל שיבוץ נושא נימוק קריא (parts לא ריק) — assignmentMeta עתידי נשען על זה",
  e2eResult.assignments.every((a) => Array.isArray(a.parts) && a.parts.length > 0)
);
// isQualified מיובא ולא שוכפל — D-04 ללא כתיבה מקבילה.
check(
  "isQualified המיובא מ-autoAssign.js הוא זה שסינן — לא הגדרה שנייה",
  e2eGuardsUnqualified.every((g) => !isQualified(g, e2ePosition.category))
);

// דטרמיניזם: הרצה שנייה עם מערך שומרים מעורבב מחזירה תוצאה זהה.
const e2eResultShuffled = autoAssign({ shifts: e2ePlanned, guards: shuffle(e2eGuards, 3), availability: {} });
const normalize = (res) =>
  JSON.stringify(
    [...res.assignments]
      .sort((a, b) => (a.shiftId + a.guardId).localeCompare(b.shiftId + b.guardId))
      .map((a) => ({ shiftId: a.shiftId, guardId: a.guardId, score: a.score }))
  );
check(
  "הרצת אותו נתיב פעמיים כשמערך השומרים מעורבב מחזירה תוצאה זהה",
  normalize(e2eResult) === normalize(e2eResultShuffled)
);

// ============================================================
console.log("\nמיפוי · round trips (position_id, positionToRow/positionFromRow)\n");
// ============================================================

const shiftRowWithPosition = {
  id: "row-1", date: sunday, label: "עמדת קבלה", start_time: "08:00:00", end_time: "16:00:00",
  required_guards: 1, type: "custom", category: "שמירות", position_id: "pos-xyz", published: false,
};
const shiftAppFromRow = shiftFromRow(shiftRowWithPosition);
check("shiftFromRow קורא position_id", shiftAppFromRow.positionId === "pos-xyz");
const shiftRoundTrip = shiftToRow(shiftAppFromRow, "T1");
check("shiftToRow(shiftFromRow(row)) משמר את position_id", shiftRoundTrip.position_id === "pos-xyz");

const taskRowWithPosition = {
  id: "task-1", title: "כוננות", category: "כוננות", assignees: ["g1"], status: "open", priority: "medium",
  start_date: sunday, due_date: addDays(sunday, 6), position_id: "pos-weekly-1",
};
const taskAppFromRow = taskFromRow(taskRowWithPosition);
check("taskFromRow קורא position_id", taskAppFromRow.positionId === "pos-weekly-1");
const taskColumnsRoundTrip = taskColumns(taskAppFromRow);
check("taskColumns(taskFromRow(row)) משמר את position_id", taskColumnsRoundTrip.position_id === "pos-weekly-1");

const positionRow = {
  id: "pos-9", team_code: "T1", shape: "template", title: "עמדת קבלה", category: "שמירות",
  weekdays: [0, 1, 2], start_time: "08:00:00", end_time: "16:00:00", required_guards: 2, active: true,
};
const positionApp = positionFromRow(positionRow);
const positionRoundTrip = positionToRow(positionApp, "T1");
check(
  "positionToRow(positionFromRow(row), code) משחזר shape/category/weekdays/required_guards",
  positionRoundTrip.shape === "template" &&
    positionRoundTrip.category === "שמירות" &&
    JSON.stringify(positionRoundTrip.weekdays) === JSON.stringify([0, 1, 2]) &&
    positionRoundTrip.required_guards === 2,
  JSON.stringify(positionRoundTrip)
);

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
