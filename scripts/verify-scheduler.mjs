// Standalone sanity check for the assignment engine.
//   node scripts/verify-scheduler.mjs
//
// Asserts the hard constraints actually hold on a generated week, and prints
// the coverage/fairness numbers so regressions are obvious.

import { autoAssign, checkAssignment, DEFAULT_RULES, shiftLoad, teamAverages } from "../src/lib/autoAssign.js";
import { shiftInterval, weekByOffset, taskAsShiftShape, withEngineTasks } from "../src/lib/dates.js";

const HOUR = 3600000;
let failures = 0;

const check = (label, cond, extra = "") => {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ---------- fixture ----------
const dates = weekByOffset(1);
const guards = [
  { id: "g1", name: "גיא לוי" },
  { id: "g2", name: "מיכל כהן" },
  { id: "g3", name: "אבי ישראלי" },
  { id: "g4", name: "רינה שמיר" },
  { id: "g5", name: "דן מזרחי" },
];

const shifts = [];
dates.forEach((date, i) => {
  shifts.push({
    id: `d${i}`, date, label: "משמרת יום", type: "morning",
    startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [],
  });
  shifts.push({
    id: `n${i}`, date, label: "משמרת לילה", type: "night",
    startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [],
  });
});

// Everyone available by default; carve out some real-world unavailability.
const availability = {};
for (const g of guards) {
  for (const s of shifts) availability[`${g.id}-${s.id}`] = { status: "available" };
}
availability["g1-n0"] = { status: "unavailable", comment: "אירוע משפחתי" };
availability["g2-n0"] = { status: "unavailable" };
availability["g3-n0"] = { status: "unavailable" };
availability["g4-d3"] = { status: "unavailable" };
availability["g5-d3"] = { status: "maybe" };

// ---------- run ----------
const result = autoAssign({ shifts, guards, availability });
const rules = result.rules;

console.log("\n=== summary ===");
console.log(result.summary);
console.log("\n=== load per guard ===");
for (const p of result.fairness.perGuard) {
  console.log(`  ${p.name.padEnd(12)} ${String(p.shifts).padStart(2)} משמרות · ${p.nights} לילות · ${p.hours} שעות`);
}

// ---------- assertions ----------
console.log("\n=== hard constraints ===");

const shiftById = new Map(shifts.map((s) => [s.id, s]));
const byGuard = new Map(guards.map((g) => [g.id, []]));
for (const a of result.assignments) {
  byGuard.get(a.guardId).push({ ...shiftInterval(shiftById.get(a.shiftId)), shiftId: a.shiftId });
}

// 1. never assigned to someone who said no
const violatedAvailability = result.assignments.filter(
  (a) => availability[`${a.guardId}-${a.shiftId}`]?.status === "unavailable"
);
check("no guard assigned to a shift they marked unavailable", violatedAvailability.length === 0,
  JSON.stringify(violatedAvailability));

// 2. no overlaps
let overlapCount = 0;
for (const [, ivs] of byGuard) {
  const sorted = [...ivs].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) overlapCount++;
  }
}
check("no guard double-booked", overlapCount === 0, `${overlapCount} overlaps`);

// 3. rest + consecutive-hours
let restViolations = 0;
let blockViolations = 0;
for (const [, ivs] of byGuard) {
  const sorted = [...ivs].sort((a, b) => a.start - b.start);
  let blockStart = null;
  let blockEnd = null;
  for (const iv of sorted) {
    if (blockEnd === null) {
      blockStart = iv.start; blockEnd = iv.end; continue;
    }
    const gap = (iv.start - blockEnd) / HOUR;
    if (gap === 0) {
      blockEnd = iv.end; // contiguous — same block
    } else {
      if ((blockEnd - blockStart) / HOUR > rules.maxConsecutiveHours) blockViolations++;
      if (gap < rules.minRestHours) restViolations++;
      blockStart = iv.start; blockEnd = iv.end;
    }
  }
  if (blockEnd !== null && (blockEnd - blockStart) / HOUR > rules.maxConsecutiveHours) blockViolations++;
}
check(`min rest of ${rules.minRestHours}h respected`, restViolations === 0, `${restViolations} violations`);
check(`max ${rules.maxConsecutiveHours}h consecutive respected`, blockViolations === 0, `${blockViolations} violations`);

// 4. weekly caps
const overCap = result.fairness.perGuard.filter((p) => p.shifts > rules.maxShiftsPerWeek);
check(`weekly cap of ${rules.maxShiftsPerWeek} shifts respected`, overCap.length === 0, JSON.stringify(overCap));
const overNights = result.fairness.perGuard.filter((p) => p.nights > rules.maxNightsPerWeek);
check(`night cap of ${rules.maxNightsPerWeek} respected`, overNights.length === 0, JSON.stringify(overNights));

// 5. required headcount never exceeded
let overfilled = 0;
for (const [sid, gids] of Object.entries(result.byShift)) {
  if (gids.length > Math.max(1, shiftById.get(sid).requiredGuards || 1)) overfilled++;
}
check("no shift over-staffed", overfilled === 0, `${overfilled} shifts`);

// 6. determinism
const again = autoAssign({ shifts, guards, availability });
check("deterministic across runs",
  JSON.stringify(again.byShift) === JSON.stringify(result.byShift));

// 7. quality bars
check("coverage >= 90%", result.summary.coverage >= 90, `${result.summary.coverage}%`);
check("workload spread <= 2 shifts", result.fairness.spread <= 2, `spread ${result.fairness.spread}`);

// 8. every assignment carries an explanation
const unexplained = result.assignments.filter((a) => !a.parts?.length);
check("every assignment has reasons", unexplained.length === 0, `${unexplained.length} without`);

// ---------- edge cases ----------
console.log("\n=== edge cases ===");
const noGuards = autoAssign({ shifts, guards: [], availability });
check("no guards -> everything unfilled, no crash", noGuards.unfilled.length === shifts.length);

const noShifts = autoAssign({ shifts: [], guards, availability });
check("no shifts -> empty result, no crash", noShifts.assignments.length === 0);

const allBusy = {};
for (const g of guards) for (const s of shifts) allBusy[`${g.id}-${s.id}`] = { status: "unavailable" };
const impossible = autoAssign({ shifts, guards, availability: allBusy });
check("everyone unavailable -> 0 assigned, reasons given",
  impossible.assignments.length === 0 && impossible.unfilled.every((u) => u.blockers.length > 0));

// ---------- preferences ----------
//
// The whole point of "preferred" is that it is *soft*. These checks pin down
// both halves of that: it must actually move the outcome when everything else
// is equal, and it must not be able to override a hard constraint, starve
// anyone, or pay out more than a plain "available" once it is switched off.
console.log("\n=== preferences ===");

// Two guards, one shift, identical in every respect except that g2 asked for it.
const duel = [
  { id: "s1", date: dates[0], label: "משמרת יום", type: "morning",
    startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [] },
];
const twoGuards = [{ id: "g1", name: "גיא" }, { id: "g2", name: "מיכל" }];

const tie = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "available" }, "g2-s1": { status: "available" } },
});
const preferWins = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "available" }, "g2-s1": { status: "preferred" } },
});
check("a preference breaks the tie between two equally free guards",
  preferWins.byShift.s1[0] === "g2", `got ${preferWins.byShift.s1[0]}, tie went to ${tie.byShift.s1[0]}`);

const preferOther = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "preferred" }, "g2-s1": { status: "available" } },
});
check("the preference decides it, not the guard ordering",
  preferOther.byShift.s1[0] === "g1", `got ${preferOther.byShift.s1[0]}`);

const preferOff = autoAssign({
  shifts: duel, guards: twoGuards, rules: { honourPreferences: false },
  availability: { "g1-s1": { status: "available" }, "g2-s1": { status: "preferred" } },
});
check("switching preferences off scores 'preferred' exactly as 'available'",
  preferOff.byShift.s1[0] === tie.byShift.s1[0],
  `got ${preferOff.byShift.s1[0]}, plain tie gives ${tie.byShift.s1[0]}`);

// A preference must never beat "unavailable" on the same slot for someone else,
// nor pull a guard past a hard constraint.
const greedy = {};
for (const g of guards) for (const s of shifts) greedy[`${g.id}-${s.id}`] = { status: "preferred" };
const allPreferred = autoAssign({ shifts, guards, availability: greedy });
check("everyone marking 'preferred' does not break the caps",
  allPreferred.fairness.perGuard.every(
    (p) => p.shifts <= DEFAULT_RULES.maxShiftsPerWeek && p.nights <= DEFAULT_RULES.maxNightsPerWeek
  ));
check("everyone marking 'preferred' stays as fair as everyone marking 'available'",
  allPreferred.fairness.spread <= 2, `spread ${allPreferred.fairness.spread}`);

