// Standalone check for the army demo structure (armyDemo.js) and that the
// engine can actually staff it with the number of soldiers the demo opens.
//   node scripts/verify-army-demo.mjs
//
// Pure modules only — no browser, no database. The point of the coverage
// section: a demo that opens 15 soldiers against 229 weekly slots shows a
// half-empty roster and teaches the commander that the engine is broken.
// If someone changes the structure or the soldier count, this fails first.

import { ARMY_DEMO_POSITIONS, ARMY_DEMO_SOLDIERS, demoAvailabilityCode, planArmyDemoPositions } from "../src/lib/armyDemo.js";
import { buildDivisionRows, plannedRowsForWeek } from "../src/lib/positions.js";
import { autoAssign, teamRules } from "../src/lib/autoAssign.js";
import { splitShiftLabel } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
console.log("\nחלוקת עמדה 24/7 — מתחילים בבוקר\n");
// ============================================================

const three = buildDivisionRows("סיור", 8);
check(
  "ברירת המחדל מתחילה ב-06:00: בוקר 06–14, צהריים 14–22, לילה 22–06",
  three.map((r) => `${r.startTime}-${r.endTime}`).join(",") === "06:00-14:00,14:00-22:00,22:00-06:00",
  three.map((r) => `${r.startTime}-${r.endTime}`).join(",")
);
const four = buildDivisionRows("עמדה", 6);
check(
  "6 שעות: 06–12, 12–18, 18–00, 00–06",
  four.map((r) => `${r.startTime}-${r.endTime}`).join(",") === "06:00-12:00,12:00-18:00,18:00-00:00,00:00-06:00"
);
check(
  "שעת התחלה אחרת מכובדת (07:30, 12 שעות)",
  buildDivisionRows("כוננות", 12, "07:30").map((r) => `${r.startTime}-${r.endTime}`).join(",") === "07:30-19:30,19:30-07:30"
);
check("כל משמרת בחלוקה נושאת את שם העמדה לפני ' – '", four.every((r) => splitShiftLabel(r.title).post === "עמדה"));

// ============================================================
console.log("\nמבנה ההדגמה — בדיוק מה שהמפקד שלח\n");
// ============================================================

const byPost = new Map();
for (const p of ARMY_DEMO_POSITIONS) {
  const { post } = splitShiftLabel(p.title);
  if (!byPost.has(post)) byPost.set(post, []);
  byPost.get(post).push(p);
}
const post = (name) => byPost.get(name) || [];

check("שתי עמדות שמירה, 4 משמרות של 6 שעות, חייל אחד בכל אחת",
  ["עמדת שמירה 1", "עמדת שמירה 2"].every((n) => post(n).length === 4 && post(n).every((p) => p.requiredGuards === 1)));
check("סיור: 3 משמרות של 8 שעות, 3 חיילים בכל אחת",
  post("סיור").length === 3 && post("סיור").every((p) => p.requiredGuards === 3));
check("כוננות: 2 משמרות של 12 שעות, 7 חיילים במקביל",
  post("כוננות").length === 2 && post("כוננות").every((p) => p.requiredGuards === 7));
const kitchen = post("תורנות מטבח");
check("מטבח: 06:30–20:30, 2 חיילים, א'–ו'",
  kitchen.length === 1 && kitchen[0].startTime === "06:30" && kitchen[0].endTime === "20:30" &&
  kitchen[0].requiredGuards === 2 && kitchen[0].weekdays.join() === "0,1,2,3,4,5");
check("כל עמדה מחולקת מתחילה בבוקר (06:00)",
  ["עמדת שמירה 1", "עמדת שמירה 2", "סיור", "כוננות"].every((n) => post(n)[0].startTime === "06:00"));

const sunday = "2026-10-11";
let pid = 0;
let sid = 0;
const positions = ARMY_DEMO_POSITIONS.map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
const shifts = positions
  .flatMap((p) => plannedRowsForWeek(p, sunday))
  .map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
const need = shifts.reduce((n, s) => n + s.requiredGuards, 0);
check("229 מקומות בשבוע", need === 229, `got ${need}`);

// ============================================================
console.log("\nכיסוי — 45 חיילים מאיישים את השבוע\n");
// ============================================================

