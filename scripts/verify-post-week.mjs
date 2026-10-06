// Standalone check for the week-build grid engine (postWeek.js).
//   node scripts/verify-post-week.mjs
//
// Pure module only — no browser, no database. What it guards: the commander
// reads "post → its shifts → seven days". If shifts of two posts get mixed,
// if the night lands under the wrong day, or if a template edit silently
// overwrites a day the commander changed by hand, the screen lies.

import {
  buildPostWeek, countMissing, isAfterMidnight, opDayOf, planTemplateSync, postBlocks, renamePostTitle,
} from "../src/lib/postWeek.js";
import { buildDivisionRows, plannedRowsForWeek } from "../src/lib/positions.js";
import { shiftPartName } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const week = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
const ALL = [0, 1, 2, 3, 4, 5, 6];

let pid = 0;
const positions = [];
const add = (title, category, startTime, endTime, extra = {}) =>
  positions.push({ id: `p${++pid}`, title, category, shape: "template", active: true, weekdays: ALL, startTime, endTime, requiredGuards: 1, ...extra });
for (const r of buildDivisionRows("עמדת שמירה 1", 6)) add(r.title, "תורנות שמירה", r.startTime, r.endTime);
for (const r of buildDivisionRows("עמדת שמירה 2", 6)) add(r.title, "תורנות שמירה", r.startTime, r.endTime);
for (const r of buildDivisionRows("סיור", 8)) add(r.title, "סיור", r.startTime, r.endTime, { requiredGuards: 3 });
add("תורנות מטבח", "תורנות מטבח", "06:30", "20:30", { weekdays: [0, 1, 2, 3, 4, 5], requiredGuards: 2 });

let sid = 0;
const shifts = positions
  .flatMap((p) => plannedRowsForWeek(p, week[0]))
  .map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));

// ============================================================
console.log("\nקיבוץ לפי עמדה\n");
// ============================================================

const posts = buildPostWeek({ shifts, positions, weekDates: week });
const byName = Object.fromEntries(posts.map((p) => [p.post, p]));
check("ארבע עמדות, לא קטגוריות: שתי עמדות שמירה נפרדות", posts.length === 4 && byName["עמדת שמירה 1"] && byName["עמדת שמירה 2"]);
check("לכל עמדת שמירה 4 משמרות, לסיור 3, למטבח 1",
  byName["עמדת שמירה 1"].blocks.length === 4 && byName["סיור"].blocks.length === 3 && byName["תורנות מטבח"].blocks.length === 1);
check("העמדות מסודרות לפי סדר הקטגוריות של הצבא (שמירה, סיור, מטבח)",
  posts.map((p) => p.post).join("|") === "עמדת שמירה 1|עמדת שמירה 2|סיור|תורנות מטבח", posts.map((p) => p.post).join("|"));
check("כמות לעמדה: 3 בכל משמרת בסיור", byName["סיור"].requiredGuards === 3);

// ============================================================
console.log("\nהיום מתחיל בבוקר\n");
// ============================================================

const guard = byName["עמדת שמירה 1"];
check("סדר המשמרות: בוקר, צהריים, ערב, לילה",
  guard.blocks.map((b) => b.part).join(",") === "בוקר,צהריים,ערב,לילה", guard.blocks.map((b) => b.part).join(","));
check("הלילה (00–06) הוא האחרון ומסומן אחרי-חצות", guard.blocks[3].startTime === "00:00" && guard.blocks[3].afterMidnight);
check("isAfterMidnight: 04:59 כן, 05:00 לא (05:30 מטבח הוא בוקר)", isAfterMidnight("04:59") && !isAfterMidnight("05:00") && !isAfterMidnight("05:30"));
check("opDayOf: 00:00 של שני שייך ליום ראשון", opDayOf({ date: "2026-10-12", startTime: "00:00" }) === "2026-10-11");

