// QA: RLS probing on a throwaway team. Everything created here is deleted at the end.
import { createClient } from "@supabase/supabase-js";
const URL = "https://biauxcgphdhwewszupsq.supabase.co";
const KEY = "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";
const fresh = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const one = (d) => (Array.isArray(d) ? d[0] : d);
const res = (l, v, x = "") => console.log(`${v ? "ok  " : "BUG "} ${l}${x ? " — " + x : ""}`);

const sup = fresh();
await sup.auth.signUp({ email: `qa.sec.${Date.now()}@mailinator.com`, password: "Guardian!2345" });
const CODE = one((await sup.rpc("gs_create_team", { p_team_name: "QA-SEC", p_full_name: "QA מנהל" })).data).team_code;
const created = [];
try {
  // unpublished draft
  await sup.from("gs_work_items").insert({ team_code: CODE, kind: "shift", start_date: "2026-10-12", due_date: "2026-10-12", title: "draft", start_time: "07:00", end_time: "19:00", published: false });

  const g = fresh(); await g.auth.signInAnonymously();
  const gp = one((await g.rpc("gs_join_team", { p_code: CODE, p_full_name: "מתנגד" })).data);

  // 1. guard sees unpublished drafts?
  const drafts = (await g.from("gs_work_items").select("id,published").eq("published", false)).data;
  res("guard cannot read unpublished draft shifts", !drafts?.length, `guard read ${drafts?.length} draft rows`);

  // 2. guard self-promotes to supervisor via UPDATE
  const up = await g.from("gs_profiles").update({ role: "supervisor" }).eq("id", gp.profile_id).select();
  res("guard cannot promote themself to supervisor (UPDATE role)", !up.data?.length, up.error?.message || `role now=${up.data?.[0]?.role}`);
  const canWrite = await g.from("gs_work_items").insert({ team_code: CODE, kind: "shift", start_date: "2026-10-13", due_date: "2026-10-13", title: "pwned", start_time: "07:00", end_time: "19:00" }).select();
  res("…and then cannot create shifts", !canWrite.data?.length, canWrite.error?.message || "insert succeeded");

  // 3. stranger inserts a supervisor profile directly (no RPC) into the team
  const s2 = fresh(); const { data: a2 } = await s2.auth.signInAnonymously();
  const ins = await s2.from("gs_profiles").insert({ user_id: a2.user.id, full_name: "פולש", role: "supervisor", team_code: CODE }).select();
  res("stranger with the team code cannot insert a supervisor profile directly", !ins.data?.length, ins.error?.message || "insert succeeded");
  const del = await s2.from("gs_work_items").select("id");
  console.log("     stranger sees", del.data?.length, "work items of the team");

  // 4. guard edits own exemptions / qualifications / duty role
  const own = await g.from("gs_profiles").update({ deadline_exempt: true, duty_role: "sergeant", half_time: true }).eq("id", gp.profile_id).select();
  res("guard cannot edit own deadline_exempt/duty_role", !own.data?.length, own.error?.message || `updated: ${JSON.stringify({ e: own.data?.[0]?.deadline_exempt, d: own.data?.[0]?.duty_role })}`);

  // 5. guard writes availability on a shift (no deadline in DB?)
  const sh = (await sup.from("gs_work_items").select("id").eq("team_code", CODE).limit(1)).data[0];
  const av = await g.from("gs_availability").upsert({ shift_id: sh.id, guard_id: gp.profile_id, status: "available" }).select();
  console.log("     guard availability write:", av.error?.message || "allowed (deadline is client-side only)");

  // 6. cross-team: supervisor writes availability for a guard from ANOTHER team
  const sup2 = fresh();
  await sup2.auth.signUp({ email: `qa.sec2.${Date.now()}@mailinator.com`, password: "Guardian!2345" });
  const CODE2 = one((await sup2.rpc("gs_create_team", { p_team_name: "QA-SEC2", p_full_name: "QA2" })).data).team_code;
  created.push([sup2, CODE2]);
  const x = await sup2.from("gs_availability").upsert({ shift_id: (await sup2.from("gs_work_items").insert({ team_code: CODE2, kind: "shift", start_date: "2026-10-12", due_date: "2026-10-12", title: "t", start_time: "07:00", end_time: "19:00" }).select()).data[0].id, guard_id: gp.profile_id, status: "unavailable" }).select();
  res("supervisor of team B cannot write availability for a guard of team A", !x.data?.length, x.error?.message || "cross-team write succeeded");

  // 7. cross-team swap request to a foreign guard
  // 8. supervisor B deleting team A
  const d = await sup2.from("gs_teams").delete().eq("code", CODE).select();
  res("supervisor B cannot delete team A", !d.data?.length);
  // 9. guard deleting team
  const gd = await g.from("gs_teams").delete().eq("code", CODE).select();
  res("guard cannot delete team", !gd.data?.length);
  // 10. anonymous guard can enumerate team codes? gs_team_exists RPC
  const probe = fresh(); await probe.auth.signInAnonymously();
  const ex = await probe.rpc("gs_team_exists", { p_code: CODE });
  console.log("     gs_team_exists callable by any anon user:", ex.data, "(enables code enumeration; 32^6≈1.07e9 space)");
  const nm = await probe.rpc("gs_join_team", { p_code: CODE, p_full_name: "מתנגד" });
  console.log("     anon session with only code+name adopts existing guard identity:", nm.data ? "YES (by design)" : nm.error?.message);
} finally {
  for (const [c, code] of created) await c.from("gs_teams").delete().eq("code", code);
  const r = await sup.from("gs_teams").delete().eq("code", CODE).select();
  console.log("cleanup:", r.data?.length, "team deleted");
}
