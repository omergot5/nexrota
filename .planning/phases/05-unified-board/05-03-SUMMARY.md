---
phase: 05-unified-board
plan: 03
subsystem: ui
tags: [react, positions, forecast, pure-functions]

# Dependency graph
requires:
  - phase: 04-standing-positions
    provides: "positions.js pure module (expectedDatesForWeek, plannedRowsForWeek, missingRowsForWeek) and PositionsScreen.jsx's PositionCard with POS-05 lists"
  - phase: 05-unified-board (05-01)
    provides: "terms.js keys positions.forward / positions.planned added by the phase's tracer plan"
provides:
  - "BOARD-02: every standing position shows its schedule running forward across the next four weeks on its own card, for both position shapes, read-only"
  - "scripts/verify-positions.mjs BOARD-02 section — locks the four-week forward projection contract (disjoint identity dates, shape invariants, determinism, realized/planned separation, no clock dependency)"
affects: []

# Actuals (#2632)
actuals:
  tokens: 3700
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forward projection via repeated calls to an existing pure function (plannedRowsForWeek × 4, different sundayISO each time) rather than extending the pure module"
    - "Realized-vs-planned status derived at render time from missingRowsForWeek's identity-date set, never stored"

key-files:
  created: []
  modified:
    - scripts/verify-positions.mjs
    - src/components/supervisor/PositionsScreen.jsx

key-decisions:
  - "No extension to positions.js — the forecast is pure composition over plannedRowsForWeek/missingRowsForWeek, called 4x with Sundays at n*7 day offsets (per RESEARCH.md <board02_positions> and the plan's own planner_decisions)"
  - "Icon and hour-vs-range display in ForecastRow branch on the row's own data shape (presence of row.date vs row.startDate/dueDate), never on position.shape — satisfies D-06's 'no shape-specific visual branch'"
  - "Current-vs-future week is distinguished by wording (השבוע / השבוע הבא / בעוד N שבועות), not by colour alone"

patterns-established:
  - "ForecastRow: one shared row component for two position shapes, non-interactive when realized, a button routing to the card's existing onEdit when not-yet-realized — no assign/toggle/disable affordance anywhere in the section"

requirements-completed: [BOARD-02]

coverage:
  - id: D1
    description: "verify-positions.mjs BOARD-02 section proves the four-week forward projection contract (disjoint identity dates, shape invariants across weeks, determinism, realized/planned separation, no wall-clock dependency)"
    requirement: "BOARD-02"
    verification:
      - kind: unit
        ref: "node scripts/verify-positions.mjs (BOARD-02 section, 13 checks)"
        status: pass
      - kind: unit
        ref: "npm test (full suite)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PositionCard renders a 4-week forward forecast per position, one shared row template for both shapes, not-yet-realized rows carry the planned badge and route to onEdit only, realized rows are non-interactive, empty weeks show a muted line — verified visually in the browser"
    requirement: "BOARD-02"
    verification: []
    human_judgment: true
    rationale: "This plan's own <verify> block specifies a <human-check> browser walkthrough (dev server, sign in as supervisor, open positions, inspect both position shapes across 4 weeks). No browser/preview tool was available in this executor's toolset — only node/build automation ran. The 6-point browser checklist from the plan is copied into 'User Setup Required' below for the user to run."
---

# Phase 05 Plan 03: Position Forward Forecast Summary

**Four-week forward schedule per standing position, both shapes through one read-only row template, composed entirely over existing `positions.js` pure functions**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-02T19:18:40Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- `scripts/verify-positions.mjs` gained a BOARD-02 section (13 checks) that locks the four-week forward projection contract for both position shapes before any UI was built — disjoint identity dates across weeks, hours/null-time invariants surviving all four weeks, determinism under repeated builds and shuffled `weekdays` input, realized-vs-planned separation via `missingRowsForWeek`, and no wall-clock dependency.
- `PositionCard` (`PositionsScreen.jsx`) now renders a forward forecast section below the existing POS-05 lists: four sequential week groups, each computed by calling `plannedRowsForWeek`/`missingRowsForWeek` with Sundays at `n*7` day offsets from the card's `weekDates[0]`.
- One shared `ForecastRow` component serves both position shapes — the row's own data (a `date` + hours for `template`, a `startDate`/`dueDate` span with no hours for `weekly`) drives the display, never a branch on `position.shape`.
- Not-yet-realized rows carry the `t("positions.planned")` badge (with an explanatory `title`) and are the only interactive element in the section — their `onClick` calls the card's existing `onEdit`, nothing else. Realized rows render as plain, non-interactive rows. Empty forecast weeks show a muted line, never a warning.
- `positions.js` remains byte-identical to what Phase 4 shipped — confirmed via `git diff --stat` after both tasks.

