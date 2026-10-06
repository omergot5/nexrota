// Standalone check for the dashboard's week status (weekStatus.js).
//   node scripts/verify-week-status.mjs
//
// מה נשמר כאן: שלושת המספרים של דף הבקרה הם אותם מספרים של בניית השבוע, והצעד
// המומלץ הוא תמיד הצעד הבא האמיתי — לא "שבץ" לפני שמישהו דיווח, ולא "פרסם"
// כשחסרים אנשים.

import { focusDay, weekStatus } from "../src/lib/weekStatus.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const week = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
const guards = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
const sh = (id, date, startTime, endTime, extra = {}) => ({
  id, date, startTime, endTime, label: `עמדה – ${id}`, category: "שמירה", requiredGuards: 1, assignedGuards: [], published: false, ...extra,
});

console.log("\nאין משמרות\n");
{
  const s = weekStatus({ shifts: [], guards, weekDates: week });
  check("הצעד הבא: להגדיר משמרות", s.next.id === "shifts");
  check("אין ספירות", s.slots.need === 0 && s.published.total === 0);
}

console.log("\nנבנה, עוד אף אחד לא דיווח\n");
{
  const shifts = [sh("s1", "2026-10-11", "06:00", "12:00"), sh("s2", "2026-10-11", "12:00", "18:00")];
  const s = weekStatus({ shifts, guards, availability: {}, weekDates: week });
  check("0 מתוך 4 דיווחו", s.reported.done === 0 && s.reported.total === 4, JSON.stringify(s.reported));
  check("הצעד הבא: תזכורת", s.next.id === "availability" && s.next.label.includes("4"), s.next.label);
}

console.log("\nכולם דיווחו, אין שיבוץ\n");
{
  const shifts = [sh("s1", "2026-10-11", "06:00", "12:00")];
  const availability = Object.fromEntries(guards.map((g) => [`${g.id}-s1`, "available"]));
  const s = weekStatus({ shifts, guards, availability, weekDates: week });
  check("4 מתוך 4", s.reported.done === 4);
  check("הצעד הבא: לבנות את הסידור", s.next.id === "smart" && s.next.label === "לבנות את הסידור", s.next.label);
}

console.log("\nשובץ חלקית — ההמשך הוא להשלים, גם אם חלק לא דיווחו\n");
{
  const shifts = [sh("s1", "2026-10-11", "06:00", "12:00", { assignedGuards: ["a"] }), sh("s2", "2026-10-12", "06:00", "12:00", { requiredGuards: 2, assignedGuards: ["b"] })];
  const s = weekStatus({ shifts, guards, availability: {}, weekDates: week });
  check("2 מתוך 3 מקומות", s.slots.filled === 2 && s.slots.need === 3, JSON.stringify(s.slots));
  check("הצעד הבא: להשלים", s.next.id === "smart" && s.next.label === "להשלים את השיבוץ", s.next.label);
}

console.log("\nהכול מאויש\n");
{
  const full = [sh("s1", "2026-10-11", "06:00", "12:00", { assignedGuards: ["a"] }), sh("s2", "2026-10-12", "06:00", "12:00", { assignedGuards: ["b"] })];
  const draft = weekStatus({ shifts: full, guards, availability: {}, weekDates: week });
  check("טיוטה: הצעד הבא לפרסם", draft.next.id === "schedule" && draft.published.done === 0);
  const half = weekStatus({ shifts: full.map((x, i) => ({ ...x, published: i === 0 })), guards, availability: {}, weekDates: week });
  check("חצי פורסם — עדיין לפרסם", half.next.id === "schedule" && half.published.done === 1 && half.published.total === 2);
  const done = weekStatus({ shifts: full.map((x) => ({ ...x, published: true })), guards, availability: {}, weekDates: week });
  check("הכול פורסם — הכול מוכן", done.next.id === "done");
}

console.log("\nיום מבצעי — 00:00–05:00 שייך ללילה הקודם\n");
{
  // 00:00 של ראשון 11/10 הוא ליל שבת 10/10, ולכן לא נספר בשבוע 11–17 אלא בקודם.
  const night = sh("n", "2026-10-11", "00:00", "06:00", { assignedGuards: ["a"] });
  const inWeek = weekStatus({ shifts: [night], guards, weekDates: week });
  check("לילה של שבת הקודמת לא נספר בשבוע הזה", inWeek.shiftCount === 0);
  const nextNight = sh("n2", "2026-10-18", "00:00", "06:00", { assignedGuards: ["a"] });
  check("00:00 של הראשון הבא הוא ליל שבת הזו", weekStatus({ shifts: [nextNight], guards, weekDates: week }).shiftCount === 1);
}

console.log("\nהיום שמוצג\n");
{
  const shifts = [
    sh("late", "2026-10-12", "12:00", "18:00"),
    sh("early", "2026-10-12", "06:00", "12:00"),
    sh("far", "2026-10-14", "06:00", "12:00"),
  ];
  const f = focusDay({ shifts, today: "2026-10-06" });
  check("בלי משמרות היום — היום הקרוב שיש בו", f.date === "2026-10-12" && f.isToday === false);
  check("מסודר מהבוקר", f.shifts.map((x) => x.id).join() === "early,late", f.shifts.map((x) => x.id).join());
  const today = focusDay({ shifts, today: "2026-10-12" });
  check("יש משמרות היום — היום", today.date === "2026-10-12" && today.isToday === true);
  check("אין כלום קדימה — null", focusDay({ shifts, today: "2026-11-01" }) === null);
  const tail = focusDay({ shifts: [sh("t", "2026-10-11", "00:00", "06:00"), sh("w", "2026-10-11", "06:00", "12:00")], today: "2026-10-06" });
  check("יום שכולו זנב אחרי חצות לא נבחר כהקרוב", tail.date === "2026-10-11", tail.date);
  const nightOfToday = focusDay({ shifts: [sh("x", "2026-10-13", "00:00", "06:00")], today: "2026-10-12" });
  check("00:00 של מחר הוא הלילה של היום", nightOfToday.date === "2026-10-12" && nightOfToday.isToday === true);
}

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
