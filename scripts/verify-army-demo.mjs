// Standalone check for the army demo structure (armyDemo.js) and that the
// engine can actually staff it with the number of soldiers the demo opens.
//   node scripts/verify-army-demo.mjs
//
// Pure modules only — no browser, no database. The point of the coverage
// section: a demo whose structure needs more soldiers than it opens shows a
// half-empty roster and teaches the commander that the engine is broken.
// The first demo (229 slots, 45 soldiers) was too big to be a recognisable
// company; at 30 soldiers it was 79% staffed and at 20 only 52%. So the
// structure now scales with the team — and this fails first if someone
// changes the structure or the soldier count without the other.

import {
  ARMY_DEMO_SMALL_MAX, ARMY_DEMO_SOLDIERS, armyDemoPositions, demoAvailabilityCode, planArmyDemoPositions,
} from "../src/lib/armyDemo.js";
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
console.log("\nגדלים — עד 30 חיילים, ומבנה קטן ל-20\n");
// ============================================================

check("ברירת המחדל היא 30 חיילים לכל היותר", ARMY_DEMO_SOLDIERS <= 30 && ARMY_DEMO_SOLDIERS > ARMY_DEMO_SMALL_MAX);
check(
  "עד 20 חיילים — המבנה הקטן; 21 ומעלה — הרגיל",
  armyDemoPositions(20) !== armyDemoPositions(21) &&
    armyDemoPositions(20) === armyDemoPositions(5) &&
    armyDemoPositions(25) === armyDemoPositions(30)
);

const byPost = (positions) => {
  const m = new Map();
  for (const p of positions) {
    const { post } = splitShiftLabel(p.title);
    if (!m.has(post)) m.set(post, []);
    m.get(post).push(p);
  }
  return (name) => m.get(name) || [];
};
const slotsOf = (positions) => positions.reduce((n, p) => n + p.requiredGuards * p.weekdays.length, 0);

const std = armyDemoPositions(30);
const post = byPost(std);
check(
  "רגיל: עמדת שמירה אחת, 4 משמרות של 6 שעות, חייל אחד בכל אחת",
  post("עמדת שמירה 2").length === 0 && post("עמדת שמירה 1").length === 4 && post("עמדת שמירה 1").every((p) => p.requiredGuards === 1)
);
check(
  "רגיל: סיור — 3 משמרות של 8 שעות, 3 חיילים בכל אחת (אחד מהם בעל תפקיד)",
  post("סיור").length === 3 && post("סיור").every((p) => p.requiredGuards === 3)
);
check(
  "רגיל: כוננות — 2 משמרות של 12 שעות, 6 חיילים במקביל",
  post("כוננות").length === 2 && post("כוננות").every((p) => p.requiredGuards === 6)
);
const kitchen = post("תורנות מטבח");
check(
  "רגיל: מטבח 06:30–20:30, חייל אחד, א'–ו'",
  kitchen.length === 1 && kitchen[0].startTime === "06:30" && kitchen[0].endTime === "20:30" &&
    kitchen[0].requiredGuards === 1 && kitchen[0].weekdays.join() === "0,1,2,3,4,5"
);
check(
  "רגיל: כל עמדה מחולקת מתחילה בבוקר (06:00)",
  ["עמדת שמירה 1", "סיור", "כוננות"].every((n) => post(n)[0].startTime === "06:00")
);
check("רגיל: 181 מקומות בשבוע", slotsOf(std) === 181, `got ${slotsOf(std)}`);

const small = armyDemoPositions(20);
const sPost = byPost(small);
check(
  "קטן: עמדת שמירה אחת, סיור של חייל, כוננות של 4, מטבח של אחד",
  sPost("עמדת שמירה 2").length === 0 && sPost("עמדת שמירה 1").length === 4 &&
    sPost("סיור").every((p) => p.requiredGuards === 1) && sPost("כוננות").every((p) => p.requiredGuards === 4) &&
    sPost("תורנות מטבח")[0].requiredGuards === 1
);
check("קטן: 111 מקומות בשבוע", slotsOf(small) === 111, `got ${slotsOf(small)}`);

// ============================================================
console.log("\nכיסוי — המבנה מתאייש במלואו עם הצוות שמיועד לו\n");
// ============================================================

const sunday = "2026-10-11";
function week(positions) {
  let pid = 0;
  let sid = 0;
  const withIds = positions.map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
  return withIds.flatMap((p) => plannedRowsForWeek(p, sunday)).map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));
}

const STATUS = { a: "available", u: "unavailable" };
function staff(shifts, soldiers, rules) {
  const guards = Array.from({ length: soldiers }, (_, i) => ({ id: `g${i}`, name: `g${i}` }));
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
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
  const need = shifts.reduce((n, s) => n + s.requiredGuards, 0);
  const result = autoAssign({ shifts, guards, availability, rules });
  return { result, need, filled: result.summary.filledSlots };
}

