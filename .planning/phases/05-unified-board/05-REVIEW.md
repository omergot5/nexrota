---
phase: 05-unified-board
reviewed: 2026-09-03T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/components/supervisor/UnifiedBoard.jsx
  - scripts/verify-board.mjs
  - scripts/verify-positions.mjs
  - src/components/GuardApp.jsx
  - src/components/SupervisorApp.jsx
  - src/components/supervisor/PositionsScreen.jsx
  - src/components/supervisor/WeekFlow.jsx
  - src/components/supervisor/views.jsx
  - src/lib/dates.js
  - src/lib/terms.js
  - package.json
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-09-03
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The core of this phase — the pure merge function `boardItemsForDates` (and its
siblings `boardShapeOf`/`rangeTextHe`) in `src/lib/dates.js` — is solid. It is
well-covered by `scripts/verify-board.mjs` and the BOARD-02 additions to
`scripts/verify-positions.mjs`, both of which pass (`npm test` was run end to
end and all four suites report `PASS`). The mutual-exclusion invariant between
`taskAsShiftShape` (engine) and `boardShapeOf` (display) is real and tested,
determinism holds under shuffled input, and `UnifiedBoard.jsx` itself is
read-only as documented (no `actions` calls, no writes).

The one correctness bug worth blocking on is in the *integration* code, not
the pure engine: `GuardApp.jsx`'s "team schedule" card computes its `dates`
prop from shift dates only, so any day that only has a task on it silently
disappears from that view — and the whole card doesn't render at all if no
shifts are published yet, even when tasks exist. This directly contradicts
the phase's own stated goal (a board that merges shifts and tasks without
ever silently dropping one of them) in the one place that goal wasn't
mechanically enforced by `boardItemsForDates` itself.

Two secondary issues: `UnifiedBoard.jsx`'s default empty-state copy hardcodes
Hebrew vocabulary that is supposed to route through `terms.js` (and quotes a
button label that doesn't match the real string), and `GuardApp.jsx` carries
two unused imports left over from refactoring.

## Critical Issues

### CR-01: GuardApp's "team schedule" card silently drops task-only days (and disappears entirely when no shifts exist)

**File:** `src/components/GuardApp.jsx:238-251`

**Issue:** The card titled "הסידור המלא של הצוות" ("the team's full
schedule") passes `tasks={tasks}` to `UnifiedBoard`, but computes its `dates`
prop from shift dates alone:

```jsx
<UnifiedBoard
  shifts={publishedAll}
  tasks={tasks}
  guards={guards}
  dates={[...new Set(publishedAll.map((s) => s.date))].sort()}
/>
```

Any date that only has a task anchored to it (no shift that day) is not in
this `dates` set. `boardItemsForDates` correctly counts that task's item as
`outside` (nothing crashes and nothing is dropped from the *count*), but
since the caller's `dates` array never contained that date to begin with,
`UnifiedBoard` never renders a `DayGroup` for it — the task is invisible to
every guard on the team, on a screen explicitly named "the full schedule."

This is compounded by the card's gating condition, three lines up:
`{publishedAll.length > 0 && (<Card>...)}`. Tasks in this app deliberately
carry no `published` flag (per the comment at line 145-149 in this same
file) — they are "work that exists," not a draft waiting for publish. So a
team that has tasks but zero published shifts sees no "team schedule" card
at all, even though it has real, visible-to-the-engine work items.

Note this is a real regression risk introduced specifically by this phase:
the *personal* board 30 lines above (`myDates`, lines 165-170) gets this
exactly right —

```jsx
const myDates = [...new Set([
    ...publishedAll.map((s) => s.date),
    ...tasks.map((t) => t.dueDate || t.startDate).filter(Boolean),
  ])]
    .filter((d) => d >= today)
    .sort();
```

— so the correct pattern already exists in the file; the team-wide card
simply doesn't reuse it.

**Fix:** Build the team-wide card's `dates` the same way `myDates` is built
(shift dates ∪ task anchor dates), and drop the `publishedAll.length > 0`
gate in favor of checking whether there's anything to show at all:

```jsx
const teamDates = [...new Set([
  ...publishedAll.map((s) => s.date),
  ...tasks.map((t) => t.dueDate || t.startDate).filter(Boolean),
])].sort();

{teamDates.length > 0 && (
  <Card>
    ...
    <UnifiedBoard
      shifts={publishedAll}
      tasks={tasks}
      guards={guards}
      dates={teamDates}
    />
  </Card>
)}
```

## Warnings

### WR-01: UnifiedBoard's default empty-state text bypasses terms.js and quotes a stale button label

**File:** `src/components/supervisor/UnifiedBoard.jsx:69-77`

**Issue:** When no `empty` prop is supplied (both call sites that hit this
path — `WeekFlow.jsx`'s board step and `SupervisorApp.jsx`'s calendar week
view — omit it), the fallback body text is a hardcoded literal:

```jsx
body={
  empty?.body ||
  "בנה משמרות או משימות, והלוח ייבנה מעצמו — או תתחיל מ'תסדר לי את השבוע'."
}
```

Two problems with this one string:

1. `"משמרות"` is hardcoded rather than routed through `terms.js`. Per
   CLAUDE.md, `terms.js` is supposed to be the sole source of vocabulary
   that changes with `gs_teams.mode` — and `"unit.shifts"` is literally one
   of the terms the `army` profile overrides (`"משמרות"` → `"תורנויות"`).
   An army-profile team sees `"בנה משמרות"` here regardless of profile,
   while every other screen that names this same concept (`nav.shifts`,
   `unit.shifts`) correctly flips per-profile.
2. The quoted phrase `'תסדר לי את השבוע'` does not match the actual button
   label. The real term (`t("nav.smart")`) is `"סדר לי את השבוע"` (civil)
   or `"בנה לי סד\"כ"` (army) — neither of which is `"תסדר לי את השבוע"`.
   The quote is stale/mistyped and, being hardcoded, can never track the
   real label if it changes.

**Fix:** Build the fallback copy from `t()` instead of a literal, e.g.:

```jsx
import { t } from "../../lib/terms.js";
...
body: empty?.body ||
  `בנה ${t("unit.shifts")} או משימות, והלוח ייבנה מעצמו — או תתחיל מ"${t("nav.smart")}".`
```

### WR-02: Unused imports in GuardApp.jsx

**File:** `src/components/GuardApp.jsx:9`

**Issue:** `addDays` and `fromISODate` are imported from `../lib/dates.js`
but never referenced anywhere in the file (verified via full-file grep —
each identifier appears exactly once, on the import line itself).

**Fix:** Remove both from the import list:

```jsx
import {
  availabilityDeadline, boardItemsForDates, countdownHe, dayName, formatDateHe,
  rangeLabelHe, shiftInterval, shortDate, toISODate, todayISO, weekByOffset,
  withEngineTasks,
} from "../lib/dates.js";
```

## Info

### IN-01: Redundant double-guard in `missingOfItem`

**File:** `src/components/supervisor/UnifiedBoard.jsx:47-50`

**Issue:** `Math.max(1, item.requiredGuards || 1)` is redundant: `x || 1`
already turns `0`/`undefined`/`null` into `1`, so wrapping it in
`Math.max(1, ...)` can never change the result. Harmless, but reads as if it
guards against a case (negative `requiredGuards`) it doesn't actually guard
against.

**Fix:** Either drop the outer `Math.max` if `x || 1` is sufficient, or (if
negative values are a real concern from the data layer) guard against them
explicitly: `Math.max(1, Number(item.requiredGuards) || 1)`.

---

_Reviewed: 2026-09-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