// The realistic case the feature was built for: open on Sunday, would rather
// have Tuesday. Both are honoured as available; Tuesday should win the pull.
const twoDays = [
  { id: "sun", date: dates[0], label: "יום א", type: "morning",
    startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [] },
  { id: "tue", date: dates[2], label: "יום ג", type: "morning",
    startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [] },
];
const softPref = autoAssign({
  shifts: twoDays, guards: twoGuards,
  availability: {
    "g1-sun": { status: "available" }, "g1-tue": { status: "preferred" },
    "g2-sun": { status: "available" }, "g2-tue": { status: "available" },
  },
});
check("open on both days, prefers Tuesday -> gets Tuesday, Sunday still covered",
  softPref.byShift.tue[0] === "g1" && softPref.byShift.sun[0] === "g2",
  JSON.stringify(softPref.byShift));

const blocked = autoAssign({
  shifts: duel, guards: twoGuards,
  availability: { "g1-s1": { status: "preferred" }, "g2-s1": { status: "available" } },
  rules: { maxShiftsPerWeek: 0 },
});
check("a preference cannot push a guard past a hard cap", blocked.assignments.length === 0);

// The opportunity-cost rule holds guards back from non-preferred shifts. That
// must never cost coverage — a shift left open to honour a wish would be a
// worse product than no preferences at all.
const scattered = {};
for (const g of guards) for (const s of shifts) scattered[`${g.id}-${s.id}`] = { status: "available" };
scattered["g1-d2"] = { status: "preferred" };
scattered["g2-n4"] = { status: "preferred" };
scattered["g3-d5"] = { status: "preferred" };
const mixed = autoAssign({ shifts, guards, availability: scattered });
const baseline = autoAssign({ shifts, guards, availability:
  Object.fromEntries(Object.keys(scattered).map((k) => [k, { status: "available" }])) });
check("preferences never reduce coverage",
  mixed.summary.coverage >= baseline.summary.coverage,
  `${mixed.summary.coverage}% vs ${baseline.summary.coverage}% baseline`);
const wishes = [["g1", "d2"], ["g2", "n4"], ["g3", "d5"]];
const granted = wishes.filter(([gid, sid]) => (mixed.byShift[sid] || []).includes(gid));
check("scattered preferences are honoured where legal",
  granted.length >= 2,
  `${granted.length}/3 granted — ${JSON.stringify({ d2: mixed.byShift.d2, n4: mixed.byShift.n4, d5: mixed.byShift.d5 })}`);

check("preferred assignments say so in the explanation",
  preferWins.assignments[0].parts.some((p) => p.label.includes("ביקש")),
  JSON.stringify(preferWins.assignments[0].parts.map((p) => p.label)));

// ---------- swap safety (FR-4.4) ----------
// Approving a swap must run the same hard constraints the engine itself runs.
// Without this a supervisor can approve a swap that breaks a rest rule, which
// silently voids the promise that the system never produces an illegal roster.
console.log("\nswap safety");

const swapShifts = [
  { id: "s1", date: dates[0], label: "לילה", type: "night",
    startTime: "23:00", endTime: "07:00", requiredGuards: 1, assignedGuards: ["g1"] },
  { id: "s2", date: dates[1], label: "בוקר", type: "morning",
    startTime: "08:00", endTime: "16:00", requiredGuards: 1, assignedGuards: ["g2"] },
];
const swapAvail = {};
for (const g of guards) for (const s of swapShifts) swapAvail[`${g.id}-${s.id}`] = { status: "available" };

// g1 comes off s1 at 07:00 and s2 starts at 08:00 — one hour of rest, not eight.
const illegalSwap = checkAssignment({
  guard: guards[0], shift: swapShifts[1], shifts: swapShifts, availability: swapAvail,
});
check("swap that breaks minimum rest is rejected", illegalSwap.ok === false, JSON.stringify(illegalSwap));
check("rejection names the rest rule", illegalSwap.code === "rest", illegalSwap.code);
check("rejection carries a human reason",
  typeof illegalSwap.reason === "string" && illegalSwap.reason.length > 0);

// g3 holds nothing this week, so the same move is legal for them.
const legalSwap = checkAssignment({
  guard: guards[2], shift: swapShifts[1], shifts: swapShifts, availability: swapAvail,
});
check("swap with a free guard is allowed", legalSwap.ok === true, JSON.stringify(legalSwap));

// An explicit "unavailable" blocks a swap exactly as it blocks the engine.
const blockedSwap = checkAssignment({
  guard: guards[2], shift: swapShifts[1], shifts: swapShifts,
  availability: { ...swapAvail, "g3-s2": { status: "unavailable" } },
});
check("swap onto a shift the guard marked unavailable is rejected",
  blockedSwap.ok === false, blockedSwap.code);

// The guard already on the shift is not a candidate to be swapped onto it.
const alreadyOn = checkAssignment({
  guard: guards[1], shift: swapShifts[1], shifts: swapShifts, availability: swapAvail,
});
check("swap onto a shift the guard already holds is rejected",
  alreadyOn.code === "already", alreadyOn.code);

// ---------------------------------------------------------------
// נטל (FR-3.2) — הוגנות נמדדת במשקל התורנות, לא בספירתן.
// ---------------------------------------------------------------

const loadWeek = weekByOffset(1);
const dayShift = {
  id: "L1", date: loadWeek[1], startTime: "07:00", endTime: "19:00",
  type: "day", requiredGuards: 1, assignedGuards: [], label: "יום",
};
const nightShift = { ...dayShift, id: "L2", type: "night", startTime: "19:00", endTime: "07:00" };

check("לילה נושא יותר נטל מיום באותו אורך",
  shiftLoad(nightShift) > shiftLoad(dayShift),
  `${shiftLoad(nightShift)} vs ${shiftLoad(dayShift)}`);

const satIndex = loadWeek.findIndex((d) => new Date(`${d}T12:00:00`).getDay() === 6);
const satShift = { ...dayShift, id: "L3", date: loadWeek[satIndex] };
check("שבת נושאת יותר נטל מיום חול",
  shiftLoad(satShift) > shiftLoad(dayShift),
  `${shiftLoad(satShift)} vs ${shiftLoad(dayShift)}`);

// המכפילים אינם מוכפלים זה בזה: לילה בשבת אינו 1.4 × 1.25.
const satNight = { ...nightShift, id: "L4", date: loadWeek[satIndex] };
check("לילה בשבת נלקח לפי המכפיל החמור ולא לפי מכפלתם",
  Math.abs(shiftLoad(satNight) - shiftLoad(nightShift)) < 1e-9,
  `${shiftLoad(satNight)} vs ${shiftLoad(nightShift)}`);

/**
 * המבחן האמיתי: שניים, לילה ושתי משמרות יום. מי שכבר נשא את הלילה נמצא מעל
 * הממוצע בנטל, ולכן אסור שיקבל גם את שתי משמרות היום — למרות שספירה פשוטה
 * הייתה רואה כאן תיקו של שיבוץ אחד לכל אחד.
 */
const two = [{ id: "a", name: "א" }, { id: "b", name: "ב" }];
const seq = [
  { ...nightShift, id: "N1", date: loadWeek[0] },
  { ...dayShift, id: "D1", date: loadWeek[2] },
  { ...dayShift, id: "D2", date: loadWeek[4] },
];
const loadPlan = autoAssign({ shifts: seq, guards: two, availability: {} });
const holderOfNight = loadPlan.assignments.find((a) => a.shiftId === "N1")?.guardId;
const nextTwo = ["D1", "D2"].map((id) => loadPlan.assignments.find((a) => a.shiftId === id)?.guardId);
check("מי שנשא לילה לא מקבל גם את שתי משמרות היום",
  nextTwo.filter((g) => g === holderOfNight).length <= 1,
  JSON.stringify({ holderOfNight, nextTwo }));

// ---------------------------------------------------------------
// FAIR-01..04 (Phase 1, Plan 01-01) — נטל בכל מקום, לא רק בניקוד.
//
// ה-repro שהניע את הפאזה: 5 בקרים + 3 לילות, 4 שומרים, כולם זמינים, בלי
// עקיפות כלל. לפני התיקון המנוע דיווח fairnessScore 100 ו-spread 0 בזמן
// שבפועל אדם אחד נשא 16.0 נטל ושלושה נשאו 19.2 — "הוגנות מושלמת" בזמן
// שאדם אחד לא נשא אף לילה. הבדיקות כאן מוכיחות שהציון המדווח באמת נגזר
// מהנטל המדווח, ולא רק "נראה נכון" על התמונה הזו.
// ---------------------------------------------------------------

const round1 = (n) => Math.round(n * 10) / 10;

