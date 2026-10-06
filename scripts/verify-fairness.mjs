// ספסל ההוגנות — האם המנוע באמת מחלק שווה כשהמשמרות לא באותו אורך.
//   node scripts/verify-fairness.mjs
//
// נולד ממדידה על מבנה הצבא (2026-10-06): המנוע דיווח ציון הוגנות 87, ובפועל
// חייל אחד עבד 36 שעות ואחר 58. הספירה הייתה מאוזנת (4–6 משמרות לכל אחד),
// אבל ארבע כוננויות של 12 שעות אינן חמש עמדות של 6, ומעבר האיזון עצר אחרי
// שני מהלכים. 9 חיילים עשו את כל המטבח, ואחד מהם שלוש פעמים.
//
// הספים כאן הם מה שהמנוע מגיע אליו היום, עם מרווח קטן. מי ששובר אותם צריך
// לדעת שהוא החזיר פער אמיתי בין אנשים, לא רק שינה מספר.

import { ARMY_DEMO_POSITIONS, ARMY_DEMO_SOLDIERS, demoAvailabilityCode } from "../src/lib/armyDemo.js";
import { plannedRowsForWeek } from "../src/lib/positions.js";
import { autoAssign, shiftLoad, teamRules } from "../src/lib/autoAssign.js";
import { shiftHours } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const round1 = (n) => Math.round(n * 10) / 10;

/** נטל, שעות ותורנויות-לפי-קטגוריה לכל אדם, מתוך התוצאה המוחזרת עצמה. */
function measure(result, shifts, guards) {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const per = new Map(guards.map((g) => [g.id, { load: 0, hours: 0, cats: {} }]));
  for (const a of result.assignments) {
    const s = byId.get(a.shiftId);
    const p = per.get(a.guardId);
    p.load += shiftLoad(s);
    p.hours += shiftHours(s);
    p.cats[s.category] = (p.cats[s.category] || 0) + 1;
  }
  const rows = [...per.values()];
  const loads = rows.map((p) => p.load);
  const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
  return {
    rows,
    spread: Math.max(...loads) - Math.min(...loads),
    sd: Math.sqrt(loads.reduce((a, b) => a + (b - mean) ** 2, 0) / loads.length),
    inCategory: (c) => rows.filter((p) => p.cats[c]).length,
    maxInCategory: (c) => Math.max(...rows.map((p) => p.cats[c] || 0)),
  };
}

// ============================================================
console.log("\nמבנה הצבא — 229 מקומות, 45 חיילים, משמרות של 6/8/12/14 שעות\n");
// ============================================================

const sunday = "2026-10-11";
let pid = 0;
let sid = 0;
const positions = ARMY_DEMO_POSITIONS.map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
const shifts = positions
  .flatMap((p) => plannedRowsForWeek(p, sunday))
  .map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
