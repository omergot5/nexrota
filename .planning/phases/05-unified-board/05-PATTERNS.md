# Phase 5: הלוח המאוחד - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 8 (new/modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/lib/dates.js` (add `boardShapeOf` or similar) | utility (pure fn) | transform | `src/lib/dates.js` — `taskAsShiftShape`/`withEngineTasks` (same file, sibling functions) | exact |
| `src/components/supervisor/UnifiedBoard.jsx` (new) | component | request-response (read-only render of props) | `src/components/supervisor/WeekCalendar.jsx` (grid variant) + `src/components/supervisor/views.jsx` `TaskRow`/`AssignView` (row/badge variant) | role-match (composite) |
| `src/components/supervisor/WeekFlow.jsx` (modify: insert step 0, shift `STEP_OF`) | component (step container) | request-response | itself, existing steps 0-3 wiring | exact |
| `src/components/GuardApp.jsx` (modify: `MySchedule`'s `mine`/`rest`/team-schedule builders) | component | CRUD-read/transform | itself — existing `withTasks`/`teamAverages` block (same file) | exact |
| `src/components/supervisor/PositionsScreen.jsx` (modify: add BOARD-02 forward strip to `PositionCard`) | component | batch (4× pure-fn calls rendered as list) | itself — existing POS-05 "who's working this week" block; `src/lib/positions.js` `plannedRowsForWeek` | exact |
| `src/lib/terms.js` (modify: add `nav.board`, `positions.forward`, `positions.planned` keys) | config/i18n | transform | itself — existing `nav.*` key entries | exact |
| `src/components/SupervisorApp.jsx` (modify: repoint/remove "calendar" tab week toggle) | component (router/shell) | request-response | itself — existing `Segmented(week=WeekCalendar|month=CalendarView)` block | exact |
| `scripts/verify-board.mjs` (new) | test | transform (pure-fn assertions) | `scripts/verify-positions.mjs` | exact |

## Pattern Assignments

### `src/lib/dates.js` — new `boardShapeOf(task)` (utility, transform)

**Analog:** same file, `taskAsShiftShape` / `isTaskEngineEligible` / `isSingleDayTask` (`src/lib/dates.js:199-270`)

**Core pattern to copy** (lines 199-270, verbatim reuse of the classification predicates):
```javascript
export const isSingleDayTask = (task) =>
  Boolean(task?.dueDate) && (!task.startDate || task.startDate === task.dueDate);

export const isTaskEngineEligible = (task) =>
  isSingleDayTask(task) && Boolean(task?.startTime) && Boolean(task?.endTime);

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
    category: task.category || "",
  };
}

export function withEngineTasks(shifts = [], tasks = []) {
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  return [...safeShifts, ...safeTasks.map(taskAsShiftShape).filter(Boolean)];
}
```

**New function contract** (RESEARCH.md §4, not yet in codebase — build as a sibling, never a replacement):
- Reuse `isTaskEngineEligible` as-is for the "does this belong to `taskAsShiftShape` instead" check (return `null` if eligible — the caller already has it via `withEngineTasks`).
- Anchor date: `task.dueDate || task.startDate` — the same idiom already used 3x independently: `taskInterval` (`dates.js:220`), `workingGuardIdsForWeek` (`positions.js:114`), `PositionsScreen.jsx:286`. Do not invent a different anchor.
- Never fabricate `startTime`/`endTime`. Mark `timeless: true` instead.
- Reuse `rangeText()` (views.jsx:1526-1531) for the date-span sentence when `startDate !== dueDate` — export it from `dates.js` or duplicate the exact formatting logic (it currently lives in `views.jsx`, not `dates.js`; planner must decide export location, but the **format itself** must be identical, not reinvented).

**Error handling:** none needed — pure function, same null-safety idiom as `taskAsShiftShape` (`if (!X) return null`).

---

### `src/components/supervisor/UnifiedBoard.jsx` (new component, request-response/read-only)

**Analogs:**
1. `src/components/supervisor/WeekCalendar.jsx` — day-grouping / "today" highlight / coverage badge conventions (grid layout, but the *tokens* transfer to a list)
2. `src/components/supervisor/views.jsx` `TaskRow` (lines 1721-1812) — row layout for a mixed timed/timeless item
3. `src/components/supervisor/views.jsx` `AssignView` per-guard button block (lines 1073-1189) — QUAL-08 per-assignee lock treatment

**Imports pattern** (model after `WeekCalendar.jsx:1-20` and `views.jsx` top-of-file imports):
```javascript
import { Badge, Btn, Card, EmptyState, readableInk } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { DAYS_HE_SHORT, shortDate, withEngineTasks, isTaskEngineEligible } from "../../lib/dates.js";
import { isQualified } from "../../lib/autoAssign.js";
import { t } from "../../lib/terms.js";
```

**"Today" highlight pattern** (`src/components/supervisor/WeekCalendar.jsx:142-154`):
```javascript
className={`px-1 py-2 text-center border-r border-hairline ${
  isToday(iso) ? "bg-brand/10" : ""
}`}
...
<div className={`text-xs font-bold ${isToday(iso) ? "text-brand" : "text-content"}`}>
  {DAYS_HE_SHORT[i]}
</div>
<div className="text-[11px] text-faint tabular-nums">{shortDate(iso)}</div>
```
Port this token set from a grid-cell header to a day-group list-header row (per UI-SPEC §Layout, "sticky-optional header row — weekday name + short date").

**Coverage badge pattern (`--warn`, icon+text, never color-only)** (`src/components/supervisor/WeekCalendar.jsx:220-260`):
```javascript
title={`${shift.label} · ${shift.startTime}–${shift.endTime}${
  missing ? ` · חסרים ${missing}` : ""
}`}
className={`... ${missing ? "ring-2 ring-warn" : "ring-black/10"}`}
```
For a list row (not a grid block), render as inline text: `<Icon name="alert" size={13} /> חסרים {missing}` — same "חסרים N" wording, same `--warn` token, no new copy.

**Row layout for mixed timed/timeless items — copy `TaskRow`'s badge-and-time-block verbatim** (`src/components/supervisor/views.jsx:1765-1798`):
```javascript
{!eligible && (
  <span title="המשימה לא נושאת שעות, או פרושה על יותר מיום אחד — ולכן היא לא נכנסת למנוע: ...">
    <Badge tone="neutral" icon="lock">מחוץ למנוע</Badge>
  </span>
)}
...
{eligible && (
  <span className="flex items-center gap-1">
    <Icon name="clock" size={11} />
    {task.startTime}–{task.endTime}
  </span>
)}
```
Do not paraphrase "מחוץ למנוע" or the tooltip sentence — copy verbatim (UI-SPEC Copywriting Contract).

**Per-assignee QUAL-08 lock — copy verbatim, per person not per item** (`src/components/supervisor/views.jsx:1142-1169`):
```javascript
{!qualified && (
  <span
    className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1
      rounded-full flex items-center justify-center
      ring-2 ring-surface bg-surface text-muted"
  >
    <Icon name="lock" size={11} strokeWidth={2.5} />
  </span>
)}
...
{!qualified ? "לא כשיר/ה" : (assigned && <Icon name="check" size={10} strokeWidth={3} className="text-brand" />)}
```
Ring class when applicable to a whole selectable control: `!qualified ? "ring-hairline-strong bg-surface-sunken" : ...` — **never `ring-danger`** (D-09/QUAL-08 neutral-ring rule).

**Empty state pattern** (`src/components/GuardApp.jsx:189-198`):
```javascript
<EmptyState
  icon="inbox"
  title="אין לך משמרות מתוכננות"
  body={
    publishedAll.length === 0
      ? 'האחמ"ש עדיין לא פרסם את הסידור. ברגע שיפרסם — הוא יופיע כאן.'
      : "לא שובצת למשמרות בסידור שפורסם. אם זו טעות, פנה לאחמ״ש."
  }
/>
```
Copy this two-branch shape; substitute the exact strings from UI-SPEC's Copywriting Contract table ("השבוע עדיין ריק" / "אין לך כלום השבוע" etc.) — do not invent new empty-state phrasing.

**Merge pattern (single source, no second merge path)** (`src/components/supervisor/views.jsx:940-942`):
```javascript
const merged = withEngineTasks(shifts, tasks);
const history = merged.filter((s) => s.date < weekStart);
const planned = merged.filter((s) => s.date >= weekStart && s.date <= weekEnd);
```
`UnifiedBoard.jsx` must call `withEngineTasks` for eligible items + the new `boardShapeOf`-style adapter for timeless items, per day, timeless-first (RESEARCH.md §4 / UI-SPEC Layout contract) — never a second independent merge.

---

### `src/components/supervisor/WeekFlow.jsx` (modify — insert step 0)

**Analog:** itself, existing `STEP_OF` map and step array (`src/components/supervisor/WeekFlow.jsx:19-40`)

**Core pattern to copy/extend:**
```javascript
export const STEP_OF = {
  shifts: 0,
  availability: 1,
  smart: 2,
  assignment: 2,
  assign: 2,
  schedule: 3,
  publish: 3,
};
```
Every existing key's numeric value must shift +1 when the unified board becomes step 0; **grep the whole `src/` tree for `go("` and `STEP_OF` before editing** (RESEARCH.md Pitfall 3 — known consumers: `WeekFlow.jsx` itself, `SupervisorApp.jsx:170`, `startDemo()`'s `go("smart")` call).