// רק א'–ה' (אינדקסים 0–4): יום שישי/שבת היו מפעילים את מכפיל הסופ"ש
// ומזייפים את החישוב למטה.
const reproWeek = weekByOffset(1).slice(0, 5);
const reproGuards = [
  { id: "r1", name: "גיא" },
  { id: "r2", name: "מיכל" },
  { id: "r3", name: "אבי" },
  { id: "r4", name: "רינה" },
];
const reproDayShifts = reproWeek.map((date, i) => ({
  id: `rd${i}`, date, label: "משמרת יום", type: "day",
  startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [],
}));
const reproNightShifts = reproWeek.slice(0, 3).map((date, i) => ({
  id: `rn${i}`, date, label: "משמרת לילה", type: "night",
  startTime: "23:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [],
}));
const reproShifts = [...reproDayShifts, ...reproNightShifts];

console.log("\n=== נטל (FAIR-01..04) ===");

// Test D — הבדיקה שהתיקון תלוי בה: אם המשמרות האלה בטעות נופלות על שישי/שבת
// כל שאר החשבון למטה שקרי.
check("FAIR-04 · משמרת יום ב-repro שוקלת 8.0 נטל",
  Math.abs(shiftLoad(reproDayShifts[0]) - 8.0) < 1e-9, `${shiftLoad(reproDayShifts[0])}`);
check("FAIR-04 · משמרת לילה ב-repro שוקלת 11.2 נטל",
  Math.abs(shiftLoad(reproNightShifts[0]) - 11.2) < 1e-9, `${shiftLoad(reproNightShifts[0])}`);

const reproResult = autoAssign({ shifts: reproShifts, guards: reproGuards, availability: {} });

// Test A — לפני התיקון המנוע היה מדווח כאן 100 בדיוק (ספירה מאוזנת גם כשהנטל
// לא). אחרי התיקון הציון חייב לרדת מתחת ל-100.
check("FAIR-02 · ציון ההוגנות ב-repro נמוך מ-100 — לא עוד '100 מושלם' שקרי",
  reproResult.summary.fairnessScore < 100, `fairnessScore=${reproResult.summary.fairnessScore}`);

// Test B (FAIR-04, המבנית) — משחזרים את הציון עצמאית מ-perGuard[].load
// ומ-perShiftLoad *המדווחים*, באותו סדר פעולות ובאותו רצפת מחלק שהמנוע
// עצמו משתמש בו. שוויון מוחלט, בלי סבילות — זו בדיוק ההבטחה של FAIR-04.
const reproLoads = reproResult.fairness.perGuard.map((p) => p.load);
const reproMeanLoad = reproLoads.reduce((a, b) => a + b, 0) / reproLoads.length;
const reproVariance = reproLoads.reduce((a, b) => a + (b - reproMeanLoad) ** 2, 0) / reproLoads.length;
const reproCoefficient = 15 / Math.max(reproResult.fairness.perShiftLoad, 0.001);
const reproRecomputedScore = Math.max(0, Math.round(100 - Math.sqrt(reproVariance) * reproCoefficient));
check("FAIR-04 · הציון המדווח נגזר במדויק מהנטל המדווח (בדיקה מבנית, לא צילום מסך)",
  reproRecomputedScore === reproResult.summary.fairnessScore,
  `recomputed=${reproRecomputedScore} vs reported=${reproResult.summary.fairnessScore}`);

// Test C — כל שורה נושאת load מספרי, ו-loadSpread הוא בדיוק ההפרש בין
// המקסימום למינימום *המדווחים*.
check("FAIR-02 · כל שורת perGuard נושאת שדה load מספרי",
  reproResult.fairness.perGuard.every((p) => typeof p.load === "number"),
  JSON.stringify(reproResult.fairness.perGuard));
check("FAIR-02 · loadSpread שווה למקסימום פחות מינימום מתוך perGuard[].load המדווח",
  reproResult.fairness.loadSpread === round1(Math.max(...reproLoads) - Math.min(...reproLoads)),
  `loadSpread=${reproResult.fairness.loadSpread}, expected=${round1(Math.max(...reproLoads) - Math.min(...reproLoads))}`);

// ---------------------------------------------------------------
// FAIR-01 / FAIR-03 (Phase 1, Plan 01-01, Task 2) — מעבר האיזון ממיין
// ועוצר לפי נטל, לא לפי ספירת משמרות.
// ---------------------------------------------------------------

console.log("\n=== מעבר האיזון (FAIR-01/FAIR-03) ===");

// Test E — רוסטר שבו מי שמרובה-במשמרות (שי) ומי שכבד-בנטל (טל) הם שני
// אנשים שונים בכוונה: שי מחזיק/ה שלוש משמרות קצרות נעולות (נטל נמוך), טל
// מחזיק/ה לילה אחד נעול (נטל גבוה) ומשמרת יום קצרה שנייה שנופלת עליו/ה
// במילוי הרגיל דרך הניקוד הרך (לא נעולה — ולכן ניתנת להזזה). המנוע הישן
// (ספירה) לא היה זז בכלל: 3-2=1 < הסף הישן של 2. המנוע החדש (נטל) חייב
// להזיז מטל, לא משי.
const divWeek = reproWeek;
const divGuards = [
  { id: "e1", name: "שי" }, // מרובה-במשמרות, קל-בנטל
  { id: "e2", name: "טל" }, // כבד-בנטל, מעט משמרות
];
const divLockedDay = [0, 1, 2].map((i, idx) => ({
  id: `ed${idx}`, date: divWeek[i], label: "משמרת קצרה", type: "day",
  startTime: "07:00", endTime: "09:00", requiredGuards: 1, assignedGuards: ["e1"],
}));
const divLockedNight = {
  id: "en0", date: divWeek[3], label: "משמרת לילה", type: "night",
  startTime: "23:00", endTime: "07:00", requiredGuards: 1, assignedGuards: ["e2"],
};
// משמרת קצרה פתוחה, ביום שאין לאף אחד מהם משמרת נעולה בו: הניקוד הרך
// (טל "מעדיף/ה", שי "אולי") מטה אותה אל טל בזמן המילוי הרגיל, בלי לגעת
// בזמינות הקשיחה — כדי שמעבר האיזון יוכל להחזיר אותה לשי בלי חסימה.
const divOpenDay = {
  id: "ed3", date: divWeek[4], label: "משמרת קצרה", type: "day",
  startTime: "20:00", endTime: "22:00", requiredGuards: 1, assignedGuards: [],
};
const divShifts = [...divLockedDay, divLockedNight, divOpenDay];
const divAvailability = {};
for (const g of divGuards) for (const s of divShifts) divAvailability[`${g.id}-${s.id}`] = { status: "available" };
divAvailability["e1-ed3"] = { status: "maybe" };
divAvailability["e2-ed3"] = { status: "preferred" };
const divResult = autoAssign({ shifts: divShifts, guards: divGuards, availability: divAvailability, keepExisting: true });

const e1Row = divResult.fairness.perGuard.find((p) => p.guardId === "e1");
const e2Row = divResult.fairness.perGuard.find((p) => p.guardId === "e2");
check("FAIR-01 · ברוסטר הסטייה, המרובה-במשמרות (שי) אינו/ה הכבד/ה-בנטל (טל)",
  e1Row.shifts > e2Row.shifts && e2Row.load > e1Row.load,
  JSON.stringify({ e1: e1Row, e2: e2Row }));

const divBalanceLog = divResult.log.find((l) => l.step === "balance");
check("FAIR-01 · מעבר האיזון מזיז משמרת מהכבד/ה-בנטל (טל), לא מהמרובה-במשמרות (שי)",
  divResult.summary.balanceMoves === 1 && divBalanceLog?.moves?.[0]?.from === "טל",
  JSON.stringify({ balanceMoves: divResult.summary.balanceMoves, moves: divBalanceLog?.moves }));

// Test F (FAIR-03, RESEARCH.md Open Question 3) — הסף החדש לא דוחף את
// הלולאה לתקרת ה-passes ולא מתנדנד; מספר ההזזות בפועל נשאר קטן משמעותית
// מהתקרה, גם על תיקון-הבאג וגם על שבוע חמשת-השומרים הרגיל שבראש הקובץ.
check("FAIR-03 · מספר ההזזות בתיקון-הבאג נשאר הרבה מתחת לתקרת balancePasses",
  reproResult.summary.balanceMoves <= DEFAULT_RULES.balancePasses / 3,
  `balanceMoves=${reproResult.summary.balanceMoves}, תקרה/3=${DEFAULT_RULES.balancePasses / 3}`);
check("FAIR-03 · מספר ההזזות בשבוע חמשת-השומרים נשאר הרבה מתחת לתקרת balancePasses",
  result.summary.balanceMoves <= DEFAULT_RULES.balancePasses / 3,
  `balanceMoves=${result.summary.balanceMoves}, תקרה/3=${DEFAULT_RULES.balancePasses / 3}`);

