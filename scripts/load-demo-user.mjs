// One simulated demo visitor — the exact startGuestDemo steps, using the real
// app modules. Spawned N times in parallel by load-demo.mjs (each process has
// its own supabase singleton, i.e. its own anonymous user).
import { supabase } from "../src/lib/supabaseClient.js";
import { seedArmyRoster, DEMO_TEAM_NAME } from "../src/lib/demoData.js";

const t0 = Date.now();
const out = { ok: false };
try {
  const { error: e } = await supabase.auth.signInAnonymously();
  if (e) throw new Error("anon sign-in: " + e.message);
  const { data: rows, error: rpcErr } = await supabase.rpc("gs_create_team", {
    p_team_name: DEMO_TEAM_NAME, p_full_name: "מפקד הדגמה", p_mode: "army",
  });
  if (rpcErr) throw new Error("gs_create_team: " + rpcErr.message);
  const row = Array.isArray(rows) ? rows[0] : rows;
  const res = await seedArmyRoster({ teamCode: row.team_code, existingGuards: [], existingPositions: [], guardCount: 15 });
  const [team, guards, shifts] = await Promise.all([
    supabase.from("gs_teams").select("mode,name").eq("code", row.team_code).single(),
    supabase.from("gs_profiles").select("id", { count: "exact", head: true }).eq("team_code", row.team_code).eq("role", "guard"),
    supabase.from("gs_work_items").select("id", { count: "exact", head: true }).eq("team_code", row.team_code),
  ]);
  Object.assign(out, { ok: true, mode: team.data?.mode, guards: guards.count, items: shifts.count, seeded: res });
} catch (err) {
  out.error = String(err.message || err);
  const { data: sd } = await supabase.auth.getSession();
  out.session = sd.session ? { exp: sd.session.expires_at, now: Math.floor(Date.now() / 1000) } : null;
}
out.ms = Date.now() - t0;
console.log(JSON.stringify(out));
