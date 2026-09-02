---
phase: 05-unified-board
plan: 01
subsystem: ui
tags: [react, dates, unified-merge, tailwind, node-verify]

requires:
  - phase: 02-unified-scheduling
    provides: withEngineTasks / taskAsShiftShape / isTaskEngineEligible — the engine-eligible merge boardShapeOf sits beside
  - phase: 04-standing-positions
    provides: the dueDate-anchoring idiom (task.dueDate || task.startDate) already used by positions.js
provides:
  - rangeTextHe/boardShapeOf/boardItemsForDates in src/lib/dates.js — the display-only siblings of taskAsShiftShape that never silently drop a frozen/multi-day/weekly-position item
  - UnifiedBoard.jsx — the one read-only board component, mounted as WeekFlow's first step, reusable by the guard side (05-02) via scopeGuardId
  - scripts/verify-board.mjs wired into npm test — asserts merge-completeness and determinism as a hard test, not a spot check
affects: [05-02-guard-board, 05-03-board-qualification, 05-04-position-board-and-calendar-tab]

actuals:
  tokens: 7753
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "boardItemsForDates(shifts, tasks, dates) is the single board merge — never a week offset, always an explicit date list, so the same function serves the manager's current week and the guard's own date list without either reading the wall clock"
    - "Board row surface is bg-surface-sunken + ring-hairline (ring-warn only on a coverage shortfall), with a small shiftTone() colour dot carrying the time-of-day scale — never a task/shift-distinguishing colour (D-12)"

key-files:
  created:
    - src/components/supervisor/UnifiedBoard.jsx
    - scripts/verify-board.mjs
  modified:
    - src/lib/dates.js
    - src/lib/terms.js
    - package.json
    - src/components/supervisor/WeekFlow.jsx
    - src/components/supervisor/views.jsx

key-decisions:
  - "P-02: rangeTextHe lives in dates.js with formatting byte-identical to the old private rangeText in views.jsx; the private copy is now deleted and views.jsx delegates to the shared function (Task 2)."
  - "P-03: board row surface is bg-surface-sunken/ring-hairline, not a shiftTone-coloured card — the colour dot alone carries the time-of-day scale, keeping --brand off items and satisfying D-12 structurally."
  - "P-05: boardItemsForDates takes an explicit `dates` array, never a week offset — the function stays pure and reusable by the guard side in 05-02."
  - "A1 (RESEARCH.md assumption, adopted): timeless items sort before timed items within a day, like an all-day-event convention."

patterns-established:
  - "Display-only adapter beside an engine adapter: boardShapeOf is gated on isTaskEngineEligible so the board can never disagree with the engine about what counts as in-engine, and never fabricates startTime/endTime."
  - "One merge function, two containers: UnifiedBoard accepts scopeGuardId so the identical component (not a second implementation) will serve GuardApp in 05-02."

requirements-completed: [BOARD-01, BOARD-04]