**Import pattern** (`src/components/supervisor/WeekFlow.jsx:19-25`):
```javascript
import { useMemo, useState } from "react";
import { PrimaryAction, Segmented } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import SmartAssign from "../SmartAssign.jsx";
import { ShiftMgmt, AvailView, AssignView, ScheduleMgmt } from "./views.jsx";
import { availStatus } from "../../lib/autoAssign.js";
import { t } from "../../lib/terms.js";
```
Add `import UnifiedBoard from "./UnifiedBoard.jsx";` alongside the other step components — same wrapping convention documented in the file's own header comment ("השלבים עוטפים את הרכיבים הקיימים ולא משכתבים אותם").

---

### `src/components/GuardApp.jsx` — `MySchedule` (modify, CRUD-read/transform)

**Analog:** itself, existing `withTasks`/`teamAverages` fairness block (`src/components/GuardApp.jsx:130-163`) — this is the pattern to **extend**, not just reference, since RESEARCH.md confirmed it only feeds fairness numbers today, not the visible list.

**Current state to replace** (`src/components/GuardApp.jsx:132-136`):
```javascript
const mine = shifts
  .filter((s) => s.published && s.assignedGuards.includes(user.id))
  .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
```
Must become a call through the same merge (`withEngineTasks` + timeless adapter) `UnifiedBoard.jsx` uses, filtered to `user.id`, so manager and guard views can never disagree (Pattern 1 in RESEARCH.md: "Single merge function, two containers").

