---
phase: 08-weekbuild-status
plan: 03
subsystem: ui
tags: [react, tailwind, resource-grid, accessibility]

requires:
  - phase: 06-resource-view-pattern
    provides: ResourceGrid.jsx shared row=position/col=day pivot component, buildResourceRows
provides:
  - "ResourceGrid.jsx: optional onRowClick prop, backward-compatible, turns a clickable row's position label into an accessible <button>"
  - "RosterWizard.jsx: focused single-position weekly view reusing ResourceGrid (WEEKBUILD-05)"
  - "RosterWizard.jsx: draft/materialized toggle hiding pendingRows in the display panel (WEEKBUILD-04)"
affects: [08-weekbuild-status remaining plans, any future consumer of ResourceGrid]

actuals:
  tokens: 2335
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Optional callback prop on a shared component gated per-row (row.pending !== true) so one caller can opt into interactivity without affecting other callers"
    - "Derived-not-snapshotted focus state: focusedRow computed from allRows on every render instead of stored in state at click time"

key-files:
  created: []
  modified:
    - src/components/supervisor/ResourceGrid.jsx
    - src/components/supervisor/RosterWizard.jsx

key-decisions:
  - "onRowClick gating checked twice: typeof onRowClick === 'function' AND row.pending !== true — ghost/draft rows are never clickable even when the caller supplies the handler"
  - "focusedRow is derived from allRows every render (not stored as a row snapshot) so the focused view stays live if the underlying schedule changes while open"
  - "hideDrafts only affects the unfocused branch's visibleRows; the focused branch is untouched by construction (a pending row can never become focusedRow, since onRowClick never fires on it)"
  - "Toggle button label uses the exact ROADMAP.md Success Criteria #4 phrase 'מה שיש עד עכשיו' for grep-back traceability to the requirement"

requirements-completed: [WEEKBUILD-04, WEEKBUILD-05]

coverage:
  - id: D1
    description: "Clicking a position label in RosterWizard's display panel opens a focused single-position weekly view built on the same ResourceGrid, with a visible way back"
    requirement: "WEEKBUILD-05"
    verification:
      - kind: unit
        ref: "node -e assertion script checking onRowClick prop, pending-row exclusion, real <button>, aria-label, focusedKey/focusedRow/rows={[focusedRow]} wiring — see plan 08-03 <automated> verify block"
        status: pass
    human_judgment: true
    rationale: "Plan mandates a live-browser human-check (mouse hover, keyboard-only Tab/Enter navigation, visual focused-view rendering) that this execution environment has no browser/preview tool to perform — automated static checks pass but the actual click/keyboard/visual behavior is unverified live."
  - id: D2
    description: "ResourceView.jsx and CalendarView.jsx are unaffected — onRowClick is optional and they never pass it"
    requirement: "WEEKBUILD-05"
    verification:
      - kind: unit
        ref: "node -e assertion scanning ResourceView.jsx and CalendarView.jsx source for onRowClick — both absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "A dedicated toggle in the display panel hides pendingRows (draft-in-progress ghost row), showing only materialized rows; toggling back restores the draft row"
    requirement: "WEEKBUILD-04"
    verification:
      - kind: unit
        ref: "node -e assertion script checking hideDrafts/setHideDrafts/visibleRows/aria-pressed/button label text and rows={visibleRows} wiring — see plan 08-03 <automated> verify block"
        status: pass
    human_judgment: true
    rationale: "Plan mandates a live-browser human-check (toggle click, label text swap, draft row appearing/disappearing, interaction with Task 1's focused view, toggle state surviving a focus/unfocus round-trip) that this execution environment has no browser/preview tool to perform."

duration: unknown (single continuous execution session)
completed: 2026-09-22
status: complete
---

# Phase 8 Plan 3: Focused Position View + Draft Toggle Summary

**Optional `onRowClick` on the shared `ResourceGrid` powers a new single-position focused weekly view, plus a "מה שיש עד עכשיו" toggle that hides the in-progress draft row — both scoped entirely inside `RosterWizard.jsx`'s display panel.**

## Performance

- **Duration:** unknown (executed as a single continuous session; no wall-clock start captured)
- **Completed:** 2026-09-22T12:28:14Z
- **Tasks:** 2/2 completed
- **Files modified:** 2 (`ResourceGrid.jsx`, `RosterWizard.jsx`)

## Accomplishments

