// QA: צוות של 22 לאורך 12 שבועות — זמני טעינה, הוגנות מצטברת, וגודל התשובה.
//   node scripts/qa/perf-live.mjs [soldiers=22] [weeks=12] [mode=army]
import { appendFileSync } from "node:fs";
import { supabase } from "../../src/lib/supabaseClient.js";
import * as api from "../../src/lib/api.js";
import { autoAssign, teamRules } from "../../src/lib/autoAssign.js";
import { rollingLoad } from "../../src/lib/fairness.js";
import { weekByOffset, addDays } from "../../src/lib/dates.js";
import { missingRowsForWeek } from "../../src/lib/positions.js";
import { positionsFor, mulberry } from "./lib.mjs";

const N = Number(process.argv[2] || 22);
const WEEKS = Number(process.argv[3] || 12);
const mode = process.argv[4] || "army";
const OUT = process.env.QA_OUT || "qa-created.jsonl";
const rec = (o) => appendFileSync(OUT, JSON.stringify({ tag: `perf-${N}`, ...o }) + "\n");
const ms = async (fn) => { const t = performance.now(); const r = await fn(); return [r, Math.round(performance.now() - t)]; };
const rnd = mulberry(4242);
let code = null;
try {
  await supabase.auth.storage.removeItem("gs-auth");
  const reg = await api.registerSupervisor({ email: `qa.perf.${Date.now()}@mailinator.com`, password: "Guardian!2345", fullName: "מפקד פרף", teamName: `QA perf ${N}`, mode });
  code = reg.teamCode;
  rec({ kind: "team", code });
  rec({ kind: "user", id: (await supabase.auth.getUser()).data.user.id, role: "supervisor" });
  await api.updateTeamSettings(code, { restHours: 8 });
  const names = Array.from({ length: N }, (_, i) => `חייל ${i}`);
  for (const n of names) await api.addGuard({ name: n, teamCode: code });
  const defs = positionsFor(mode, N);
  const positions = [];
  for (const d of defs) positions.push(await api.createPosition({ ...d, shape: "template", active: true }, code));
  const base = weekByOffset(1)[0];

  console.log("week  shifts  availRows  loadTeam(ms)  autoAssign(ms)  cov%  fairScore  cumSpread(shifts)  cumLoadSpread");
  const cumShifts = new Map(), cumLoad = new Map();
  for (let w = 0; w < WEEKS; w++) {
    const sunday = addDays(base, 7 * w);
    const rows = positions.flatMap((p) => missingRowsForWeek(p, sunday, []));
    await api.materializeTemplateShifts(rows, code);
    let [data] = await ms(() => api.loadTeam(code));
    const weekShifts = data.shifts.filter((s) => s.date >= sunday && s.date < addDays(sunday, 7));
    const av = [];
    data.guards.forEach((g, gi) => {
      if (gi % 10 < 2) return; // 20% תמיד שותקים
      for (const s of weekShifts) {
        const r = rnd();
        const status = r < 0.6 ? "available" : r < 0.7 ? "preferred" : r < 0.8 ? "maybe" : r < 0.93 ? "unavailable" : null;
        if (status) av.push({ shift_id: s.id, guard_id: g.id, status });
      }
    });
    for (let i = 0; i < av.length; i += 500) {
      const { error } = await supabase.from("gs_availability").upsert(av.slice(i, i + 500), { onConflict: "shift_id,guard_id" });
      if (error) throw new Error(error.message);
    }
    let t;
    [data, t] = await ms(() => api.loadTeam(code));
    const history = data.shifts.filter((s) => s.date < sunday);
    const carried = rollingLoad({ guards: data.guards, shifts: history, until: sunday, days: 90, taskWeights: data.team.taskWeights }).per;
    const rules = teamRules(data.team);
    const [res, at] = await ms(async () => autoAssign({
      shifts: data.shifts.filter((s) => weekShifts.some((x) => x.id === s.id)), guards: data.guards, availability: data.availability,
      rules, carriedLoad: carried, taskWeights: data.team.taskWeights,
    }));
    await api.applyPlan({ shiftIds: weekShifts.map((s) => s.id), assignments: res.assignments });
    for (const p of res.fairness.perGuard) {
      cumShifts.set(p.guardId, (cumShifts.get(p.guardId) || 0) + p.shifts);
      cumLoad.set(p.guardId, (cumLoad.get(p.guardId) || 0) + p.load);
    }
    const cs = [...cumShifts.values()], cl = [...cumLoad.values()];
    console.log(
      `${String(w + 1).padStart(3)}  ${String(data.shifts.length).padStart(6)}  ${String(Object.keys(data.availability).length).padStart(9)}  ${String(t).padStart(12)}  ${String(at).padStart(14)}  ${String(res.summary.coverage).padStart(4)}  ${String(res.summary.fairnessScore).padStart(9)}  ${String(Math.max(...cs) - Math.min(...cs)).padStart(17)}  ${(Math.max(...cl) - Math.min(...cl)).toFixed(1).padStart(13)}`
    );
  }
  const times = [];
  for (let i = 0; i < 3; i++) times.push((await ms(() => api.loadTeam(code)))[1]);
  const final = await api.loadTeam(code);
  console.log(`\nfinal loadTeam x3 (ms): ${times.join(", ")}  | shifts=${final.shifts.length} availability=${Object.keys(final.availability).length} assignments=${final.shifts.reduce((a, s) => a + s.assignedGuards.length, 0)}`);
  console.log(`approx availability payload: ${(JSON.stringify(Object.values(final.availability)).length / 1024).toFixed(0)} KB (client-side shape; wire format larger)`);
  const sorted = [...cumShifts.entries()].map(([g, c]) => [names[final.guards.findIndex((x) => x.id === g)] || g, c, cumLoad.get(g)]).sort((a, b) => b[2] - a[2]);
  console.log("heaviest 3 / lightest 3 (cumulative shifts, load):", sorted.slice(0, 3).map((x) => `${x[0]}:${x[1]}/${x[2].toFixed(0)}`).join(" "), "...", sorted.slice(-3).map((x) => `${x[0]}:${x[1]}/${x[2].toFixed(0)}`).join(" "));
} catch (e) {
  console.log("FAIL", e.stack || e.message);
} finally {
  if (code) { const r = await supabase.from("gs_teams").delete().eq("code", code).select("code"); console.log("cleanup: deleted", r.data?.length, "team"); rec({ kind: "deleted", code }); }
  await supabase.auth.stopAutoRefresh();
  process.exit(0);
}