**Fairness block to keep unchanged** (`src/components/GuardApp.jsx:146-154`):
```javascript
const withTasks = useMemo(
  () => withEngineTasks(publishedAll, tasks),
  [publishedAll, tasks]
);
const { perGuard, avg } = useMemo(
  () => teamAverages(guards, withTasks),
  [guards, withTasks]
);
```
Do not touch this — it already works correctly for its narrow purpose.

**Imports already present** (`src/components/GuardApp.jsx:1-14`) — add the new `boardShapeOf`-style export from `dates.js` to this existing import block, no new import statement needed:
```javascript
import {
  addDays, availabilityDeadline, countdownHe, dayName, formatDateHe, fromISODate, rangeLabelHe,
  shiftInterval, shortDate, toISODate, todayISO, weekByOffset, withEngineTasks,
} from "../lib/dates.js";
```

---

### `src/components/supervisor/PositionsScreen.jsx` (modify — add BOARD-02 forward strip)

**Analog:** itself, existing POS-05 "who's working this week" pattern + `src/lib/positions.js` `plannedRowsForWeek`/`missingRowsForWeek`

**Imports pattern already present** (`src/components/supervisor/PositionsScreen.jsx:13-21`):
```javascript
import { useState } from "react";
import {
  Badge, Btn, Card, EmptyState, Field, IconBtn, Input, Modal, PageHeader, Segmented, Select,
} from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { DAYS_HE_SHORT } from "../../lib/dates.js";
import { t } from "../../lib/terms.js";
import { categoryOptions } from "./views.jsx";
import { qualifiedGuardsForPosition, workingGuardIdsForWeek } from "../../lib/positions.js";
```
Add `plannedRowsForWeek`, `missingRowsForWeek`, and `addDays`/`startOfWeek` (from `dates.js`) to these existing import lines.

**Core 4-week composition pattern** (RESEARCH.md `<board02_positions>`, illustrative but grounded in verified pure fns):
```javascript
import { addDays, startOfWeek } from "../../lib/dates.js";
import { plannedRowsForWeek } from "../../lib/positions.js";

const forwardWeeks = Array.from({ length: 4 }, (_, n) =>
  plannedRowsForWeek(position, addDays(startOfWeek(), n * 7))
);
```
Compose this the same way the existing POS-05 block calls `qualifiedGuardsForPosition`/`workingGuardIdsForWeek` with a single `sundayISO = weekDates[0]` today (`PositionsScreen.jsx:269-296`) — same call shape, just looped 4x.

**Existing card layout to extend (no horizontal carousel, sequential sections)** — reuse the `grid gap-4 sm:grid-cols-2` pattern already used for the two POS-05 lists inside `PositionCard` (per UI-SPEC "overflow" resolution for E2).

**"מתוכנן" badge for not-yet-realized rows** — same `Badge tone="neutral"` component already imported, just new copy `"מתוכנן"` (one word, per UI-SPEC Copywriting Contract) — no new Badge variant needed.

---

