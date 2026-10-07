// QA: האם התכונות הרכות באמת עובדות? העדפות, חצי משרה, סופ"ש, שותקים — על צוותים 18-22.
import { autoAssign, teamRules, shiftLoad } from "../../src/lib/autoAssign.js";
import { plannedRowsForWeek } from "../../src/lib/positions.js";
import { addDays, isNightShift, fromISODate } from "../../src/lib/dates.js";
import { positionsFor, mulberry } from "./lib.mjs";

const SUN = "2026-10-11";
const week = (mode, n, w = 0) => {
  let pid = 0, sid = 0;
  const s = addDays(SUN, 7 * w);
  return positionsFor(mode, n).map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }))
    .flatMap((p) => plannedRowsForWeek(p, s)).map((r) => ({ ...r, id: `w${w}s${String(++sid).padStart(3, "0")}`, assignedGuards: [] }));
};
const isWeekend = (s) => { const d = fromISODate(s.date).getDay(); return d === 6 || (d === 5 && Number(s.startTime.slice(0, 2)) >= 12); };
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const SIZES = [18, 19, 20, 21, 22];

console.log("=== 1. 'preferred' honoured? (security/restaurant, 15% of cells preferred, rest available) ===");
for (const mode of ["security", "restaurant"]) for (const n of SIZES) {
  const rnd = mulberry(n * 7), guards = Array.from({ length: n }, (_, i) => ({ id: `g${String(i).padStart(2, "0")}`, name: `g${i}` }));
  const shifts = week(mode, n); const av = {}; const wanted = [];
  guards.forEach((g) => shifts.forEach((s) => { const r = rnd(); if (r < 0.15) { av[`${g.id}-${s.id}`] = "preferred"; wanted.push([g.id, s.id]); } else av[`${g.id}-${s.id}`] = "available"; }));
  const res = autoAssign({ shifts, guards, availability: av, rules: teamRules({ mode }) });
  const got = new Set(res.assignments.map((a) => a.guardId + "|" + a.shiftId));
  const hit = wanted.filter(([g, s]) => got.has(g + "|" + s)).length;
  // baseline: same shifts, everyone merely 'available'
  const base = autoAssign({ shifts, guards, availability: Object.fromEntries(Object.keys(av).map((k) => [k, "available"])), rules: teamRules({ mode }) });
  const baseGot = new Set(base.assignments.map((a) => a.guardId + "|" + a.shiftId));
  const baseHit = wanted.filter(([g, s]) => baseGot.has(g + "|" + s)).length;
  console.log(`${mode.padEnd(10)} n=${n} preferred cells=${wanted.length} honoured=${hit} (${(100 * hit / wanted.length).toFixed(0)}%) vs by-chance baseline ${baseHit} (${(100 * baseHit / wanted.length).toFixed(0)}%)  slots=${res.summary.totalSlots}`);
}

console.log("\n=== 2. does 'prefer everything' beat 'available for everything'? (guard g02 marks all preferred) ===");
for (const n of SIZES) {
  const mode = "security", guards = Array.from({ length: n }, (_, i) => ({ id: `g${String(i).padStart(2, "0")}`, name: `g${i}` }));
  const shifts = week(mode, n); const av = {};
  guards.forEach((g, gi) => shifts.forEach((s) => (av[`${g.id}-${s.id}`] = gi === 2 ? "preferred" : "available")));
  const r = autoAssign({ shifts, guards, availability: av, rules: teamRules({ mode }) });
  const per = Object.fromEntries(r.fairness.perGuard.map((p) => [p.guardId, p.shifts]));
  const others = guards.filter((g) => g.id !== "g02").map((g) => per[g.id]);
  console.log(`n=${n}: g02 shifts=${per.g02}, others avg=${avg(others).toFixed(2)} (min ${Math.min(...others)}, max ${Math.max(...others)})`);
}

