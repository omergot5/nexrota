// ============================================================
// Date helpers
//
// Everything in the app speaks "YYYY-MM-DD" local dates. We never round-trip
// through toISOString() for a calendar date — that converts to UTC and shifts
// Israel (UTC+2/+3) back a day for anything before 02:00/03:00 local.
//
// This module also owns the time window of any scheduled item — shift or
// task alike (Phase 2, UNIF-03). It is deliberately the only cycle-free leaf
// both `autoAssign.js` and `conflicts.js` can import a shared overlap test
// from without creating an import cycle.
// ============================================================

export const DAYS_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const DAYS_HE_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];
export const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

/** Local calendar date of a Date object as YYYY-MM-DD. */
export const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Parse YYYY-MM-DD as a local Date at noon (immune to DST edges). */
export const fromISODate = (iso) => new Date(`${iso}T12:00:00`);

export const todayISO = () => toISODate(new Date());

/**
 * When availability for a week closes. Stored on the team as an offset rather
 * than a date so it recurs every week with nobody maintaining it.
 *
 * Both sides must agree on this or the guard is told one thing and locked out
 * by another, so it lives here and is imported by guard and supervisor alike.
 */
/**
 * Six full weeks covering a month, Sunday-first and always 42 cells. A grid
 * that changes height between months makes the surrounding layout jump, so
 * the trailing days of the neighbouring months are included rather than
 * padded with blanks.
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = addDays(toISODate(first), -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const monthLabelHe = (year, month) => `${MONTHS_HE[month]} ${year}`;

export const DEADLINE_DEFAULTS = { days: 3, hour: 14 };

export function availabilityDeadline(weekStartISO, team) {
  const days = team?.deadlineDays ?? DEADLINE_DEFAULTS.days;
  const hour = team?.deadlineHour ?? DEADLINE_DEFAULTS.hour;
  const d = fromISODate(addDays(weekStartISO, -days));
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** "עוד יומיים ו-3 שעות" / "עבר לפני 5 שעות" — never a bare timestamp. */
export function countdownHe(target, now = new Date()) {
  const ms = target - now;
  const past = ms < 0;
  const mins = Math.floor(Math.abs(ms) / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const parts = [];
  if (days) parts.push(days === 1 ? "יום" : days === 2 ? "יומיים" : `${days} ימים`);
  if (hours && days < 3) parts.push(hours === 1 ? "שעה" : hours === 2 ? "שעתיים" : `${hours} שעות`);
  if (!parts.length) parts.push(mins <= 1 ? "פחות מדקה" : `${mins} דקות`);
  const span = parts.join(" ו-");
  return past ? `עבר לפני ${span}` : `עוד ${span}`;
}

export const addDays = (iso, n) => {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

export const diffInDays = (isoA, isoB) =>
  Math.round((fromISODate(isoA) - fromISODate(isoB)) / 86400000);

/** Sunday of the week containing `iso` (Israeli week starts Sunday). */
export const startOfWeek = (iso = todayISO()) => addDays(iso, -fromISODate(iso).getDay());

/** The 7 dates of the week starting at `sundayISO`. */
export const weekFrom = (sundayISO) => Array.from({ length: 7 }, (_, i) => addDays(sundayISO, i));

/** The week `offset` weeks away from the current one. offset 0 = this week. */
export const weekByOffset = (offset = 0) => weekFrom(addDays(startOfWeek(), offset * 7));

export const dayName = (iso) => DAYS_HE[fromISODate(iso).getDay()];

export const formatDateHe = (iso) => {
  const d = fromISODate(iso);
  return `יום ${DAYS_HE[d.getDay()]}, ${d.getDate()} ב${MONTHS_HE[d.getMonth()]}`;
};

export const shortDate = (iso) => {
  const d = fromISODate(iso);
  return `${DAYS_HE_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

export const rangeLabelHe = (dates) => {
  if (!dates?.length) return "";
  const a = fromISODate(dates[0]);
  const b = fromISODate(dates[dates.length - 1]);
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${a.getDate()}–${b.getDate()} ב${MONTHS_HE[b.getMonth()]}`
    : `${a.getDate()} ב${MONTHS_HE[a.getMonth()]} – ${b.getDate()} ב${MONTHS_HE[b.getMonth()]}`;
};

export const isPast = (iso) => iso < todayISO();
export const isToday = (iso) => iso === todayISO();

/** "07:00" -> 420 (minutes past midnight) */
export const minutesOfTime = (hhmm) => {
  const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Absolute start/end timestamps for a shift, unwrapping overnight shifts. */
export const shiftInterval = (shift) => {
  const base = fromISODate(shift.date).setHours(0, 0, 0, 0);
  const start = base + minutesOfTime(shift.startTime) * 60000;
  let end = base + minutesOfTime(shift.endTime) * 60000;
  if (end <= start) end += 24 * 3600 * 1000; // crosses midnight
  return { start, end };
};

export const shiftHours = (shift) => {
  const { start, end } = shiftInterval(shift);
  return (end - start) / 3600000;
};

// ============================================================
// Task ↔ shift unification (Phase 2, UNIF-01/02/03/04).
//
// A task only ever enters the engine if it resolves to exactly one calendar
// day AND carries both a start and an end time (D-01). Anything else —
// including every task that existed before this migration, since the hour
// columns did not exist for it to have hours in — is frozen by definition:
// there is no stored flag to keep in sync, only two nullable fields to read.
// ============================================================

/**
 * Normalises a window to absolute milliseconds. An already-ms window
 * ({start, end}, the shape shiftInterval/taskInterval produce) passes
 * through untouched. A date-only window ({from, to} ISO strings, the shape
 * a frozen or multi-day task produces) is widened to the full calendar day
 * it covers. Anything else — including a malformed/garbage window — returns
 * null, never a partial window that would silently compare false forever
 * (T-02-01, T-02-02).
 *
 * A date-only window ends at 23:59:59.999 local, not at the following
 * midnight: under the strict overlap test below, an end at the following
 * midnight would make a Monday-only and a Tuesday-only window register as
 * overlapping — exactly the outcome the old inclusive date-string
 * comparison avoided.
 */
function toMsWindow(w) {
  if (!w) return null;
  if (Number.isFinite(w.start) && Number.isFinite(w.end)) return w;
  if (w.from && w.to) {
    const start = fromISODate(w.from).setHours(0, 0, 0, 0);
    const end = fromISODate(w.to).setHours(23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

/**
 * The single overlap test for the whole product (UNIF-03). Accepts either
 * an ms window or a date-only window on each side, normalises both through
 * `toMsWindow`, and never compares a raw ISO string against a raw
 * millisecond number.
 *
 * Strict, not inclusive: two shifts touching end to start (07:00–15:00
 * followed by 15:00–23:00) are one continuous stretch — `blockHoursAround`
 * in autoAssign.js handles that separately — and turning that into an
 * overlap would reject rosters the product accepts today.
 */
export function windowsOverlap(a, b) {
  const wa = toMsWindow(a);
  const wb = toMsWindow(b);
  if (!wa || !wb) return false;
  if (!Number.isFinite(wa.start) || !Number.isFinite(wa.end)) return false;
  if (!Number.isFinite(wb.start) || !Number.isFinite(wb.end)) return false;
  return wa.start < wb.end && wb.start < wa.end;
}

/** The single definition of "one calendar day" in the product (D-01). */
export const isSingleDayTask = (task) =>
  Boolean(task?.dueDate) && (!task.startDate || task.startDate === task.dueDate);

/**
 * Counted versus frozen, derived — never stored (UNIF-04). Only a
 * single-day task carrying both a start and end time is eligible; in
 * particular this is never gated on `task.status` (D-09) and never on a
 * stored flag — frozen is simply the absence of hours, which is the only
 * state a pre-migration row can be in.
 */
export const isTaskEngineEligible = (task) =>
  isSingleDayTask(task) && Boolean(task?.startTime) && Boolean(task?.endTime);

/**
 * Millisecond window of an hour-bearing task. Returns null unless the task
 * has a resolvable day and both times. Delegates to `shiftInterval` so a
 * task and a shift share one midnight-wrap rule instead of two that can
 * drift apart.
 */
export function taskInterval(task) {
  const day = task?.dueDate || task?.startDate;
  if (!day || !task?.startTime || !task?.endTime) return null;
  return shiftInterval({ date: day, startTime: task.startTime, endTime: task.endTime });
}

/**
 * The only task-to-engine-item adapter (UNIF-02). Returns null unless the
 * task is engine-eligible.
 *
 * `assignedGuards` — not `assignees` — is load-bearing: `addToLoad`,
 * `teamAverages` and `tally` all read that exact field name, and the whole
 * point of this adapter is that none of them has to learn a second one.
 *
 * `type: "task"` is what makes D-07 true without a special case:
 * `LOAD_WEIGHTS` has no key for it, so `shiftLoad` falls through to
 * `default`, while `isWeekendShift` reads `date`/`startTime` and applies
 * the weekend multiplier on its own — automatically, not by special-casing
 * tasks.
 */
export function taskAsShiftShape(task) {
  if (!isTaskEngineEligible(task)) return null;
  return {
    id: task.id,
    date: task.dueDate || task.startDate,
    startTime: task.startTime,
    endTime: task.endTime,
    type: "task",
    label: task.title || "משימה",
    assignedGuards: task.assignees || [],
  };
}

/**
 * The single merge definition every reporting call site routes through
 * (plan 02-03), so the number the engine enforces and the number a screen
 * prints can never come from two different merges. Total over its inputs:
 * an empty or `undefined` list on either side still returns a usable array,
 * never throws.
 */
export function withEngineTasks(shifts = [], tasks = []) {
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  return [...safeShifts, ...safeTasks.map(taskAsShiftShape).filter(Boolean)];
}
