---
phase: 02-task-shift-unification
plan: 01
subsystem: scheduling-engine
tags: [constraint-engine, conflict-detection, fairness, determinism, pure-functions]

# Dependency graph
requires:
  - phase: 01-fairness-calibration
    provides: shiftLoad/LOAD_WEIGHTS/isWeekendShift, loadTable.js, teamAverages().perGuard.load, meanShiftLoad
provides:
  - "windowsOverlap(a, b) — the single overlap test for shifts and tasks (dates.js)"
  - "taskInterval(task), isSingleDayTask(task), isTaskEngineEligible(task) — the shared task-eligibility primitives (dates.js)"
  - "taskAsShiftShape(task), withEngineTasks(shifts, tasks) — the single task-to-engine-item adapter and merge helper (dates.js)"
  - "conflicts.js's taskWindow branches to ms precision for engine-eligible tasks, imports the shared overlap instead of owning one"
  - "autoAssign()/checkAssignment() accept an optional tasks param that seeds guard load via addToLoad, never addAssignment"
affects: [02-02-task-form-ui, 02-03-reporting-call-sites]

# Actuals (#2632)
actuals:
  tokens: 10700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One shared time-window primitive (dates.js) imported by both engines instead of two private overlap implementations"
    - "Task-to-shift adapter pattern: shape the new item like the old one, feed it through unmodified existing functions, never write a parallel code path"
    - "Frozen state derived from field absence (no startTime/endTime), never a stored flag"

key-files:
  created: []
  modified:
    - src/lib/dates.js
    - src/lib/conflicts.js
    - src/lib/autoAssign.js
    - scripts/verify-planning.mjs
    - scripts/verify-scheduler.mjs

key-decisions:
  - "D-07 (flat task load weight): taskAsShiftShape sets type: \"task\", which has no LOAD_WEIGHTS entry and falls through to LOAD_WEIGHTS.default (1x) — the weekend multiplier still applies automatically because isWeekendShift is derived from date/startTime, not from type."
  - "D-09 (status-independent eligibility): isTaskEngineEligible never reads task.status — a task marked done still counts toward rest/consecutive/weekly-cap/load, matching that the hours were actually worked."
  - "Tasks seed guard load via addToLoad only, never addAssignment — no task record ever enters assignments/byShift, so balanceWorkload's iteration count is unaffected (the roadmap's named risk)."

patterns-established:
  - "isTaskEngineEligible(task) is the single definition of engine eligibility — single-day (isSingleDayTask) AND both startTime/endTime present. Every other file (plan 02-02's form, plan 02-03's reporting) must gate on this same function."

requirements-completed: [UNIF-02, UNIF-03, UNIF-04, UNIF-06]

coverage:
  - id: D1
    description: "One windowsOverlap function serves both engines — conflicts.js and autoAssign.js each import it instead of owning a private overlap implementation"
    requirement: "UNIF-03"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — UNIF-03 · assertions (resolution branch, semantics-preserved boundary cases, mixed-resolution, degenerate input)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A single-day task carrying hours blocks a conflicting shift through rest/overlap/consecutive/weekly-cap with the same code and reason shape a shift-vs-shift violation produces"
    requirement: "UNIF-02"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — UNIF-02 · Tests H-P (rest, overlap, consecutive, weekly-cap, load parity, D-07 flat weight, D-09 status-independence, backwards compatibility)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A frozen or multi-day task produces a byte-identical autoAssign result to passing no tasks at all — zero load, zero constraint effect"
    requirement: "UNIF-04"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — UNIF-04 · Test N (byte-identical serialisation)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pre-existing conflict-matrix assertions and category-pair matrix (compatIndex/pairRule) are an unmodified non-regression after the overlap unification"
    requirement: "UNIF-06"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — all pre-existing assertions plus UNIF-06 · same-day different-hours conflict tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "Determinism holds over a task-seeded roster, including with task array order reversed, and reporting functions (teamAverages, loadTable, fairnessPlan) stay coherent once tasks are merged in via withEngineTasks"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs Test Q/R; scripts/verify-planning.mjs Test S/T/U"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-24
status: complete
---

# Phase 2 Plan 1: Task ↔ Shift Overlap Unification Summary

**One `windowsOverlap` function in `dates.js` now serves both `conflicts.js` and `autoAssign.js`; an hour-bearing single-day task feeds the same rest/overlap/consecutive/weekly-cap constraints and load bookkeeping a shift does, via a `taskAsShiftShape` adapter that seeds `addToLoad` and never touches `assignments`.**

## Performance