coverage:
  - id: D1
    description: "boardItemsForDates merges shifts + engine-eligible tasks + timeless items (frozen/multi-day/weekly-position) with zero silent drop, asserted as a hard accounting total, not a spot check"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "scripts/verify-board.mjs (17 assertions, including the accounting total, timeless anchoring via `in` operator, determinism across shuffled input)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unified board renders as WeekFlow step 0 — the first thing a manager sees on \"השבוע\", before any other step (D-04)"
    requirement: "BOARD-04"
    verification:
      - kind: other
        ref: "grep -c \"board: 0\"/\"shifts: 1\" WeekFlow.jsx (STEP_OF re-indexed) + grep -c UnifiedBoard WeekFlow.jsx (mounted as body[0])"
        status: pass
    human_judgment: true
    rationale: "No browser session available to this parallel worktree agent to visually confirm first-paint position. Source-level verification (STEP_OF re-indexing, body array order, npm run build) passed; the live-browser walkthrough in the plan's Task 2 <human-check> block (6 steps) was not run — see 'Not Verified' section below."
  - id: D3
    description: "Timeless items (frozen/multi-day/weekly-position) show the verbatim \"מחוץ למנוע\" badge and a date range, never a fabricated clock time"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "scripts/verify-board.mjs (`in` operator assertions that startTime/endTime keys are absent on a timeless item)"
        status: pass
    human_judgment: true
    rationale: "The underlying data contract is unit-tested and passing, but the actual JSX rendering (badge + calendar icon + rangeTextHe, no clock icon) has not been visually confirmed in a running browser."
  - id: D4
    description: "Under-staffed shift row shows the alert icon, \"חסרים N\" text, and a warn ring — three channels, never colour alone"
    requirement: "BOARD-04"
    verification:
      - kind: other
        ref: "grep -c ring-warn/alert UnifiedBoard.jsx (both present); code reading confirms a fully-staffed row renders no coverage element"
        status: pass
    human_judgment: true
    rationale: "Structural presence of the three signals is confirmed by source reading and grep; visual correctness (actual ring colour, icon rendering, layout) needs a live browser check not available in this session."
  - id: D5
    description: "A week with nothing in it reads as a worded invitation (D-15), never a warning or error"
    requirement: "BOARD-04"
    verification: []
    human_judgment: true
    rationale: "EmptyState is used with the exact copy from UI-SPEC (never Alert/danger/warn), confirmed by source reading only — not visually confirmed in a browser."
  - id: D6
    description: "Seed-demo (\"בנה לי הדגמה\") still lands on the smart-assign step after the STEP_OF re-index, not on shift building (Pitfall 3 regression)"
    requirement: "BOARD-04"
    verification:
      - kind: other
        ref: "manual code review: STEP_OF.smart=3 aligns with body[3] (the assign/SmartAssign element); SupervisorApp.jsx's startDemo()/go(\"smart\") reads STEP_OF dynamically and required no edit"
        status: pass
    human_judgment: true
    rationale: "Verified by reading SupervisorApp.jsx and WeekFlow.jsx index alignment, not by clicking the seed-demo button in a running app."

duration: ~55min
completed: 2026-09-02
status: complete
---

# Phase 5 Plan 1: Unified Board Merge Engine + First WeekFlow Step Summary

**`boardItemsForDates` (src/lib/dates.js) merges shifts, engine-eligible tasks, and engine-ineligible (frozen/multi-day/weekly-position) items into one day-grouped, timeless-first list with a hard completeness guarantee, rendered by the new `UnifiedBoard.jsx` as step 0 of "השבוע."**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-02T12:42:27Z (per STATE.md session start)
- **Completed:** 2026-09-02T12:59:55Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `boardShapeOf`/`boardItemsForDates`/`rangeTextHe` added to `src/lib/dates.js` as the display-only siblings of `taskAsShiftShape` — engine-ineligible items (no hours, multi-day, weekly-shape standing positions) are now anchored to `dueDate || startDate` and surfaced instead of silently dropped.
- `scripts/verify-board.mjs` (17 assertions) proves merge completeness (`shifts.length + tasks.length` accounted for exactly), timeless anchoring (`in` operator, no fabricated `startTime`/`endTime`), and determinism across shuffled input — wired into `npm test`.
- `UnifiedBoard.jsx` — new read-only component, day-grouped, timeless-first-then-by-time, with an under-staffed-row coverage indicator (icon + text + warn ring) and a single week-level shortfall line.
- `WeekFlow.jsx` mounts `UnifiedBoard` as step 0; `STEP_OF` re-indexed (+1 for every prior key) after grepping every `go("...")`/`STEP_OF` consumer in `src/` to avoid the seed-demo regression (Pitfall 3).
- `views.jsx`'s private `rangeText` collapsed into the shared `rangeTextHe` — the task list and the board can no longer print two different date-range sentences for the same task; `People` (avatar stack) exported for reuse by the board.

## Task Commits

1. **Task 1: הלוח המאוחד מקצה לקצה — מנוע המיזוג, הבדיקה, והמסך שהמנהל רואה ראשון** - `d9a510d` (feat)
2. **Task 2: איוש חסר, ניסוח אחד לטווח תאריכים, וצפיפות שמסבירה את עצמה** - `255ea25` (feat)

