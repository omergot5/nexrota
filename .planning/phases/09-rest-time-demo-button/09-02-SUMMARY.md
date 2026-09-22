---
phase: 09-rest-time-demo-button
plan: 02
subsystem: ui
tags: [react, supervisor-views, demo-data, modal]

# Dependency graph
requires: ["09-01"]
provides:
  - "SeedDemoDialog({ open, onClose, onConfirm, busy }) — single shared Modal+footer confirmation dialog for demo-data seeding, defined once before SupDashboard in views.jsx"
  - "Both real-team demo-fill entry points (SupDashboard onboarding card, TeamView empty-state) gate onSeedDemo behind explicit confirm; neither writes on first click anymore"
affects: [dashboard, team-settings]

# Actuals (#2632)
actuals:
  tokens: 1549
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared confirmation-dialog components (SeedDemoDialog) defined once above their first consumer in views.jsx, following the existing Modal+footer pattern (qualifications editor) rather than duplicating a dialog per call site"

key-files:
  created: []
  modified:
    - src/components/supervisor/views.jsx

key-decisions:
  - "SeedDemoDialog holds its own internal guardCount state (default 20) rather than being controlled by each parent — each parent only tracks a boolean demoDialogOpen, keeping the two call sites minimal"
  - "onConfirm is awaited before onClose() fires, matching the async save-then-close pattern already used by saveQualifications/saveWkndPreference in TeamView"

patterns-established:
  - "A dialog shared by two unrelated call sites lives once, above the first consumer that needs it, rather than being defined per-component or duplicated"

requirements-completed: [REST-03, REST-04]

coverage:
  - id: D1
    description: "TeamView's empty-state 'מלא נתוני הדגמה' button (guards.length === 0) opens SeedDemoDialog instead of calling onSeedDemo(demoCount) directly; only confirming inside the dialog writes"
    requirement: REST-03
    verification:
      - kind: other
        ref: "node -e script: SeedDemoDialog defined before SupDashboard; TeamView body contains demoDialogOpen/setDemoDialogOpen/<SeedDemoDialog/onConfirm={onSeedDemo}"
        status: pass
      - kind: manual_procedural
        ref: "Not run in this session — no browser tool available in the executing worktree; flagged for user's own live-browser check per their request"
        status: not_run
    human_judgment: false
  - id: D2
    description: "SupDashboard's onboarding-card 'מלא לי נתוני הדגמה' button (isNew) opens the same SeedDemoDialog instead of calling onSeedDemo(demoCount) directly"
    requirement: REST-04
    verification:
      - kind: other
        ref: "node -e script: SupDashboard body contains demoDialogOpen/setDemoDialogOpen/<SeedDemoDialog/onConfirm={onSeedDemo}; SeedDemoDialog defined exactly once and rendered exactly twice"
        status: pass
      - kind: manual_procedural
        ref: "Not run in this session — no browser tool available; flagged for user's own live-browser check"
        status: not_run
    human_judgment: false
  - id: D3
    description: "SeedDemoDialog exposes the existing 7/14/15/20 guard-count Segmented picker (default 20) in its body, moved out of both inline call sites"
    requirement: REST-04
    verification:
      - kind: other
        ref: "Code inspection: Segmented rendered inside SeedDemoDialog's Modal body with the same four options array as the two removed inline pickers"
        status: pass
    human_judgment: false
  - id: D4
    description: "AuthPage.jsx / startGuestDemo (anonymous guest-demo flow) untouched — explicitly out of scope"
    verification:
      - kind: other
        ref: "node -e script: AuthPage.jsx does not contain 'SeedDemoDialog'; useGuardian.js still contains 'startGuestDemo'"
        status: pass
    human_judgment: false
  - id: D5
    description: "onSeedDemo is never called directly outside SeedDemoDialog.onConfirm anywhere in views.jsx (T-09-02 mitigation)"
    verification:
      - kind: other
        ref: "grep for 'onSeedDemo(' in views.jsx after both tasks — zero direct-call matches remain, only onConfirm={onSeedDemo} wiring"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-22
status: complete
---

# Phase 9 Plan 2: Explicit Demo-Fill Confirmation Dialog Summary

**Built one shared `SeedDemoDialog` (Modal + footer, qualifications-editor precedent) that gates both real-team demo-data-fill entry points — SupDashboard's onboarding card and TeamView's empty-state — behind an explicit confirm step; neither button writes data on click anymore, only the dialog's confirm button does.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 1
- **Commits:** 2

## Accomplishments

