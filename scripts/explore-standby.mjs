// בדיקת היתכנות (לא חלק מ-npm test): כמה חיילים צריך כדי לאייש כוננות של 6 במקביל
// לצד שאר העמדות, עם בעל תפקיד בכל סיור וכוננות.
//   node scripts/explore-standby.mjs

import { armyDemoPositions, demoAvailabilityCode } from "../src/lib/armyDemo.js";
import { plannedRowsForWeek } from "../src/lib/positions.js";
import { autoAssign, teamRules } from "../src/lib/autoAssign.js";
import { buildDivisionRows } from "../src/lib/positions.js";

const ALL = [0, 1, 2, 3, 4, 5, 6];
const divided = (title, hours, category, requiredGuards) =>
  buildDivisionRows(title, hours).map((r) => ({ ...r, category, weekdays: ALL, requiredGuards }));
const kitchen = (n) => ({ title: "תורנות מטבח", category: "תורנות מטבח", weekdays: [0, 1, 2, 3, 4, 5], startTime: "06:30", endTime: "20:30", requiredGuards: n });

const STRUCTURES = {
  "A: 2 שמירה, סיור 2, כוננות 6, מטבח 2": [...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1), ...divided("עמדת שמירה 2", 6, "תורנות שמירה", 1), ...divided("סיור", 8, "סיור", 2), ...divided("כוננות", 12, "כוננות", 6), kitchen(2)],
  "B: שמירה 1, סיור 1, כוננות 6, מטבח 1": [...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1), ...divided("סיור", 8, "סיור", 1), ...divided("כוננות", 12, "כוננות", 6), kitchen(1)],
  "C: שמירה 1, סיור 1, כוננות 6 (בלי מטבח)": [...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1), ...divided("סיור", 8, "סיור", 1), ...divided("כוננות", 12, "כוננות", 6)],
  "D: כוננות 6 בלבד": [...divided("כוננות", 12, "כוננות", 6)],
};

const sunday = "2026-10-11";
const NCMD = Number(process.env.NCMD || 6);
const ROLES = Array.from({ length: NCMD }, (_, i) => (i === 0 ? "sergeant" : i === 1 ? "platoon" : "squad"));

function run(soldiers, positions, commanders = true) {
  let pid = 0;
  let sid = 0;
  const pos = positions.map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  const shifts = pos.flatMap((p) => plannedRowsForWeek(p, sunday)).map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
  const guards = Array.from({ length: soldiers }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`,
    name: `g${i}`,
    ...(commanders && i < NCMD ? { dutyRole: ROLES[i], qualifiedCategories: ["סיור", "כוננות"] } : {}),
  }));
  const availability = {};
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
  guards.forEach((g, gi) =>
    dates.forEach((date, di) =>
      shifts.filter((s) => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((s, si) => {
        availability[`${g.id}-${s.id}`] = demoAvailabilityCode(gi, di * 5 + si, si % 2 === 0 ? "day" : "night") === "a" ? "available" : "unavailable";
      })
    )
  );
  const need = shifts.reduce((n, s) => n + s.requiredGuards, 0);
  const r = autoAssign({ shifts, guards, availability, rules: teamRules({ mode: "army", restHours: 10 }) });
  const per = r.fairness.perGuard.map((p) => p.shifts);
  return { need, filled: r.summary.filledSlots, gaps: r.commandGaps.length, max: Math.max(...per), cmdShifts: shifts.filter((s) => ["סיור", "כוננות"].includes(s.category)).length };
}

for (const [name, positions] of Object.entries(STRUCTURES)) {
  console.log(`\n${name}`);
  for (const n of [20, 25, 30, 40]) {
    const r = run(n, positions);
    console.log(`  ${String(n).padStart(2)} חיילים: ${r.filled}/${r.need} מקומות · משמרות בלי בעל תפקיד: ${r.gaps}/${r.cmdShifts} · מקסימום משמרות לחייל ${r.max}`);
  }
}

console.log("\n--- 20 חיילים: כוננות קטנה יותר ---");
for (const k of [3, 4, 5]) {
  const r = run(20, [...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1), ...divided("סיור", 8, "סיור", 1), ...divided("כוננות", 12, "כוננות", k), kitchen(1)]);
  console.log(`  כוננות ${k}: ${r.filled}/${r.need} · בלי בעל תפקיד ${r.gaps}/${r.cmdShifts}`);
}
