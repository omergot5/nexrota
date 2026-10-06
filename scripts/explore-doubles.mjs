// חיפוש כפילויות: מי עושה שני סיורים (או שתי משמרות) באותו יום, או בלי מנוחה.
//   node scripts/explore-doubles.mjs

import { armyDemoPositions, demoAvailabilityCode } from "../src/lib/armyDemo.js";
import { plannedRowsForWeek } from "../src/lib/positions.js";
import { autoAssign, teamRules } from "../src/lib/autoAssign.js";
import { opDayOf } from "../src/lib/postWeek.js";

const sunday = "2026-10-11";
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const interval = (s) => {
  const start = new Date(`${s.date}T00:00:00Z`).getTime() / 60000 + mins(s.startTime);
  let end = new Date(`${s.date}T00:00:00Z`).getTime() / 60000 + mins(s.endTime);
  if (end <= start) end += 1440;
  return [start, end];
};

const OFF = Number(process.env.OFF || 0);
for (const [soldiers, cmd] of [[30, 6], [30, 8], [25, 6], [20, 6], [30, 0]]) {
  let pid = 0, sid = 0;
  const positions = armyDemoPositions(soldiers).map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  const shifts = positions.flatMap((p) => plannedRowsForWeek(p, sunday)).map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
  const guards = Array.from({ length: soldiers }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`, name: `g${i}`,
    ...(i < cmd ? { dutyRole: i === 0 ? "sergeant" : i === 1 ? "platoon" : "squad", qualifiedCategories: ["סיור", "כוננות"] } : {}),
  }));
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
  const availability = {};
  guards.forEach((g, gi) => dates.forEach((date, di) => shifts.filter((s) => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((s, si) => {
    availability[`${g.id}-${s.id}`] = demoAvailabilityCode(gi + OFF, di * 5 + si, si % 2 === 0 ? "day" : "night") === "a" ? "available" : "unavailable";
  })));
  const r = autoAssign({ shifts, guards, availability, rules: teamRules({ mode: "army", restHours: 10 }) });
  const byShift = new Map(shifts.map((s) => [s.id, s]));
  const per = new Map(guards.map((g) => [g.id, []]));
  for (const a of r.assignments) per.get(a.guardId).push(byShift.get(a.shiftId));
  const problems = [];
  for (const [gid, list] of per) {
    list.sort((a, b) => interval(a)[0] - interval(b)[0]);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [s1, e1] = interval(list[i]);
        const [s2, e2] = interval(list[j]);
        const gap = (s2 - e1) / 60;
        if (s2 < e1) problems.push(`${gid}: חפיפה ${list[i].label} ${list[i].date} ${list[i].startTime} / ${list[j].label} ${list[j].date} ${list[j].startTime}`);
        else if (gap > 0 && gap < 10 && j === i + 1) problems.push(`${gid}: מנוחה ${gap.toFixed(1)} שעות בין ${list[i].label} ${list[i].date} ${list[i].startTime}-${list[i].endTime} ל-${list[j].label} ${list[j].date} ${list[j].startTime}`);
        if (opDayOf(list[i]) === opDayOf(list[j]) && list[i].category === list[j].category && list[i].category === "סיור")
          problems.push(`${gid}: שני סיורים באותו יום (${opDayOf(list[i])}): ${list[i].startTime}-${list[i].endTime} + ${list[j].startTime}-${list[j].endTime}`);
      }
    }
  }
  console.log(`\n${soldiers} חיילים, ${cmd} בעלי תפקיד: ${problems.length} בעיות`);
  problems.slice(0, 12).forEach((p) => console.log("  " + p));
}
