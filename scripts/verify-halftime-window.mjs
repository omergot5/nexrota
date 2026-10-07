// Standalone check: חצי משרה נשאר חצי משרה גם כשחלון ההוגנות פעיל.
//   node scripts/verify-halftime-window.mjs
//
// נולד מבאג שנתפס ב-QA (docs/qa/2026-10-07-qa-report.md, ממצא 3): carriedLoad מכיל את
// הנטל של כל החלון, אבל היעד האישי היה יעד של שבוע אחד. ההפרש בין משרה מלאה לחצי
// משרה הצטמצם לחצי שבוע, והמנוע יישר את הנטל המצטבר — בחלון של 3 חודשים (ברירת
// המחדל) חצי משרה עבד כמו משרה מלאה מהשבוע השני.
//
// כאן: 20 אנשים, 4 בחצי משרה, 10 שבועות רצופים כמו ש-SmartAssign מזין את המנוע
// (rollingLoad על ההיסטוריה), ובכל חלון — היחס בין הנטל השבועי הממוצע של חצי משרה
// לזה של משרה מלאה. ובנוסף: מי שנשא יותר בעבר מקבל פחות עכשיו (החלון עדיין עובד).

import { autoAssign, shiftLoad } from "../src/lib/autoAssign.js";
import { rollingLoad } from "../src/lib/fairness.js";
import { plannedRowsForWeek, buildDivisionRows } from "../src/lib/positions.js";
import { addDays } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const SUNDAY = "2026-10-11";
const ALL = [0, 1, 2, 3, 4, 5, 6];
const POSITIONS = [
  ...buildDivisionRows("שער", 12).map((r) => ({ ...r, category: "שער", weekdays: ALL, requiredGuards: 2 })),
  ...buildDivisionRows("סיור", 8).map((r) => ({ ...r, category: "סיור", weekdays: ALL, requiredGuards: 1 })),
].map((p, i) => ({ ...p, id: `p${i}`, shape: "template", active: true }));

const weekShifts = (w) => {
  let n = 0;
  return POSITIONS.flatMap((p) => plannedRowsForWeek(p, addDays(SUNDAY, 7 * w)))
    .map((r) => ({ ...r, id: `w${w}s${String(++n).padStart(2, "0")}`, assignedGuards: [] }));
};

const guards = Array.from({ length: 20 }, (_, i) => ({
  id: `g${String(i).padStart(2, "0")}`,
  name: `g${i}`,
  ...(i >= 16 ? { halfTime: true } : {}),
}));
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

function run(windowDays, weeks = 10) {
  const history = [];
  const perWeek = [];
  for (let w = 0; w < weeks; w++) {
    const shifts = weekShifts(w);
    const until = addDays(SUNDAY, 7 * w);
    const carriedLoad = windowDays ? rollingLoad({ guards, shifts: history, until, days: windowDays }).per : {};
    const result = autoAssign({ shifts, guards, availability: {}, carriedLoad });
    for (const s of shifts) history.push({ ...s, assignedGuards: result.byShift[s.id] || [] });
    perWeek.push(Object.fromEntries(result.fairness.perGuard.map((p) => [p.guardId, p.load])));
  }
  const later = perWeek.slice(2);
  const half = avg(guards.filter((g) => g.halfTime).map((g) => avg(later.map((x) => x[g.id]))));
  const full = avg(guards.filter((g) => !g.halfTime).map((g) => avg(later.map((x) => x[g.id]))));
  return half / full;
}

console.log("\nחצי משרה מול משרה מלאה, שבועות 3–10, לפי חלון ההוגנות (יעד: 0.5)\n");
for (const days of [0, 14, 30, 90, 120]) {
  const ratio = run(days);
  check(`חלון ${days} ימים: יחס ${ratio.toFixed(2)}`, ratio > 0.4 && ratio < 0.6);
}

console.log("\nהחלון עדיין מפצה על עבר לא מאוזן\n");
{
  const shifts = weekShifts(0);
  // g00 נשא בעבר הרבה מעל כולם; g01 לא נשא כלום.
  const carriedLoad = Object.fromEntries(guards.map((g) => [g.id, { load: 30, nights: 1 }]));
  carriedLoad.g00 = { load: 90, nights: 4 };
  carriedLoad.g01 = { load: 0, nights: 0 };
  const result = autoAssign({ shifts, guards, availability: {}, carriedLoad });
  const load = Object.fromEntries(result.fairness.perGuard.map((p) => [p.guardId, p.load]));
  check("מי שנשא הרבה בעבר מקבל השבוע פחות ממי שלא נשא כלום", load.g00 < load.g01, `g00=${load.g00} g01=${load.g01}`);
  check("שום שיבוץ לא הלך לאיבוד בגלל החלון", result.summary.coverage === 100, `${result.summary.coverage}%`);
}

console.log("\nבלי carriedLoad — היעדים זהים ליעדי השבוע (אין שינוי התנהגות)\n");
{
  const shifts = weekShifts(0);
  const a = autoAssign({ shifts, guards, availability: {} });
  const b = autoAssign({ shifts, guards, availability: {}, carriedLoad: {} });
  check("carriedLoad ריק = בלי carriedLoad", JSON.stringify(a.assignments.map((x) => [x.shiftId, x.guardId])) === JSON.stringify(b.assignments.map((x) => [x.shiftId, x.guardId])));
  const target = a.fairness.perGuard.find((p) => p.guardId === "g00").target;
  const week = shifts.reduce((s, x) => s + shiftLoad(x) * x.requiredGuards, 0) / (16 + 4 * 0.5);
  check("perGuard[].target הוא עדיין יעד השבוע", Math.abs(target - week) < 0.1, `${target} vs ${week.toFixed(1)}`);
}

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
