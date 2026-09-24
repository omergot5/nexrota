---
phase: 12-critical-confirmations
plan: 02
subsystem: state
tags: [react-hooks, useGuardian, deferred, undo-bar, pre-confirm]

# Dependency graph
requires: []
provides:
  - "actions.deleteShifts/deleteDemoDataForWeek/replaceShifts/removeGuard/deletePosition — write immediately via run()+refresh(), no deferred()/UndoBar, ready to be called from behind ConfirmDialog"
  - "actions.removeRoleCompatibility — now deferred()/UndoBar-protected (was completely unprotected before)"
  - "CONFIRM-05 audit table (code comment above `actions` in src/hooks/useGuardian.js) documenting disposition of all 10 reviewed destructive actions"
affects: [12-03, 12-04, 12-05, 12-06]

# Actuals (#2632)
actuals:
  tokens: 3632
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immediate-write mechanism (run()+refresh(), no optimistic patch) reused for five pre-confirm candidates — same pattern already established by addShifts/updateShift"
    - "deletePosition's partial-failure handling (unmaterializePositionWeek succeeds, deletePosition fails) now relies on run()'s own catch+setError instead of a manual setError call, since run() never paints a patch that needs guarding against a stale rollback"

key-files:
  created: []
  modified:
    - src/hooks/useGuardian.js

key-decisions:
  - "Pre-confirm REPLACES UndoBar for the five in-scope actions (locked in 12-CONTEXT.md) — deleteShifts/deleteDemoDataForWeek/replaceShifts/removeGuard/deletePosition all switched from deferred() to run()+refresh(), dropping their 8-second undo window rather than stacking a dialog on top of it"
  - "removeRoleCompatibility promoted from a bare run() (zero protection) to deferred()/UndoBar — the real gap found during Phase 12's codebase investigation, closed at the minimum bar (UndoBar), not full pre-confirm"
  - "label params removed from deleteShifts/replaceShifts (no longer used — no UndoBar label to display); existing callers passing an extra label arg are unaffected at runtime (JS ignores extra args) and are rewired by Wave 2 (12-03/04/05), per 12-CONTEXT.md's confirmed single-call-site inventory"
  - "hasMaterializedWeek (and its weekSet computation) removed from deletePosition — it only existed to pick between two UndoBar label strings; there is no UndoBar left to label"

patterns-established:
  - "CONFIRM-05 audit table as a durable JSDoc comment above `actions`, same convention as MORE-01 (SupervisorApp.jsx, Phase 10) — a markdown table naming every destructive action's disposition and rationale, kept next to the code it documents"

requirements-completed: [CONFIRM-03, CONFIRM-05]

coverage:
  - id: D1
    description: "deleteShifts and deleteDemoDataForWeek write immediately (run()+refresh()), no deferred()/UndoBar — ready to be called only after explicit dialog confirmation in Wave 2"
    requirement: "CONFIRM-03"
    verification:
      - kind: unit
        ref: "inline node verify scripts — assert run(async, no deferred(, await refresh() present in each action body"
        status: pass
      - kind: other
        ref: "npm test && npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "replaceShifts, removeGuard, deletePosition write immediately via the same pattern; deletePosition preserves the Phase 11 CR-02 partial-failure handling (refresh() before the error surfaces) without hasMaterializedWeek"
    requirement: "CONFIRM-05"
    verification:
      - kind: unit
        ref: "inline node verify scripts — per-action run()/no-deferred() check; deletePosition-specific check for unmaterializePositionWeek + catch(e) + throw e; whole-file check that hasMaterializedWeek is gone"
        status: pass
      - kind: other
        ref: "npm test && npm run build"
        status: pass
    human_judgment: false
  - id: D3
    description: "removeRoleCompatibility moved from run() to deferred() (UndoBar 'החסימה הוסרה') — first safety net it has ever had"
    requirement: "CONFIRM-05"
    verification:
      - kind: unit
        ref: "inline node verify script — asserts deferred( present in removeRoleCompatibility body and the patch filters d.compatibility"
        status: pass
      - kind: other
        ref: "npm test && npm run build"
        status: pass
    human_judgment: false
  - id: D4
    description: "Durable code-comment audit table above `actions`, listing all 10 reviewed destructive actions with disposition (in-scope-for-pre-confirm / stays-UndoBar / newly-protected) and rationale, faithful to 12-CONTEXT.md findings §1"
    requirement: "CONFIRM-05"
    verification:
      - kind: unit
        ref: "inline node verify script — asserts CONFIRM-05 marker text present and all 10 action names appear as backtick-quoted rows"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-24
status: complete
---

# Phase 12 Plan 02: Confirmation Mechanism Layer Summary

**Converts five destructive `useGuardian.js` actions from `deferred()`/UndoBar to immediate `run()+refresh()` writes (matching `addShifts`), promotes `removeRoleCompatibility` from zero protection to `deferred()`/UndoBar, and documents the full disposition of all 10 reviewed destructive actions in a durable code-comment audit table.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 1 (`src/hooks/useGuardian.js`)
- **Commits:** 3

## Accomplishments

