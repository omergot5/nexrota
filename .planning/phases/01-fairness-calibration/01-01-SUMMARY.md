---
phase: 01-fairness-calibration
plan: 01
subsystem: scheduling-engine
tags: [fairness, load-weighted-scoring, deterministic, autoAssign, verify-scheduler]

# Dependency graph
requires: []
provides:
  - "result.fairness.perGuard[].load — weighted-load per guard, rounded to one decimal"
  - "result.fairness.perShiftLoad / loadMax / loadMin / loadSpread / loadMean — roster-relative load statistics"
  - "summary.fairnessScore derived from load variance, not shift-count variance"
  - "balanceWorkload ranks and stops on load (stats.perShiftLoad-derived gapThreshold), not shift count"
  - "FAIR-01..04 regression block in scripts/verify-scheduler.mjs (22 new assertions)"
affects: ["01-02 (supervisor screen + participant fairness row, consumes fairness.perShiftLoad/loadMax/loadMin/loadSpread/loadMean)", "01-03 (reports screen)"]

# Actuals (#2632)
actuals:
  tokens: 6661
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single roster-relative divisor (stats.perShiftLoad) computed once in autoAssign() and read by both balanceWorkload and buildResult — no second average-shift calculation"
    - "Score/threshold reported to the UI is derived from the same rounded values exposed on the result object, making a structural (recompute-and-compare) regression test possible instead of a pinned snapshot"

key-files:
  created: []
  modified:
    - src/lib/autoAssign.js
    - scripts/verify-scheduler.mjs

key-decisions:
  - "gapThreshold coefficient corrected from the researched starting value of 0.5 to 1.0 (stats.perShiftLoad * 1.0, not * 0.5) — the 0.5 value caused an infinite balance-pass oscillation (hit the 40-pass ceiling every run) on the pre-existing 5-guard/mixed-shift-type fixture; found via Task 2's own convergence test (Test F), not Task 3's pressure tests"
  - "fairnessScore coefficient (15 / perShiftLoad) needed no adjustment — verified via Task 3's scale-invariance, dynamic-range, and unit-consistency property tests, all of which passed against the original researched formula"
  - "Divergence fixture (Task 2 Test E) constructed via keepExisting-locked shifts plus one soft-scored (maybe/preferred) open shift, rather than availability-based hard exclusivity — a hard-unavailable block on the receiving guard during fill would also block the balance-pass move-back to that same guard, since availability is one static map read at both times"

requirements-completed: [FAIR-01, FAIR-02, FAIR-03, FAIR-04]

coverage:
  - id: D1
    description: "summary.fairnessScore and fairness.score are computed from perGuard[].load variance, never from shift count; the CONTEXT.md reproduction (5 day + 3 night shifts, 4 guards) now scores strictly below 100 instead of the previous false 100"
    requirement: "FAIR-02"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — 'FAIR-02 · ציון ההוגנות ב-repro נמוך מ-100'"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm test fails (non-zero exit) if summary.fairnessScore is not exactly recomputable from the reported perGuard[].load and perShiftLoad, using the identical divisor floor and operation order the engine uses"
    requirement: "FAIR-04"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — 'FAIR-04 · הציון המדווח נגזר במדויק מהנטל המדווח (בדיקה מבנית, לא צילום מסך)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "balanceWorkload ranks guards by accumulated load and stops on a threshold derived from stats.perShiftLoad; a divergence roster (count-heaviest and load-heaviest are different guards) proves the balance pass moves a shift away from the load-heaviest guard, not the count-heaviest"
    requirement: "FAIR-01"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — 'FAIR-01 · מעבר האיזון מזיז משמרת מהכבד/ה-בנטל (טל), לא מהמרובה-במשמרות (שי)'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both re-derived coefficients (fairnessScore's 15/perShiftLoad, balanceWorkload's gapThreshold) are genuinely roster-relative: an 8h and a 12h twin of the same roster score identically and balance identically, a flat roster scores exactly 100, a severe-skew roster scores below the reproduction and above 0, and an equal-weight roster reproduces the pre-change count-based formula exactly"
    requirement: "FAIR-03"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — FAIR-03 block (10 assertions: scale invariance, dynamic range, unit consistency)"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-08-23
status: complete
---

# Phase 1 Plan 01-01: Load-Calibrated Fairness Engine Summary

**Converted `autoAssign.js`'s fairness score and balance-pass threshold from shift-count units to weighted-load units, re-deriving both constants from the roster's own `perShiftLoad` instead of token-swapping the count-tuned literals — with 22 new structural regression assertions in `scripts/verify-scheduler.mjs` proving the reported score is exactly recomputable from the reported load, not just plausible-looking.**

