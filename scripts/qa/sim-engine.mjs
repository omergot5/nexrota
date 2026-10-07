// QA: סימולציית מנוע השיבוץ על צוותים של 18-22, שלושה תחומים, כמה משטרי זמינות.
//   node scripts/qa/sim-engine.mjs
// אין רשת. ה-PRNG כאן הוא של הסקריפט בלבד (mulberry32), לא של המנוע.

import { autoAssign, teamRules } from "../../src/lib/autoAssign.js";
import { armyDemoPositions } from "../../src/lib/armyDemo.js";
import { plannedRowsForWeek, buildDivisionRows } from "../../src/lib/positions.js";
import { addDays, isNightShift } from "../../src/lib/dates.js";
import { shiftLoad } from "../../src/lib/autoAssign.js";

const SUNDAY = "2026-10-11";
const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- scenarios (positions per mode) ----------
const ALL = [0, 1, 2, 3, 4, 5, 6];
const div = (title, hours, category, requiredGuards) =>
  buildDivisionRows(title, hours).map((r) => ({ ...r, category, weekdays: ALL, requiredGuards }));

function positionsFor(mode, n) {
  if (mode === "army") return armyDemoPositions(n);
  if (mode === "security") {
    // אבטחה: שער ראשי 24/7 ב-2 משמרות של 12 (2 אנשים), סיור 3×8 (1), קבלה ביום 08-16 א-ה (1)
    return [
      ...div("שער ראשי", 12, "שער", 2),
      ...div("סיור היקפי", 8, "סיור", 1),
      { title: "קבלה", category: "קבלה", weekdays: [0, 1, 2, 3, 4], startTime: "08:00", endTime: "16:00", requiredGuards: 1 },
    ];
  }
  // מסעדנות: בוקר 08-16 (2), ערב 16-00 (3), סגירה 00-03 ו-ו'/ש' (שבת בלבד פתוח עד מאוחר)
  return [
    { title: "משמרת בוקר", category: "אולם", weekdays: ALL, startTime: "08:00", endTime: "16:00", requiredGuards: 2 },
    { title: "משמרת ערב", category: "אולם", weekdays: ALL, startTime: "16:00", endTime: "00:00", requiredGuards: 3 },
    { title: "מטבח", category: "מטבח", weekdays: ALL, startTime: "10:00", endTime: "22:00", requiredGuards: 2 },
  ];
}

function buildWeek(mode, n, weekIdx) {
  const sunday = addDays(SUNDAY, 7 * weekIdx);
  let pid = 0, sid = 0;
  const positions = positionsFor(mode, n).map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  const shifts = positions.flatMap((p) => plannedRowsForWeek(p, sunday))
    .map((r) => ({ ...r, id: `w${weekIdx}s${String(++sid).padStart(3, "0")}`, assignedGuards: [] }));
  return shifts;
}