- New `SeedDemoDialog({ open, onClose, onConfirm, busy })` defined once, immediately before `SupDashboard`, so both consumers share a single definition (verified: exactly one `function SeedDemoDialog(` in the file, exactly two `<SeedDemoDialog` render sites).
- Built on the existing `Modal` (`src/components/ui.jsx:591`) using the same `Modal`+`footer` pattern as the qualifications editor: a primary `Btn` with `loading={busy}` and a `variant="secondary"` "ביטול" button that closes without ever calling `onConfirm`.
- The 7/14/15/20 guard-count `Segmented` picker (default 20) moved from sitting inline next to each button into the dialog's body — same options array, same default, now shared.
- `TeamView`'s "מלא נתוני הדגמה" button (visible only when `guards.length === 0`) now opens the dialog via `setDemoDialogOpen(true)` instead of calling `onSeedDemo(demoCount)` on click.
- `SupDashboard`'s "מלא לי נתוני הדגמה" button (visible only while `isNew`) now opens the same dialog instead of calling `onSeedDemo(demoCount)` on click.
- Both buttons kept their exact existing text, icon (`sparkles`), variant/size, and visibility conditions — not unified into one condition, per the phase's locked decision.
- Confirming inside the dialog awaits `onConfirm(guardCount)` (wired to `actions.seedDemo`) and only calls `onClose()` after it resolves — matching the async save-then-close pattern already used by `saveQualifications`/`saveWkndPreference`.
- `AuthPage.jsx` and `startGuestDemo` (the pre-login anonymous guest-demo flow) were not touched at all — confirmed by grep in Task 2's automated verification.
- After both tasks, zero direct `onSeedDemo(` calls remain in `views.jsx` — the only reference left is the `onConfirm={onSeedDemo}` prop wiring passed to `SeedDemoDialog` in each of the two call sites.

## Task Commits

Each task was committed atomically:

1. **Task 1: SeedDemoDialog משותפת + חיווט כפתור TeamView (מסלול-מוכח-ראשון)** - `98803af` (feat)
2. **Task 2: חיווט כפתור SupDashboard לאותה SeedDemoDialog** - `0e8cbd8` (feat)

## Files Created/Modified

- `src/components/supervisor/views.jsx` — Added `SeedDemoDialog` component (before `SupDashboard`); converted `TeamView`'s and `SupDashboard`'s local `demoCount` state to `demoDialogOpen` booleans; removed the two inline `Segmented` pickers; both demo-fill buttons now open the shared dialog; `<SeedDemoDialog>` rendered once in each of `TeamView` and `SupDashboard`.

## Decisions Made

- `SeedDemoDialog` owns its own `guardCount` state internally (default 20) rather than being fully controlled by each parent, so each call site only needs to track a boolean `demoDialogOpen` — this keeps both wiring sites minimal and avoids lifting picker state up unnecessarily.
- The dialog body text explicitly states that confirming adds real data to the current team and that nothing is created before that click — addressing REST-04's "parameter dialog before writing" requirement directly in the copy, not just structurally.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' automated verify steps (node -e grep-style assertions, `npm test`, `npm run build`) ran as specified in the PLAN.md and all passed without modification.

## Issues Encountered

- **No live browser/MCP tooling was available in the executing worktree session to perform either task's `human-check` verification.** This was not attempted and is NOT claimed as verified. Per the user's explicit instruction, this is flagged clearly rather than asserted as done. The user has browser access and will perform the live verification themselves:
  - Task 1 human-check (TeamView, 5 points): button visible only when `guards.length === 0`; click opens dialog without writing; guard-count picker works with default 20; Cancel closes without creating records; Confirm creates the selected count and closes.
  - Task 2 human-check (SupDashboard, 5 points): button visible only while `isNew`; click opens the same dialog seen in Task 1 (identical title/picker/footer); no records exist before confirm; confirm creates the selected count and navigates to smart-assign (existing `startDemo` behavior, unchanged); a clean team where no demo button is ever clicked receives zero demo records, verified on refresh.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REST-03 and REST-04 are both satisfied structurally and by automated verification; live-browser confirmation of the five `human-check` points per task is still outstanding and should be performed by the user before this phase is considered fully closed.
- Phase 9 is now fully executed (09-01 + 09-02); both plans' automated checks pass. `npm test` and `npm run build` are green on the combined diff from fork point `ead694d`.

---
*Phase: 09-rest-time-demo-button*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `src/components/supervisor/views.jsx`
- FOUND: commit `98803af`
- FOUND: commit `0e8cbd8`
