// QA: האם חצי משרה שורד את חלון ההוגנות המתגלגל (כמו ש-SmartAssign מזין אותו)?
import { autoAssign, teamRules } from "../../src/lib/autoAssign.js";
import { rollingLoad } from "../../src/lib/fairness.js";
import { plannedRowsForWeek } from "../../src/lib/positions.js";
import { addDays } from "../../src/lib/dates.js";
import { positionsFor, mulberry } from "./lib.mjs";
const SUN = "2026-10-11";
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
for (const windowDays of [0, 14, 30, 90]) {
  const n = 20, mode = "security", rnd = mulberry(11);
  const guards = Array.from({ length: n }, (_, i) => ({ id: `g${String(i).padStart(2, "0")}`, name: `g${i}`, ...(i >= n - 4 ? { halfTime: true } : {}) }));
  const history = []; // shifts with assignedGuards
  const wk = []; // per-week loads
  for (let w = 0; w < 12; w++) {
    const s0 = addDays(SUN, 7 * w);
    let pid = 0, sid = 0;
    const shifts = positionsFor(mode, n).map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true })).flatMap((p) => plannedRowsForWeek(p, s0)).map((r) => ({ ...r, id: `w${w}s${++sid}`, assignedGuards: [] }));
    const av = {};
    guards.forEach((g, gi) => { if (gi % 5 === 0) return; shifts.forEach((s) => { const r = rnd(); if (r < 0.75) av[`${g.id}-${s.id}`] = "available"; else if (r < 0.9) av[`${g.id}-${s.id}`] = "unavailable"; }); });
    const carried = windowDays ? rollingLoad({ guards, shifts: history, until: s0, days: windowDays }).per : {};
    const res = autoAssign({ shifts, guards, availability: av, rules: teamRules({ mode }), carriedLoad: carried });
    const by = new Map(); res.assignments.forEach((a) => by.set(a.shiftId, [...(by.get(a.shiftId) || []), a.guardId]));
    shifts.forEach((s) => history.push({ ...s, assignedGuards: by.get(s.id) || [] }));
    wk.push(Object.fromEntries(res.fairness.perGuard.map((p) => [p.guardId, p.load])));
  }
  const ratio = (from, to) => {
    const half = guards.filter((g) => g.halfTime).map((g) => avg(wk.slice(from, to).map((x) => x[g.id])));
    const full = guards.filter((g) => !g.halfTime).map((g) => avg(wk.slice(from, to).map((x) => x[g.id])));
    return `${avg(half).toFixed(1)}/${avg(full).toFixed(1)}=${(avg(half) / avg(full)).toFixed(2)}`;
  };
  console.log(`fairness window ${String(windowDays).padStart(2)}d: half/full weekly load  wk1 ${ratio(0, 1)} | wk2-3 ${ratio(1, 3)} | wk4-12 ${ratio(3, 12)}   (ideal 0.50)`);
}