// Test G (D-04) — ריצה חוזרת על תיקון-הבאג נותנת בדיוק אותה תוצאה.
const reproAgain = autoAssign({ shifts: reproShifts, guards: reproGuards, availability: {} });
check("FAIR-01 · deterministic across runs — תיקון-הבאג נותן אותו byShift ואותו ציון בריצה חוזרת",
  JSON.stringify(reproAgain.byShift) === JSON.stringify(reproResult.byShift) &&
    reproAgain.summary.fairnessScore === reproResult.summary.fairnessScore,
  JSON.stringify({ a: reproAgain.byShift, b: reproResult.byShift }));

// Test H — על תיקון-הבאג עצמו, הפער (3.2) קטן מהסף הנגזר, וכל הזזה חוקית
// הייתה מזיזה את הפער בלפחות 16.0 (2 × 8.0, המשמרת הקלה ביותר) — כלומר
// הייתה עוקפת אפס ופותחת פער בכיוון ההפוך. ההתנהגות הנכונה היא לא לזוז.
check("FAIR-01 · בתיקון-הבאג אין שום הזזה — כל הזזה חוקית הייתה רק מגדילה את הפער",
  reproResult.summary.balanceMoves === 0,
  `balanceMoves=${reproResult.summary.balanceMoves}`);

// ---------------------------------------------------------------
// FAIR-03 (Phase 1, Plan 01-01, Task 3) — מבחני לחץ על שני המקדמים
// שנוחשו: לא מקבלים אותם כי הם "נראים סבירים", אלא מוכיחים שהם נגזרים
// מהרוסטר ולא קבועים חדשים שממציאים סולם (D-02).
// ---------------------------------------------------------------

console.log("\n=== מבחני לחץ על המקדמים (FAIR-03) ===");

// תאום 12 שעות — טרנספורמציה מבנית של תיקון-הבאג: אותם תאריכים ואותם
// שומרים, רק שעות המשמרת שונות. כל נטל בו בדיוק 1.5× הנטל בגרסת 8 השעות.
const twinDayShifts = reproWeek.map((date, i) => ({
  id: `rd${i}`, date, label: "משמרת יום", type: "day",
  startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [],
}));
const twinNightShifts = reproWeek.slice(0, 3).map((date, i) => ({
  id: `rn${i}`, date, label: "משמרת לילה", type: "night",
  startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [],
}));
const twinShifts = [...twinDayShifts, ...twinNightShifts];
const twinResult = autoAssign({ shifts: twinShifts, guards: reproGuards, availability: {} });

// תנאי מקדים מפורש: שני הרוסטרים חייבים להיות מאוישים במלואם, אחרת פער
// בכיסוי היה מתחזה לפער בהוגנות. שעת המנוחה המינימלית (8) מתקיימת בגרסת
// 8 השעות בדיוק על הגבול — אם מישהו ישנה את גבול המנוחה הזה, הבדיקה הזו
// היא זו שתיכשל, לא המקדמים.
check("FAIR-03 · תיקון-הבאג ותאום 12 השעות שניהם מאוישים במלואם (תנאי מקדים לפני השוואת ציונים)",
  reproResult.summary.filledSlots === reproResult.summary.totalSlots &&
    twinResult.summary.filledSlots === twinResult.summary.totalSlots,
  `repro=${reproResult.summary.filledSlots}/${reproResult.summary.totalSlots}, twin=${twinResult.summary.filledSlots}/${twinResult.summary.totalSlots}`);

// Test I — אי-תלות בקנה מידה: perShiftLoad שונה, הציון זהה. מקדם קבוע היה
// נכשל כאן; רק מקדם שנגזר מ-perShiftLoad יכול לעבור.
check("FAIR-03 · perShiftLoad שונה בין תיקון-הבאג לתאום 12 השעות (וידוא שהתאום באמת שונה)",
  reproResult.fairness.perShiftLoad !== twinResult.fairness.perShiftLoad,
  `repro=${reproResult.fairness.perShiftLoad}, twin=${twinResult.fairness.perShiftLoad}`);
check("FAIR-03 · ציון ההוגנות זהה בין תיקון-הבאג לתאום 12 השעות — המקדם נגזר, לא קבוע",
  reproResult.summary.fairnessScore === twinResult.summary.fairnessScore,
  `repro=${reproResult.summary.fairnessScore}, twin=${twinResult.summary.fairnessScore}`);

// Test J — אי-תלות בקנה מידה של סף האיזון: אותו מספר הזזות, אותה מפת
// byShift. סף קבוע היה גורם לתאום 12 השעות להתנהג אחרת מגרסת 8 השעות.
check("FAIR-03 · אותו מספר הזזות איזון בתיקון-הבאג ובתאום 12 השעות",
  reproResult.summary.balanceMoves === twinResult.summary.balanceMoves,
  `repro=${reproResult.summary.balanceMoves}, twin=${twinResult.summary.balanceMoves}`);
check("FAIR-03 · deterministic across runs — אותה מפת byShift בתיקון-הבאג ובתאום 12 השעות",
  JSON.stringify(reproResult.byShift) === JSON.stringify(twinResult.byShift),
  JSON.stringify({ repro: reproResult.byShift, twin: twinResult.byShift }));

// Test K — טווח דינמי, בלי מספרי קסם: רוסטר שטוח לחלוטין (כל שומר בדיוק
// לילה אחד ויום אחד) מקבל 100; תיקון-הבאג נמוך ממנו; רוסטר בסקיו קיצוני
// (שומר אחד נושא הכול) נמוך מתיקון-הבאג וגבוה מ-0.
const flatWeek = reproWeek.slice(0, 4);
const flatGuards = [
  { id: "k1", name: "כרמל" }, { id: "k2", name: "נועה" }, { id: "k3", name: "עומר" }, { id: "k4", name: "יעל" },
];
// נעול: כל שומר מקבל בדיוק יום אחד ולילה אחד — לא סומכים על כך שהמילוי
// החמדני עצמו יגלה את החלוקה השטוחה (הוא לא בהכרח יעשה זאת).
const flatDay = flatWeek.map((date, i) => ({
  id: `kd${i}`, date, label: "משמרת יום", type: "day", startTime: "07:00", endTime: "15:00",
  requiredGuards: 1, assignedGuards: [flatGuards[i].id],
}));
const flatNight = flatWeek.map((date, i) => ({
  id: `kn${i}`, date, label: "משמרת לילה", type: "night", startTime: "23:00", endTime: "07:00",
  requiredGuards: 1, assignedGuards: [flatGuards[i].id],
}));
const flatShifts = [...flatDay, ...flatNight];
const flatAvailability = {};
for (const g of flatGuards) for (const s of flatShifts) flatAvailability[`${g.id}-${s.id}`] = { status: "available" };
const flatResult = autoAssign({ shifts: flatShifts, guards: flatGuards, availability: flatAvailability, keepExisting: true });
check("FAIR-03 · הרוסטר השטוח באמת מאויש במלואו ובחלוקה שווה (תנאי מקדים לפני שקוראים ל-100 'הוגנות')",
  flatResult.summary.filledSlots === flatResult.summary.totalSlots &&
    flatResult.fairness.perGuard.every((p) => p.shifts === 2),
  JSON.stringify(flatResult.fairness.perGuard));
check("FAIR-03 · רוסטר שטוח לחלוטין מקבל ציון 100",
  flatResult.summary.fairnessScore === 100, `fairnessScore=${flatResult.summary.fairnessScore}`);
check("FAIR-03 · תיקון-הבאג נמוך מהרוסטר השטוח",
  reproResult.summary.fairnessScore < flatResult.summary.fairnessScore,
  `repro=${reproResult.summary.fairnessScore}, flat=${flatResult.summary.fairnessScore}`);

const skewAvailability = {};
for (const g of reproGuards) {
  for (const s of reproShifts) {
    skewAvailability[`${g.id}-${s.id}`] = g.id === reproGuards[0].id ? { status: "available" } : { status: "unavailable" };
  }
}
const skewResult = autoAssign({ shifts: reproShifts, guards: reproGuards, availability: skewAvailability });
check("FAIR-03 · רוסטר בסקיו קיצוני נמוך מתיקון-הבאג וגבוה מ-0 (יש טווח דינמי אמיתי)",
  skewResult.summary.fairnessScore < reproResult.summary.fairnessScore && skewResult.summary.fairnessScore > 0,
  `skew=${skewResult.summary.fairnessScore}, repro=${reproResult.summary.fairnessScore}`);