- **Duration:** ~30 min (task-commit window 08:16–08:26 UTC+2; includes worktree repair and verification)
- **Started:** 2026-08-24 (session start)
- **Completed:** 2026-08-24T08:26:15+02:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `windowsOverlap(a, b)` in `src/lib/dates.js` is the single overlap test for the whole product (UNIF-03): normalises `{start, end}` ms windows and `{from, to}` date-only windows through a shared `toMsWindow` step, applies the same strict `<` test everywhere, and never throws or silently miscompares on malformed input.
- `taskInterval`, `isSingleDayTask`, `isTaskEngineEligible` establish the single definition of "a task the engine can see" (D-01, UNIF-04) — derived purely from field presence, never a stored flag, never gated on `task.status` (D-09).
- `conflicts.js`'s `taskWindow` now branches to millisecond precision for an engine-eligible task and falls through to the pre-existing date-string shape for everything else; the module-local overlap `const` is gone, replaced by an import from `dates.js`. `compatIndex`/`pairRule`/`findConflicts` are otherwise untouched (UNIF-06).
- `autoAssign.js`'s local `overlaps()` delegates to the shared `windowsOverlap` instead of its own inline millisecond comparison — observable behaviour unchanged, confirmed by every pre-existing scheduler assertion still passing.
- `taskAsShiftShape(task)` and `withEngineTasks(shifts, tasks)` in `dates.js` are the single task-to-engine-item adapter and merge helper (UNIF-02). `autoAssign()` and `checkAssignment()` both accept an optional `tasks` array, seeding guard load through the existing `addToLoad` — never `addAssignment` — so a task can never enter `assignments`/`byShift` and can never double the balance pass's item count (the roadmap's named risk for this phase).
- A 06:00–14:00 task now rejects a same-day night shift with `code: "rest"`, an overlapping shift with `code: "overlap"`, a touching shift with `code: "consecutive"`, and six tasks in a week reject a seventh duty with `code: "weekly-cap"` — all with the same reason shape a shift-caused rejection already produces.
- A task's load weight is flat `LOAD_WEIGHTS.default` (12 units for a 12-hour weekday task, not the 16.8 a `night`-typed shift over the same hours would carry) while the weekend multiplier still applies automatically, because it is derived from `date`/`startTime`, not from `type` (D-07).
- Determinism holds over a task-seeded roster, including with the task array reversed; `teamAverages`, `loadTable`, and `fairnessPlan` all stay internally coherent once tasks are merged in via `withEngineTasks`.

## Task Commits

Each task was committed atomically:

1. **Task 1: One overlap function serving both engines, end to end** - `1d099f2` (feat)
2. **Task 2: A task with hours feeds the same hard constraints a shift does (UNIF-02)** - `f9046e1` (feat)
3. **Task 3: Pressure-test the unification — determinism, reporting parity, and the merge helper** - `f707a41` (test)

## Files Created/Modified

- `src/lib/dates.js` - Adds `windowsOverlap`, `taskInterval`, `isSingleDayTask`, `isTaskEngineEligible`, `taskAsShiftShape`, `withEngineTasks` — the complete new exported surface for Phase 2's task/shift unification.
- `src/lib/conflicts.js` - `taskWindow` branches to ms precision for engine-eligible tasks; local overlap `const` removed, imports the shared `windowsOverlap` instead. `compatIndex`/`pairRule`/`findConflicts` unchanged.
- `src/lib/autoAssign.js` - `overlaps()` delegates to the shared `windowsOverlap`; `autoAssign()` and `checkAssignment()` gain an optional `tasks` param that seeds guard load via `addToLoad` before any constraint check runs.
- `scripts/verify-planning.mjs` - New `UNIF-01/03/04/06` assertion block (task eligibility boundaries, resolution branch, semantics-preserving boundary cases, mixed-resolution overlap, same-day-different-hours conflict-matrix non-collision, degenerate input) plus `withEngineTasks`/`loadTable`/`fairnessPlan` post-merge coherence tests (Task 3).
- `scripts/verify-scheduler.mjs` - New `UNIF-02/04` assertion block (rest/overlap/consecutive/weekly-cap via a task, load parity, D-07 flat weight with automatic weekend multiplier, D-09 status-independence, backwards compatibility, the balance-pass guard) plus determinism and reporting-parity tests (Task 3).

## Decisions Made

- **D-07 resolved as planned:** a task's load weight is flat `LOAD_WEIGHTS.default`, not a night-multiplier inferred from clock hours — `taskAsShiftShape` sets `type: "task"`, which has no `LOAD_WEIGHTS` entry, so `shiftLoad` falls through to `default` (1x) while the weekend multiplier still applies automatically via `isWeekendShift`'s date/startTime-only derivation.
- **D-09 resolved as planned:** `isTaskEngineEligible` never reads `task.status` — a task marked `"done"` still blocks a conflicting shift with the same code, because the hours were actually worked.
- **Test tolerance widened for a 2-row fairnessPlan fixture (Task 3, Test U):** the roadmap's existing 3-guard fairness assertion uses `< 0.01` tolerance for "deficits sum to approximately zero"; with only 2 guards in the new post-merge fixture, two independent 1-decimal roundings can combine to a residual up to ~0.1 even though the unrounded sum is exactly zero by construction. Widened the new test's tolerance to `< 0.15` rather than adding a third guard, since the point of the test is merge-coherence, not fixture size.

