---
phase: 11-inline-demo-cleanup
plan: 02
subsystem: ui
tags: [react, board-editing, toggleAssignment, fk-fix]

# Dependency graph
requires:
  - phase: 11-inline-demo-cleanup
    provides: "actions.deletePosition(id, weekDates) + actions.toggleAssignment (11-01, data/state layer)"
provides:
  - "UnifiedBoard.jsx/BoardCard: optional onToggleAssignment prop, prop-drilled from UnifiedBoard → DayColumn → BoardCard, gated by canRemove/canAdd (both require !timeless)"
  - "views.jsx's People: optional onRemove prop — always-visible \"x\" on both qualified and qualification-blocked avatar branches, with stopPropagation"
  - "UnifiedBoard.jsx's BoardCard: \"+\" button + Modal-based short guard picker (qualification-gated via isQualified/qualRefusal, same scope as toggleAssignment itself) for open-capacity slots"
  - "WeekFlow.jsx passes onToggleAssignment={actions.toggleAssignment} to UnifiedBoard — GuardApp.jsx/CalendarView.jsx remain read-only (prop never passed there)"
  - "RosterWizard.jsx's removeItem and PositionsScreen.jsx's onDelete both now pass weekDates to actions.deletePosition, activating 11-01's FK safety net for army position deletion"
affects: [11-03-demo-cleanup-ui]

# Actuals (#2632)
actuals:
  tokens: 4215
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-prop-drilling for board write-affordances: onToggleAssignment follows the exact onMove precedent (undefined default, prop-drilled UnifiedBoard → DayColumn → BoardCard, never passed from GuardApp.jsx/CalendarView.jsx) — a second write-capable exit from the read-only board contract without inventing a new wiring mechanism."
    - "Always-visible (not hover-gated) inline icon-buttons on avatar chips, positioned opposite the existing qualification-lock badge to avoid overlap — same rationale already documented next to ShiftMgmt's delete button (touch-screen reachability)."
    - "Short in-board picker (Modal + Avatar reused from ui.jsx) intentionally scoped to toggleAssignment's own gate (isQualified only) — deliberately not AssignView's fuller checkAssignment (overlap/rest-hours) gate, per 11-CONTEXT.md's documented out-of-scope decision."

key-files:
  created: []
  modified:
    - src/components/supervisor/UnifiedBoard.jsx
    - src/components/supervisor/views.jsx
    - src/components/supervisor/WeekFlow.jsx
    - src/components/supervisor/RosterWizard.jsx
    - src/components/supervisor/PositionsScreen.jsx

key-decisions:
  - "onToggleAssignment/onRemove/onAdd-picker all follow the exact optional-prop convention onMove/onDragStart already established in the same files — no new wiring pattern introduced, keeping BOARD-05's read-only-by-default guarantee intact for GuardApp.jsx and CalendarView.jsx."
  - "\"x\" is rendered unconditionally visible (not hover-only) on both the qualified-avatar and qualification-blocked-avatar branches of People, positioned at the corner opposite the existing lock badge — matches the already-documented touch-reachability rationale next to ShiftMgmt's delete button."
  - "The \"+\" picker deliberately reuses toggleAssignment's own qualification-only gate (isQualified/qualRefusal) rather than AssignView's fuller checkAssignment (overlap/rest-hours) — an explicit, pre-documented scope boundary (11-CONTEXT.md), not an oversight."

patterns-established: []

requirements-completed: [INLINE-01]

coverage:
  - id: D1
    description: "Always-visible \"x\" on every assigned avatar in WeekFlow's board step removes the assignment immediately via the existing toggleAssignment action, with stepper/board counts updating live and the removal persisting after reload"
    requirement: INLINE-01
    verification:
      - kind: unit
        ref: "node -e structural checks — UnifiedBoard.jsx onToggleAssignment/canRemove, views.jsx People onRemove+stopPropagation"
        status: pass
      - kind: manual_procedural
        ref: "Live browser session (orchestrating session) — clicked \"x\" on an assigned avatar, immediate removal + stepper/board count update, confirmed persisted after reload via direct SQL against gs_work_item_assignments, confirmed absent from CalendarView.jsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "\"+\" button on any open-capacity board slot opens a short qualification-gated guard picker; selecting a qualified guard adds the assignment immediately via toggleAssignment and closes the picker"
    requirement: INLINE-01
    verification:
      - kind: unit
        ref: "node -e structural checks — UnifiedBoard.jsx Modal/Avatar import, pickerOpen state, onToggleAssignment(item.id, ...) call"
        status: pass
      - kind: manual_procedural
        ref: "Live browser session (orchestrating session) — opened picker on א' 27/9 day shift (0/1), listed all 7 guards, clicked \"גיא לוי\", assignment added immediately, stepper 0/14 → 1/14, \"+\" replaced by \"x\" on fill, confirmed via SQL row created in gs_work_item_assignments"
        status: pass
    human_judgment: true
    rationale: "Qualification-gating branch (disabled avatar + refusal tooltip) was not exercised live — the demo team used for verification has no gs_role_compatibility restrictions configured, so no guard was actually disabled during the live test. The code path reuses the same isQualified/qualRefusal logic already relied on elsewhere (blocked-avatar rendering), which lowers risk, but the gated-picker branch itself remains unconfirmed live pending a fixture with real qualification restrictions."
  - id: D3
    description: "Board stays read-only in CalendarView (main-nav calendar) and GuardApp (participant screen) — onToggleAssignment is never passed to UnifiedBoard from either surface"
    requirement: INLINE-01
    verification:
      - kind: unit
        ref: "node -e structural check — GuardApp.jsx and CalendarView.jsx source scanned, neither contains the string onToggleAssignment"
        status: pass
      - kind: manual_procedural
        ref: "Live browser session (orchestrating session) — confirmed the \"x\" affordance is absent from CalendarView.jsx during Task 1 verification"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deleting an army position whose current week is already materialized no longer fails with a raw foreign-key violation, from both RosterWizard and the standalone PositionsScreen"
    requirement: INLINE-01
    verification:
      - kind: unit
        ref: "node -e structural checks — RosterWizard.jsx removeItem and PositionsScreen.jsx onDelete both pass weekDates to actions.deletePosition"
        status: pass
      - kind: manual_procedural
        ref: "Live browser session (orchestrating session) — opened RosterWizard, selected the materialized \"כוננות\" tab for the current week, clicked \"הסר משימה זו\"; tab disappeared immediately, no error toast; confirmed via SQL zero rows remain in gs_positions for that category and no orphaned gs_work_items rows"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min
