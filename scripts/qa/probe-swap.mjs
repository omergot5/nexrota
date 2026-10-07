// QA: בקשות החלפה דרך gs_decide_swap (0035). שתי כניסות אנונימיות.
//   node scripts/qa/probe-swap.mjs
import { createClient } from "@supabase/supabase-js";
const URL = "https://biauxcgphdhwewszupsq.supabase.co";
const KEY = "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";
const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const one = (d) => (Array.isArray(d) ? d[0] : d);
let fails = 0;
const ck = (label, cond, extra = "") => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${!cond && extra ? " — " + extra : ""}`); };
const sup = mk();
await sup.auth.signUp({ email: `qa.swap.${Date.now()}@mailinator.com`, password: "Guardian!2345" });
const code = one((await sup.rpc("gs_create_team", { p_team_name: "QA-SWAP", p_full_name: "מפקד" })).data).team_code;
const uids = [(await sup.auth.getUser()).data.user.id];
const join = async (name) => {
  const c = mk(); const s = await c.auth.signInAnonymously();
  if (s.error) throw new Error(`anon sign-in: ${s.error.message}`);
  uids.push(s.data.user.id);
  return [c, one((await c.rpc("gs_join_team", { p_code: code, p_full_name: name })).data).profile_id];
};
const on = async (shiftId) => (await sup.from("gs_work_item_assignments").select("guard_id").eq("work_item_id", shiftId)).data.map((r) => r.guard_id).sort();
const status = async (id) => (await sup.from("gs_swap_requests").select("status").eq("id", id).single()).data.status;
try {
  const [A, a] = await join("אלף");
  const [B, b] = await join("בית");
  const sh = (await sup.from("gs_work_items").insert([1, 2, 3, 4].map((i) => ({ team_code: code, kind: "shift", start_date: `2026-10-1${i}`, due_date: `2026-10-1${i}`, title: `s${i}`, start_time: "07:00", end_time: "15:00", published: true }))).select("id")).data.map((r) => r.id);
  await sup.from("gs_work_item_assignments").insert(sh.map((id) => ({ work_item_id: id, guard_id: a, source: "auto" })));
  await sup.from("gs_work_item_assignments").insert({ work_item_id: sh[3], guard_id: b, source: "auto" });
  const req = async (i) => (await A.from("gs_swap_requests").insert({ team_code: code, shift_id: sh[i], from_guard: a, to_guard: b }).select("id").single()).data.id;

  console.log("-- the guard the request was sent to approves --");
  const r0 = await req(0);
  const e0 = (await B.rpc("gs_decide_swap", { p_swap_id: r0, p_status: "approved" })).error;
  ck("target guard approves", !e0, e0?.message);
  ck("shift moved from A to B", JSON.stringify(await on(sh[0])) === JSON.stringify([b]));
  ck("request marked approved", (await status(r0)) === "approved");
  const again = (await sup.rpc("gs_decide_swap", { p_swap_id: r0, p_status: "rejected" })).error;
  ck("deciding twice is refused", /SWAP_NOT_PENDING/.test(again?.message || ""), again?.message);

  console.log("-- requester cannot approve their own request; supervisor rejects --");
  const r1 = await req(1);
  const e1 = (await A.rpc("gs_decide_swap", { p_swap_id: r1, p_status: "approved" })).error;
  ck("requester approving own request is refused", /SWAP_FORBIDDEN/.test(e1?.message || ""), e1?.message);
  const d1 = await B.from("gs_swap_requests").update({ status: "approved" }).eq("id", r1).select("id");
  ck("target guard cannot flip status by direct UPDATE any more", !d1.data?.length, "direct update went through");
  const e1b = (await sup.rpc("gs_decide_swap", { p_swap_id: r1, p_status: "rejected" })).error;
  ck("supervisor rejects", !e1b, e1b?.message);
  ck("rejection leaves the roster untouched", JSON.stringify(await on(sh[1])) === JSON.stringify([a]));

  console.log("-- stale and conflicting requests fail without touching the roster --");
  const r2 = await req(2);
  await sup.from("gs_work_item_assignments").delete().match({ work_item_id: sh[2], guard_id: a });
  const e2 = (await sup.rpc("gs_decide_swap", { p_swap_id: r2, p_status: "approved" })).error;
  ck("approving after the requester was moved off is refused (SWAP_STALE)", /SWAP_STALE/.test(e2?.message || ""), e2?.message);
  ck("stale approval did not assign B", (await on(sh[2])).length === 0);
  ck("stale request still pending", (await status(r2)) === "pending");
  const r3 = (await A.from("gs_swap_requests").insert({ team_code: code, shift_id: sh[3], from_guard: a, to_guard: b }).select("id").single()).data.id;
  const e3 = (await sup.rpc("gs_decide_swap", { p_swap_id: r3, p_status: "approved" })).error;
  ck("approving onto someone already on the shift is refused", /SWAP_TARGET_ALREADY_ASSIGNED/.test(e3?.message || ""), e3?.message);
  ck("…and A stays on it", JSON.stringify(await on(sh[3])) === JSON.stringify([a, b].sort()));

  console.log("-- another team cannot touch it --");
  const other = mk(); await other.auth.signUp({ email: `qa.swap2.${Date.now()}@mailinator.com`, password: "Guardian!2345" });
  uids.push((await other.auth.getUser()).data.user.id);
  const code2 = one((await other.rpc("gs_create_team", { p_team_name: "QA-SWAP2", p_full_name: "זר" })).data).team_code;
  const e4 = (await other.rpc("gs_decide_swap", { p_swap_id: r2, p_status: "approved" })).error;
  ck("supervisor of another team gets SWAP_NOT_FOUND", /SWAP_NOT_FOUND/.test(e4?.message || ""), e4?.message);
  await other.from("gs_teams").delete().eq("code", code2);
} catch (e) { fails++; console.log("  FAIL", e.message); }
finally {
  await sup.from("gs_teams").delete().eq("code", code);
  console.log(`\n${fails ? `FAIL — ${fails}` : "PASS"}  (auth users created: ${uids.join(",")})`);
  process.exit(fails ? 1 : 0);
}