// Test L — עקביות יחידות מול הנוסחה הישנה: כשכל המשמרות שוות משקל, נטל
// וספירה פרופורציוניים, אז הנוסחה החדשה חייבת להחזיר בדיוק את מה שהנוסחה
// הישנה (המבוססת-ספירה) הייתה מחזירה.
const uniformShifts = reproWeek.map((date, i) => ({
  id: `ud${i}`, date, label: "משמרת יום", type: "day", startTime: "07:00", endTime: "15:00",
  requiredGuards: 1, assignedGuards: [],
}));
const uniformResult = autoAssign({ shifts: uniformShifts, guards: reproGuards, availability: {} });
const uniformCounts = uniformResult.fairness.perGuard.map((p) => p.shifts);
const uniformMeanCount = uniformCounts.reduce((a, b) => a + b, 0) / uniformCounts.length;
const uniformCountVariance =
  uniformCounts.reduce((a, b) => a + (b - uniformMeanCount) ** 2, 0) / uniformCounts.length;
const oldFormulaScore = Math.max(0, Math.round(100 - Math.sqrt(uniformCountVariance) * 15));
check("FAIR-03 · במשמרות שוות-משקל, הנוסחה החדשה משחזרת בדיוק את הנוסחה הישנה המבוססת-ספירה",
  uniformResult.summary.fairnessScore === oldFormulaScore,
  `new=${uniformResult.summary.fairnessScore}, old(count-based)=${oldFormulaScore}, counts=${JSON.stringify(uniformCounts)}`);

// ---------------------------------------------------------------
// FAIR-05 (Phase 1, Plan 01-02, Task 2) — הנטל שהמשתתף רואה מרותך לנטל
// שהמנוע חילק לפיו. שני הנתיבים (teamAverages ל-GuardApp.jsx, perGuard[]
// ל-SmartAssign.jsx) קוראים לאותו shiftLoad מאותו קובץ — הבדיקות כאן
// מוכיחות זאת מבנית, על הרוסטר-repro של 01-01, ולא רק "נראה תואם".
// ---------------------------------------------------------------

console.log("\n=== FAIR-05 — נטל המשתתף מרותך לנטל המנוע ===");

// עותק, לא מוטציה: reproShifts משמש בדיקות אחרות מעל ומתחת, ומוטציה שלו
// הייתה הופכת את סדר הריצה בקובץ למשמעותי.
const reproPublishedShifts = reproShifts.map((s) => ({
  ...s,
  assignedGuards: reproResult.byShift[s.id] || [],
  published: true,
}));

const { perGuard: participantPerGuard, avg: participantAvg } = teamAverages(reproGuards, reproPublishedShifts);
const engineLoadByGuard = Object.fromEntries(reproResult.fairness.perGuard.map((p) => [p.guardId, p.load]));

// Test G — ה-single-meter check, וכל FAIR-05: לכל שומר, הנטל שמוצג למשתתף
// שווה לנטל שמדווח המנוע. הסבילות: המנוע מעגל ל-עשירית אחת, teamAverages
// מחזיר גלם — אז הסבילות היא פחות מחצי מהעשירית האחרונה שמדווח המנוע.
const loadMismatches = reproGuards.filter((g) => {
  const participantLoad = participantPerGuard[g.id]?.load ?? NaN;
  const engineLoad = engineLoadByGuard[g.id] ?? NaN;
  return !(Math.abs(participantLoad - engineLoad) < 0.05);
});
check("FAIR-05 · לכל שומר, הנטל שמוצג למשתתף (teamAverages) שווה לנטל שמדווח המנוע (fairness.perGuard)",
  loadMismatches.length === 0,
  JSON.stringify(loadMismatches.map((g) => ({ id: g.id, participant: participantPerGuard[g.id]?.load, engine: engineLoadByGuard[g.id] }))));

// Test H — עצמאית מהמנוע (דפוס FAIR-04, מיושם על נתיב המשתתף): הנטל שווה
// לסכום shiftLoad על המשמרות שהוקצו לאותו שומר, מחושב כאן מחדש מאפס — לא
// רק עקבי עם עצמו. הסבילות כאן היא רק רעש צף, כי שני הצדדים גלמיים.
const recomputedLoads = Object.fromEntries(reproGuards.map((g) => {
  const total = reproPublishedShifts
    .filter((s) => s.assignedGuards.includes(g.id))
    .reduce((a, s) => a + shiftLoad(s), 0);
  return [g.id, total];
}));
const recomputeMismatches = reproGuards.filter(
  (g) => Math.abs(participantPerGuard[g.id].load - recomputedLoads[g.id]) > 1e-9
);
check("FAIR-05 · הנטל של המשתתף נגזר עצמאית מסכום shiftLoad על המשמרות שהוקצו לו",
  recomputeMismatches.length === 0, JSON.stringify(recomputeMismatches));

// Test I — הרגרסיה שהייתה נשארת שקטה: על הרוסטר הזה יש לפחות שומר אחד
// שהנטל שלו שונה מהשעות שלו בשלמים — אם עריכה עתידית הופכת בשקט את שורת
// הנטל לשורת שעות לא-שקולה, הבדיקה הזו נכשלת.
const loadHoursDiverge = reproGuards.some(
  (g) => Math.round(participantPerGuard[g.id].load) !== Math.round(participantPerGuard[g.id].hours)
);
check("FAIR-05 · לפחות שומר אחד: הנטל שונה מהשעות בשלמים — שורת הנטל לא הפכה לשורת שעות",
  loadHoursDiverge, JSON.stringify(reproGuards.map((g) => participantPerGuard[g.id])));

// Test J — הממוצע הוא ממוצע אותם ערכים, לא נוסחה שלישית.
const participantLoads = reproGuards.map((g) => participantPerGuard[g.id].load);
const expectedAvgLoad = round1(participantLoads.reduce((a, b) => a + b, 0) / participantLoads.length);
check("FAIR-05 · avg.load הוא ממוצע אותם ערכי load של perGuard, מעוגל באותה שיטה",
  Math.abs(participantAvg.load - expectedAvgLoad) < 0.05,
  `avg.load=${participantAvg.load}, expected=${expectedAvgLoad}`);

// Test K — סקופ, לא יחידה: כשכל השומרים פעילים וכל המשמרות מפורסמות (תנאי
// הפיקסצ'ר עצמו), avg.load של המשתתף ו-loadMean של המנוע מסכימים בתוך
// העיגול. שני המספרים יכולים להיפרד לגיטימית כשהצוות מחזיק שומרים שהתוכנית
// לא שקלה — זה פער של *אוכלוסייה*, לא של *יחידה*, וזה בדיוק מה ששורת
// המשתתף אמורה לחשוף (לא נבדק כאן — התנאי המקדים חסום ל"כולם" בכוונה).
check("FAIR-05 · avg.load של המשתתף ו-loadMean של המנוע מסכימים כשהאוכלוסייה זהה",
  Math.abs(participantAvg.load - reproResult.fairness.loadMean) < 0.15,
  `participant avg.load=${participantAvg.load}, engine loadMean=${reproResult.fairness.loadMean}`);

// Test L — דטרמיניזם (D-04): הרצה חוזרת של כל הרצף נותנת אותם ערכי נטל.
const reproPublishedShiftsAgain = reproShifts.map((s) => ({
  ...s,
  assignedGuards: reproResult.byShift[s.id] || [],
  published: true,
}));
const { perGuard: participantPerGuardAgain } = teamAverages(reproGuards, reproPublishedShiftsAgain);
check("FAIR-05 · דטרמיניסטי — הרצה חוזרת נותנת בדיוק אותם ערכי load למשתתף",
  reproGuards.every((g) => participantPerGuardAgain[g.id].load === participantPerGuard[g.id].load),
  JSON.stringify({ a: participantPerGuardAgain, b: participantPerGuard }));

// ---------------------------------------------------------------
// UNIF-02 — משימה עם שעות נכנסת לאותם אילוצים קשיחים שמשמרת נכנסת אליהם
// (Phase 2, Plan 02-01). Fixture נבחר מאינדקסים 0–4 של weekByOffset(1)
// בלבד (א'–ה') כדי לא להפעיל בשוגג את מכפיל הסופ"ש — מלבד test M, שבו
// שבת היא בדיוק הנקודה שנבדקת.
// ---------------------------------------------------------------

console.log("\n=== UNIF-02 — משימה עם שעות נכנסת לאותם אילוצים ===\n");

// בונה משימה יציבה: אותו תאריך כ-startDate/dueDate (חד-יומית, D-01), שתי
// שעות, וממונה יחיד. מזהה נגזר מהארגומנטים כדי שהריצה תישאר דטרמיניסטית.
const hourTask = (date, assignee, start, end) => ({
  id: `tk-${date}-${assignee}-${start}-${end}`, title: "משימה", category: "מטבח",
  startDate: date, dueDate: date, startTime: start, endTime: end, assignees: [assignee],
});

const unifGuard = { id: "u1", name: "רותם" };
const unifDate = dates[0];
const morningTask = hourTask(unifDate, unifGuard.id, "06:00", "14:00");