const guards = Array.from({ length: ARMY_DEMO_SOLDIERS }, (_, i) => ({ id: `g${i}`, name: `g${i}` }));
const dates = [...new Set(shifts.map((s) => s.date))].sort();
const STATUS = { a: "available", u: "unavailable", m: "maybe" };
const availability = {};
guards.forEach((g, gi) =>
  dates.forEach((date, di) => {
    shifts
      .filter((s) => s.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .forEach((s, si) => {
        availability[`${g.id}-${s.id}`] = STATUS[demoAvailabilityCode(gi, di * 5 + si, si % 2 === 0 ? "day" : "night")];
      });
  })
);

const missingOf = (res, pred = () => true) =>
  (res.unfilled || []).filter((u) => pred(u)).reduce((m, u) => m + u.missing, 0);
const isKitchen = (u) => String(u.shift?.label || u.label || "").includes("מטבח");

// כללי צוות צבאי כמו שהם באמת: מנוחה 10, ומטבח+כוננות מותרים מעל 12 שעות.
const armyRules = { ...teamRules({ mode: "army", restHours: 10 }) };
const army = autoAssign({ shifts, guards, availability, rules: armyRules });
check(
  "בכללי הצבא (מטבח מותר מעל 12): לפחות 99% מהמקומות מאוישים",
  (need - missingOf(army)) / need >= 0.99,
  `${need - missingOf(army)}/${need}`
);
check("המטבח (14 שעות, יש הפסקות) מאויש במלואו", missingOf(army, isKitchen) === 0, `${missingOf(army, isKitchen)} חסרים במטבח`);

const noException = autoAssign({ shifts, guards, availability, rules: { minRestHours: 10, longShiftCategories: [] } });
check(
  "בלי ההיתר המנוע לא עוקף את כלל ה-12: המטבח נשאר פתוח",
  missingOf(noException, isKitchen) === 12,
  `${missingOf(noException, isKitchen)} חסרים במטבח`
);
const half = autoAssign({ shifts, guards: guards.slice(0, 20), availability, rules: armyRules });
check(
  "20 חיילים לא מספיקים (פחות מ-60%) — לכן ההדגמה פותחת 45",
  (need - missingOf(half)) / need < 0.6,
  `${need - missingOf(half)}/${need}`
);

// ============================================================
console.log("\nיישור עמדות קיימות — צוות אמיתי מול צוות ההדגמה\n");
// ============================================================

const fresh = planArmyDemoPositions([]);
check("צוות ריק: מוסיפים את כל העמדות", fresh.insert.length === ARMY_DEMO_POSITIONS.length && !fresh.update.length);

// הדגמה ישנה: סיור בודד 06–18 לאדם אחד, ועמדת שמירה שחולקה מחצות ל-8 שעות.
const old = [
  { id: "o1", title: "סיור", shape: "template", category: "סיור", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "06:00", endTime: "18:00", requiredGuards: 1 },
  { id: "o2", title: "עמדת שמירה 1 – משמרת 1", shape: "template", category: "תורנות שמירה", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "00:00", endTime: "08:00", requiredGuards: 1 },
  { id: "o3", title: "עמדת שמירה 1 – משמרת 2", shape: "template", category: "תורנות שמירה", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "12:00", endTime: "18:00", requiredGuards: 1 },
];
const realTeam = planArmyDemoPositions(old, { reconcile: false });
check("צוות אמיתי: לא מעדכנים ולא מכבים שום עמדה של המפקד", !realTeam.update.length && !realTeam.deactivate.length);
check("צוות אמיתי: מוסיפים רק שמות שחסרים", !realTeam.insert.some((p) => p.title === "עמדת שמירה 1 – משמרת 1"));

const demoTeam = planArmyDemoPositions(old, { reconcile: true });
check("צוות ההדגמה: עמדה באותו שם שהוגדרה אחרת מתעדכנת (משמרת 1 → 06–12)",
  demoTeam.update.some((u) => u.id === "o2" && u.patch.startTime === "06:00" && u.patch.endTime === "12:00"));
check("צוות ההדגמה: עמדה שכבר תואמת לא נוגעים בה", !demoTeam.update.some((u) => u.id === "o3"));
check("צוות ההדגמה: 'סיור' הבודד הישן כבה (הסיור החדש מחולק)", demoTeam.deactivate.includes("o1"));

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
