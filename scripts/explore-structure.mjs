// בדיקת היתכנות (לא חלק מ-npm test): המבנה שהמפקד ביקש — עמדת שמירה 1, סיור 3–4, כוננות 6, מטבח 1–2.
//   node scripts/explore-structure.mjs

import { demoAvailabilityCode } from "../src/lib/armyDemo.js";
import { plannedRowsForWeek, buildDivisionRows } from "../src/lib/positions.js";
import { autoAssign, teamRules } from "../src/lib/autoAssign.js";

const ALL = [0, 1, 2, 3, 4, 5, 6];
const divided = (title, hours, category, requiredGuards) =>
  buildDivisionRows(title, hours).map((r) => ({ ...r, category, weekdays: ALL, requiredGuards }));
const kitchen = (n) => ({ title: "תורנות מטבח", category: "תורנות מטבח", weekdays: [0, 1, 2, 3, 4, 5], startTime: "06:30", endTime: "20:30", requiredGuards: n });
const structure = ({ patrol, standby = 6, kit }) => [
  ...divided("עמדת שמירה 1", 6, "תורנות שמירה", 1),
  ...divided("סיור", 8, "סיור", patrol),
  ...divided("כוננות", 12, "כוננות", standby),
  kitchen(kit),
];

const sunday = "2026-10-11";
function run(soldiers, positions, { rest, cap, commanders }) {
  let pid = 0;
  let sid = 0;
  const pos = positions.map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  const shifts = pos.flatMap((p) => plannedRowsForWeek(p, sunday)).map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
  const guards = Array.from({ length: soldiers }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`,
    name: `g${i}`,
    ...(i < commanders ? { dutyRole: i === 0 ? "sergeant" : i === 1 ? "platoon" : "squad", qualifiedCategories: ["סיור", "כוננות"] } : {}),
  }));
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
  const availability = {};
  guards.forEach((g, gi) =>
    dates.forEach((date, di) =>
      shifts.filter((s) => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((s, si) => {
        availability[`${g.id}-${s.id}`] = demoAvailabilityCode(gi, di * 5 + si, si % 2 === 0 ? "day" : "night") === "a" ? "available" : "unavailable";
      })
    )
  );
  const need = shifts.reduce((n, s) => n + s.requiredGuards, 0);
  const r = autoAssign({ shifts, guards, availability, rules: { ...teamRules({ mode: "army", restHours: rest }), maxShiftsPerWeek: cap } });
  return { need, filled: r.summary.filledSlots, gaps: r.commandGaps.length, spread: r.fairness.loadSpread };
}

const variants = { "סיור 3, מטבח 1": { patrol: 3, kit: 1 }, "סיור 4, מטבח 2": { patrol: 4, kit: 2 } };
for (const [name, v] of Object.entries(variants)) {
  const positions = structure(v);
  const slots = positions.reduce((n, p) => n + p.requiredGuards * p.weekdays.length, 0);
  console.log(`\n${name} — ${slots} מקומות בשבוע`);
  for (const [soldiers, cmd] of [[30, 6], [36, 8], [40, 8], [45, 8]]) {
    for (const [rest, cap] of [[10, 6], [8, 6], [8, 7]]) {
      const r = run(soldiers, positions, { rest, cap, commanders: cmd });
      console.log(`  ${soldiers} חיילים, מנוחה ${rest}, תקרה ${cap}: ${r.filled}/${r.need} · בלי בעל תפקיד ${r.gaps} · פער נטל ${r.spread}`);
    }
  }
}
