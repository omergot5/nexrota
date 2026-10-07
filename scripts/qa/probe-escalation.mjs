// QA: שלוש דרכים להפוך למנהל של צוות זר/של עצמך. כל אחת חייבת להיחסם.
//   node scripts/qa/probe-escalation.mjs
import { createClient } from "@supabase/supabase-js";
const URL = "https://biauxcgphdhwewszupsq.supabase.co";
const KEY = "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";
const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const one = (d) => (Array.isArray(d) ? d[0] : d);
let fails = 0;
const ck = (label, blocked, extra = "") => { if (!blocked) fails++; console.log(`  ${blocked ? "ok  " : "FAIL"} ${label}${extra ? " — " + extra : ""}`); };
const sup = mk();
await sup.auth.signUp({ email: `qa.esc.${Date.now()}@mailinator.com`, password: "Guardian!2345" });
const code = one((await sup.rpc("gs_create_team", { p_team_name: "QA-ESC", p_full_name: "מפקד" })).data).team_code;
const uids = [(await sup.auth.getUser()).data.user.id];
try {
  const g = mk(); const ga = await g.auth.signInAnonymously(); uids.push(ga.data.user.id);
  const gp = one((await g.rpc("gs_join_team", { p_code: code, p_full_name: "משתתף" })).data);
  await g.from("gs_profiles").update({ role: "supervisor" }).eq("id", gp.profile_id);
  const r1 = (await sup.from("gs_profiles").select("role").eq("id", gp.profile_id).single()).data;
  ck("guard UPDATE role=supervisor", r1.role === "guard", `role is now ${r1.role}`);
  for (const [col, val] of [["deadline_exempt", true], ["duty_role", "sergeant"], ["half_time", true], ["qualified_categories", ["x"]], ["full_name", "שם אחר"], ["color_slot", 3]]) {
    await g.from("gs_profiles").update({ [col]: val }).eq("id", gp.profile_id);
    const r = (await sup.from("gs_profiles").select(col).eq("id", gp.profile_id).single()).data;
    ck(`guard UPDATE own ${col}`, JSON.stringify(r[col]) !== JSON.stringify(val), `${col} is now ${JSON.stringify(r[col])}`);
  }
  const ph = await g.from("gs_profiles").update({ phone: "050-0000000" }).eq("id", gp.profile_id).select("phone");
  console.log(`  info guard UPDATE own phone: ${ph.error ? "blocked: " + ph.error.message : "allowed"}`);
  // stranger: insert without asking for the row back (return=minimal)
  const s = mk(); const sa = await s.auth.signInAnonymously(); uids.push(sa.data.user.id);
  const ins = await s.from("gs_profiles").insert({ user_id: sa.data.user.id, full_name: "פולש", role: "supervisor", team_code: code });
  const inv = (await sup.from("gs_profiles").select("id").eq("team_code", code).eq("full_name", "פולש")).data;
  ck("stranger INSERT supervisor profile (no .select())", !inv?.length, ins.error?.message || "row inserted");
  // the legitimate paths still work
  const sh = await sup.from("gs_profiles").update({ deadline_exempt: true, duty_role: "squad" }).eq("id", gp.profile_id).select("id");
  ck("supervisor can still edit a guard (must NOT be blocked)", !!sh.data?.length, sh.error?.message || "");
  const ph2 = await sup.from("gs_profiles").insert({ full_name: "ממלא מקום", role: "guard", team_code: code }).select("id");
  ck("supervisor can still add a placeholder guard", !!ph2.data?.length, ph2.error?.message || "");
  const c = mk(); const ca = await c.auth.signInAnonymously(); uids.push(ca.data.user.id);
  const adopt = one((await c.rpc("gs_join_team", { p_code: code, p_full_name: "ממלא מקום" })).data);
  ck("join still adopts a placeholder (user_id change via RPC)", adopt?.created === false && adopt?.profile_id === ph2.data?.[0]?.id, JSON.stringify(adopt));
} finally {
  await sup.from("gs_teams").delete().eq("code", code);
  console.log(`\n${fails ? `FAIL — ${fails}` : "PASS"}  (auth users created: ${uids.join(",")})`);
  process.exit(fails ? 1 : 0);
}