// כללי צוות צבאי כמו שהם באמת: מנוחה 10, ומטבח+כוננות מותרים מעל 12 שעות.
const army = teamRules({ mode: "army", restHours: 8 });
const stdShifts = week(std);
const smallShifts = week(small);

const at30 = staff(stdShifts, ARMY_DEMO_SOLDIERS, army);
check(`רגיל + ${ARMY_DEMO_SOLDIERS} חיילים (מנוחה 8): לפחות 99% מאוישים — 30 חיילים הם 180 תורנויות לכל היותר`, at30.filled / at30.need >= 0.99, `${at30.filled}/${at30.need}`);

const at25 = staff(stdShifts, 25, army);
check("רגיל + 25 חיילים: לפחות 80% מאוישים", at25.filled / at25.need >= 0.8, `${at25.filled}/${at25.need}`);

const small20 = staff(smallShifts, ARMY_DEMO_SMALL_MAX, army);
check(`קטן + ${ARMY_DEMO_SMALL_MAX} חיילים: כל המקומות מאוישים`, small20.filled === small20.need, `${small20.filled}/${small20.need}`);

const std20 = staff(stdShifts, ARMY_DEMO_SMALL_MAX, army);
check(
  "רגיל + 20 חיילים (לא המבנה שלהם): חלקי, בין 60% ל-90% — המנוע לא מסתיר את החוסר",
  std20.filled / std20.need >= 0.6 && std20.filled / std20.need < 0.9,
  `${std20.filled}/${std20.need}`
);
check("... ולא עובר את תקרת 6 התורנויות לחייל", std20.result.fairness.perGuard.every((p) => p.shifts <= 6));

const missingOf = (res, pred) => (res.unfilled || []).filter(pred).reduce((m, u) => m + u.missing, 0);
const isKitchen = (u) => String(u.shift?.label || u.label || "").includes("מטבח");
const strict = staff(stdShifts, ARMY_DEMO_SOLDIERS, { minRestHours: 8, longShiftCategories: [] });
check(
  "בלי ההיתר ל'משמרות ארוכות' המנוע לא עוקף את כלל ה-12: רק המטבח נשאר פתוח",
  missingOf(strict.result, (u) => !isKitchen(u)) === 0 && missingOf(strict.result, isKitchen) === 6,
  `${missingOf(strict.result, isKitchen)} חסרים במטבח`
);

// ============================================================
console.log("\nיישור עמדות קיימות — צוות אמיתי מול צוות ההדגמה\n");
// ============================================================

const fresh = planArmyDemoPositions([]);
check("צוות ריק: מוסיפים את כל העמדות", fresh.insert.length === std.length && !fresh.update.length);
check("צוות ריק ב-20: מוסיפים את המבנה הקטן", planArmyDemoPositions([], { soldiers: 20 }).insert.length === small.length);

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
check(
  "צוות ההדגמה: עמדה באותו שם שהוגדרה אחרת מתעדכנת (משמרת 1 → 06–12)",
  demoTeam.update.some((u) => u.id === "o2" && u.patch.startTime === "06:00" && u.patch.endTime === "12:00")
);
check("צוות ההדגמה: עמדה שכבר תואמת לא נוגעים בה", !demoTeam.update.some((u) => u.id === "o3"));
check("צוות ההדגמה: 'סיור' הבודד הישן כבה (הסיור החדש מחולק)", demoTeam.deactivate.includes("o1"));

// הדגמה ישנה של 45: סיור של 3 וכוננות של 7 — מתכווצות לכמויות הרגילות.
const big = std.map((p, i) => ({
  ...p, id: `b${i}`, shape: "template", active: true,
  requiredGuards: p.category === "סיור" ? 3 : p.category === "כוננות" ? 7 : p.requiredGuards,
}));
const shrink = planArmyDemoPositions(big, { reconcile: true });
check(
  "הדגמה ישנה (כוננות ×7) מתעדכנת לכמות הרגילה (×6); סיור ×3 כבר תואם",
  shrink.update.length === 2 &&
    shrink.update.every((u) => u.patch.category === "כוננות") &&
    shrink.update.filter((u) => u.patch.category === "כוננות").every((u) => u.patch.requiredGuards === 6),
  `${shrink.update.length} עדכונים`
);
const toSmall = planArmyDemoPositions(
  std.map((p, i) => ({ ...p, id: `s${i}`, shape: "template", active: true })),
  { reconcile: true, soldiers: 20 }
);
check(
  "מעבר ל-20: סיור 3→1 (3 עדכונים) וכוננות 6→4 (2), בלי כיבוי ובלי הוספה",
  toSmall.update.length === 5 &&
    toSmall.update.filter((u) => u.patch.category === "סיור").every((u) => u.patch.requiredGuards === 1) &&
    toSmall.update.filter((u) => u.patch.category === "כוננות").every((u) => u.patch.requiredGuards === 4) &&
    toSmall.deactivate.length === 0 && toSmall.insert.length === 0,
  `update=${toSmall.update.length} deactivate=${toSmall.deactivate.length} insert=${toSmall.insert.length}`
);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