// Test H (rest) — 06:00–14:00 מול משמרת לילה 19:00–07:00 באותו יום: פער
// מנוחה של 5 שעות, מתחת למינימום (8). ההשוואה בלי tasks כלל מוכיחה שהמשימה
// היא זו שחסמה, לא הפיקסצ'ר.
const nightShiftUnif = {
  id: "unif-night", date: unifDate, label: "משמרת לילה", type: "night",
  startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [],
};
const withTaskRest = checkAssignment({
  guard: unifGuard, shift: nightShiftUnif, shifts: [], tasks: [morningTask], availability: {},
});
const withoutTaskRest = checkAssignment({
  guard: unifGuard, shift: nightShiftUnif, shifts: [], tasks: [], availability: {},
});
check("UNIF-02 · משימה 06:00–14:00 חוסמת משמרת לילה באותו יום מחוסר מנוחה, code=rest",
  withTaskRest.ok === false && withTaskRest.code === "rest" &&
    typeof withTaskRest.reason === "string" && withTaskRest.reason.length > 0,
  JSON.stringify(withTaskRest));
check("UNIF-02 · אותה קריאה בלי tasks כלל מאושרת — המשימה היא שחסמה, לא הפיקסצ'ר",
  withoutTaskRest.ok === true, JSON.stringify(withoutTaskRest));

// Test I (overlap) — אותה משימה מול משמרת חופפת בפועל.
const overlapShiftUnif = {
  id: "unif-day", date: unifDate, label: "משמרת יום", type: "day",
  startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [],
};
const overlapCheck = checkAssignment({
  guard: unifGuard, shift: overlapShiftUnif, shifts: [], tasks: [morningTask], availability: {},
});
check("UNIF-02 · משימה 06:00–14:00 חוסמת משמרת חופפת עם code=overlap",
  overlapCheck.ok === false && overlapCheck.code === "overlap", JSON.stringify(overlapCheck));

// Test J (consecutive) — אותה משימה נוגעת קצה-לקצה במשמרת 14:00–22:00:
// 16 שעות רצף בלתי-שבור, מעל המקסימום (12). נעילת המנוחה-לנוגעות היא מה
// שמאפשר לכלל הרצף לתפוס במקום כלל המנוחה.
const touchingShiftUnif = {
  id: "unif-touch", date: unifDate, label: "משמרת נוגעת", type: "day",
  startTime: "14:00", endTime: "22:00", requiredGuards: 1, assignedGuards: [],
};
const touchCheck = checkAssignment({
  guard: unifGuard, shift: touchingShiftUnif, shifts: [], tasks: [morningTask], availability: {},
});
check("UNIF-02 · משימה שנוגעת קצה-לקצה במשמרת מייצרת חריגת רצף, code=consecutive",
  touchCheck.ok === false && touchCheck.code === "consecutive", JSON.stringify(touchCheck));

// Test K (weekly-cap) — שישה תאריכים נפרדים, כל אחד עם משימה קצרה (2
// שעות), ממוקמים כרונולוגית *אחרי* המשמרת המועמדת כדי שאף כלל מנוחה/רצף
// לא יתפוס קודם — רק ספירת השבוע.
const capGuard = { id: "u2", name: "טל" };
const capTasks = dates.slice(1, 7).map((d) => hourTask(d, capGuard.id, "10:00", "12:00"));
const capShift = {
  id: "unif-cap-shift", date: dates[0], label: "משמרת יום", type: "day",
  startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [],
};
const capCheck = checkAssignment({
  guard: capGuard, shift: capShift, shifts: [], tasks: capTasks, availability: {},
});
check("UNIF-02 · שישה תאריכי משימה בשבוע חוסמים שיבוץ שביעי, code=weekly-cap",
  capCheck.ok === false && capCheck.code === "weekly-cap", JSON.stringify(capCheck));

// Test L (load) — הנטל המדווח לשומר שמחזיק גם משימה וגם משמרת שווה לסכום
// shiftLoad עצמאי, בדיוק בסגנון FAIR-04: לא מושווה נגד קבוע מוצמד.
// keepExisting נועל את המשמרת ל-lg1 כדי שהתוצאה לא תלויה בהכרעת ההוגנות.
const loadGuards = [
  { id: "lg1", name: "לירון" },
  { id: "lg2", name: "מאור" },
];
const loadTask = hourTask(unifDate, "lg1", "06:00", "14:00");
const loadShiftUnif = {
  id: "unif-load-shift", date: dates[2], label: "משמרת יום", type: "day",
  startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: ["lg1"],
};
const loadResult = autoAssign({
  shifts: [loadShiftUnif], guards: loadGuards, availability: {}, tasks: [loadTask], keepExisting: true,
});
const lg1Row = loadResult.fairness.perGuard.find((p) => p.guardId === "lg1");
const expectedLg1Load = shiftLoad(taskAsShiftShape(loadTask)) + shiftLoad(loadShiftUnif);
check("UNIF-02 · הנטל המדווח לשומר שמחזיק משימה ומשמרת שווה לסכום shiftLoad עצמאי (סגנון FAIR-04)",
  Math.abs(lg1Row.load - Math.round(expectedLg1Load * 10) / 10) < 1e-9,
  JSON.stringify({ reported: lg1Row.load, expected: expectedLg1Load }));

// Test M (D-07) — נטל שטוח, לא היקש מכפיל-לילה משעות השעון; מכפיל
// הסופ"ש עדיין חל אוטומטית כי הוא נגזר מתאריך/שעת-התחלה בלבד.
const nightTaskUnif = hourTask(unifDate, "mt1", "19:00", "07:00");
const nightShiftForCompare = { id: "cmp-night", date: unifDate, startTime: "19:00", endTime: "07:00", type: "night" };
const taskLoadNight = shiftLoad(taskAsShiftShape(nightTaskUnif));
check("UNIF-02 · משימה 19:00–07:00 ביום חול שוקלת בדיוק 12 נטל — שטוח, בלי מכפיל לילה (D-07)",
  Math.abs(taskLoadNight - 12) < 1e-9, `${taskLoadNight}`);
check("UNIF-02 · אותה משימה שוקלת פחות ממשמרת לילה על אותן שעות ותאריך",
  taskLoadNight < shiftLoad(nightShiftForCompare), `${taskLoadNight} vs ${shiftLoad(nightShiftForCompare)}`);

const satIndexUnif = dates.findIndex((d) => new Date(`${d}T12:00:00`).getDay() === 6);
const dayTaskWeekday = hourTask(unifDate, "mt2", "07:00", "15:00");
const dayTaskSat = hourTask(dates[satIndexUnif], "mt2", "07:00", "15:00");
check("UNIF-02 · משימה בשבת שוקלת יותר מאותה משימה ביום חול (מכפיל הסופ״ש חל אוטומטית, D-07)",
  shiftLoad(taskAsShiftShape(dayTaskSat)) > shiftLoad(taskAsShiftShape(dayTaskWeekday)),
  `${shiftLoad(taskAsShiftShape(dayTaskSat))} vs ${shiftLoad(taskAsShiftShape(dayTaskWeekday))}`);

// Test N (UNIF-04, המלוא) — משימות קפואות ורב-יומיות לא משנות דבר: אותה
// תוצאה בייט-לבייט כמו הרצה בלי tasks כלל. `result` הוא ההרצה המקורית
// שכבר הוכחה דטרמיניסטית למעלה בקובץ הזה.
const frozenTaskUnif = {
  id: "fz-uf1", title: "משימה קפואה", category: "מטבח",
  startDate: dates[0], dueDate: dates[0], assignees: ["g1"],
};
const spanTaskUnif = {
  id: "sp-uf1", title: "משימה רב-יומית", category: "מטבח",
  startDate: dates[0], dueDate: dates[2], startTime: "07:00", endTime: "15:00", assignees: ["g1"],
};
const withFrozenTasksUnif = autoAssign({
  shifts, guards, availability, tasks: [frozenTaskUnif, spanTaskUnif],
});
check("UNIF-04 · הרצה עם משימות קפואות/רב-יומיות זהה בייט-לבייט להרצה בלי tasks כלל",
  JSON.stringify(withFrozenTasksUnif) === JSON.stringify(result));

// Test O (D-09) — status: "done" לא משנה eligibility; אותה חסימה, אותו code.
const doneTask = { ...morningTask, id: "tk-done", status: "done" };
const doneCheck = checkAssignment({
  guard: unifGuard, shift: nightShiftUnif, shifts: [], tasks: [doneTask], availability: {},
});
check("UNIF-02 · משימה עם status='done' עדיין חוסמת את אותה משמרת עם אותו code (D-09)",
  doneCheck.ok === false && doneCheck.code === "rest", JSON.stringify(doneCheck));

