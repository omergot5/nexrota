---
phase: 12-critical-confirmations
plan: 01
subsystem: ui
tags: [react, modal, confirm-dialog, ui-primitives]

# Dependency graph
requires: []
provides:
  - "export const ConfirmDialog in src/components/ui.jsx — the single generic confirm-before-action component the whole phase builds on"
affects: [12-02, 12-03, 12-04, 12-05, 12-06]

# Actuals (#2632)
actuals:
  tokens: 735
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ConfirmDialog generalizes the SeedDemoDialog pending/closeUnlessPending pattern (Phase 9) into reusable props: title, body, confirmLabel, cancelLabel, tone, busy, onConfirm"

key-files:
  created: []
  modified:
    - src/components/ui.jsx

key-decisions:
  - "tone falls straight through to Btn's variant prop (no extra mapping layer) — default \"danger\" fits most consumers (deletes/overwrites); callers needing a softer tone (e.g. publish, which is hard-to-reverse but not data-destroying) pass tone=\"accent\"/\"outline\" explicitly in Wave 2"
  - "Cancel/Escape/backdrop/X all route through the single closeUnlessPending function — no second code path can ever call onConfirm, matching CONFIRM-06 (no revert needed since nothing paints an optimistic patch before confirmation)"

patterns-established:
  - "Pattern: async-confirm dialogs use a local pending state that blocks Modal's onClose during the write (same shape as SeedDemoDialog), so ConfirmDialog is the only place this logic needs to exist going forward"

requirements-completed: [CONFIRM-01]

coverage:
  - id: D1
    description: "ConfirmDialog exported from src/components/ui.jsx, built on the existing Modal+Btn primitives, with dynamic title/body/confirmLabel/cancelLabel/tone/busy props and an async onConfirm"
    requirement: "CONFIRM-01"
    verification:
      - kind: unit
        ref: "inline node verify script — asserts export const ConfirmDialog exists, useState imported before its definition, pending/closeUnlessPending/variant={tone}/<Modal> all present in its body"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cancel/Escape/backdrop/X never call onConfirm (CONFIRM-06 pure state cleanup)"
    requirement: "CONFIRM-01"
    verification:
      - kind: unit
        ref: "inline node verify script — asserts closeUnlessPending gates the only onClose path in ConfirmDialog's Modal usage"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-09-24
status: complete
---

# Phase 12 Plan 01: ConfirmDialog Component Summary

**Generic `ConfirmDialog` component added to `src/components/ui.jsx`, generalizing the proven `SeedDemoDialog` pending/close-gating pattern into reusable props — pure infrastructure with no consumer yet.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-24T16:00:00Z (approx.)
- **Completed:** 2026-09-24T16:10:00Z (approx.)
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added `useState` to the existing `react` import in `src/components/ui.jsx`
- Added `export const ConfirmDialog` next to `Modal`, built on `Modal` + `Btn` — no new overlay
- `pending` state blocks `Modal`'s `onClose` during `onConfirm` (identical shape to Phase 9's `SeedDemoDialog`, generalized to props: `title`, `body`, `confirmLabel`, `cancelLabel`, `tone`, `busy`, `onConfirm`)
- `tone` prop falls straight through to `Btn`'s `variant`, default `"danger"`
- Doc comment above the component records the CONFIRM-06 rationale (cancel never calls `onConfirm`, since nothing consuming this component paints an optimistic patch before confirmation) and notes the `pending` mechanism is reused, not new

## Task Commits

Each task was committed atomically:

1. **Task 1: ConfirmDialog — רכיב אישור גנרי (CONFIRM-01)** - `957a6cf` (feat)

_No plan-level metadata commit yet — created below via `docs(12-01): complete ConfirmDialog plan`._

## Files Created/Modified
- `src/components/ui.jsx` - Added `useState` to react imports; added `export const ConfirmDialog` (generic confirm-before-action dialog built on existing `Modal`/`Btn`)

## Decisions Made
- `tone` maps directly to `Btn`'s `variant` — no intermediate mapping table. Default `"danger"` suits most consumers (deletes/overwrites, CONFIRM-03/CONFIRM-05 candidates); callers whose action is destructive-but-not-data-loss (e.g. publish/unpublish, CONFIRM-02/04) pass `tone="accent"`/`"outline"` explicitly when they wire the dialog in Wave 2.
- No revert/undo logic inside `ConfirmDialog` itself — confirmed correct per 12-CONTEXT.md CONFIRM-06: none of the four named actions paint an optimistic patch before the dialog's confirm button is pressed, so "cancel" is pure state cleanup, never a call to `onConfirm`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `ConfirmDialog` is exported and ready for Wave 2 (12-03/04/05) to wire into the four named entry points (publish/unpublish, delete-week, delete-demo-data) plus whatever CONFIRM-05 promotes from the phase's deferred() inventory.
- No blockers. This plan intentionally shipped zero UI consumers — `ConfirmDialog` has no call sites in the app yet, matching the plan's explicit "infrastructure-only" scope.

---
*Phase: 12-critical-confirmations*
*Completed: 2026-09-24*

## Self-Check: PASSED
- FOUND: src/components/ui.jsx
- FOUND: .planning/phases/12-critical-confirmations/12-01-SUMMARY.md
- FOUND: commit 957a6cf