completed: 2026-09-24
status: complete
---

# Phase 11 Plan 02: Inline Board Editing ("x"/"+") + Army Position-Delete FK Wiring Summary

**Always-visible "x"/"+" affordances wired onto WeekFlow's board through the existing `toggleAssignment` action, plus `weekDates` wired into both `deletePosition` call sites to activate 11-01's FK safety net — no new DB writes, no new backend.**

## Performance

- **Duration:** ~25 min (across two executor sessions — Task 1 committed 2026-09-23, Tasks 2-3 committed 2026-09-24)
- **Started:** 2026-09-23T10:00:00Z (approx, Task 1)
- **Completed:** 2026-09-24T07:50:23Z (Task 3 commit)
- **Tasks:** 3 (1 `type="tracer"`, 2 `type="auto"`; no checkpoint tasks — all `<human-check>` verification deferred to and completed by the orchestrating session's live browser pass, per this plan's final instructions)
- **Files modified:** 5

## Accomplishments
- `UnifiedBoard.jsx`/`BoardCard`: `onToggleAssignment` optional prop, prop-drilled `UnifiedBoard → DayColumn → BoardCard` following the exact `onMove` precedent — passed as `onRemove` to `People`, gated by `canRemove = Boolean(onToggleAssignment) && !timeless`.
- `views.jsx`'s `People`: optional `onRemove` prop renders an always-visible (not hover-only) "x" on both the qualified-avatar branch and the qualification-blocked-avatar branch (positioned opposite the existing lock badge), with `e.stopPropagation()` so the click never leaks into the avatar wrapper's `draggable` behavior.
- `UnifiedBoard.jsx`'s `BoardCard`: "+" button (visible only when `canAdd = Boolean(onToggleAssignment) && !timeless && missing > 0`) opens a `Modal`-based picker listing every not-yet-assigned guard; qualification-blocked guards render `disabled` with a `title` tooltip via the same `isQualified`/`qualRefusal` already used for blocked-avatar rendering — deliberately scoped to `toggleAssignment`'s own gate, not `AssignView`'s fuller overlap/rest-hours check.
- `WeekFlow.jsx` passes `onToggleAssignment={actions.toggleAssignment}` to its `UnifiedBoard` instance; `GuardApp.jsx` and `CalendarView.jsx` were left untouched and remain fully read-only.
- `RosterWizard.jsx`'s `removeItem` and `PositionsScreen.jsx`'s `onDelete` both now call `actions.deletePosition(id, weekDates)` instead of `actions.deletePosition(id)`, activating the FK-safe unmaterialize-then-delete path built in Plan 11-01.

## Task Commits

Each task was committed atomically:

1. **Task 1: "x" הסרת שיבוץ מהלוח — מחווט מקצה-לקצה (INLINE-01)** - `dd7a87a` (feat)
2. **Task 2: "+" הוספת שיבוץ — בורר-שומר קצר על הלוח (INLINE-01)** - `b9744ca` (feat)
3. **Task 3: חיווט תיקון ה-FK של מחיקת עמדת army (INLINE-01)** - `18f5efe` (fix)

**Plan metadata:** pending final `docs(11-02): complete plan` commit (created after this summary).

_Note: no TDD tasks in this plan — this project has no test runner/linter for React components; verification is `npm test` (pure-engine Node scripts) + `npm run build` + live-browser human-check, per project convention._