## Performance

- **Duration:** ~33 min
- **Started:** 2026-08-23T14:18:00+02:00 (worktree creation)
- **Completed:** 2026-08-23T14:51:10+02:00 (final task commit)
- **Tasks:** 3
- **Files modified:** 2 (`src/lib/autoAssign.js`, `scripts/verify-scheduler.mjs`)

## Final Coefficient Values

| Coefficient | Researched starting value | Final value | Adjusted? |
|---|---|---|---|
| `fairnessScore` variance coefficient | `15 / perShiftLoad` (floor 0.001) | `15 / Math.max(perShiftLoad, 0.001)` | **No** — held up against all of Task 3's property tests unchanged |
| `balanceWorkload` `gapThreshold` fraction | `perShiftLoad * 0.5` | `perShiftLoad * 1.0` | **Yes** — see Deviations below |

## Accomplishments
- `stats.perShiftLoad` computed once in `autoAssign()`, mirroring `fairness.js`'s existing derivation — the single "what does one shift cost this team" value used by both `balanceWorkload` and `buildResult`
- `perGuard[].load` field added and reported; `fairnessScore`/`fairness.score` now derived from load variance; `fairness.perShiftLoad`/`loadMax`/`loadMin`/`loadSpread`/`loadMean` exposed for plan 01-02's supervisor screen
- `balanceWorkload`'s sort key and stopping-gap comparison both switched from `load.get(id).count` to `load.get(id).load`, with the threshold derived from `stats.perShiftLoad` rather than a hardcoded literal
- 22 new `FAIR-01`..`FAIR-04` labelled assertions across three tasks: the CONTEXT.md reproduction case, a deliberately-constructed count/load divergence roster, convergence checks on both synthetic and the pre-existing production-shaped fixture, and four coefficient pressure tests (scale invariance, threshold scale invariance, dynamic range, unit consistency against the old formula)
- `LOAD_WEIGHTS` untouched; engine still imports nothing from React, network, or `lib/api.js`; no test runner introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end load-based fairness score, proved by an independent recomputation check** - `ac353fb` (feat)
2. **Task 2: Balance pass ranks and stops by load (FAIR-01)** - `a3d247e` (feat)
3. **Task 3: Pressure-test the two assumed coefficients instead of accepting them** - `cecc0cf` (test)

_Note: this plan's tasks were `type="tracer"`/`type="auto"` with `tdd="true"` — each task's tests were written and run against the pre-fix engine (confirmed failing) before the engine change, then re-run to confirm green, per the plan's TDD instructions. Formal RED/GREEN/REFACTOR gate commits were not split out separately (test additions and the engine fix landed in the same per-task commit, matching this codebase's existing commit granularity where `scripts/verify-scheduler.mjs` and `src/lib/autoAssign.js` are committed together)._

## Files Created/Modified
- `src/lib/autoAssign.js` — `stats.perShiftLoad` derivation; `buildResult`'s `perGuard[].load` field and load-based `fairnessScore`; `fairness.perShiftLoad/loadMax/loadMin/loadSpread/loadMean`; `balanceWorkload`'s load-based sort/threshold; `emptyResult`'s matching zero-value keys
- `scripts/verify-scheduler.mjs` — reproduction fixture (`reproShifts`/`reproGuards`), divergence fixture (`divShifts`/`divGuards`), 12-hour twin fixture (`twinShifts`), flat/skew/uniform fixtures for Task 3, and 22 `FAIR-0N ·` labelled assertions