const night = guard.blocks[3];
const sundayNight = night.cells[0];
check("תא הלילה של ראשון מציג את המשמרת של שני 00:00 (ליל ראשון→שני)",
  sundayNight.state === "shift" && sundayNight.shifts[0].date === "2026-10-12", JSON.stringify(sundayNight.shifts.map((s) => s.date)));
check("תא הלילה של שבת: 'שבוע הבא' (ליל שבת→ראשון מתחיל בשבוע הבא)", night.cells[6].state === "next-week");
check("ה-00:00 של יום ראשון הזה (ליל השבת הקודמת) לא מוצג בשבוע הזה",
  !night.cells.some((c) => c.shifts.some((s) => s.date === "2026-10-11")));
check("משמרת בוקר נשארת ביום שלה", guard.blocks[0].cells[0].shifts[0].date === "2026-10-11");

const kitchen = byName["תורנות מטבח"].blocks[0];
check("מטבח בשבת: 'לא פעילה' (א'–ו')", kitchen.cells[6].state === "off" && kitchen.cells[5].state === "shift");

check("סיור 22–06: הלילה של אותו יום (מתחיל לפני חצות)",
  byName["סיור"].blocks[2].part === "לילה" && byName["סיור"].blocks[2].cells[0].shifts[0].date === "2026-10-11");

// ============================================================
console.log("\nשמות חלקי היום\n");
// ============================================================

check("12 שעות: 06–18 'יום', 18–06 'לילה'",
  shiftPartName({ startTime: "06:00", endTime: "18:00" }) === "יום" && shiftPartName({ startTime: "18:00", endTime: "06:00" }) === "לילה");
check("8 שעות: 06 בוקר, 14 צהריים, 22 לילה",
  ["06:00", "14:00", "22:00"].map((s) => shiftPartName({ startTime: s, endTime: s })).join() !== "" &&
  buildDivisionRows("x", 8).map(shiftPartName).join(",") === "בוקר,צהריים,לילה");
check("מטבח 06:30–20:30 (14 שעות) הוא 'יום'", shiftPartName({ startTime: "06:30", endTime: "20:30" }) === "יום");

// ============================================================
console.log("\nמשמרת בלי עמדה לא נעלמת\n");
// ============================================================

const manual = { id: "m1", date: "2026-10-13", label: "שמירה מיוחדת", startTime: "09:00", endTime: "13:00", requiredGuards: 2, assignedGuards: [], positionId: null, category: "כללי" };
const withManual = buildPostWeek({ shifts: [...shifts, manual], positions, weekDates: week });
const extra = withManual.find((p) => p.post === "שמירה מיוחדת");
check("משמרת שנוספה ידנית מופיעה כעמדה משלה ביום שלה",
  extra && extra.blocks[0].cells[2].shifts[0].id === "m1" && extra.blocks[0].cells[1].state === "off");

// ============================================================
console.log("\nעמדה חדשה מתוך הבחירה\n");
// ============================================================

check("3 משמרות מ-06:00", postBlocks({ name: "סיור", perDay: 3 }).map((b) => b.startTime).join() === "06:00,14:00,22:00");
check("4 משמרות מ-07:00", postBlocks({ name: "x", perDay: 4, firstStart: "07:00" }).map((b) => b.startTime).join() === "07:00,13:00,19:00,01:00");
check("משמרת אחת עם שעות חופשיות", JSON.stringify(postBlocks({ name: "מטבח", perDay: 1, start: "06:30", end: "20:30" })) ===
  JSON.stringify([{ title: "מטבח", startTime: "06:30", endTime: "20:30" }]));
check("שינוי שם עמדה שומר את החלק", renamePostTitle("עמדת שמירה 1 – משמרת 3", "עמדה צפונית") === "עמדה צפונית – משמרת 3");

// ============================================================
console.log("\nשינוי תבנית מסתנכרן לשבוע — בלי לדרוס יום שנערך ידנית\n");
// ============================================================