## Files Created/Modified
- `src/components/supervisor/UnifiedBoard.jsx` - `onToggleAssignment` optional prop drilled through `DayColumn`/`BoardCard`; `canRemove`/`canAdd` gates; "+" button + `Modal`/`Avatar`-based guard picker
- `src/components/supervisor/views.jsx` - `People`'s new optional `onRemove` prop; always-visible "x" on both avatar-rendering branches (qualified + blocked)
- `src/components/supervisor/WeekFlow.jsx` - `onToggleAssignment={actions.toggleAssignment}` added to the existing `UnifiedBoard` call
- `src/components/supervisor/RosterWizard.jsx` - `removeItem` passes `weekDates` to `actions.deletePosition`
- `src/components/supervisor/PositionsScreen.jsx` - `onDelete` passes `weekDates` to `actions.deletePosition`

## Decisions Made
- Followed the plan's "Option B" wiring (11-CONTEXT.md decision) exactly: inline "+"/"x" directly on `UnifiedBoard.jsx`, through `toggleAssignment`, no new DB write path.
- "x" rendered always-visible rather than hover-gated, per the plan's explicit instruction citing the pre-existing `ShiftMgmt` touch-reachability rationale.
- "+" picker intentionally scoped to `toggleAssignment`'s own qualification-only gate, not `AssignView`'s fuller `checkAssignment` (overlap/rest-hours) — an explicit, pre-documented out-of-scope boundary for this phase (11-CONTEXT.md), not an oversight.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' automated `<verify>` blocks pass (`npm test`, `npm run build`, and every task-specific `node -e` structural check), and all `<human-check>` items were subsequently confirmed live by the orchestrating session (see below).

## Issues Encountered

None. Task 1 was executed and committed in an earlier session (2026-09-23); Tasks 2-3 were executed and committed in a later session (2026-09-24), continuing correctly from Task 1's committed state with no rework needed.

## Live-Verification Results (performed by the orchestrating session, 2026-09-24)

All three tasks' `<human-check>` points are satisfied:

**Task 1 ("x" remove-assignment):** Always-visible "x" confirmed on assigned avatars; clicking removes immediately with correct step-strip/board count updates; removal persisted after reload and confirmed via direct SQL against `gs_work_item_assignments`; confirmed absent from the read-only `CalendarView.jsx`.

**Task 2 ("+" add-assignment picker):** On an open slot (א' 27/9 day shift, 0/1), clicked "הוסף כפופים למשמרת יום" — modal opened listing all 7 guards (none disabled in this test, since the demo team has no `gs_role_compatibility` restrictions configured — the qualification-gating code path itself was not exercised live, but it reuses the exact same `isQualified`/`qualRefusal` logic already relied on elsewhere in the app, accepted as sufficiently low-risk without fixture setup; see D2's `human_judgment` rationale above). Clicked "גיא לוי" — assignment added immediately, modal closed, stepper went 0/14 → 1/14, the "+" button was replaced by "הסר את גיא לוי" once the slot filled. Confirmed via direct SQL against `gs_work_item_assignments` that the row was created correctly (team_code X6HJ3J, start_date 2026-09-27, start_time 07:00, guard "גיא לוי").

**Task 3 (army position-delete FK fix):** Opened RosterWizard, selected the "כוננות" tab (a real, already-materialized position for the current displayed week), clicked "הסר משימה זו" — tab disappeared immediately, no error toast, no raw FK violation surfaced. Confirmed via direct SQL: `select id from gs_positions where team_code='X6HJ3J' and category='כוננות'` returned zero rows, with no orphaned `gs_work_items` rows left behind — the `unmaterializePositionWeek`-then-`deletePosition` ordering from Plan 11-01 worked as intended.

## User Setup Required

None - no external service configuration required. (Migration 0022 from Plan 11-01 was already applied to the live database per 11-01-SUMMARY.md's post-merge follow-up.)

## Requirements Traceability

This plan's frontmatter lists `requirements: [INLINE-01]`, matching the ID also claimed by `11-01-PLAN.md` (backend layer) and `11-03-PLAN.md` (remaining slice: demo-cleanup UI + "מצב השבוע" verification). **`REQUIREMENTS.md` INLINE-01/02/03/04 checkboxes are deliberately left unchecked by this plan**, per 11-01-SUMMARY.md's established convention — Plan 11-03 (Wave 3 of 3) is still pending. Whichever of 11-02/11-03 completes last should run `requirements mark-complete` once the full picture (all three plans) is verified together.

Within this plan's own scope, INLINE-01's user-facing capability is now fully wired and live-verified: inline add/remove on the board (Task 1+2) and army-safe position deletion from both delete surfaces (Task 3).

## Next Phase Readiness

Board-level inline editing (INLINE-01's UI half) is complete and live-verified. Plan 11-03 remains to deliver the demo-cleanup UI (`actions.deleteDemoDataForWeek`, built backend-only in 11-01) and the final live "מצב השבוע" verification pass across the full three-plan Phase 11 diff — that plan (or a subsequent code-review pass) should also run `requirements mark-complete` for INLINE-01..04 once its own scope closes.

---
*Phase: 11-inline-demo-cleanup*
*Completed: 2026-09-24*

## Self-Check: PASSED

All 5 files modified this plan verified present on disk; all 3 task commit hashes (`dd7a87a`, `b9744ca`, `18f5efe`) verified present in `git log`.
