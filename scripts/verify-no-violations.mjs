// Standalone check: the engine never hands one person two shifts that break the rest rules.
//   node scripts/verify-no-violations.mjs
//
// נולד מבאג שנתפס על ההדגמה: מי שהייתה לה משמרת צמודה מצד אחד (סיום = התחלה) לא נבדקה
// בכלל מול משמרת רחוקה פחות מ-10 שעות מהצד השני — אחרי 18:00–00:00 קיבלה כוננות ב-06:00
// (6 שעות מנוחה). כאן נסרקים שמונה שבועות עם זמינות שונה, בכמה גדלי צוות, וכל שיבוץ שיוצא
// נבדק מבחוץ, בלי להסתמך על אותה פונקציה שהמנוע משתמש בה.

import { armyDemoPositions, demoAvailabilityCode } from "../src/lib/armyDemo.js";
import { plannedRowsForWeek } from "../src/lib/positions.js";
import { autoAssign, teamRules } from "../src/lib/autoAssign.js";
import { opDayOf } from "../src/lib/postWeek.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const sunday = "2026-10-11";
const REST = 10;
const MAX_BLOCK = 12;
const LONG = ["תורנות מטבח", "כוננות"];
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const interval = (s) => {
  const start = new Date(`${s.date}T00:00:00Z`).getTime() / 60000 + mins(s.startTime);
  let end = new Date(`${s.date}T00:00:00Z`).getTime() / 60000 + mins(s.endTime);
  if (end <= start) end += 1440;
  return [start, end];
};

function violations({ soldiers, commanders, offset }) {
  let pid = 0;
  let sid = 0;
  const positions = armyDemoPositions(soldiers).map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  const shifts = positions.flatMap((p) => plannedRowsForWeek(p, sunday)).map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
  const guards = Array.from({ length: soldiers }, (_, i) => ({
    id: `g${String(i).padStart(2, "0")}`,
    name: `g${i}`,
    ...(i < commanders ? { dutyRole: i === 0 ? "sergeant" : i === 1 ? "platoon" : "squad", qualifiedCategories: ["סיור", "כוננות"] } : {}),
  }));
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
  const availability = {};
  guards.forEach((g, gi) =>
    dates.forEach((date, di) =>
      shifts.filter((s) => s.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((s, si) => {
        availability[`${g.id}-${s.id}`] =
          demoAvailabilityCode(gi + offset, di * 5 + si, si % 2 === 0 ? "day" : "night") === "a" ? "available" : "unavailable";
      })
    )
  );
  const r = autoAssign({ shifts, guards, availability, rules: teamRules({ mode: "army", restHours: REST }) });
  const byShift = new Map(shifts.map((s) => [s.id, s]));
  const per = new Map(guards.map((g) => [g.id, []]));
  for (const a of r.assignments) per.get(a.guardId).push(byShift.get(a.shiftId));

  const bad = [];
  for (const [gid, list] of per) {
    list.sort((a, b) => interval(a)[0] - interval(b)[0]);
    // רצף: משמרות שנוגעות זו בזו.
    let blockStart = null;
    let blockEnd = null;
    let blockLong = false;
    let blockCount = 0;
    const flush = () => {
      if (blockStart === null) return;
      const hours = (blockEnd - blockStart) / 60;
      if (hours > MAX_BLOCK && !(blockCount === 1 && blockLong)) bad.push(`${gid}: רצף של ${hours} שעות`);
    };
    for (let i = 0; i < list.length; i++) {
      const [s, e] = interval(list[i]);
      if (i > 0) {
        const [, prevEnd] = interval(list[i - 1]);
        if (s < prevEnd) bad.push(`${gid}: חפיפה`);
        else if (s > prevEnd && (s - prevEnd) / 60 < REST) bad.push(`${gid}: מנוחה של ${(s - prevEnd) / 60} שעות`);
      }
      if (blockStart !== null && s === blockEnd) {
        blockEnd = e;
        blockCount++;
        blockLong = blockLong && LONG.includes(list[i].category);
      } else {
        flush();
        blockStart = s;
        blockEnd = e;
        blockCount = 1;
        blockLong = LONG.includes(list[i].category);
      }
    }
    flush();
    // שני סיורים באותו יום מבצעי.
    const patrols = list.filter((x) => x.category === "סיור");
    const days = patrols.map(opDayOf);
    if (new Set(days).size !== days.length) bad.push(`${gid}: שני סיורים באותו יום`);
  }
  return bad;
}

console.log("\nשמונה שבועות, כמה גדלי צוות — אף אדם לא מקבל חפיפה, מנוחה קצרה, רצף ארוך או שני סיורים ביום\n");
for (const [soldiers, commanders] of [[30, 6], [30, 8], [30, 0], [25, 6], [20, 6]]) {
  const all = [];
  for (let offset = 0; offset < 8; offset++) all.push(...violations({ soldiers, commanders, offset }));
  check(`${soldiers} חיילים, ${commanders} בעלי תפקיד`, all.length === 0, all.slice(0, 3).join("; "));
}

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