const makeGuards = (n, mode, opts = {}) =>
  Array.from({ length: n }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`,
    name: `חייל ${i}`,
    ...(opts.halfTime?.includes(i) ? { halfTime: true } : {}),
    ...(opts.weekendAvoid?.includes(i) ? { weekendPreference: "avoid" } : {}),
    ...(mode === "army" && i < (opts.commanders ?? 0)
      ? { dutyRole: i === 0 ? "sergeant" : i === 1 ? "platoon" : "squad", qualifiedCategories: ["סיור", "כוננות"] }
      : {}),
  }));

// ---------- availability regimes ----------
// returns {availability, silent:Set<guardId>}
function availFor(regime, guards, shifts, seed) {
  const rnd = mulberry(seed);
  const availability = {};
  const silent = new Set();
  const put = (g, s, status) => { availability[`${g.id}-${s.id}`] = { status, comment: "" }; };
  const mixed = (g, s, w) => {
    const r = rnd();
    let acc = 0;
    for (const [status, p] of w) { acc += p; if (r < acc) return put(g, s, status); }
    // otherwise: no row (never answered this shift)
  };
  const MIX = [["available", 0.55], ["preferred", 0.1], ["maybe", 0.1], ["unavailable", 0.15]]; // 10% blank
  guards.forEach((g, gi) => {
    switch (regime) {
      case "nobody-registered": silent.add(g.id); break;
      case "all-available": shifts.forEach((s) => put(g, s, "available")); break;
      case "mixed": shifts.forEach((s) => mixed(g, s, MIX)); break;
      case "30pct-silent":
        if (gi % 10 < 3) silent.add(g.id); else shifts.forEach((s) => mixed(g, s, MIX));
        break;
      case "heavy-unavailable":
        shifts.forEach((s) => mixed(g, s, [["available", 0.3], ["unavailable", 0.5], ["maybe", 0.1]]));
        break;
      case "nights-unavailable":
        shifts.forEach((s) => put(g, s, isNightShift(s) && gi % 2 === 0 ? "unavailable" : "available"));
        break;
      case "extremes":
        if (gi === 0) silent.add(g.id);                               // לא הגיש כלום
        else if (gi === 1) shifts.forEach((s) => put(g, s, "unavailable")); // לא זמין לכלום
        else if (gi === 2) shifts.forEach((s) => put(g, s, "preferred"));   // מעדיף הכול
        else shifts.forEach((s) => mixed(g, s, MIX));
        break;
      case "all-maybe": shifts.forEach((s) => put(g, s, "maybe")); break;
    }
  });
  return { availability, silent };
}

// ---------- independent validator ----------
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayStart = (d) => new Date(`${d}T00:00:00Z`).getTime() / 60000;
const iv = (s) => {
  const a = dayStart(s.date) + mins(s.startTime);
  let b = dayStart(s.date) + mins(s.endTime);
  if (b <= a) b += 1440;
  return [a, b];
};
const opDay = (s) => (mins(s.startTime) / 60 < 5 ? addDays(s.date, -1) : s.date);

function validate({ result, shifts, guards, availability, rest, longCats, oncePerDay, maxBlock = 12, weeklyCap = 6, nightCap = 3 }) {
  const bad = [];
  const sById = new Map(shifts.map((s) => [s.id, s]));
  const per = new Map(guards.map((g) => [g.id, []]));
  const perShift = new Map();
  for (const a of result.assignments) {
    const s = sById.get(a.shiftId);
    if (!s) { bad.push(`assignment to unknown shift ${a.shiftId}`); continue; }
    if (!per.has(a.guardId)) { bad.push(`assignment to unknown guard ${a.guardId}`); continue; }
    per.get(a.guardId).push(s);
    perShift.set(s.id, [...(perShift.get(s.id) || []), a.guardId]);
    const st = availability[`${a.guardId}-${s.id}`]?.status;
    if (st === "unavailable") bad.push(`${a.guardId} assigned to ${s.id} despite unavailable`);
    if (!a.parts?.length) bad.push(`assignment ${a.shiftId}/${a.guardId} has no reasoning parts`);
  }
  for (const [sid, gs] of perShift) {
    const s = sById.get(sid);
    if (new Set(gs).size !== gs.length) bad.push(`${sid}: same guard twice`);
    if (gs.length > Math.max(1, s.requiredGuards || 1)) bad.push(`${sid}: overfilled ${gs.length}/${s.requiredGuards}`);
  }
  for (const [gid, list] of per) {
    list.sort((a, b) => iv(a)[0] - iv(b)[0]);
    if (list.length > weeklyCap) bad.push(`${gid}: ${list.length} shifts > cap ${weeklyCap}`);
    const nights = list.filter(isNightShift).length;
    if (nights > nightCap) bad.push(`${gid}: ${nights} nights > cap ${nightCap}`);
    let bs = null, be = null, bc = 0, bl = false;
    const flush = () => {
      if (bs === null) return;
      const h = (be - bs) / 60;
      if (h > maxBlock && !(bc === 1 && bl)) bad.push(`${gid}: block ${h}h`);
    };
    for (let i = 0; i < list.length; i++) {
      const [s0, e0] = iv(list[i]);
      if (i > 0) {
        const prevEnd = Math.max(...list.slice(0, i).map((x) => iv(x)[1]));
        if (s0 < prevEnd) bad.push(`${gid}: overlap ${list[i - 1].id}/${list[i].id}`);
        else if (s0 > prevEnd && (s0 - prevEnd) / 60 < rest) bad.push(`${gid}: rest ${(s0 - prevEnd) / 60}h < ${rest}`);
      }
      if (bs !== null && s0 === be) { be = e0; bc++; bl = bl && longCats.includes(list[i].category); }
      else { flush(); bs = s0; be = e0; bc = 1; bl = longCats.includes(list[i].category); }
    }
    flush();
    for (const cat of oncePerDay) {
      const d = list.filter((x) => x.category === cat).map(opDay);
      if (new Set(d).size !== d.length) bad.push(`${gid}: two ${cat} on one op-day`);
    }
  }
  return bad;
}

// ---------- run ----------
const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : String(n));
const rows = [];
const problems = [];
let totalRuns = 0;

const REGIMES = ["nobody-registered", "all-available", "mixed", "30pct-silent", "heavy-unavailable", "nights-unavailable", "extremes", "all-maybe"];
const MODES = ["army", "security", "restaurant"];
const SIZES = [18, 19, 20, 21, 22];

for (const mode of MODES) {
  for (const n of SIZES) {
    const restOptions = mode === "army" ? [8, 10] : [10, 12];
    for (const rest of restOptions) {
      for (const regime of REGIMES) {
        const guards = makeGuards(n, mode, { commanders: mode === "army" ? 6 : 0 });
        const shifts = buildWeek(mode, n, 0);
        const { availability, silent } = availFor(regime, guards, shifts, n * 131 + regime.length);
        const rules = teamRules({ mode, restHours: rest });
        const t0 = performance.now();
        const result = autoAssign({ shifts, guards, availability, rules });
        const ms = performance.now() - t0;
        totalRuns++;

        // determinism: same input twice, and input order shuffled
        const again = autoAssign({ shifts, guards, availability, rules });
        const sig = (r) => JSON.stringify(r.assignments.map((a) => [a.shiftId, a.guardId]).sort());
        const det = sig(result) === sig(again);
        const rnd = mulberry(7);
        const shuffled = (arr) => [...arr].map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
        const orderFree = sig(result) === sig(autoAssign({ shifts: shuffled(shifts), guards: shuffled(guards), availability, rules }));

        const bad = validate({
          result, shifts, guards, availability, rest,
          longCats: rules.longShiftCategories || [], oncePerDay: rules.oncePerDayCategories || [],
        });

        const perG = result.fairness.perGuard;
        const loadOf = new Map(perG.map((p) => [p.guardId, p]));
        const silentLoad = [...silent].map((id) => loadOf.get(id)?.load ?? 0);
        const activeLoad = guards.filter((g) => !silent.has(g.id)).map((g) => loadOf.get(g.id)?.load ?? 0);
        const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
        const zero = perG.filter((p) => p.shifts === 0).length;

        const row = {
          mode, n, rest, regime,
          slots: result.summary.totalSlots, cov: result.summary.coverage, open: result.summary.openSlots,
          fair: result.summary.fairnessScore, spread: result.fairness.loadSpread, zero,
          silentAvg: avg(silentLoad), activeAvg: avg(activeLoad), ms, det, orderFree, bad,
          cmdGaps: result.commandGaps?.length ?? 0,
        };
        rows.push(row);
        if (bad.length) problems.push({ kind: "HARD-VIOLATION", ...row });
        if (!det) problems.push({ kind: "NON-DETERMINISTIC", ...row });
      }
    }
  }
}

// ---------- report ----------
const summarize = (filter, title) => {
  console.log(`\n=== ${title} ===`);
  console.log("mode       n  rest regime              slots cov% open fair spread zero  silentAvg activeAvg  ms   order-free");
  for (const r of rows.filter(filter)) {
    console.log(
      `${r.mode.padEnd(10)} ${String(r.n).padStart(2)} ${String(r.rest).padStart(4)} ${r.regime.padEnd(19)} ${String(r.slots).padStart(5)} ${String(r.cov).padStart(4)} ${String(r.open).padStart(4)} ${String(r.fair).padStart(4)} ${fmt(r.spread).padStart(6)} ${String(r.zero).padStart(4)} ${fmt(r.silentAvg).padStart(9)} ${fmt(r.activeAvg).padStart(9)} ${fmt(r.ms, 0).padStart(4)}  ${r.orderFree ? "yes" : "NO"}${r.bad.length ? "  VIOLATIONS:" + r.bad.length : ""}`
    );
  }
};
summarize((r) => r.regime === "mixed" && r.rest === (r.mode === "army" ? 8 : 10), "mixed availability, default rest");
summarize((r) => r.regime === "nobody-registered" && r.rest === (r.mode === "army" ? 8 : 10), "NOBODY registered anything");
summarize((r) => r.regime === "30pct-silent" && r.rest === (r.mode === "army" ? 8 : 10), "30% silent guards");
summarize((r) => r.regime === "extremes" && r.rest === (r.mode === "army" ? 8 : 10), "extremes: silent / all-unavailable / all-preferred guards");

console.log(`\n--- totals: ${totalRuns} runs ---`);
console.log(`hard-rule violations: ${problems.filter((p) => p.kind === "HARD-VIOLATION").length}`);
console.log(`non-deterministic (same input twice): ${problems.filter((p) => p.kind === "NON-DETERMINISTIC").length}`);
console.log(`input-order sensitive: ${rows.filter((r) => !r.orderFree).length} of ${rows.length}`);
console.log(`max runtime: ${fmt(Math.max(...rows.map((r) => r.ms)), 0)}ms, mean ${fmt(rows.reduce((a, r) => a + r.ms, 0) / rows.length, 0)}ms`);
for (const p of problems.slice(0, 15)) console.log(p.kind, p.mode, p.n, p.rest, p.regime, p.bad.slice(0, 3));
const full = rows.filter((r) => r.cov === 100).length;
console.log(`runs with 100% coverage: ${full}/${rows.length}`);
const zeroRuns = rows.filter((r) => r.zero > 0 && r.regime !== "extremes");
console.log(`runs where someone gets zero shifts (excluding 'extremes'): ${zeroRuns.length}`);

// silent-vs-active comparison across all silent regimes
const sv = rows.filter((r) => r.regime === "30pct-silent" && Number.isFinite(r.silentAvg));
console.log(`\n30%-silent: silent guards avg load ${fmt(sv.reduce((a, r) => a + r.silentAvg, 0) / sv.length)} vs responders ${fmt(sv.reduce((a, r) => a + r.activeAvg, 0) / sv.length)}`);

import { writeFileSync } from "node:fs";
writeFileSync(new URL("./sim-engine-results.json", import.meta.url), JSON.stringify(rows, null, 1));
process.exit(problems.some((p) => p.kind === "HARD-VIOLATION") ? 1 : 0);