- `deleteShifts(ids)` converted from `deferred(label, patch, work)` to `run(async () => { await api.deleteShifts(ids); await refresh(); })` — the `label` param and optimistic patch removed (Task 1, tracer)
- `deleteDemoDataForWeek`, `replaceShifts`, `removeGuard`, `deletePosition` converted to the same immediate-write pattern (Task 2)
  - `deleteDemoDataForWeek` keeps its existing DoS gate (`if (!ids.length) return;`) ahead of the write
  - `replaceShifts` drops its `label` param and the "atomic patch" comment (no longer relevant — no second `deferred()` window to coordinate against)
  - `deletePosition` drops `hasMaterializedWeek`/`weekSet` (no UndoBar label left to compute) but keeps the Phase 11 CR-02 partial-failure order: `unmaterializePositionWeek` → `deletePosition` → `refresh()` before the error surfaces, now rethrown through `run()`'s own catch instead of a manual `setError()` call
- `removeRoleCompatibility(id)` converted from a bare `run()` to `deferred("החסימה הוסרה", ...)` — its first safety net ever (Task 3)
- Added a CONFIRM-05 audit-table JSDoc comment directly above `const actions = useMemo(...)`, in the same convention as MORE-01 (`SupervisorApp.jsx`, Phase 10): all 10 reviewed destructive actions, their disposition, and rationale, faithful to `12-CONTEXT.md` findings §1
- Updated the `deferred()` header comment to point at the new audit table, since not every remaining `deferred()` call shares the original "no confirm needed" rationale anymore
- Updated the stale docstring above `deleteShifts`/`deleteDemoDataForWeek` describing them as going through `deferred()`

## Task Commits

Each task was committed atomically:

1. **Task 1: deleteShifts — מקצה לקצה, deferred() → כתיבה מיידית (CONFIRM-03)** - `e695d0b` (feat, tracer)
2. **Task 2: deleteDemoDataForWeek, replaceShifts, removeGuard, deletePosition — אותה המרה (CONFIRM-03 + CONFIRM-05)** - `7c2b265` (feat)
3. **Task 3: removeRoleCompatibility → UndoBar + טבלת-ביקורת CONFIRM-05 מתועדת** - `0fcb713` (feat)

## Files Created/Modified

- `src/hooks/useGuardian.js` — Five actions converted to immediate writes; `removeRoleCompatibility` promoted to `deferred()`; CONFIRM-05 audit table added; `deferred()` header comment updated to reference it.

## Decisions Made

- Pre-confirm REPLACES UndoBar for all five in-scope actions — no stacking of both mechanisms, per the locked 12-CONTEXT.md decision (ROADMAP.md's own planner note calls stacking "an insult to the user").
- `removeRoleCompatibility` gets UndoBar, not full pre-confirm — the CONFIRM-05 bar for promotion to pre-confirm wasn't met for this action, but leaving it with zero protection contradicted the project's baseline pattern.
- `label` params removed from `deleteShifts`/`replaceShifts` rather than left as dead parameters — no UndoBar label consumer remains after this conversion, and JS silently ignores the extra arguments existing callers (`clearWeek` in `views.jsx`, `fillWeek` in `views.jsx`) still pass, so nothing breaks before Wave 2 rewires them.
- `deletePosition`'s partial-failure `catch` rethrows through `run()`'s built-in error handling instead of calling `setError()` manually — `run()` never paints an optimistic patch, so there is no snapshot-rollback risk that the old CR-02 fix (Phase 11 code review) was originally guarding against; `refresh()` before `throw` still shows the real server state first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shortened in-code comments that accidentally re-triggered the plan's own text-matching `<verify>` assertions**
- **Found during:** Task 2 verification
- **Issue:** The plan's automated `<verify>` scripts for Task 2 do naive substring/regex scanning of a fixed 700-character window starting at each action's key (e.g. searching for `/deferred\(/` in the text following `deletePosition:`). My first draft of the explanatory comment inside `deletePosition`'s `catch` block referenced "the old `deferred()`" by name in prose, and a separate comment above the key still said `` `hasMaterializedWeek` `` even after the variable itself was removed — both tripped the corresponding verify assertions even though the *code* was already correct.
- **Fix:** Shortened the `deletePosition` catch-block comment so `throw e` falls inside the scanned window, and reworded the two proximate comments to avoid the literal `deferred(` substring and the removed variable's name.
- **Files modified:** `src/hooks/useGuardian.js`
- **Commit:** `7c2b265`

Otherwise: plan executed exactly as written — no other deviations.

## Issues Encountered

None beyond the verify-script text-matching false positives documented above (resolved before commit, not left as a follow-up).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All five in-scope actions (`deleteShifts`, `deleteDemoDataForWeek`, `replaceShifts`, `removeGuard`, `deletePosition`) now write immediately and are ready for Wave 2 (12-03/04/05) to wire behind `ConfirmDialog` (12-01).
- `removeRoleCompatibility` requires no further UI change — the global `UndoBar` (`SupervisorApp.jsx`, fed from `pending`/`undo`) will display it automatically now that the mechanism has changed.
- No blockers. This plan touched only `src/hooks/useGuardian.js` — no `.jsx` files, no visible UI change, matching the plan's mechanism-only scope. The two Wave-2 callers still passing a now-unused `label` argument (`clearWeek`/`fillWeek` in `views.jsx`) are unaffected today (JS ignores extra args) and are explicitly in scope for 12-03/12-04/12-05 to rewire.

---
*Phase: 12-critical-confirmations*
*Completed: 2026-09-24*

## Self-Check: PASSED
- FOUND: src/hooks/useGuardian.js
- FOUND: .planning/phases/12-critical-confirmations/12-02-SUMMARY.md
- FOUND: commit e695d0b
- FOUND: commit 7c2b265
- FOUND: commit 0fcb713