const patrolMorning = positions.find((p) => p.title === "סיור – משמרת 1");
const patrolShifts = shifts.filter((s) => s.positionId === patrolMorning.id);
// יום שני נערך ידנית: 4 חיילים ושעות אחרות. יום שלישי כבר שובץ אליו מישהו.
const edited = shifts.map((s) => {
  if (s.id === patrolShifts[1].id) return { ...s, requiredGuards: 4, startTime: "07:00" };
  if (s.id === patrolShifts[2].id) return { ...s, assignedGuards: ["g1"] };
  return s;
});
const before = patrolMorning;
const after = { ...patrolMorning, requiredGuards: 5, startTime: "05:30", endTime: "13:30", weekdays: [0, 1, 2, 3, 4, 5] };
const sync = planTemplateSync({ shifts: edited, positionId: before.id, before, after, fromDate: week[0] });

const timeUpdate = sync.update.find((u) => "startTime" in u.fields);
const countUpdate = sync.update.find((u) => "requiredGuards" in u.fields);
check("שעות: מתעדכנות בכל הימים חוץ מיום שני שנערך ידנית",
  timeUpdate && !timeUpdate.ids.includes(patrolShifts[1].id) && timeUpdate.ids.includes(patrolShifts[0].id));
check("כמות: לא נוגעת ביום שני (4 נשאר 4), כן בשאר",
  countUpdate && !countUpdate.ids.includes(patrolShifts[1].id) && countUpdate.ids.includes(patrolShifts[3].id));
check("שבת הוסרה מהעמדה: המשמרת של שבת (לא שובצה) נמחקת", sync.remove.includes(patrolShifts[6].id));
check("משמרת לפני השבוע המוצג לא נוגעים בה",
  !planTemplateSync({ shifts: edited, positionId: before.id, before, after, fromDate: week[3] }).update
    .some((u) => u.ids.includes(patrolShifts[0].id)));

const renamed = planTemplateSync({
  shifts, positionId: before.id, before, after: { ...before, title: "סיור צפוני – משמרת 1" }, fromDate: week[0],
});
check("שינוי שם מעדכן תווית ומיקום בכל המשמרות של העמדה",
  renamed.update.some((u) => u.fields.label === "סיור צפוני – משמרת 1" && u.fields.location === "סיור צפוני" && u.ids.length === 7));

// ============================================================
console.log("\nמקומות חסרים — אותו מספר שהמפקד רואה בתאים\n");
// ============================================================

const grid = buildPostWeek({ shifts, positions, tasks: [], weekDates: week, mode: "army" });
const emptyCount = countMissing(grid);
const shownNeed = shifts.filter((s) => week.includes(opDayOf(s))).reduce((n, s) => n + (s.requiredGuards || 1), 0);
check("לפני שיבוץ: אף אחד לא משובץ", emptyCount.assigned === 0, `assigned=${emptyCount.assigned}`);
check("לפני שיבוץ: החסרים הם כל מה שמוצג בתאים", emptyCount.missing === shownNeed, `missing=${emptyCount.missing} expected=${shownNeed}`);

const one = shifts.map((s, i) => (i === 0 ? { ...s, assignedGuards: ["g1"] } : s));
const afterOne = countMissing(buildPostWeek({ shifts: one, positions, tasks: [], weekDates: week, mode: "army" }));
check("שיבוץ אחד מוריד בדיוק מקום חסר אחד", afterOne.missing === emptyCount.missing - 1 && afterOne.assigned === 1,
  `${afterOne.missing} / ${emptyCount.missing}`);

const over = shifts.map((s, i) => (i === 0 ? { ...s, assignedGuards: ["g1", "g2", "g3", "g4", "g5"] } : s));
const overCount = countMissing(buildPostWeek({ shifts: over, positions, tasks: [], weekDates: week, mode: "army" }));
check("משמרת עם יותר משובצים מהנדרש לא יוצרת חוסר שלילי", overCount.missing >= 0 && overCount.missing < emptyCount.missing,
  `missing=${overCount.missing}`);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