## Task Commits

Each task was committed atomically:

1. **Task 1: לפני המסך — לנעול את חוזה ארבעת השבועות בבדיקה** - `e76a64b` (test)
2. **Task 2: תחזית ארבעה שבועות בכרטיס העמדה** - `93ee14e` (feat)

**Plan metadata:** this SUMMARY's own commit (docs)

## Files Created/Modified
- `scripts/verify-positions.mjs` — added BOARD-02 section: four-week forward projection assertions for both position shapes
- `src/components/supervisor/PositionsScreen.jsx` — added forward-forecast section to `PositionCard`, plus `forwardWeekLabel` and `ForecastRow` helpers

## Decisions Made
- No extension to `positions.js` — reused `plannedRowsForWeek`/`missingRowsForWeek` unchanged, called 4x. Verified with `git diff --stat src/lib/positions.js` returning empty after both tasks.
- "Realized" is derived per row at render time (`!missingDates.has(row.date || row.dueDate)`), never stored or computed with a second comparison rule — matches the exact expression `missingRowsForWeek` itself uses internally.
- Current-week distinction ("השבוע" vs "השבוע הבא" vs "בעוד N שבועות") uses wording, not colour, per the UI-SPEC Layout Contract's "today distinguishable by wording rather than by colour alone."
- Icon for the forecast section heading: `trending` (represents forward projection) — distinct from the `key`/`calendar` icons already used by the two POS-05 list headings on the same card.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- A naming collision surfaced when running the new BOARD-02 test section: the existing POS-04 section already declares a `missingWithOtherPosition` const at module scope, and ES modules don't allow re-declaration. Renamed the new BOARD-02 variable to `forwardMissingWithOtherPosition`. This is a same-task, same-commit fix (not a deviation against the plan's own rules — it's a mechanical naming fix within Task 1, verified immediately by re-running `node scripts/verify-positions.mjs`).

## User Setup Required

None - no external service configuration required.

**Browser verification not performed by this executor** — no browser/preview tool was available in this session's toolset (only Bash/node was available for `npm test` and `npm run build`). Per this plan's own `<human-check>` block, please verify in the browser before considering BOARD-02 fully signed off:

1. Start the dev server (`npm run dev`, port 3000), sign in as a supervisor, open "עוד" → "עמדות קבועות" and confirm:
2. A template position with weekdays selected shows four week sections in chronological order — the current week's rows already realized (no extra badge) and the next three weeks' rows carrying "מתוכנן".
3. A weekly-shape position shows exactly one row per week for four weeks, spanning the week, with no hours printed anywhere.
4. Both shapes render through visibly the same row layout — no different icon family, colour or card style for one shape versus the other.
5. Tapping a "מתוכנן" row opens the position's own edit dialog and nothing else. Nothing anywhere in the forecast section can assign, unassign, disable or delete.
6. A deactivated position, or a template position whose weekdays miss a week, shows the muted "אין שורות מתוכננות השבוע הזה" line — muted, not a warning.
7. The four weeks stack vertically inside the card; there is no horizontal scroll or carousel.

## Next Phase Readiness
- BOARD-02 is functionally complete and automation-verified (`npm test`, `npm run build` both green); browser sign-off is the one open item, listed above.
- No blockers for sibling plan 05-02 (UnifiedBoard.jsx / GuardApp.jsx) — this plan touched only `scripts/verify-positions.mjs` and `src/components/supervisor/PositionsScreen.jsx`, no overlap.

---
*Phase: 05-unified-board*
*Completed: 2026-09-02*
