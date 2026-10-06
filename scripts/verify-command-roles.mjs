// Standalone check for role holders in standby and patrol (autoAssign.js, dutyRoles.js).
//   node scripts/verify-command-roles.mjs
//
// מה נשמר כאן: בכל סיור וכוננות יש בעל תפקיד (סמל, מפקץ, מפקד כיתה), בעלי התפקיד לא
// נשחקים במקומות אחרים, וכשאי אפשר לכסות את כל המשמרות — החוסר מדווח ולא מוסתר.

import { ARMY_DEMO_SOLDIERS, armyDemoPositions, demoAvailabilityCode } from "../src/lib/armyDemo.js";
import { plannedRowsForWeek } from "../src/lib/positions.js";
import { autoAssign, teamRules } from "../src/lib/autoAssign.js";
import { isCommander } from "../src/lib/dutyRoles.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const sunday = "2026-10-11";
const COMMAND = ["סיור", "כוננות"];
const rolesFor = (n) => Array.from({ length: n }, (_, i) => (i === 0 ? "sergeant" : i === 1 ? "platoon" : "squad"));

function scenario(soldiers, commanders, { restrict = true } = {}) {
  let pid = 0;
  let sid = 0;
  const positions = armyDemoPositions(soldiers).map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  const shifts = positions.flatMap((p) => plannedRowsForWeek(p, sunday)).map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
  const roles = rolesFor(commanders);
  const guards = Array.from({ length: soldiers }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`,
    name: `g${i}`,
    ...(i < commanders ? { dutyRole: roles[i], ...(restrict ? { qualifiedCategories: COMMAND } : {}) } : {}),
  }));
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
  const availability = {};
  guards.forEach((g, gi) =>
    dates.forEach((date, di) =>
      shifts.filter((s) => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((s, si) => {
        availability[`${g.id}-${s.id}`] = demoAvailabilityCode(gi, di * 5 + si, si % 2 === 0 ? "day" : "night") === "a" ? "available" : "unavailable";
      })
    )
  );
  const result = autoAssign({ shifts, guards, availability, rules: teamRules({ mode: "army", restHours: 10 }) });
  const byId = new Map(guards.map((g) => [g.id, g]));
  const commandShifts = shifts.filter((s) => COMMAND.includes(s.category));
  const withCommander = commandShifts.filter((s) => (result.byShift[s.id] || []).some((gid) => isCommander(byId.get(gid?.guardId ?? gid))));
  return { result, shifts, guards, byId, commandShifts, withCommander };
}

console.log("\nהדגמה — 30 חיילים, 6 בעלי תפקיד (סמל, מפקץ, 4 מפקדי כיתה)\n");
{
  const sc = scenario(ARMY_DEMO_SOLDIERS, 6);
  const gaps = sc.result.commandGaps;
  check("35 משמרות סיור וכוננות", sc.commandShifts.length === 35, String(sc.commandShifts.length));
  check("לפחות 28 מתוכן עם בעל תפקיד", sc.withCommander.length >= 28, `${sc.withCommander.length}/35`);
  check("כל משמרת בלי בעל תפקיד מדווחת ב-commandGaps (לא מוסתרת)", gaps.length === 35 - sc.withCommander.length, `gaps=${gaps.length}`);
  check("כל המקומות מאוישים", sc.result.summary.openSlots === 0, `${sc.result.summary.openSlots} פתוחים`);
  const inOther = sc.result.assignments.filter(
    (a) => isCommander(sc.byId.get(a.guardId)) && !COMMAND.includes(sc.shifts.find((s) => s.id === a.shiftId).category)
  );
  check("בעלי תפקיד לא עושים שמירה או מטבח", inOther.length === 0, `${inOther.length} שיבוצים`);
  const again = scenario(ARMY_DEMO_SOLDIERS, 6);
  const sig = (r) => r.assignments.map((a) => `${a.shiftId}:${a.guardId}`).sort().join("|");
  check("דטרמיניזם", sig(sc.result) === sig(again.result));
}

console.log("\nמספיק בעלי תפקיד — 8 מכסים את כל השבוע\n");
{
  const sc = scenario(ARMY_DEMO_SOLDIERS, 8);
  check("כל 35 המשמרות עם בעל תפקיד", sc.withCommander.length === 35 && sc.result.commandGaps.length === 0, `${sc.withCommander.length}/35`);
}

console.log("\nבלי בעלי תפקיד בצוות — אין דרישה, אין חוסר מדווח\n");
{
  const sc = scenario(ARMY_DEMO_SOLDIERS, 0);
  check("אף משמרת לא מדווחת כחסרה", sc.result.commandGaps.length === 0);
  check("השיבוץ מתאייש כרגיל", sc.result.summary.openSlots === 0, `${sc.result.summary.openSlots} פתוחים`);
}

console.log("\nבעלי תפקיד בלי הגבלת כשירות — עדיין לא נעקף הכלל\n");
{
  const sc = scenario(ARMY_DEMO_SOLDIERS, 8, { restrict: false });
  check("כל 35 המשמרות עם בעל תפקיד", sc.withCommander.length === 35, `${sc.withCommander.length}/35`);
}

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
