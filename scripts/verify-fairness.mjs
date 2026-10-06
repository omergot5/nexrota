// ספסל ההוגנות — האם המנוע באמת מחלק שווה כשהמשמרות לא באותו אורך.
//   node scripts/verify-fairness.mjs
//
// נולד ממדידה על מבנה הצבא (2026-10-06): המנוע דיווח ציון הוגנות 87, ובפועל
// חייל אחד עבד 36 שעות ואחר 58. הספירה הייתה מאוזנת (4–6 משמרות לכל אחד),
// אבל ארבע כוננויות של 12 שעות אינן חמש עמדות של 6, ומעבר האיזון עצר אחרי
// שני מהלכים. 9 חיילים עשו את כל המטבח, ואחד מהם שלוש פעמים.
//
// נבדק בשלושה גדלים של הדגמת הצבא — 30 חיילים (המבנה הרגיל), 25 (אותו מבנה,
// פחות אנשים) ו-20 (המבנה הקטן). הספים הם מה שהמנוע מגיע אליו היום, עם
// מרווח קטן, והמנוע שלפני התיקון נכשל בהם (ר' ההערה לכל בדיקה). מי ששובר אותם
// צריך לדעת שהוא החזיר פער אמיתי בין אנשים, לא רק שינה מספר.

import { ARMY_DEMO_SMALL_MAX, ARMY_DEMO_SOLDIERS, armyDemoPositions, demoAvailabilityCode } from "../src/lib/armyDemo.js";
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

const sunday = "2026-10-11";
const STATUS = { a: "available", u: "unavailable" };

/** שבוע מלא של המבנה שמתאים ל-`structureFor` חיילים, עם `soldiers` חיילים. */
function scenario(soldiers, structureFor, rules) {
  let pid = 0;
  let sid = 0;
  const positions = armyDemoPositions(structureFor).map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  const shifts = positions
    .flatMap((p) => plannedRowsForWeek(p, sunday))
    .map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
  const guards = Array.from({ length: soldiers }, (_, i) => ({ id: `g${i}`, name: `g${i}` }));
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
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
  const need = shifts.reduce((n, s) => n + s.requiredGuards, 0);
  const result = autoAssign({ shifts, guards, availability, rules });
  const sig = result.assignments.map((a) => `${a.shiftId}:${a.guardId}`).sort().join("|");
  return { shifts, guards, availability, need, result, sig, m: measure(result, shifts, guards), rules };
}

const army = teamRules({ mode: "army", restHours: 10 });
const kitchenSlots = (sc) => sc.shifts.filter((s) => s.category === "תורנות מטבח").reduce((n, s) => n + s.requiredGuards, 0);

const SCENARIOS = [
  { name: `${ARMY_DEMO_SOLDIERS} חיילים — המבנה הרגיל (ברירת המחדל)`, soldiers: ARMY_DEMO_SOLDIERS, structure: ARMY_DEMO_SOLDIERS, minCover: 1, moves: 10 },
  { name: "25 חיילים — אותו מבנה, פחות אנשים", soldiers: 25, structure: ARMY_DEMO_SOLDIERS, minCover: 0.97, moves: 0 },
  { name: `${ARMY_DEMO_SMALL_MAX} חיילים — המבנה הקטן`, soldiers: ARMY_DEMO_SMALL_MAX, structure: ARMY_DEMO_SMALL_MAX, minCover: 1, moves: 0 },
];

for (const spec of SCENARIOS) {
  console.log(`\n${spec.name}\n`);
  const sc = scenario(spec.soldiers, spec.structure, army);
  const { m } = sc;
  const filled = sc.result.summary.filledSlots;

  // המנוע שלפני התיקון: פער נטל 20–46, סטיית תקן 6–11 — הסף נמוך מכך בהרבה.
  check(`כיסוי: ${filled}/${sc.need}`, filled / sc.need >= spec.minCover, `${filled}/${sc.need}`);
  check("פער הנטל בין הכי עמוס לפנוי ביותר — עד 12", m.spread <= 12, `spread=${round1(m.spread)}`);
  check("סטיית התקן של הנטל — עד 3.6", m.sd <= 3.6, `sd=${round1(m.sd)}`);
  check("אף חייל לא עובר את תקרת 6 התורנויות", sc.result.fairness.perGuard.every((p) => p.shifts <= 6));
  if (spec.moves) {
    check(`מעבר האיזון באמת עובד — יותר מ-${spec.moves} מהלכים (היו 4 במנוע הישן)`, sc.result.summary.balanceMoves > spec.moves,
      `balanceMoves=${sc.result.summary.balanceMoves}`);
  }

  // הסבב: כל משבצת מטבח אצל אדם אחר כל עוד יש מי שעוד לא עשה — ללא כפילות.
  const ks = kitchenSlots(sc);
  const kitchenFilled = sc.shifts
    .filter((s) => s.category === "תורנות מטבח")
    .reduce((n, s) => n + (sc.result.byShift[s.id] || []).length, 0);
  if (ks > 0 && kitchenFilled === ks && spec.soldiers >= ks) {
    check(`המטבח עובר בסבב: ${ks} משבצות, ${ks} חיילים שונים, פעם אחת כל אחד`,
      m.inCategory("תורנות מטבח") === ks && m.maxInCategory("תורנות מטבח") === 1,
      `${m.inCategory("תורנות מטבח")} חיילים, max=${m.maxInCategory("תורנות מטבח")}`);
  }

  const again = scenario(spec.soldiers, spec.structure, army);
  check("אותם נתונים, אותו סידור (דטרמיניזם)", again.sig === sc.sig);
}

// ============================================================
console.log("\nבלי ההיתר ל'משמרות ארוכות' — המנוע עדיין לא עוקף את כלל ה-12\n");
// ============================================================

{
  const strict = scenario(ARMY_DEMO_SOLDIERS, ARMY_DEMO_SOLDIERS, { minRestHours: 10, longShiftCategories: [] });
  const open = strict.result.unfilled.reduce((n, u) => n + u.missing, 0);
  const kitchenOpen = strict.result.unfilled
    .filter((u) => String(u.shift?.label || "").includes("מטבח"))
    .reduce((n, u) => n + u.missing, 0);
  check("רק המטבח (14 שעות) נשאר פתוח", open === kitchenOpen && kitchenOpen === kitchenSlots(strict), `${open} פתוחים, ${kitchenOpen} במטבח`);
  check("ועדיין פער הנטל סביר", strict.m.spread <= 14, `spread=${round1(strict.m.spread)}`);
}

// ============================================================
console.log("\nרוסטר אזרחי מעורב — עמדות של 6 שעות וכוננות של 12, 14 אנשים\n");
// ============================================================

const civilDates = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
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