const guards = Array.from({ length: ARMY_DEMO_SOLDIERS }, (_, i) => ({ id: `g${i}`, name: `g${i}` }));
const dates = [...new Set(shifts.map((s) => s.date))].sort();
const STATUS = { a: "available", u: "unavailable", m: "maybe" };
const availability = {};
guards.forEach((g, gi) =>
  dates.forEach((date, di) => {
    shifts
      .filter((s) => s.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .forEach((s, si) => {
        availability[`${g.id}-${s.id}`] = STATUS[demoAvailabilityCode(gi, di * 5 + si, si % 2 === 0 ? "day" : "night")];
      });
  })
);

const strictRun = autoAssign({ shifts, guards, availability, rules: { minRestHours: 10 } });
const strict = measure(strictRun, shifts, guards);
check(
  "פער הנטל בין הכי עמוס לפנוי ביותר — עד 12 (היה 25.6)",
  strict.spread <= 12,
  `spread=${round1(strict.spread)}`
);
check("סטיית התקן של הנטל — עד 3 (הייתה 8.0)", strict.sd <= 3, `sd=${round1(strict.sd)}`);
check("מעבר האיזון באמת עובד — יותר מ-10 מהלכים (היו 2)", strictRun.summary.balanceMoves > 10,
  `balanceMoves=${strictRun.summary.balanceMoves}`);

const relaxedRun = autoAssign({ shifts, guards, availability, rules: { minRestHours: 10, maxConsecutiveHours: 14 } });
const relaxed = measure(relaxedRun, shifts, guards);
check("גם כשהמטבח מאויש: פער הנטל עד 12", relaxed.spread <= 12, `spread=${round1(relaxed.spread)}`);
check(
  "המטבח עובר בסבב: 12 חיילים שונים על 12 התורנויות (היו 9)",
  relaxed.inCategory("תורנות מטבח") === 12,
  `${relaxed.inCategory("תורנות מטבח")} חיילים`
);
check(
  "אף חייל לא עושה מטבח פעמיים באותו שבוע (היה 3)",
  relaxed.maxInCategory("תורנות מטבח") === 1,
  `max=${relaxed.maxInCategory("תורנות מטבח")}`
);
check(
  "הסבב לא עולה בכיסוי: כל 229 המקומות מאוישים",
  relaxedRun.summary.filledSlots === 229,
  `${relaxedRun.summary.filledSlots}/229`
);

// הכללים שהצוות באמת רץ איתם (teamRules, 0029): מטבח וכוננות מותרים מעל 12.
const teamRun = autoAssign({
  shifts, guards, availability, rules: { ...teamRules({ mode: "army", restHours: 10 }) },
});
const team = measure(teamRun, shifts, guards);
check("בכללי הצוות: כל 229 המקומות מאוישים — ההוגנות לא עולה בכיסוי", teamRun.summary.filledSlots === 229,
  `${teamRun.summary.filledSlots}/229`);
check("בכללי הצוות: פער הנטל עד 10 (היה 35.8)", team.spread <= 10, `spread=${round1(team.spread)}`);
check("בכללי הצוות: המטבח — 12 חיילים, פעם אחת כל אחד", team.inCategory("תורנות מטבח") === 12 && team.maxInCategory("תורנות מטבח") === 1,
  `${team.inCategory("תורנות מטבח")} חיילים, max=${team.maxInCategory("תורנות מטבח")}`);

// ============================================================
console.log("\nדטרמיניזם — אותם נתונים, אותו סידור\n");
// ============================================================

const again = autoAssign({ shifts, guards, availability, rules: { minRestHours: 10, maxConsecutiveHours: 14 } });
const sig = (r) => r.assignments.map((a) => `${a.shiftId}:${a.guardId}`).sort().join("|");
check("שתי הרצות זהות לגמרי", sig(again) === sig(relaxedRun));

// ============================================================
console.log("\nרוסטר אזרחי מעורב — עמדות של 6 שעות וכוננות של 12, 14 אנשים\n");
// ============================================================

const civilDates = dates;
const civilShifts = [];
let cid = 0;
for (const date of civilDates) {
  for (const [startTime, endTime] of [["06:00", "12:00"], ["12:00", "18:00"], ["18:00", "00:00"], ["00:00", "06:00"]]) {
    civilShifts.push({ id: `c${++cid}`, date, label: "עמדה", category: "שמירה", startTime, endTime, requiredGuards: 1, assignedGuards: [] });
  }
  civilShifts.push({ id: `c${++cid}`, date, label: "כוננות יום", category: "כוננות", startTime: "07:00", endTime: "19:00", requiredGuards: 2, assignedGuards: [] });
  civilShifts.push({ id: `c${++cid}`, date, label: "כוננות לילה", category: "כוננות", startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [] });
}
const civilGuards = Array.from({ length: 14 }, (_, i) => ({ id: `w${String(i).padStart(2, "0")}`, name: `w${i}` }));
const civilRun = autoAssign({ shifts: civilShifts, guards: civilGuards, availability: {}, rules: { minRestHours: 10 } });
const civil = measure(civilRun, civilShifts, civilGuards);
const civilPerShift = civilRun.fairness.perShiftLoad;
check(
  "פער הנטל קטן ממשמרת ממוצעת אחת וחצי",
  civil.spread <= civilPerShift * 1.5,
  `spread=${round1(civil.spread)} perShift=${civilPerShift}`
);
check("כל המקומות מאוישים", civilRun.summary.openSlots === 0, `${civilRun.summary.openSlots} פתוחים`);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