- `ResourceGrid.jsx` accepts an optional `onRowClick(row)` prop. When supplied and the row is not a pending/ghost row (`row.pending !== true`), the position-label `<div>` is replaced with a real `<button type="button">` — native keyboard focusability, with an `aria-label` describing the action and naming the category. Ghost rows never become clickable regardless of the prop. Both other consumers (`ResourceView.jsx`, `CalendarView.jsx`) do not pass the prop and are byte-unchanged in behavior — confirmed by diff stat (`git diff a5f49f6 HEAD --stat` touches only `ResourceGrid.jsx` and `RosterWizard.jsx`).
- `RosterWizard.jsx` gained `focusedKey`/`focusedRow` state (WEEKBUILD-05). `focusedRow` is re-derived from `allRows` on every render rather than snapshotted at click time, so the focused view stays live if the schedule changes while open. When focused, the display card renders `<ResourceGrid rows={[focusedRow]} .../>` (same component, single-row array) with the card title switching to `"{category} · תצוגה ממוקדת"` and a `Btn` "חזרה לכל העמדות" (variant="ghost", icon="x") to return to the general view.
- `RosterWizard.jsx` gained `hideDrafts` state and `visibleRows = hideDrafts ? rows : allRows` (WEEKBUILD-04), scoped strictly to the unfocused branch of the display panel. A toggle button reads exactly `"מה שיש עד עכשיו"` (off state, matches ROADMAP.md Success Criteria #4 wording verbatim) / `"הצג גם טיוטה"` (on state), exposes `aria-pressed={hideDrafts}`. The focused branch is structurally unaffected — a pending/ghost row can never become `focusedRow` because it's never clickable in the first place (Task 1's `clickable` gate).
- `WeekFlow.jsx` and the board step were never touched — verified by diff stat showing zero changes outside the two target files, matching the explicit out-of-scope note in `08-CONTEXT.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: תצוגה ממוקדת לעמדה בודדת — onRowClick ב-ResourceGrid, ומיקוד ב-RosterWizard** - `be36e73` (feat)
2. **Task 2: טוגל "מה שיש עד עכשיו" — הסתרת שורת-הטיוטה בתצוגה הכללית** - `19c8986` (feat)

_No plan-metadata commit yet — this SUMMARY and STATE.md updates are committed separately per the executor protocol._

## Files Created/Modified

- `src/components/supervisor/ResourceGrid.jsx` - Added optional `onRowClick` prop; clickable rows (non-pending, when handler supplied) render an accessible `<button>` in place of the position-label `<div>`; all other rendering paths byte-identical to before.
- `src/components/supervisor/RosterWizard.jsx` - Added `focusedKey`/`focusedRow` state and conditional rendering for the focused single-position view (WEEKBUILD-05); added `hideDrafts`/`visibleRows` state and toggle button for the draft-hiding view (WEEKBUILD-04). Display-panel Card block (`<Card className="p-4 overflow-hidden">`) restructured into three render branches: focused / empty-unfocused / general-unfocused.

## Decisions Made

- Kept the two capabilities (WEEKBUILD-04, WEEKBUILD-05) in a single plan/commit set as the plan specified, since both live in the exact same JSX block and a split would have caused merge conflicts on the same lines. Committed as two separate atomic task commits within that single plan, per task boundaries.
- `visibleRows` passed to the general `<ResourceGrid onRowClick=.../>` (not `allRows`), so when the draft toggle is active a pending row is excluded from being clickable/focusable at the source — no separate guard needed beyond the existing `row.pending !== true` check already in `ResourceGrid.jsx`.
- Used the existing `Btn` component (`variant="ghost"`, `size="sm"`) for both the "back to all positions" and the draft-toggle buttons, matching existing UI conventions in the file rather than introducing new button styling.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched the plan's file/line references precisely (verified `allRows` at line 363 and the Card block at lines 431-442 in the pre-edit file, matching the plan's `<read_first>` pointers).

## Issues Encountered

**Browser/live verification not performed.** This execution environment (a spawned GSD executor subagent in a git worktree) has no browser automation or preview-server tool available — only Read/Write/Edit/Bash/Grep/Glob/Skill. The plan's `<human-check>` verification blocks for both Task 1 (mouse hover, keyboard-only Tab/Enter navigation into the focused view, "back to all positions" round-trip, ghost-row non-clickability, ResourceView.jsx unaffected-behavior spot check) and Task 2 (toggle click, label swap, draft row show/hide, interaction with the focused view, toggle-state persistence across a focus/unfocus round-trip) were **not** run live. All automated verifies (the four `node -e` assertion scripts per task, `npm test`, `npm run build`) passed. This is flagged rather than silently skipped, per explicit instruction from the calling context.

## Known Stubs

None — no placeholder/mock data paths introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both WEEKBUILD-04 and WEEKBUILD-05 are code-complete and pass all automated checks (unit assertions, `npm test`, `npm run build`).
- **Outstanding before this plan can be considered fully verified:** a human needs to run `npm run dev`, open an army team's "בניית שבוע" step, and walk through both `<human-check>` procedures in `08-03-PLAN.md` (Task 1 six points, Task 2 five points) — including keyboard-only navigation, which is the one behavior static analysis cannot substitute for.
- No blockers for subsequent Phase 8 plans; `ResourceGrid.jsx`'s new `onRowClick` prop is available for any future caller that wants the same click-to-focus pattern.

---
*Phase: 08-weekbuild-status*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: src/components/supervisor/ResourceGrid.jsx
- FOUND: src/components/supervisor/RosterWizard.jsx
- FOUND: .planning/phases/08-weekbuild-status/08-03-SUMMARY.md
- FOUND commit: be36e73
- FOUND commit: 19c8986