## Deviations from Plan

### Auto-fixed Issues

**1. [Environment/setup — not a Rule 1-4 code deviation] Worktree branch was stale, predating all Phase 1/Phase 2 planning history**

- **Found during:** Pre-Task-1 file discovery
- **Issue:** The spawned worktree's branch (`worktree-agent-a043e58895183d1ea`) was checked out at commit `1b0106b`, an ancestor of `main` with zero unique commits — it predated the entire Phase 1 fairness-calibration merge and the `.planning/` directory itself. None of the files the plan depends on (`LOAD_WEIGHTS`, `shiftLoad`, `loadTable.js`, the Phase 1 fairness engine, `.planning/phases/`) existed in the worktree.
- **Fix:** Verified via `git merge-base HEAD main` that the worktree branch was a pure ancestor of `main` (zero unique commits to lose), then ran a fast-forward merge (`git merge main --ff-only`) to bring the worktree up to `main`'s tip (`dd52170`). This is a non-destructive, lossless operation — no `git reset --hard` or history rewrite.
- **Files modified:** None (git ref update only)
- **Verification:** `npm test` and `npm run build` both passed cleanly on the fast-forwarded worktree before any Task 1 edits began, confirming the baseline matched the main-repo copy read during planning.
- **Committed in:** No separate commit — this was a `git merge --ff-only`, which is a fast-forward ref move, not a new commit object.

---

**Total deviations:** 1 (environment/setup, not a code deviation under Rules 1-4)
**Impact on plan:** Execution was blocked entirely until resolved; no code, test, or scope changes resulted from it. All three tasks then executed exactly as planned.

## Known Stubs

None — this plan touches only pure-function engine files and test scripts; no UI, no partial data wiring.

## Threat Flags

None — every threat register row from the plan's `<threat_model>` (T-02-01 through T-02-04) is mitigated exactly as designed: `toMsWindow`'s finite-number guard prevents the type-confusion coercion bug (T-02-01), `taskAsShiftShape`/`taskInterval`/`windowsOverlap` all return `null`/`false` rather than propagating a malformed clock value (T-02-02), tasks are routed through `addToLoad` only and never `addAssignment` (T-02-03, verified structurally by Test-4's balance-pass guard assertions), and the fairness-figure disclosure risk (T-02-04) is unchanged and accepted per the plan.

## Issues Encountered

- **`git diff`/`git show` reports `src/lib/conflicts.js` as binary** (`Bin 4717 -> 5062 bytes` in `git diff --stat`). Investigated by hand: the file contains two literal NUL (`\x00`) bytes inside `pairKey`'s template-literal separator (`` `${a}${b}` `` with a NUL where a space was presumably intended). Confirmed via `git show dd52170:src/lib/conflicts.js` that these NUL bytes predate this plan entirely — they are not something Task 1's edits introduced. Functionally harmless (`pairKey` is only used for internal, symmetric Map-key equality; every `compatIndex`/`pairRule`/`findConflicts` assertion passes). Logged to `.planning/phases/02-task-shift-unification/deferred-items.md` as an out-of-scope pre-existing artifact rather than fixed, per the scope boundary (fixing it would touch the exact bytes UNIF-06 requires to stay byte-identical, and it is not this plan's task).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**For Plan 02-02 (task form UI):** `isSingleDayTask` is the single definition of "one calendar day" the new-task form must gate its hour fields on (D-01) — importable directly from `src/lib/dates.js`. The form must never write hours to a multi-day task; `isTaskEngineEligible` will simply never see them as eligible if it tries.

**For Plan 02-03 (reporting call sites):** `withEngineTasks(shifts, tasks)` is ready to be the single merge point at every `teamAverages`/`loadTable`/`fairnessPlan` call site (`GuardApp.jsx:142`, `Analytics.jsx:44`, `views.jsx:100`, `views.jsx:884` per `02-RESEARCH.md`'s enumeration) and at both `checkAssignment` call sites (`GuardApp.jsx:566`, `views.jsx:1241`). Task 3's Test T found `loadTable`'s `byType.task` bucket and `totalAssigned` already internally consistent once tasks are merged in via `withEngineTasks` — **no drift found, no fix needed before 02-03 renders these fields.**

No blockers for 02-02 or 02-03. The one open finding (NUL bytes in `conflicts.js`'s `pairKey`) is logged in `deferred-items.md` and does not block downstream work.

---
*Phase: 02-task-shift-unification*
*Completed: 2026-08-24*

## Self-Check: PASSED

All modified files confirmed present on disk (`src/lib/dates.js`, `src/lib/conflicts.js`, `src/lib/autoAssign.js`, `scripts/verify-planning.mjs`, `scripts/verify-scheduler.mjs`, this SUMMARY, and `deferred-items.md`). All three task commit hashes (`1d099f2`, `f9046e1`, `f707a41`) confirmed present in `git log`. `npm test` and `npm run build` both exit 0 on the final state.
