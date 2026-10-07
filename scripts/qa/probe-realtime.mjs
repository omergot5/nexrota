// QA: האם צוות A מקבל אירועי realtime של צוות B? (ובאיזה מטען)
import { createClient } from "@supabase/supabase-js";
const URL = "https://biauxcgphdhwewszupsq.supabase.co";
const KEY = "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";
const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const one = (d) => (Array.isArray(d) ? d[0] : d);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const A = mk(), B = mk();
const stamp = Date.now();
await A.auth.signUp({ email: `qa.rtA.${stamp}@mailinator.com`, password: "Guardian!2345" });
await B.auth.signUp({ email: `qa.rtB.${stamp}@mailinator.com`, password: "Guardian!2345" });
const codeA = one((await A.rpc("gs_create_team", { p_team_name: "QA-RT-A", p_full_name: "A" })).data).team_code;
const codeB = one((await B.rpc("gs_create_team", { p_team_name: "QA-RT-B", p_full_name: "B" })).data).team_code;
const events = [];
const ch = A.channel(`team-${codeA}`);
for (const table of ["gs_work_items", "gs_work_item_assignments", "gs_availability", "gs_profiles", "gs_swap_requests"])
  ch.on("postgres_changes", { event: "*", schema: "public", table }, (p) => events.push({ table, type: p.eventType, new: p.new && Object.keys(p.new).length, old: p.old && JSON.stringify(p.old) }));
await new Promise((res) => ch.subscribe((s) => s === "SUBSCRIBED" && res()));
await sleep(500);
try {
  const ins = await B.from("gs_work_items").insert([1, 2, 3].map((i) => ({ team_code: codeB, kind: "shift", start_date: "2026-10-12", due_date: "2026-10-12", title: `סודי-${i}`, start_time: "07:00", end_time: "19:00" }))).select();
  await sleep(1500);
  const afterInsert = events.length;
  await B.from("gs_work_items").update({ title: "שונה" }).eq("id", ins.data[0].id);
  await sleep(1000);
  const afterUpdate = events.length;
  await B.from("gs_work_items").delete().in("id", ins.data.map((r) => r.id));
  await sleep(2000);
  console.log("events at A after B inserted 3 rows:", afterInsert);
  console.log("events at A after B updated 1 row:", afterUpdate - afterInsert);
  console.log("events at A after B deleted 3 rows:", events.length - afterUpdate);
  for (const e of events.slice(0, 6)) console.log("  ", e.table, e.type, "new-cols:", e.new, "old:", e.old);
  // and A's own events work?
  const before = events.length;
  const mine = await A.from("gs_work_items").insert({ team_code: codeA, kind: "shift", start_date: "2026-10-12", due_date: "2026-10-12", title: "שלי", start_time: "07:00", end_time: "19:00" }).select();
  await sleep(1500);
  console.log("own-team insert events received:", events.length - before);
} finally {
  await A.from("gs_teams").delete().eq("code", codeA);
  await B.from("gs_teams").delete().eq("code", codeB);
  await A.removeAllChannels();
  console.log("cleanup done");
  process.exit(0);
}
