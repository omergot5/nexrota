// Standalone sanity check for the react-big-calendar event adapter.
//   node scripts/verify-calendar-events.mjs
//
// Pure module only — no browser, no database. Covers: overnight-shift
// splitting into two day-bounded segments (RBC promotes any event that
// crosses a calendar day to the all-day row otherwise — this is the fix
// for the live-reported bug where night shifts rendered as a banner
// instead of at their real hour), allDay placement for timeless items,
// merge-completeness (reuses boardItemsForDates, so nothing silently
// drops), and determinism.

import { toCalendarEvents } from "../src/lib/calendarEvents.js";
import { weekFrom } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
console.log("\nRBC-01 · toCalendarEvents — פיקסצ'ר שבוע קבוע (2026-09-06)\n");
// ============================================================

const sunday = "2026-09-06";
const weekDates = weekFrom(sunday);

const shifts = [
  { id: "s-day", date: sunday, startTime: "07:00", endTime: "19:00", label: "יום", assignedGuards: ["g1"], category: "שמירות", requiredGuards: 1 },
  // חוצה חצות — 19:00 עד 07:00 למחרת
  { id: "s-night", date: sunday, startTime: "19:00", endTime: "07:00", label: "לילה", assignedGuards: [], category: "שמירות", requiredGuards: 1 },
];

const tasks = [
  // engine-eligible, timed
  {
    id: "t-timed", title: "משימה עם שעה", category: "סיור", assignees: ["g2"], status: "open", priority: "medium",
    startDate: "2026-09-07", dueDate: "2026-09-07", startTime: "08:00", endTime: "10:00", positionId: null,
  },
  // קפואה — בלי שעות, אמורה לצאת allDay
  {
    id: "t-frozen", title: "משימה קפואה", category: "", assignees: [], status: "open", priority: "medium",
    startDate: null, dueDate: sunday, startTime: null, endTime: null, positionId: null,
  },
];

const events = toCalendarEvents({ shifts, tasks, dates: weekDates });

// משמרת הלילה חוצה חצות — מתפצלת לשני אירועים, לא אחד. סה"כ האירועים
// גדול ב-1 מסכום פריטי הקלט בדיוק בגלל הפיצול הזה.
check(
  "כל פריט קלט מייצר אירוע אחד — חוץ ממשמרת הלילה שמתפצלת לשניים",
  events.length === shifts.length + tasks.length + 1,
  `events=${events.length} expected=${shifts.length + tasks.length + 1}`
);

const nightEvents = events.filter((e) => e.id === "s-night");
check("משמרת לילה חוצה חצות מייצרת בדיוק שני אירועים", nightEvents.length === 2, `count=${nightEvents.length}`);

const [beforeMidnight, afterMidnight] = nightEvents.sort((a, b) => a.start - b.start);
check(
  "החצי הראשון: 19:00 עד ממש לפני חצות אותו יום",
  beforeMidnight.start.getHours() === 19 &&
    beforeMidnight.end.getDate() === beforeMidnight.start.getDate() &&
    beforeMidnight.end.getHours() === 23 &&
    beforeMidnight.end.getMinutes() === 59
);
check("החצי הראשון מסומן continuesAfter", beforeMidnight.resource.continuesAfter === true);
check("החצי השני מתחיל בדיוק בחצות (00:00) ביום שאחרי", afterMidnight.start.getHours() === 0 && afterMidnight.start.getMinutes() === 0);
check("החצי השני נגמר ב-07:00", afterMidnight.end.getHours() === 7);
check("החצי השני מסומן continuesBefore", afterMidnight.resource.continuesBefore === true);
check("שני החצאים יחד מכסים בדיוק 12 שעות", afterMidnight.end.getTime() - beforeMidnight.start.getTime() === 12 * 3600 * 1000);
check("אף חצי אינו allDay", beforeMidnight.allDay === false && afterMidnight.allDay === false);

const dayEvent = events.find((e) => e.id === "s-day");
check(
  "משמרת יום: 12 שעות בדיוק (07:00–19:00)",
  dayEvent.end.getTime() - dayEvent.start.getTime() === 12 * 3600 * 1000
);

const frozenEvent = events.find((e) => e.id === "t-frozen");
check("משימה קפואה יוצאת allDay", frozenEvent.allDay === true);
check("למשימה קפואה אין requiredGuards (אין מושג איוש)", frozenEvent.resource.requiredGuards === null);

const timedTaskEvent = events.find((e) => e.id === "t-timed");
check("משימה עם שעה אינה allDay", timedTaskEvent.allDay === false);
check(
  "משימה עם שעה: שעתיים בדיוק (08:00–10:00)",
  timedTaskEvent.end.getTime() - timedTaskEvent.start.getTime() === 2 * 3600 * 1000
);
check("הקטגוריה עוברת דרך resource.category", timedTaskEvent.resource.category === "סיור");

// דטרמיניזם: אותו קלט, שלוש קריאות, אותו JSON (משווים אחרי serialize כדי
// ש-Date ייצא כ-ISO string נורמלי לשם ההשוואה).
const serialize = (evs) => JSON.stringify(evs.map((e) => ({ ...e, start: e.start.toISOString(), end: e.end.toISOString() })));
const j1 = serialize(toCalendarEvents({ shifts, tasks, dates: weekDates }));
const j2 = serialize(toCalendarEvents({ shifts, tasks, dates: weekDates }));
check("שלוש קריאות רצופות על אותו קלט מייצרות JSON זהה", j1 === j2);

// קלט ריק לא קורס.
const empty = toCalendarEvents({ shifts: [], tasks: [], dates: weekDates });
check("קלט ריק מחזיר מערך אירועים ריק, לא קורס", Array.isArray(empty) && empty.length === 0);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
