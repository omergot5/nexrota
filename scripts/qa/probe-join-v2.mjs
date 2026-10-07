// QA: ממצאים 4 ו-6 אחרי 0036/0037/0039 — שמות שנכתבו אחרת, תיקון טעות באותו מכשיר,
// מכשיר משותף, ושיבוצים של טיוטה. ארבע כניסות אנונימיות.
//   node scripts/qa/probe-join-v2.mjs
import { createClient } from "@supabase/supabase-js";
const URL = "https://biauxcgphdhwewszupsq.supabase.co";
const KEY = "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";
const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const one = (d) => (Array.isArray(d) ? d[0] : d);
let fails = 0;
const ck = (label, cond, extra = "") => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"} ${label}${!cond && extra ? " — " + extra : ""}`); };
const sup = mk();
await sup.auth.signUp({ email: `qa.join2.${Date.now()}@mailinator.com`, password: "Guardian!2345" });
const code = one((await sup.rpc("gs_create_team", { p_team_name: "QA-JOIN2", p_full_name: "מפקד" })).data).team_code;
const anon = async () => { const c = mk(); const s = await c.auth.signInAnonymously(); if (s.error) throw new Error("anon: " + s.error.message); return c; };
const join = (c, name) => c.rpc("gs_join_team", { p_code: code, p_full_name: name });
const roster = async () => (await sup.from("gs_profiles").select("id, full_name, user_id").eq("team_code", code).eq("role", "guard")).data;
try {
  const ph = Object.fromEntries((await sup.from("gs_profiles").insert(["גי'ל כהן", "רות בן דוד", "בן-ציון שמש", "דנה לוי"].map((n) => ({ full_name: n, role: "guard", team_code: code }))).select("id, full_name")).data.map((r) => [r.full_name, r.id]));

  console.log("-- names written differently are the same person (0037) --");
  const G1 = await anon(); const j1 = one((await join(G1, "גי׳ל כהן")).data);
  ck("Hebrew geresh adopts the ASCII-apostrophe placeholder", j1?.profile_id === ph["גי'ל כהן"] && j1.created === false, JSON.stringify(j1));
  const G2 = await anon(); const j2 = one((await join(G2, "רות  בן  דוד")).data);
  ck("double spaces adopt the placeholder", j2?.profile_id === ph["רות בן דוד"], JSON.stringify(j2));
  const G3 = await anon(); const j3 = one((await join(G3, "בן ציון שמש")).data);
  ck("space instead of hyphen adopts the placeholder", j3?.profile_id === ph["בן-ציון שמש"], JSON.stringify(j3));
  const dup = await sup.from("gs_profiles").insert({ full_name: "רות בן–דוד", role: "guard", team_code: code });
  ck("the supervisor can no longer add 'רות בן–דוד' next to 'רות בן דוד'", dup.error?.code === "23505", dup.error?.message || "inserted");

  console.log("-- a typo is fixed on the same device, no ghost left (0037/0039) --");
  const G4 = await anon(); const t1 = one((await join(G4, "דנה לויי")).data);
  ck("typo creates a new, self-joined profile", t1?.created === true);
  const t2 = one((await join(G4, "דנה לוי")).data);
  ck("same device + correct name adopts the supervisor's placeholder", t2?.profile_id === ph["דנה לוי"] && t2.created === false, JSON.stringify(t2));
  const r = await roster();
  ck("the typo profile is gone from the roster", !r.some((p) => p.full_name === "דנה לויי"), r.map((p) => p.full_name).join(","));
  const myNow = (await G4.from("gs_profiles").select("id").eq("id", ph["דנה לוי"])).data;
  ck("…and the device now owns the placeholder", myNow?.length === 1);

  console.log("-- a second person on an adopted device cannot take it over --");
  const s1 = await join(G1, "מישהו אחר");
  ck("different name on a device that owns a supervisor's placeholder → DEVICE_IN_USE", /DEVICE_IN_USE/.test(s1.error?.message || ""), s1.error?.message || JSON.stringify(s1.data));
  const r2 = await roster();
  ck("the placeholder keeps its name", r2.some((p) => p.id === ph["גי'ל כהן"] && p.full_name === "גי'ל כהן"));

  console.log("-- draft assignments are hidden from guards (0036) --");
  // שתי הכנסות נפרדות: הכנסה משותפת שולחת null בעמודה שחסרה באחת השורות.
  const draft = (await sup.from("gs_work_items").insert({ team_code: code, kind: "shift", start_date: "2026-10-20", due_date: "2026-10-20", title: "טיוטה", start_time: "07:00", end_time: "15:00" }).select("id, published").single()).data;
  const pub = (await sup.from("gs_work_items").insert({ team_code: code, kind: "shift", start_date: "2026-10-21", due_date: "2026-10-21", title: "מפורסם", start_time: "07:00", end_time: "15:00", published: true }).select("id, published").single()).data;
  ck("a shift inserted without 'published' is a draft (default false)", draft.published === false);
  await sup.from("gs_work_item_assignments").insert([{ work_item_id: draft.id, guard_id: ph["רות בן דוד"], source: "auto" }, { work_item_id: pub.id, guard_id: ph["רות בן דוד"], source: "auto" }]);
  const seen = (await G2.from("gs_work_items").select("id, gs_work_item_assignments(guard_id)").in("id", [draft.id, pub.id])).data;
  const byId = Object.fromEntries(seen.map((x) => [x.id, x.gs_work_item_assignments.length]));
  ck("guard still sees the draft shift itself (needed to submit availability)", draft.id in byId);
  ck("guard does NOT see who is assigned to the draft", byId[draft.id] === 0, `saw ${byId[draft.id]}`);
  ck("guard sees the assignment on the published shift", byId[pub.id] === 1);
  const supSeen = (await sup.from("gs_work_item_assignments").select("work_item_id").eq("work_item_id", draft.id)).data;
  ck("supervisor still sees the draft assignment", supSeen.length === 1);
  await sup.from("gs_work_items").update({ published: true }).eq("id", draft.id);
  const after = (await G2.from("gs_work_item_assignments").select("work_item_id").eq("work_item_id", draft.id)).data;
  ck("after publishing, the guard sees it", after.length === 1);
} catch (e) { fails++; console.log("  FAIL", e.message); }
finally {
  await sup.from("gs_teams").delete().eq("code", code);
  console.log(fails ? `\nFAIL — ${fails}` : "\nPASS");
  process.exit(fails ? 1 : 0);
}
