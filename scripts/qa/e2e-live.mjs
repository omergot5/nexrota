// QA: זרימה מלאה מול Supabase החי, דרך שכבת הנתונים האמיתית של האפליקציה (src/lib/api.js).
//   node scripts/qa/e2e-live.mjs <n> <mode> <regime> <realGuards> [extras]
//   regime: mixed | silent30 | nobody | extremes
//   extras: "variants" מריץ גם בדיקות שם-מבטא/רווחים (עולה כניסות אנונימיות נוספות)
//
// כל צוות נמחק בסוף; מזהי המשתמשים שנוצרו נשמרים ב-QA_OUT לניקוי.

import { appendFileSync } from "node:fs";
import { supabase } from "../../src/lib/supabaseClient.js";
import * as api from "../../src/lib/api.js";
import { autoAssign, teamRules, checkAssignment, shiftLoad } from "../../src/lib/autoAssign.js";
import { weekByOffset } from "../../src/lib/dates.js";
import { missingRowsForWeek } from "../../src/lib/positions.js";
import { positionsFor, validate, mulberry } from "./lib.mjs";

const [, , nArg, mode = "security", regime = "mixed", kArg = "2", extras = ""] = process.argv;
const N = Number(nArg);
const K = Number(kArg);
const OUT = process.env.QA_OUT || "qa-created.jsonl";
const stamp = Date.now();
const tag = `${mode}-${N}`;

let pass = 0, fail = 0;
const notes = [];
const ck = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`); }
};
const note = (s) => { notes.push(s); console.log(`  NOTE ${s}`); };
const record = (o) => appendFileSync(OUT, JSON.stringify({ tag, ...o }) + "\n");
const time = async (label, fn) => { const t = performance.now(); const r = await fn(); console.log(`       (${label}: ${(performance.now() - t).toFixed(0)}ms)`); return r; };

// ---- session juggling on the app's singleton client ----
const sess = {};
const save = async (label) => { const { data } = await supabase.auth.getSession(); sess[label] = data.session; return data.session; };
const as = async (label) => {
  const { error } = await supabase.auth.setSession({ access_token: sess[label].access_token, refresh_token: sess[label].refresh_token });
  if (error) throw new Error(`setSession(${label}): ${error.message}`);
};
// signOut({scope:"local"}) מבטל את הסשן גם בשרת (מנתק את המנהל), לכן מנקים רק את האחסון המקומי.
const leave = async () => { await supabase.auth.storage.removeItem("gs-auth"); };
const me = async () => (await supabase.auth.getUser()).data.user?.id;

async function expectThrow(fn) { try { await fn(); return null; } catch (e) { return e; } }

console.log(`\n######## ${tag}  regime=${regime}  realGuards=${K}  ########`);
const sunday = weekByOffset(1)[0];
const rnd = mulberry(N * 977 + 13);
let code = null;