// Test P (backwards compatibility) — checkAssignment בלי tasks == עם tasks ריק.
const noTasksArg = checkAssignment({ guard: unifGuard, shift: nightShiftUnif, shifts: [], availability: {} });
const emptyTasksArg = checkAssignment({
  guard: unifGuard, shift: nightShiftUnif, shifts: [], tasks: [], availability: {},
});
check("UNIF-02 · checkAssignment בלי tasks זהה בדיוק לקריאה עם tasks ריק",
  JSON.stringify(noTasksArg) === JSON.stringify(emptyTasksArg));

// Step 4 — משמר-האיזון: משימה אף פעם לא הופכת לרשומת assignment, וספירת
// ה-assignments תמיד שווה ל-filledSlots המדווח (הסיכון שמפת-הדרכים מציינת
// בשם — הכפלת מספר הפריטים שמעבר האיזון בוחן).
const balanceGuardTask = hourTask(dates[6], "g1", "08:00", "10:00");
const balanceCheckResult = autoAssign({ shifts, guards, availability, tasks: [balanceGuardTask] });
const shiftIdSetUnif = new Set(shifts.map((s) => s.id));
const taskNeverBecameAssignment = balanceCheckResult.assignments.every((a) => shiftIdSetUnif.has(a.shiftId));
check("UNIF-02 · אף רשומת משימה לא נכנסת ל-assignments — כל shiftId שם שייך למשמרת אמיתית",
  taskNeverBecameAssignment,
  JSON.stringify(balanceCheckResult.assignments.filter((a) => !shiftIdSetUnif.has(a.shiftId))));
check("UNIF-02 · מספר ה-assignments שווה בדיוק ל-filledSlots המדווח",
  balanceCheckResult.assignments.length === balanceCheckResult.summary.filledSlots,
  `assignments=${balanceCheckResult.assignments.length}, filledSlots=${balanceCheckResult.summary.filledSlots}`);
const balanceLogEntryUnif = balanceCheckResult.log.find((l) => l.step === "balance");
const movesReferenceOnlyShifts =
  !balanceLogEntryUnif?.moves?.length || balanceLogEntryUnif.moves.every((m) => shiftIdSetUnif.has(m.shiftId));
check("UNIF-02 · רשומת האיזון (אם קיימת) מפנה רק ל-shiftId של משמרות",
  movesReferenceOnlyShifts, JSON.stringify(balanceLogEntryUnif));

// Test Q (determinism, החוט שעובר לכל הפאזה) — שתי הרצות זהות על אותו רוסטר
// מזורע-משימות, והרצה שלישית עם עותק המשימות בסדר הפוך (עותק, לא מוטציה —
// detTasks משמש גם בהרצות A/B) מזהה גם היא. סדר משימות אסור לדלוף לתוך
// הסידור, בדיוק כמו קריאה מ-DB בלי order מפורש.
const detTasks = [
  hourTask(dates[0], "g1", "06:00", "08:00"),
  hourTask(dates[1], "g2", "06:00", "08:00"),
  hourTask(dates[2], "g3", "06:00", "08:00"),
];
const detA = autoAssign({ shifts, guards, availability, tasks: detTasks });
const detB = autoAssign({ shifts, guards, availability, tasks: detTasks });
check("UNIF-02 · deterministic across runs — עם משימות מזורעות, אותו byShift ואותו fairnessScore",
  JSON.stringify(detA.byShift) === JSON.stringify(detB.byShift) &&
    detA.summary.fairnessScore === detB.summary.fairnessScore,
  JSON.stringify({ a: detA.byShift, b: detB.byShift }));
const detTasksReversed = [...detTasks].reverse();
const detC = autoAssign({ shifts, guards, availability, tasks: detTasksReversed });
check("UNIF-02 · deterministic across runs — סדר המשימות ההפוך לא מדליף לתוך הסידור",
  JSON.stringify(detA.byShift) === JSON.stringify(detC.byShift) &&
    detA.summary.fairnessScore === detC.summary.fairnessScore,
  JSON.stringify({ a: detA.byShift, c: detC.byShift }));

// Test R (reporting parity, UNIF-02 — FAIR-05 המורחבת למשימות) — עבור רוסטר
// שבו שומר אחד מחזיק גם משמרת וגם משימה: teamAverages על המערך הממוזג
// מדווח נטל השווה לסכום shiftLoad עצמאי, ומסכים עם הנטל שמדווח המנוע עצמו
// בתוך העיגול (idiom FAIR-05, לפי `01-02-SUMMARY.md`).
const parityGuards = [
  { id: "pr1", name: "עדי" },
  { id: "pr2", name: "רון" },
];
const parityShift = {
  id: "unif-parity-shift", date: dates[3], label: "משמרת יום", type: "day",
  startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: ["pr1"],
};
const parityTask = hourTask(unifDate, "pr1", "06:00", "08:00");
const parityMerged = withEngineTasks([parityShift], [parityTask]);
const { perGuard: parityPerGuard } = teamAverages(parityGuards, parityMerged);
const expectedParityLoad = shiftLoad(parityShift) + shiftLoad(taskAsShiftShape(parityTask));
check("UNIF-02 · teamAverages על מערך ממוזג מדווח נטל השווה לסכום shiftLoad עצמאי (משמרת+משימה)",
  Math.abs(parityPerGuard.pr1.load - Math.round(expectedParityLoad * 10) / 10) < 1e-9,
  JSON.stringify({ reported: parityPerGuard.pr1.load, expected: expectedParityLoad }));

const parityEngineResult = autoAssign({
  shifts: [parityShift], guards: parityGuards, availability: {}, tasks: [parityTask], keepExisting: true,
});
const parityEngineRow = parityEngineResult.fairness.perGuard.find((p) => p.guardId === "pr1");
check("UNIF-02 · הנטל שהמנוע עצמו מדווח לאותו שומר, על אותם נתונים, מסכים עם teamAverages בתוך העיגול (FAIR-05 מורחב)",
  Math.abs(parityEngineRow.load - parityPerGuard.pr1.load) < 0.05,
  JSON.stringify({ engine: parityEngineRow.load, participant: parityPerGuard.pr1.load }));

// ---------------------------------------------------------------
// QUAL-04 — כשירות חוסמת בכל שלושת המסלולים (מילוי אוטומטי, איזון עומסים,
// אישור החלפה) דרך ההכנסה היחידה ב-checkHardConstraints (Phase 3, Plan
// 03-01, Task 2). שבוע מוגבל לאינדקסים 0-4 (א'-ה') כדי שמכפיל הסופ"ש לא
// ייכנס לחישוב. תחיליות מזהים: `ql-` — לא בשימוש באף פיקסצ'ר קודם בקובץ.
// ---------------------------------------------------------------

console.log("\n=== QUAL-04 — כשירות חוסמת בכל המסלולים ===\n");

const qlGuardNarrow = { id: "ql-narrow", name: "מוגבל/ת למטבח בלבד", qualifiedCategories: ["מטבח"] };
const qlGuardWide = { id: "ql-wide", name: "בלי הגבלת כשירות" };
const qlGuards = [qlGuardNarrow, qlGuardWide];

const qlShiftA = {
  id: "ql-scout-a", date: dates[0], label: "סיור בוקר", type: "day", category: "סיור",
  startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [],
};
const qlShiftB = {
  id: "ql-scout-b", date: dates[1], label: "סיור בוקר", type: "day", category: "סיור",
  startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [],
};
// אף שומר לא זמין למשמרת הזו — נשארת לא מלאה, וזו נקודת התצפית ל-unfilled:
// שני קודים שונים חוסמים את שני המועמדים היחידים (זמינות ל-wide, כשירות
// ל-narrow), לא רק כשירות — כדי שהבדיקה תוכיח שהמועמד המצומצם *הגיע* לבדיקה.
const qlShiftUnfilled = {
  id: "ql-scout-unfilled", date: dates[3], label: "סיור בוקר", type: "day", category: "סיור",
  startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [],
};
// בלי קטגוריה כלל — המקום שמוכיח שהחסימה תחומה לקטגוריה, לא לאדם. wide לא
// זמין כאן בכוונה כדי שהמועמד היחיד שנשאר יהיה narrow, ללא תלות בשובר-שוויון.
const qlShiftOpen = {
  id: "ql-open", date: dates[2], label: "משמרת בלי קטגוריה", type: "day",
  startTime: "07:00", endTime: "15:00", requiredGuards: 1, assignedGuards: [],
};
const qlShifts = [qlShiftA, qlShiftB, qlShiftUnfilled, qlShiftOpen];
const qlShiftById = new Map(qlShifts.map((s) => [s.id, s]));

const qlAvailability = {};
for (const g of qlGuards) {
  for (const s of qlShifts) qlAvailability[`${g.id}-${s.id}`] = { status: "available" };
}
qlAvailability[`${qlGuardWide.id}-${qlShiftOpen.id}`] = { status: "unavailable" };
qlAvailability[`${qlGuardWide.id}-${qlShiftUnfilled.id}`] = { status: "unavailable" };

