// QA: מקרי קצה בהצטרפות שומרים (3 כניסות אנונימיות)
import { createClient } from "@supabase/supabase-js";
const URL = "https://biauxcgphdhwewszupsq.supabase.co";
const KEY = "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";
const mk = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const one = (d) => (Array.isArray(d) ? d[0] : d);
const sup = mk();
await sup.auth.signUp({ email: `qa.join.${Date.now()}@mailinator.com`, password: "Guardian!2345" });
const code = one((await sup.rpc("gs_create_team", { p_team_name: "QA-JOIN", p_full_name: "מפקד" })).data).team_code;
const users = [];
try {
  await sup.from("gs_profiles").insert({ full_name: "גיא לוי", role: "guard", team_code: code });
  const A = mk(); const sa = await A.auth.signInAnonymously(); if (sa.error) throw new Error("anon: " + sa.error.message); users.push(sa.data.user.id);
  const j1 = one((await A.rpc("gs_join_team", { p_code: code, p_full_name: "גיא לוו" })).data);
  console.log("1) typo join → created =", j1.created, "name =", j1.full_name);
  const j2 = one((await A.rpc("gs_join_team", { p_code: code, p_full_name: "גיא לוי" })).data);
  console.log("2) SAME device re-enters with the CORRECT name → profile:", j2.full_name, "| created =", j2.created, "| same profile as typo:", j2.profile_id === j1.profile_id);
  const j3 = one((await A.rpc("gs_join_team", { p_code: code, p_full_name: "שם אחר לגמרי" })).data);
  console.log("3) SAME device, a different person types another name → gets:", j3.full_name, "(second person silently becomes the first)");
  // self-rename allowed? (guard updates own full_name)
  const rn = await A.from("gs_profiles").update({ full_name: "גיא לוי" }).eq("id", j1.profile_id).select();
  console.log("4) guard renames own profile to the placeholder's name:", rn.error ? "ERR " + rn.error.message : `OK (${rn.data?.length} rows)`);
  const roster = (await sup.from("gs_profiles").select("full_name,user_id,role").eq("team_code", code).eq("role", "guard")).data;
  console.log("5) roster now:", roster.map((r) => `${r.full_name}${r.user_id ? "✓" : "·"}`).join(", "));
  // the usual 'log out and come back' recovery path
  const B = mk(); const sb = await B.auth.signInAnonymously(); if (sb.error) throw new Error("anon: " + sb.error.message); users.push(sb.data.user.id);
  const j4 = one((await B.rpc("gs_join_team", { p_code: code, p_full_name: "גיא לוי" })).data);
  const roster2 = (await sup.from("gs_profiles").select("full_name,user_id,role").eq("team_code", code).eq("role", "guard")).data;
  console.log("6) fresh device with the correct name → created =", j4.created, "| roster:", roster2.map((r) => `${r.full_name}${r.user_id ? "✓" : "·"}`).join(", "));
} catch (e) { console.log("ERR", e.message); }
finally {
  await sup.from("gs_teams").delete().eq("code", code);
  console.log("anon ids created:", users.join(","));
  process.exit(0);
}