### `src/lib/terms.js` (modify — add nav/board copy keys)

**Analog:** itself — existing `nav.*` key pattern (civil/army split)

Search the file for the existing `nav.schedule`/`nav.availability` key definitions and add `nav.board`, `positions.forward`, `positions.planned` alongside them using the identical `{ civil: "...", army: "..." }` (or equivalent) shape already established — do not hardcode strings in components (CLAUDE.md: "אין מחרוזת ממשק קשיחה ברכיבים").

---

### `scripts/verify-board.mjs` (new test file, transform/pure-fn assertions)

**Analog:** `scripts/verify-positions.mjs` — the established one-pure-module-one-verify-script convention (confirmed by RESEARCH.md Validation Architecture section: "Framework: None — standalone Node ES-module scripts, `console.log(\"  ok ...\")`/`\"  FAIL ...\"`, non-zero exit on failure").

Read `scripts/verify-positions.mjs` directly before writing this file to copy its exact literal-fixture style (no shared fixture/conftest file exists in this codebase — each script is self-contained). Wire into `package.json`'s `"test"` script alongside the two/three existing `node scripts/verify-*.mjs` calls.

**Required assertions** (RESEARCH.md Phase Requirements → Test Map):
- Merge of eligible + timeless items totals `shifts.length + tasks.length` for a fixture week — no silent drop.
- Timeless items anchor to `dueDate || startDate`, never fabricate a time.

---

### `src/components/SupervisorApp.jsx` (modify — "calendar" tab decision)

**Analog:** itself, existing `Segmented(week=WeekCalendar.jsx | month=CalendarView.jsx)` block (`src/components/SupervisorApp.jsx:180-198` per RESEARCH.md citation)

UI-SPEC's Open Recommendation: repoint the week-mode `Segmented` option to render the same `UnifiedBoard` component (not delete it, not leave old `WeekCalendar.jsx` mounted unchanged). Read the exact `Segmented` usage at that line range before editing — reuse the same `Segmented` control pattern already imported from `ui.jsx` throughout the codebase (see `WeekFlow.jsx:20` for the same import).

---

## Shared Patterns

### Qualification lock (QUAL-08) — single source of truth
**Source:** `src/components/supervisor/views.jsx:1073-1189` (`AssignView`, canonical) and `src/components/supervisor/views.jsx:2083-2124` (`TaskMgmt` assignee chip, secondary confirmation)
**Apply to:** `UnifiedBoard.jsx` (both manager and guard containers), any per-assignee row rendering
```javascript
disabled={busy || !qualified}
className={... !qualified ? "ring-hairline-strong bg-surface-sunken" : ...}  // neutral, never ring-danger
{!qualified && <span className="... bg-surface text-muted"><Icon name="lock" size={11} /></span>}
{!qualified ? "לא כשיר/ה" : (assigned && <Icon name="check" ... />)}
```
Call `isQualified(guard, item.category)` (`src/lib/autoAssign.js:124-129`) directly at render time — never cache or re-derive:
```javascript
export function isQualified(guard, category) {
  if (!category) return true;
  const list = guard?.qualifiedCategories;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(category);
}
```

### Merge (shifts + engine-eligible tasks) — single path
**Source:** `src/lib/dates.js:266-270` (`withEngineTasks`)
**Apply to:** `UnifiedBoard.jsx`, `GuardApp.jsx`'s `MySchedule`, any future merge site — never a second implementation.

### Empty state — worded invitation, not warning
**Source:** `src/components/GuardApp.jsx:189-198` (`EmptyState` two-branch pattern), `src/components/ui.jsx` `EmptyState` primitive
**Apply to:** `UnifiedBoard.jsx` (manager + guard variants), `PositionsScreen.jsx` per-week forecast empty state.

### Terms/i18n — no hardcoded UI strings
**Source:** `src/lib/terms.js` `t()` function, existing `nav.*` key convention
**Apply to:** all new nav labels and empty-state copy introduced by this phase.

## No Analog Found

None — every file in scope has a direct or composite analog already in the codebase (this phase is explicitly UI-composition over existing pure functions, per RESEARCH.md's own framing: "not a new technology phase").

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/components/supervisor/`, `scripts/`
**Files scanned:** `src/lib/dates.js`, `src/lib/positions.js`, `src/lib/autoAssign.js`, `src/lib/terms.js`, `src/components/GuardApp.jsx`, `src/components/supervisor/WeekFlow.jsx`, `src/components/supervisor/WeekCalendar.jsx`, `src/components/supervisor/views.jsx` (`TaskRow`, `AssignView`), `src/components/supervisor/PositionsScreen.jsx`
**Pattern extraction date:** 2026-09-02