const qlResult = autoAssign({ shifts: qlShifts, guards: qlGuards, availability: qlAvailability });

// Test 1 — השומר המצומצם לא מופיע באף רשומת שיבוץ של משמרת מהקטגוריה
// שהוא לא כשיר לה, על פני כל התוצאה (לא רק בדיקה נקודתית).
const qlNarrowInExcluded = qlResult.assignments.some(
  (a) => a.guardId === qlGuardNarrow.id && qlShiftById.get(a.shiftId)?.category === "סיור"
);
check("QUAL-04 · השומר המצומצם לא מופיע באף רשומת שיבוץ של משמרת מקטגוריית 'סיור'",
  !qlNarrowInExcluded, JSON.stringify(qlResult.assignments));

// Test 2 — אותו שומר כן משובץ למשמרת בלי קטגוריה — החסימה תחומה לקטגוריה,
// לא לאדם.
check("QUAL-04 · אותו שומר מצומצם כן משובץ למשמרת בלי קטגוריה כלל",
  (qlResult.byShift[qlShiftOpen.id] || []).includes(qlGuardNarrow.id),
  JSON.stringify(qlResult.byShift[qlShiftOpen.id]));

// Test 3+4 — המשמרת הבלתי-ניתנת-למילוי נושאת חוסם code='unqualified' ששם
// את השומר המצומצם — מוכיח שהמועמד הגיע לבדיקה ולא סונן לפניה (Pitfall 6).
const qlUnfilledEntry = qlResult.unfilled.find((u) => u.shiftId === qlShiftUnfilled.id);
const qlUnqualifiedBlocker = qlUnfilledEntry?.blockers?.find((b) => b.code === "unqualified");
check("QUAL-04 · המשמרת החסומה-כשירות נשארת unfilled עם חוסם code='unqualified'",
  Boolean(qlUnqualifiedBlocker) && typeof qlUnqualifiedBlocker.reason === "string" && qlUnqualifiedBlocker.reason.length > 0,
  JSON.stringify(qlUnfilledEntry));
check("QUAL-04 · חוסם ה-unqualified נושא את guardId של השומר המצומצם עצמו",
  qlUnqualifiedBlocker?.guardId === qlGuardNarrow.id, JSON.stringify(qlUnqualifiedBlocker));

// Test 5 — ריצת ביקורת: אותו פיקסצ'ר בדיוק, בלי הרשימה המצמצמת (עותק, לא
// מוטציה, כדפוס הקובץ בשורות 609-615/867), ממלאת את המשמרת שהייתה ריקה —
// מוכיח שהכשירות היא שחסמה, לא הזמינות או תקרה כלשהי.
const qlGuardsUnrestricted = qlGuards.map((g) =>
  g.id === qlGuardNarrow.id ? { id: g.id, name: g.name } : g
);
const qlControlResult = autoAssign({ shifts: qlShifts, guards: qlGuardsUnrestricted, availability: qlAvailability });
check("QUAL-04 · ריצת ביקורת בלי הרשימה המצמצמת ממלאת את המשמרת שהייתה unfilled",
  (qlControlResult.byShift[qlShiftUnfilled.id] || []).includes(qlGuardNarrow.id),
  JSON.stringify(qlControlResult.byShift[qlShiftUnfilled.id]));

// Test 6 — checkAssignment (הכניסה שכל מסכי ההחלפה משתמשים בה) חוסם את
// אותו זוג עם code='unqualified' ומאשר את הזוג הבלתי-מקוטלג.
const qlCheckExcluded = checkAssignment({
  guard: qlGuardNarrow, shift: qlShiftA, shifts: [], availability: {},
});
check("QUAL-04 · checkAssignment חוסם את השומר המצומצם למשמרת מקטגוריה שהוא לא כשיר לה, code='unqualified'",
  qlCheckExcluded.ok === false && qlCheckExcluded.code === "unqualified", JSON.stringify(qlCheckExcluded));
const qlCheckOpen = checkAssignment({
  guard: qlGuardNarrow, shift: qlShiftOpen, shifts: [], availability: {},
});
check("QUAL-04 · checkAssignment מאשר את אותו שומר למשמרת בלי קטגוריה",
  qlCheckOpen.ok === true, JSON.stringify(qlCheckOpen));

// Test 7 — מעבר האיזון לא יכול לבטל את החסימה. שומר אחד מחזיק משמרת
// מהקטגוריה החסומה (דרך המילוי הרגיל — לא נעולה, keepExisting=true כאן לא
// נוגע לה כי היא לא הגיעה עם assignedGuards מראש), שני מוגבל וריק לגמרי —
// הכי קל, ולכן מועמד יחיד למעבר. אם מעבר האיזון היה מתעלם מכשירות, השומר
// המוגבל היה מקבל אותה כי הוא הכי קל.
const qlBalHeavy = { id: "ql-bal-heavy", name: "כבד" };
const qlBalLight = { id: "ql-bal-light", name: "קל ומוגבל", qualifiedCategories: ["מטבח"] };
const qlBalShift = {
  id: "ql-bal-shift", date: dates[0], label: "משמרת לילה", type: "night", category: "סיור",
  startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [],
};
const qlBalAvailability = {
  [`${qlBalHeavy.id}-${qlBalShift.id}`]: { status: "available" },
  [`${qlBalLight.id}-${qlBalShift.id}`]: { status: "available" },
};
const qlBalResult = autoAssign({
  shifts: [qlBalShift], guards: [qlBalHeavy, qlBalLight], availability: qlBalAvailability, keepExisting: true,
});
const qlBalLogEntry = qlBalResult.log.find((l) => l.step === "balance");
const qlBalMovedLightToExcluded = (qlBalLogEntry?.moves || []).some(
  (m) => m.shiftId === qlBalShift.id && m.to === qlBalLight.name
);
check("QUAL-04 · מעבר האיזון לא מזיז את השומר המצומצם למשמרת מהקטגוריה שהוא לא כשיר לה",
  !(qlBalResult.byShift[qlBalShift.id] || []).includes(qlBalLight.id) && !qlBalMovedLightToExcluded,
  JSON.stringify({ byShift: qlBalResult.byShift, balanceLog: qlBalLogEntry }));

// Test 8 — הפיקסצ'ר המקורי, בלי שום נתון כשירות (guards ו-shifts בראש
// הקובץ), לא זז מהתוצאה שכבר הוכחה מעליו — רגרסיה כאן משויכת לכשירות ולא
// לבדיקה אחרת שלא קשורה.
check("QUAL-02 · הפיקסצ'ר המקורי (בלי qualifiedCategories/category כלל) עדיין מכסה לפחות 90",
  result.summary.coverage >= 90, String(result.summary.coverage));

// Test 9 — דטרמיניזם: שתי הרצות של הפיקסצ'ר החדש מייצרות אותו byShift ואותו
// fairnessScore בייט-לבייט.
const qlResultAgain = autoAssign({ shifts: qlShifts, guards: qlGuards, availability: qlAvailability });
check("QUAL-04 · דטרמיניסטי — שתי הרצות של פיקסצ'ר הכשירות מייצרות אותו byShift ואותו fairnessScore",
  JSON.stringify(qlResult.byShift) === JSON.stringify(qlResultAgain.byShift) &&
    qlResult.summary.fairnessScore === qlResultAgain.summary.fairnessScore,
  JSON.stringify({ a: qlResult.byShift, b: qlResultAgain.byShift }));

// Test 10 (D-01) — taskAsShiftShape נושאת category — הגשר מפאזה 2 לא מפיל
// את השדה שכשירות נשפטת עליו.
const qlTaskWithCategory = {
  id: "ql-task-1", title: "משימה", category: "מטבח",
  startDate: dates[0], dueDate: dates[0], startTime: "08:00", endTime: "10:00", assignees: ["ql-narrow"],
};
const qlTaskNoCategory = {
  id: "ql-task-2", title: "משימה",
  startDate: dates[0], dueDate: dates[0], startTime: "08:00", endTime: "10:00", assignees: ["ql-narrow"],
};
check("D-01 · taskAsShiftShape על משימה עם קטגוריה מחזירה אותה בשדה category",
  taskAsShiftShape(qlTaskWithCategory)?.category === "מטבח", JSON.stringify(taskAsShiftShape(qlTaskWithCategory)));
check("D-01 · taskAsShiftShape על משימה בלי קטגוריה מחזירה מחרוזת ריקה, לא undefined/null",
  taskAsShiftShape(qlTaskNoCategory)?.category === "", JSON.stringify(taskAsShiftShape(qlTaskNoCategory)));
const qlMerged = withEngineTasks([], [qlTaskWithCategory]);
check("D-01 · withEngineTasks משמר את category על פני המיזוג",
  qlMerged[0]?.category === "מטבח", JSON.stringify(qlMerged));

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