console.log("\n=== 3. half-time guards (last two) ===");
for (const mode of ["security", "restaurant"]) for (const n of SIZES) {
  const guards = Array.from({ length: n }, (_, i) => ({ id: `g${String(i).padStart(2, "0")}`, name: `g${i}`, ...(i >= n - 2 ? { halfTime: true } : {}) }));
  const shifts = week(mode, n); const av = {};
  const r = autoAssign({ shifts, guards, availability: av, rules: teamRules({ mode }) });
  const pg = r.fairness.perGuard; const half = pg.filter((p) => guards.find((g) => g.id === p.guardId).halfTime); const full = pg.filter((p) => !guards.find((g) => g.id === p.guardId).halfTime);
  console.log(`${mode.padEnd(10)} n=${n}: half-time avg load ${avg(half.map((p) => p.load)).toFixed(1)} vs full-time ${avg(full.map((p) => p.load)).toFixed(1)}  (ratio ${(avg(half.map((p) => p.load)) / avg(full.map((p) => p.load))).toFixed(2)}, ideal 0.50)`);
}

console.log("\n=== 4. weekend 'avoid' (first 3 guards) vs the rest ===");
for (const mode of ["security", "restaurant"]) for (const n of SIZES) {
  const guards = Array.from({ length: n }, (_, i) => ({ id: `g${String(i).padStart(2, "0")}`, name: `g${i}`, ...(i < 3 ? { weekendPreference: "avoid" } : {}) }));
  const shifts = week(mode, n); const r = autoAssign({ shifts, guards, availability: {}, rules: teamRules({ mode }) });
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const wk = {}; guards.forEach((g) => (wk[g.id] = 0));
  r.assignments.forEach((a) => { if (isWeekend(byId.get(a.shiftId))) wk[a.guardId]++; });
  const avoid = guards.slice(0, 3).map((g) => wk[g.id]), rest = guards.slice(3).map((g) => wk[g.id]);
  console.log(`${mode.padEnd(10)} n=${n}: avoiders weekend shifts avg ${avg(avoid).toFixed(2)} vs others ${avg(rest).toFixed(2)}`);
}

console.log("\n=== 5. 8 weeks in a row: carriedLoad on vs off (security 20, 25% silent, mixed) ===");
for (const useCarry of [true, false]) {
  const n = 20, mode = "security", rnd = mulberry(5);
  const guards = Array.from({ length: n }, (_, i) => ({ id: `g${String(i).padStart(2, "0")}`, name: `g${i}`, ...(i % 7 === 0 ? { halfTime: true } : {}) }));
  const cum = Object.fromEntries(guards.map((g) => [g.id, { load: 0, nights: 0 }]));
  for (let w = 0; w < 8; w++) {
    const shifts = week(mode, n, w), av = {};
    guards.forEach((g, gi) => { if (gi % 4 === 0) return; shifts.forEach((s) => { const r = rnd(); if (r < 0.7) av[`${g.id}-${s.id}`] = "available"; else if (r < 0.85) av[`${g.id}-${s.id}`] = "unavailable"; }); });
    const res = autoAssign({ shifts, guards, availability: av, rules: teamRules({ mode }), carriedLoad: useCarry ? Object.fromEntries(Object.entries(cum).map(([k, v]) => [k, { ...v }])) : {} });
    const byId = new Map(shifts.map((s) => [s.id, s]));
    res.assignments.forEach((a) => { const s = byId.get(a.shiftId); cum[a.guardId].load += shiftLoad(s); if (isNightShift(s)) cum[a.guardId].nights++; });
  }
  const full = guards.filter((g) => !g.halfTime).map((g) => cum[g.id].load), half = guards.filter((g) => g.halfTime).map((g) => cum[g.id].load);
  console.log(`carry=${useCarry}: full-time cumulative load min ${Math.min(...full).toFixed(0)} max ${Math.max(...full).toFixed(0)} spread ${(Math.max(...full) - Math.min(...full)).toFixed(0)} | half-time avg ${avg(half).toFixed(0)} vs full avg ${avg(full).toFixed(0)} | nights min/max ${Math.min(...guards.map((g) => cum[g.id].nights))}/${Math.max(...guards.map((g) => cum[g.id].nights))}`);
}