## Decisions Made
- **gapThreshold fraction corrected 0.5 → 1.0**, discovered via Task 2's own convergence test (Test F), not Task 3's pressure tests. Running the researched 0.5 value against the pre-existing 5-guard/mixed-shift-type fixture (already in `verify-scheduler.mjs` before this plan) produced an infinite balance-pass oscillation: a single shift bounced between two guards for the full 40-pass ceiling every run, because a move changes the gap by 2× the moved shift's own weight, and for an above-average shift (a night shift, in a roster averaging day+night) that swing comfortably exceeds half the *average* shift weight. Swept the fraction from 0.5 to 2.0 against three fixtures simultaneously (the reproduction fixture, a newly-constructed count/load divergence fixture, and the pre-existing 5-guard fixture); 1.0 was the smallest value that converges cleanly on all three without suppressing the divergence fixture's genuinely-needed move. 1.0 also matches the pre-existing count-based formula's actual implied ratio more closely: the old `gapSize < 2` threshold already required the gap to be smaller than one full shift's worth of count swing (not half of it), since a single move changes count-gap by exactly 2.
- **`fairnessScore` coefficient (15/perShiftLoad) required no adjustment.** Task 3's four property tests (scale invariance across an 8h/12h twin roster, threshold scale invariance, dynamic range across flat/reproduction/severe-skew rosters, and unit consistency against the pre-change count-based formula on an equal-weight roster) all passed against the coefficient exactly as researched.
- **Test E's divergence fixture uses soft scoring (`maybe`/`preferred`) rather than hard `unavailable` blocks** to steer the marginal open shift onto the intended load-heavy guard during initial fill. A hard availability block on the receiving guard would also block the balance-pass move-back to that guard later, since `checkHardConstraints`/`availStatus` read the same static availability map at both fill-time and balance-time — there is no way to make a guard ineligible only during initial fill and eligible again during rebalancing via availability alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `gapThreshold` fraction of 0.5 caused balance-pass oscillation on the pre-existing 5-guard fixture**
- **Found during:** Task 2 (writing Test F, the convergence assertion the plan itself specifies)
- **Issue:** With `gapThreshold = stats.perShiftLoad * 0.5` (the plan's/RESEARCH.md's researched starting value, explicitly flagged `[ASSUMED]` in RESEARCH.md's Assumptions Log, Row A1), the pre-existing 5-guard/mixed-morning-and-night fixture at the top of `scripts/verify-scheduler.mjs` (unrelated to this plan's own new fixtures) hit the full `balancePasses: 40` ceiling every run: a single shift bounced back and forth between two guards indefinitely because moving it changed the gap by more than the threshold in *both* directions.
- **Fix:** Raised the fraction to `stats.perShiftLoad * 1.0`. Verified via a controlled sweep (0.5, 0.75, 1.0, 1.25, 1.5, 2.0) against three fixtures (reproduction, divergence, 5-guard) that 1.0 is the smallest value producing zero oscillation on all three while still allowing the divergence fixture's genuinely-needed single move.
- **Files modified:** `src/lib/autoAssign.js` (the `gapThreshold` line and its explanatory comment)
- **Verification:** `npm test`, `node scripts/verify-scheduler.mjs`, `npm run build` all pass; Test F (`FAIR-03 · מספר ההזזות בשבוע חמשת-השומרים נשאר הרבה מתחת לתקרת balancePasses`) and Test J (Task 3's scale-invariance-of-threshold check) both green
- **Committed in:** `a3d247e` (Task 2 commit — the fix and its own discovering test landed together, since the plan's own Test F is what surfaced the issue)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in an assumed-but-unvalidated coefficient, caught by the plan's own convergence test as intended)
**Impact on plan:** The plan explicitly anticipated this exact scenario (RESEARCH.md Assumption A1, Task 3's `<action>`: "if any of tests I, J, K or L fails, the coefficients are wrong and must be adjusted... not the tests weakened"). The fix is a one-line coefficient change with no architectural impact, fully covered by the existing property-test suite. No scope creep.

## Issues Encountered
- Constructing Task 2's divergence fixture (Test E) required several iterations. The first two attempts used a single unlocked "marginal" shift whose own weight both created the count/load divergence *and* was the sole candidate for the balance pass to move — algebraically, this construction always overshoots on the return move (proven: if the marginal shift's weight is what tips load-heaviest to the target guard by margin `d`, moving it back always changes the gap by `2×shift_weight`, which necessarily *exceeds* the original gap by `2d`, guaranteeing a reversal attempt). Resolved by locking the count-heavy guard's shifts entirely via `keepExisting`, and using soft preference signals (`maybe`/`preferred`) rather than hard availability to steer the one open shift onto the load-heavy guard — this keeps the guard legally eligible to receive it back during the balance pass, since eligibility (hard constraints/availability) is unaffected by soft scoring.

## User Setup Required
None - no external service configuration required. Pure client-side engine change.

## Next Phase Readiness
- `fairness.perShiftLoad`, `loadMax`, `loadMin`, `loadSpread`, `loadMean`, and `perGuard[].load` are all present on the result object with the exact shapes plan 01-02 (supervisor screen + participant fairness row) depends on, per this plan's own `<interface_context>` and `<key_links>` commitments.
- `LOAD_WEIGHTS` is byte-identical to before the phase — no downstream consumer of that constant is affected.
- No blockers for 01-02 or 01-03.

---
*Phase: 01-fairness-calibration*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: `src/lib/autoAssign.js`
- FOUND: `scripts/verify-scheduler.mjs`
- FOUND: `.planning/phases/01-fairness-calibration/01-01-SUMMARY.md`
- FOUND commit `ac353fb` (Task 1)
- FOUND commit `a3d247e` (Task 2)
- FOUND commit `cecc0cf` (Task 3)