_Task 1 is a `type="tracer"` task; per the tracer feedback gate, `node scripts/verify-board.mjs`, `npm test`, and `npm run build` were all re-run and confirmed green immediately after the Task 1 commit, before starting Task 2._

## Files Created/Modified

- `src/lib/dates.js` - `rangeTextHe`/`boardShapeOf`/`boardItemsForDates` appended after `withEngineTasks`
- `scripts/verify-board.mjs` - new pure-function test script (17 assertions), wired into `npm test`
- `src/components/supervisor/UnifiedBoard.jsx` - new read-only board component (default export)
- `src/components/supervisor/WeekFlow.jsx` - `UnifiedBoard` mounted as step 0, `STEP_OF`/`meta`/`body`/`action` re-indexed
- `src/components/supervisor/views.jsx` - `People` exported; private `rangeText` deleted, delegates to `rangeTextHe`
- `src/lib/terms.js` - `nav.board`, `positions.forward`, `positions.planned` keys (BASE + army override for `nav.board`)
- `package.json` - `test` script now runs `verify-board.mjs` as a fourth step

## Decisions Made

- P-02/P-03/P-05 (recorded in the plan's `<planner_decisions>`) implemented as specified — see `key-decisions` in frontmatter.
- A1 (RESEARCH.md assumption — timeless items sort before timed items within a day) adopted as the contract, matching UI-SPEC's Layout & Interaction Contract.
- Split the coverage-indicator/density work (originally drafted in one pass) into its own Task 2 commit rather than folding it into Task 1's `UnifiedBoard.jsx`, to keep each task's commit scoped to exactly what its own `<action>`/`<verify>` block describes.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; no architectural questions arose.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Not Verified (browser UAT)

This is a parallel worktree executor with no browser/preview tool available in this session. Per CLAUDE.md's own iron rule 6 ("מה שלא נבדק מדווח כלא נבדק"), the following items from Task 2's `<human-check>` block were **not run** and must be confirmed in a real browser before this plan is considered fully verified:

1. "השבוע" opens on the unified board — the board is the first thing visible, not a step to find.
2. Every shift and every task for the visible week is on the board, matching the "משימות" screen count.
3. A task with no hours, and a task spanning more than one day, each show the "מחוץ למנוע" badge and a date range — no clock time.
4. An under-staffed shift row shows the alert icon, "חסרים N", and a warn ring — all three, not the ring alone.
5. Clearing the week to empty produces the worded invitation, not a warning/error banner.
6. Pressing the seed-demo button still lands on the smart-assign step, not shift building.

Automated coverage for the *data* underlying items 2-4 exists and passes (`scripts/verify-board.mjs`); automated coverage for item 6's *index alignment* exists via source reading (see D6 rationale). None of the six is a live-pixel confirmation. Recorded in `.planning/WINDOWS.md` as `unrun-verify` entries.

## Next Phase Readiness

- `boardItemsForDates`/`boardShapeOf` and `UnifiedBoard` (with its already-wired `scopeGuardId` prop) are ready for 05-02 to mount the identical component inside `GuardApp.jsx`'s `MySchedule` — no second merge path needed.
- Per-assignee QUAL-08 qualification-lock rendering (BOARD-03) was intentionally out of scope for this plan (not present in `05-01-PLAN.md`'s tasks) and is expected in a later 05-0x plan.
- The live browser UAT walkthrough (six items above) should be run before the phase is signed off — recommend a human (or a future agent with browser access) run it against `npm run dev` on port 3000.

## Self-Check: PASSED

- FOUND: src/lib/dates.js, src/lib/terms.js, package.json, src/components/supervisor/WeekFlow.jsx, src/components/supervisor/views.jsx, src/components/supervisor/UnifiedBoard.jsx, scripts/verify-board.mjs, .planning/phases/05-unified-board/05-01-SUMMARY.md
- FOUND commit d9a510d (Task 1)
- FOUND commit 255ea25 (Task 2)
- `node scripts/verify-board.mjs`, `npm test` (4 scripts), and `npm run build` all re-confirmed green immediately before writing this summary.

---
*Phase: 05-unified-board*
*Completed: 2026-09-02*