try {
  // ---------- 1. supervisor registers, team created ----------
  console.log("\n-- supervisor + team --");
  await leave();
  const reg = await time("registerSupervisor", () => api.registerSupervisor({
    email: `qa.e2e.${tag}.${stamp}@mailinator.com`, password: "Guardian!2345",
    fullName: `מפקד ${tag}`, teamName: `QA ${tag}`, mode,
  }));
  code = reg.teamCode;
  const supId = await me();
  record({ kind: "user", id: supId, role: "supervisor" });
  record({ kind: "team", code });
  await save("sup");
  ck("team code is 6 chars from the safe alphabet", /^[A-HJ-NP-Z2-9]{6}$/.test(code), code);

  await api.updateTeamSettings(code, { restHours: mode === "army" ? 8 : 10 });
  let data = await api.loadTeam(code);
  ck("mode persisted", data.team?.mode === mode, data.team?.mode);
  ck("rest hours persisted", data.team?.restHours === (mode === "army" ? 8 : 10), String(data.team?.restHours));

  // idempotent create
  const again = await api.createTeamForCurrentUser({ fullName: "x", teamName: "y", mode: "army" });
  ck("second create returns the same team (idempotent)", again.teamCode === code);

  // ---------- 2. roster ----------
  console.log("\n-- roster --");
  const names = Array.from({ length: N }, (_, i) => `חייל ${String.fromCharCode(0x5d0 + (i % 27))}${i}`);
  await time(`addGuard x${N}`, async () => { for (let i = 0; i < N; i++) await api.addGuard({ name: names[i], phone: i % 2 ? `05${i % 10}-12345${String(i).padStart(2, "0")}` : "", teamCode: code }); });
  const dupErr = await expectThrow(() => api.addGuard({ name: names[0], teamCode: code }));
  ck("duplicate name rejected with friendly code", dupErr?.code === "DUPLICATE_NAME", dupErr?.message);
  const dupSpace = await expectThrow(() => api.addGuard({ name: `${names[0]} `, teamCode: code }));
  ck("duplicate name differing only by trailing space rejected", !!dupSpace, "was accepted → two copies of the same person");
  const dupCase = await expectThrow(() => api.addGuard({ name: names[1].replace("חייל", "חייל "), teamCode: code }));
  note(`name with extra internal space: ${dupCase ? "rejected" : "ACCEPTED (looks like a different person)"}`);
  data = await api.loadTeam(code);
  ck(`roster has ${N} guards`, data.guards.length === N + (dupSpace ? 0 : 1) + (dupCase ? 0 : 1), String(data.guards.length));
  // clean extras created by the leniency probes
  for (const g of data.guards.filter((g) => !names.includes(g.name))) await api.removeGuard(g.id);
  data = await api.loadTeam(code);
  const guardByName = new Map(data.guards.map((g) => [g.name, g]));

  // army: command roles like the demo
  if (mode === "army") {
    const roles = ["sergeant", "platoon", "squad", "squad", "squad", "squad"];
    for (let i = 0; i < roles.length; i++) {
      await api.setGuardDutyRole(guardByName.get(names[i]).id, roles[i]);
      await api.setGuardQualifications(guardByName.get(names[i]).id, ["סיור", "כוננות"]);
    }
  }
  // half time + weekend avoid for two people
  await api.setGuardHalfTime(guardByName.get(names[N - 1]).id, true);
  await api.setGuardWeekendPreference(guardByName.get(names[N - 2]).id, "avoid");

  // ---------- 3. positions + shifts ----------
  console.log("\n-- positions and shifts --");
  const defs = positionsFor(mode, N);
  const positions = [];
  await time(`createPosition x${defs.length}`, async () => {
    for (const d of defs) positions.push(await api.createPosition({ ...d, shape: "template", active: true }, code));
  });
  ck("all positions created", positions.length === defs.length);
  const rows = positions.flatMap((p) => missingRowsForWeek(p, sunday, []));
  const created = await time(`materialize ${rows.length} shifts`, () => api.materializeTemplateShifts(rows, code));
  ck(`materialize returned all ${rows.length} rows`, created.length === rows.length, String(created.length));
  const second = await api.materializeTemplateShifts(rows, code);
  ck("second materialize is a no-op (idempotent)", second.length === 0, String(second.length));
  data = await api.loadTeam(code);
  ck("shift count in DB matches", data.shifts.length === rows.length, `${data.shifts.length} vs ${rows.length}`);
  ck("fresh shifts are born unpublished", data.shifts.every((s) => !s.published));
  console.log(`       ${data.shifts.length} shifts, ${data.shifts.reduce((a, s) => a + s.requiredGuards, 0)} slots`);

  // ---------- 4. availability (supervisor-seeded + real guards) ----------
  console.log("\n-- availability --");
  const shifts0 = data.shifts;
  const availRows = [];
  const silent = new Set();
  data.guards.forEach((g, gi) => {
    if (regime === "nobody") { silent.add(g.id); return; }
    if (regime === "silent30" && gi % 10 < 3) { silent.add(g.id); return; }
    if (regime === "extremes" && gi === 0) { silent.add(g.id); return; }
    for (const s of shifts0) {
      let status;
      if (regime === "extremes" && gi === 1) status = "unavailable";
      else if (regime === "extremes" && gi === 2) status = "preferred";
      else {
        const r = rnd();
        status = r < 0.55 ? "available" : r < 0.65 ? "preferred" : r < 0.75 ? "maybe" : r < 0.9 ? "unavailable" : null;
      }
      if (status) availRows.push({ shift_id: s.id, guard_id: g.id, status, comment: status === "unavailable" && rnd() < 0.05 ? "מילואים" : null });
    }
  });
  await time(`upsert ${availRows.length} availability rows`, async () => {
    for (let i = 0; i < availRows.length; i += 500) {
      const { error } = await supabase.from("gs_availability").upsert(availRows.slice(i, i + 500), { onConflict: "shift_id,guard_id" });
      if (error) throw new Error(error.message);
    }
  });
  data = await api.loadTeam(code);
  ck(`loadTeam returns ALL ${availRows.length} availability rows (paging ${availRows.length > 1000 ? "exercised" : "n/a"})`,
    Object.keys(data.availability).length === availRows.length, `${Object.keys(data.availability).length}`);
  const supCountRow = await supabase.from("gs_availability").select("*", { count: "exact", head: true });
  console.log(`       supervisor-visible availability rows (head count): ${supCountRow.count}`);

  // ---------- 5. real guards join with code + name ----------
  console.log("\n-- real guards enter with the code --");
  const real = [];
  for (let k = 0; k < K; k++) {
    await leave();
    const nm = names[k + 6 < N ? k + 6 : k]; // not a commander
    const j = await api.joinAsGuard({ teamCode: code.toLowerCase(), fullName: nm });
    const uid = await me();
    record({ kind: "user", id: uid, role: "guard" });
    await save(`g${k}`);
    real.push({ k, name: nm, id: j.id, uid });
    ck(`guard ${k}: joins and adopts the supervisor's placeholder (not a new profile)`, j.id === guardByName.get(nm).id && j.isNewProfile === false, `new=${j.isNewProfile}`);
    const mine = await api.getMyProfile();
    ck(`guard ${k}: getMyProfile resolves role=guard on team`, mine?.teamCode === code && !mine.isSupervisor);
    const gd = await api.loadTeam(code);
    ck(`guard ${k}: sees roster and shifts`, gd.guards.length === N && gd.shifts.length === rows.length, `${gd.guards.length}/${gd.shifts.length}`);
    const seen = Object.keys(gd.availability).length;
    if (k === 0) note(`guard can read the whole team's availability + comments (${seen} rows) — RLS is team-wide, not own-rows`);
    // own availability write
    const target = gd.shifts[k * 3];
    await api.setAvailability({ shiftId: target.id, guardId: j.id, status: "preferred", comment: "מבקש במיוחד" });
    const other = [...gd.guards].find((g) => g.id !== j.id);
    const spoof = await expectThrow(() => api.setAvailability({ shiftId: target.id, guardId: other.id, status: "unavailable" }));
    ck(`guard ${k}: cannot write another guard's availability`, !!spoof);
    const noCreate = await expectThrow(() => api.createShifts([{ date: sunday, label: "x", startTime: "07:00", endTime: "15:00", requiredGuards: 1 }], code));
    ck(`guard ${k}: cannot create shifts`, !!noCreate);
    const noPub = await expectThrow(() => api.setPublished([target.id], true));
    ck(`guard ${k}: cannot publish`, !!noPub);
    const noTeamEdit = await expectThrow(() => api.updateTeamSettings(code, { restHours: 12 }));
    ck(`guard ${k}: cannot change team settings`, !!noTeamEdit);
    const noRemove = await expectThrow(() => api.removeGuard(other.id));
    ck(`guard ${k}: cannot remove a teammate`, !!noRemove);
    // the promotion hole, on this team
    const { data: promo } = await supabase.from("gs_profiles").update({ role: "supervisor" }).eq("id", j.id).select();
    if (promo?.length) {
      note(`SECURITY: guard ${k} promoted themself to supervisor via UPDATE gs_profiles.role`);
      await supabase.from("gs_profiles").update({ role: "guard" }).eq("id", j.id); // restore (still allowed as the new supervisor)
      const back = await api.getMyProfile();
      ck(`guard ${k}: role restored to guard after the probe`, back?.role === "guard", back?.role);
    }
    await save(`g${k}`);
  }
  await as("sup");
  data = await api.loadTeam(code);
  const gotComment = Object.values(data.availability).some((a) => a.comment === "מבקש במיוחד");
  if (real.length) ck("supervisor sees the comment a real guard wrote", gotComment);

  // ---------- 6. engine: assign + persist ----------
  console.log("\n-- smart assignment and persistence --");
  const rules = teamRules(data.team);
  const result = autoAssign({ shifts: data.shifts, guards: data.guards, availability: data.availability, rules, taskWeights: data.team.taskWeights });
  const viol = validate({ result, shifts: data.shifts, guards: data.guards, availability: data.availability, rest: data.team.restHours, longCats: rules.longShiftCategories || [], oncePerDay: rules.oncePerDayCategories || [] });
  ck("engine output breaks no hard rule (independent validator)", viol.length === 0, viol.slice(0, 3).join("; "));
  console.log(`       coverage ${result.summary.coverage}% (${result.summary.openSlots} open of ${result.summary.totalSlots}), fairness ${result.summary.fairnessScore}, load spread ${result.fairness.loadSpread}, commandGaps ${result.commandGaps?.length ?? 0}`);
  const silentLoads = [...silent].map((id) => result.fairness.perGuard.find((p) => p.guardId === id)?.shifts ?? 0);
  if (silent.size) {
    const act = result.fairness.perGuard.filter((p) => !silent.has(p.guardId)).map((p) => p.shifts);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    console.log(`       silent guards: ${silent.size}, avg shifts ${avg(silentLoads).toFixed(1)} vs responders ${avg(act).toFixed(1)}`);
    ck("a guard who submitted nothing is still scheduled (not dropped)", silentLoads.every((c) => c > 0) || regime === "extremes");
  }
  await time("applyPlan", () => api.applyPlan({ shiftIds: data.shifts.map((s) => s.id), assignments: result.assignments }));
  let after = await api.loadTeam(code);
  const persisted = after.shifts.reduce((a, s) => a + s.assignedGuards.length, 0);
  ck("every proposed assignment persisted", persisted === result.assignments.length, `${persisted} vs ${result.assignments.length}`);
  const sameSets = after.shifts.every((s) => [...s.assignedGuards].sort().join() === [...(result.byShift[s.id] || [])].sort().join());
  ck("persisted guard sets equal engine output, shift by shift", sameSets);
  ck("every persisted assignment carries a reason text", after.shifts.every((s) => s.assignedGuards.every((g) => (s.assignmentMeta[g]?.reason || "").length > 0)));
  const unknownGuards = after.shifts.flatMap((s) => s.assignedGuards).filter((g) => !after.guards.some((x) => x.id === g));
  ck("no assignment points at a guard outside the roster", unknownGuards.length === 0);
  await api.applyPlan({ shiftIds: data.shifts.map((s) => s.id), assignments: result.assignments });
  const after2 = await api.loadTeam(code);
  ck("re-applying the same plan is idempotent (no duplicates)", after2.shifts.reduce((a, s) => a + s.assignedGuards.length, 0) === persisted);

  // re-run the engine on the persisted state with keepExisting — must not shuffle
  const keep = autoAssign({ shifts: after2.shifts, guards: after2.guards, availability: after2.availability, rules, keepExisting: true, taskWeights: after2.team.taskWeights });
  ck("keepExisting preserves every locked assignment", keep.assignments.filter((a) => a.locked).length === persisted, `${keep.assignments.filter((a) => a.locked).length}`);

  // ---------- 7. publish / what guards see ----------
  console.log("\n-- publish --");
  const ids = after2.shifts.map((s) => s.id);
  await api.setPublished(ids, true);
  for (const g of real) {
    await as(`g${g.k}`);
    const gd = await api.loadTeam(code);
    const mineIds = gd.shifts.filter((s) => s.assignedGuards.includes(g.id)).map((s) => s.id).sort().join();
    const expected = result.assignments.filter((a) => a.guardId === g.id).map((a) => a.shiftId).sort().join();
    ck(`guard ${g.k}: sees exactly the shifts the engine gave them (${expected ? expected.split(",").length : 0})`, mineIds === expected);
    ck(`guard ${g.k}: all published`, gd.shifts.every((s) => s.published));
    await save(`g${g.k}`);
  }
  await as("sup");
  await api.setPublished(ids, false);
  if (real.length) {
    await as("g0");
    const hidden = await api.loadTeam(code);
    ck("after UNPUBLISH the guard's API response contains no shifts (server-side)", hidden.shifts.length === 0, `still returns ${hidden.shifts.length} shifts — hiding is client-side only`);
  }
  await as("sup");
  await api.setPublished(ids, true);

  // ---------- 8. swap ----------
  console.log("\n-- swap request --");
  if (real.length >= 1) {
    const a = real[0];
    await as("sup");
    const sv = await api.loadTeam(code);
    const myShift = sv.shifts.find((s) => s.assignedGuards.includes(a.id));
    // a legal receiver, found with the same checker the UI uses
    let b = null;
    if (myShift) {
      for (const g of sv.guards) {
        if (g.id === a.id) continue;
        if (checkAssignment({ guard: g, shift: myShift, shifts: sv.shifts, availability: sv.availability, rules }).ok) { b = g; break; }
      }
    }
    if (!myShift || !b) note("no legal swap pair found for guard 0 — swap flow not exercised");
    else {
      await as("g0");
      const swap = await api.createSwap({ teamCode: code, shiftId: myShift.id, fromGuard: a.id, toGuard: b.id, message: "QA" });
      ck("guard creates swap request", !!swap.id);
      const realB = real.find((r) => r.id === b.id);
      if (realB) { await as(`g${realB.k}`); const bView = await api.loadTeam(code); ck("target guard sees the request", bView.swapRequests.some((r) => r.id === swap.id)); }
      await as("g0");
      const sneaky = await expectThrow(() => api.decideSwap(swap, "approved"));
      note(`requesting guard calling decideSwap(approved) on their own request: ${sneaky ? "blocked" : "SUCCEEDED"}`);
      await as("sup");
      const supView = await api.loadTeam(code);
      const sw = supView.swapRequests.find((r) => r.id === swap.id);
      const before = supView.shifts.find((s) => s.id === myShift.id).assignedGuards.slice();
      const decideErr = await expectThrow(() => api.decideSwap(sw, "approved"));
      const fin = await api.loadTeam(code);
      const moved = fin.shifts.find((s) => s.id === myShift.id);
      ck("approving a LEGAL swap completes without error", !decideErr, decideErr?.message);
      ck("approved swap moved the shift to the target guard", moved.assignedGuards.includes(b.id) && !moved.assignedGuards.includes(a.id), `before=${before.length} after=${moved.assignedGuards.length}`);
      if (!moved.assignedGuards.includes(b.id) && !moved.assignedGuards.includes(a.id)) note("DATA LOSS: failed swap approval left the shift with NO assignee (unassign ran, assign failed)");
      ck("swap row marked approved", fin.swapRequests.find((r) => r.id === swap.id)?.status === "approved", fin.swapRequests.find((r) => r.id === swap.id)?.status);
      if (!moved.assignedGuards.includes(a.id) && !moved.assignedGuards.includes(b.id)) await api.assignGuard({ shiftId: myShift.id, guardId: a.id, source: "manual" });
    }
  }

  // ---------- 9. edits / deletes ----------
  console.log("\n-- edits and deletes --");
  await as("sup");
  data = await api.loadTeam(code);
  const sample = data.shifts[0];
  const upd = await api.updateShift(sample.id, { ...sample, requiredGuards: 5, location: "בדיקה" }, code);
  ck("updateShift persists", upd.requiredGuards === 5 && upd.location === "בדיקה");
  ck("updateShift keeps existing assignments", upd.assignedGuards.length === sample.assignedGuards.length, `${upd.assignedGuards.length} vs ${sample.assignedGuards.length}`);
  const noRows = await expectThrow(() => api.deleteShift("00000000-0000-0000-0000-000000000000"));
  ck("deleting a nonexistent shift reports an error (not silent success)", !!noRows);

  // remove a guard that holds assignments
  const holder = data.guards.find((g) => !real.some((r) => r.id === g.id) && data.shifts.some((s) => s.assignedGuards.includes(g.id)));
  const holdCount = data.shifts.filter((s) => s.assignedGuards.includes(holder.id)).length;
  await api.removeGuard(holder.id);
  const afterRm = await api.loadTeam(code);
  ck(`removing a guard with ${holdCount} shifts leaves no assignments or availability behind`,
    !afterRm.shifts.some((s) => s.assignedGuards.includes(holder.id)) && !Object.keys(afterRm.availability).some((k) => k.startsWith(holder.id)));
  const missingNow = afterRm.shifts.filter((s) => s.assignedGuards.length < Math.max(1, s.requiredGuards)).length;
  console.log(`       open slots now: ${missingNow} shifts below target`);
  if (real.length) {
    // removing a real, signed-in guard
    const victim = real[real.length - 1];
    await api.removeGuard(victim.id);
    await as(`g${victim.k}`);
    const ghost = await api.getMyProfile();
    ck("a removed guard's session has no profile afterwards (app falls back to join screen)", ghost === null);
    const ghostData = await expectThrow(() => api.loadTeam(code));
    const gd2 = ghostData ? null : await api.loadTeam(code);
    ck("removed guard can no longer read the team's data", !!ghostData || (gd2.shifts.length === 0 && gd2.guards.length === 0), gd2 ? `still sees ${gd2.shifts.length} shifts` : "");
    // can the removed guard rejoin with the same code+name? (placeholder is gone → new profile)
    await leave();
    const rejoin = await api.joinAsGuard({ teamCode: code, fullName: victim.name });
    record({ kind: "user", id: await me(), role: "guard-rejoin" });
    ck("removed guard re-entering gets a NEW profile (history gone)", rejoin.isNewProfile === true && rejoin.id !== victim.id);

  }

  // position with realised shifts: delete directly vs retire
  await as("sup");
  const pos = positions[0];
  const directDel = await expectThrow(() => api.deletePosition(pos.id));
  ck("deletePosition on a position with shifts fails (FK) — and says so", !!directDel);
  if (directDel) note(`deletePosition error text shown to user: "${directDel.message}"`);
  await api.retirePosition(pos.id, sunday);
  const afterRetire = await api.loadTeam(code);
  ck("retirePosition removes the position and its week's shifts", !afterRetire.positions.some((p) => p.id === pos.id) && !afterRetire.shifts.some((s) => s.positionId === pos.id));

  // name variants (adoption edge cases) — optional, spends anonymous sign-ins
  if (extras.includes("variants")) {
    console.log("\n-- name variants on re-entry --");
    const variants = [
      ["ASCII apostrophe vs Hebrew geresh", "גי'ל כהן", "גי׳ל כהן"],
      ["ASCII apostrophe vs curly quote", "דני'אל לוי", "דני’אל לוי"],
      ["double internal space", "רות בן דוד", "רות  בן דוד"],
      ["hyphen vs space", "בן-ציון שמש", "בן ציון שמש"],
    ];
    for (const [label, original, variant] of variants) {
      await as("sup");
      const p = await api.addGuard({ name: original, teamCode: code });
      await leave();
      const j = await api.joinAsGuard({ teamCode: code, fullName: variant });
      record({ kind: "user", id: await me(), role: "guard-variant" });
      if (j.id === p.id) console.log(`  ok   ${label}: adopted`);
      else { fail++; console.log(`  FAIL ${label}: variant created a SECOND person (new=${j.isNewProfile}) — the supervisor's placeholder stays orphaned`); }
    }
  }

  // ---------- 10. delete the team, verify nothing remains ----------
  console.log("\n-- team deletion --");
  await as("sup");
  const { data: delRows, error: delErr } = await supabase.from("gs_teams").delete().eq("code", code).select("code");
  ck("owner can delete the team", !delErr && delRows?.length === 1, delErr?.message);
  const gone = await api.loadTeam(code).catch((e) => ({ err: e.message }));
  ck("team is gone for the owner", !gone.team, JSON.stringify(gone.team));
  const prof = await api.getMyProfile();
  ck("after deletion the supervisor has no profile (cascade) and can start over", prof === null);
  const second2 = await api.createTeamForCurrentUser({ fullName: "מפקד", teamName: "QA again", mode });
  ck("supervisor can create a new team after deleting the old one", /^[A-HJ-NP-Z2-9]{6}$/.test(second2.teamCode));
  record({ kind: "team", code: second2.teamCode });
  await supabase.from("gs_teams").delete().eq("code", second2.teamCode);
  record({ kind: "deleted", code, code2: second2.teamCode });
  code = null;
} catch (e) {
  fail++;
  console.log(`  FAIL (exception) ${e.stack || e.message}`);
} finally {
  if (code) {
    try { await as("sup"); const r = await supabase.from("gs_teams").delete().eq("code", code).select("code"); console.log(`cleanup: deleted ${r.data?.length} team(s) ${code}`); record({ kind: "deleted", code }); } catch (e) { console.log("cleanup failed:", e.message); }
  }
  console.log(`\n${tag}: ${pass} ok, ${fail} FAIL`);
  for (const n of notes) console.log("  note:", n);
  await supabase.auth.stopAutoRefresh();
  process.exit(fail ? 1 : 0);
}
