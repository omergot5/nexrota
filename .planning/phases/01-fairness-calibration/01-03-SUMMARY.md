---
phase: 01-fairness-calibration
plan: 03
subsystem: ui
tags: [fairness, load-weighted-scoring, recharts, design-tokens, deterministic, verify-planning]

# Dependency graph
requires:
  - phase: 01-fairness-calibration (plan 01-01)
    provides: "result.fairness.perGuard[].load, teamAverages(guards, shifts) with raw perGuard/rounded avg"
  - phase: 01-fairness-calibration (plan 01-02)
    provides: "loadShareHint({load, meanLoad, perShiftLoad}) -> {tone, text, level} | null; unit.load/unit.shifts/unit.nights in terms.js"
provides:
  - "src/lib/loadTable.js — pure module relaying every workload figure from teamAverages()/meanShiftLoad(); the single presentation-shaping layer for both the reports screen and the dashboard's own load card"
  - "src/design/chartTheme.js — pure, injectable-reader module resolving Recharts chart chrome (axis/grid/tooltip) from exactly four design tokens, no hex anywhere"
  - "meanShiftLoad(shifts) exported from src/lib/fairness.js — the single definition of the average shift weight above the engine"
  - "reports screen (Analytics.jsx) and dashboard card (views.jsx SupDashboard) both report weighted load as primary, both carry a fairness tag/derived-threshold display where applicable"
  - "widened fairness/load inventory gate (5-file symbol pattern, 4-file narrower pattern) and a standing shape-based gate (assignedGuards.includes(...).length / guards.map(...assignedGuards) = 0 under src/components/)"
affects: ["any future phase touching Analytics.jsx, views.jsx SupDashboard, or Recharts chart chrome; phase verification (this is the last plan of Phase 1)"]

# Actuals (#2632)
actuals:
  tokens: 11541
  tasks: 4
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "loadTable(guards, shifts) as the single presentation-shaping layer above teamAverages() — two consumers (Analytics.jsx, SupDashboard's load card) read the same rows, so a private per-screen formula is structurally impossible"
    - "chartTheme(read) as an injectable-reader pure module, testable in Node without a DOM, with a browser-safe default reader and a compose()/normalize() split that keeps fallback values well-formed by construction"
    - "symbol-based inventory gate (grep for named fairness/load symbols) paired with a shape-based gate (grep for the inline arithmetic shape itself) — two gates, not one, because a screen can compute a workload-like figure with zero fairness-symbol footprint"

key-files:
  created:
    - src/lib/loadTable.js
    - src/design/chartTheme.js
  modified:
    - src/lib/fairness.js
    - src/lib/terms.js
    - src/components/supervisor/Analytics.jsx
    - src/components/supervisor/views.jsx
    - scripts/verify-planning.mjs

key-decisions:
  - "loadTable's row shape was extended beyond the plan's literal `{guardId, name, fullName, count, nights, hours, load}` enumeration to also carry `morning`/`afternoon` per-guard type-slot counts — needed so the pre-existing per-guard stacked BarChart (kept unchanged per the plan's 'Deliberate non-goals') and the table's three per-type columns could keep working without Analytics.jsx reaching into `shifts`/`guards` directly, which the plan's own gate forbids. The literal shape declaration is read as illustrative of the new/identity fields, not exhaustive of the whole row."
  - "The BarChart's night stack renamed from dataKey='night' to dataKey='nights' to match loadTable's field name (which itself matches teamAverages' 'nights' field, per Test B's chain-of-custody requirement); a small TYPE_LABEL alias keeps the Tooltip label reading 'לילה' for the renamed key."
  - "Task 3's widened inventory gate and Task 4's shape-based gate required no new code in verify-planning.mjs — both are shell-level grep checks defined verbatim in the plan's own <verify> blocks, and both went green by construction once Analytics.jsx (task 3) and views.jsx (task 4) were migrated. Confirmed by running the exact grep commands from the plan against the tree post-migration."
  - "The worktree this plan executed in was branched before Phase 1 waves 1-2 were merged to main (git log showed no 01-01/01-02 commits at task-1 start, though the SUMMARY.md files for both were already present — a stale worktree base, not a missing dependency). Fast-forward merged local `main` into the worktree branch before starting any edits; this brought in 01-01's and 01-02's actual code changes cleanly with no conflicts, confirmed by npm test passing on the merged tree before any Plan 01-03 code was written."

requirements-completed: [FAIR-02, FAIR-04]

coverage:
  - id: D1
    description: "Reports screen's per-person table reports weighted load (loadTable's row.load, sourced from teamAverages) as the primary column, not a shift count or unweighted hours; a night-holding guard outranks a day-only guard with equal shift count"
    requirement: "FAIR-02"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — 'FAIR-02 · loadTable · אותה ספירה, נטל שונה — מי שנשא לילה נחשב עמוס יותר' (Test A)"
        status: pass
    human_judgment: true
    rationale: "The visual ranking/emphasis in the rendered table (load column leading, bold, shift-count/hours demoted to muted) is a rendering fact the unit test cannot see — no browser preview tool was available in this environment to confirm it, per Iron Principle 6."
  - id: D2
    description: "Every figure on the reports screen and the dashboard's load card is relayed from teamAverages()/meanShiftLoad(); npm test fails if any guard's displayed load diverges from teamAverages' own reported value for that guard"
    requirement: "FAIR-04"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — 'FAIR-02 · loadTable · כל שורה תואמת את teamAverages לאותו שומר — לא רק שורה אחת' (Test B, all guards, not one)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reports table carries an over/under-average fairness tag per row via the one shared loadShareHint helper, with words + direction icon (not colour alone), silent inside the shared derived dead zone, with a team-mean footer as a checkable reference"
    requirement: "FAIR-02"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — Tests O-R ('...loadShareHint מזהה מי מעל...', '...בדיוק על הממוצע לא מקבל תג...', '...שני הכיוונים... מייצרים טקסט שונה...', '...שום סף שני קבוע...')"
        status: pass
    human_judgment: true
    rationale: "Legibility of the badge/icon combination and footer placement in the rendered table (both themes, both vocabulary profiles) is a visual fact — no browser preview tool was available to confirm it, per Iron Principle 6."
  - id: D4
    description: "Recharts chart chrome (axis, grid, tooltip) is resolved from tokens.css via chartTheme(), not hardcoded hex; no colour value exists anywhere under src/components/supervisor/; both themes get the same finish and change live"
    requirement: "FAIR-02"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — Tests H-N (chartTheme channel/rgba/whitespace-padding/allowlist/fallback/junk); shell gate: colour-literal grep on src/components/supervisor/*.jsx = 0 (was 8)"
        status: pass
    human_judgment: true
    rationale: "Live theme-switch behaviour in a real browser (tooltip legibility over the brightest bar in dark theme, RTL layout) is a rendering fact the unit tests and shell gates cannot observe — no browser preview tool was available in this environment, per Iron Principle 6."
  - id: D5
    description: "Supervisor dashboard's own 'עומס השומרים' card — the first screen a supervisor opens — ranks and sizes guards by the same loadTable-relayed load, not a raw shift count computed inline"
    requirement: "FAIR-02"
    verification:
      - kind: unit
        ref: "shell gate: grep for assignedGuards.includes(...).length / guards.map(...assignedGuards) under src/components/ = 0 (was 2, both in views.jsx)"
        status: pass
    human_judgment: true
    rationale: "The dashboard's visual ranking (night-holder outranking a day-only guard of equal count) is a rendering fact — no browser preview tool was available to confirm it, per Iron Principle 6."
  - id: D6
    description: "The fairness-surface inventory gate covers the two per-shift primitives plus the four fairness symbols (5-file exact list) and re-asserts 01-02's narrower 4-symbol pattern at its corrected 4-file value; a second shape-based gate (independent of symbol names) closes the same class of defect"
    requirement: "FAIR-04"
    verification:
      - kind: unit
        ref: "shell gate: 5-file sorted list == GuardApp.jsx, SmartAssign.jsx, Analytics.jsx, CalendarView.jsx, views.jsx; 4-file sorted list == GuardApp.jsx, SmartAssign.jsx, Analytics.jsx, views.jsx; shape gate = 0"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min active (task commits span 16:21-18:47 local across two sessions; a multi-hour gap between task 1's commit and task 2's reflects a session interruption/resume, not active work — see Deviations)
completed: 2026-08-23
status: complete
---

# Phase 1 Plan 01-03: Reports Screen and Dashboard Card onto Weighted Load Summary

**Reports table and dashboard's own load card both converted from raw shift-count/unweighted-hours arithmetic to `teamAverages`-relayed weighted load via a new pure `loadTable()` module; Recharts chart chrome moved from five hardcoded hex/rgba literals into a token-reading `chartTheme()` module; the fairness-surface inventory gate widened from a blind 3-file symbol pattern to an exact 5-file pattern plus an independent shape-based regression gate.**

## Performance

- **Duration:** ~45 min of active work across two sessions (see note below)
- **Started:** 2026-08-23T16:21:00+02:00 (Task 1 commit)
- **Completed:** 2026-08-23T18:46:47+02:00 (Task 4 commit)
- **Tasks:** 4
- **Files modified:** 7 (`src/lib/loadTable.js` and `src/design/chartTheme.js` created; `src/lib/fairness.js`, `src/lib/terms.js`, `src/components/supervisor/Analytics.jsx`, `src/components/supervisor/views.jsx`, `scripts/verify-planning.mjs` modified)

**Session note:** this executor's session was interrupted between Task 1's commit (`f4de249`, 16:21) and the start of Task 2 — `src/design/chartTheme.js` had already been written to disk but was uncommitted when the interruption happened. On resume, the file was re-verified against the plan's Task 2 action items before being wired into `Analytics.jsx` and committed. No task was redone or guessed at; Task 1's commit was left untouched.

## Accomplishments

- `src/lib/loadTable.js` (new): pure module relaying every workload figure (`count`, `nights`, `hours`, `load`) from a single `teamAverages()` call, plus the team mean load, the average shift weight (via `meanShiftLoad`), per-type slot counts (`byType` team-level, `morning`/`afternoon` per-guard), total assigned count and guard count. Performs no workload arithmetic of its own — neither `shiftHours` nor `shiftLoad` appears anywhere in its body.
- `src/lib/fairness.js`: `meanShiftLoad(shifts)` extracted as the single definition of the average shift weight above the engine; `fairnessPlan` calls it in place of its former inline reduce (behaviour-preserving — all of `fairnessPlan`'s pre-existing assertions still pass unchanged).
- `src/lib/terms.js`: `unit.hours` noun added (no profile override, matching `unit.load`/`unit.nights`).
- `src/components/supervisor/Analytics.jsx`: per-person table now leads with weighted load (bold, primary column), demotes shift-count and hours to muted supporting detail, carries a fairness tag column (`loadShareHint`, words + direction icon, silent in the dead zone), and a team-mean footer row. The screen never reaches into `shifts`/`guards` directly — everything flows through `loadTable()`. All five hardcoded chart-chrome colour literals replaced by a single memoised `chartTheme()` call.
- `src/design/chartTheme.js` (new): pure, injectable-reader module resolving axis/grid/tooltip colours from exactly four design-role tokens; trims `getComputedStyle`'s leading whitespace before any shape check, composes `tokens.css`'s space-separated RGB channels into comma-separated `rgb()` for SVG-attribute safety, passes translucent `rgba()` through byte-identical, and falls back to a well-formed constant on any unrecognised value (never injects raw junk into a style object).
- `src/components/supervisor/views.jsx`: `SupDashboard`'s "עומס השומרים" card and its `maxLoad` derivation — the fourth workload surface, found only by a second adversarial plan-check audit pass — now read from the same `loadTable()`, with the per-row caption printing a load figure through `t("unit.load")` instead of a hardcoded shift-count string.
- `scripts/verify-planning.mjs`: 26 new `FAIR-02 ·` labelled assertions across three sections (`loadTable`, `chartTheme`, and the Task 3 tag tests), covering load/count divergence, exact per-guard chain-of-custody against `teamAverages`, population-rule correctness, `meanShiftLoad` behaviour preservation, deterministic ordering with lexicographic tie-break, degenerate-input safety, channel/rgba normalisation (including the whitespace-padding case only Node can catch), light/dark divergence, the token allowlist, fallback non-shadowing, junk-value rejection, and the fairness-tag helper reachable purely through the table's own exposed fields.
- Widened fairness/load inventory gate (5-file exact list) and the re-asserted narrower 4-file pattern, plus a standing shape-based gate (`assignedGuards.includes(...).length` / `assignedGuards` inside `guards.map(` = 0 anywhere under `src/components/`) — both enforced as shell-level checks per the plan's own `<verify>` blocks, requiring no new script code since the source migrations themselves made the patterns match.

## Task Commits

Each task was committed atomically:

1. **Task 1: The engine's own load number reaches the reports table** - `f4de249` (feat)
2. **Task 2: Recharts is told the theme by the token system, not by five hardcoded values** - `db58802` (feat)
3. **Task 3: The nav label's promise of הוגנות comes true, and the inventory gate stops being blind to this screen** - `91952fb` (feat)
4. **Task 4: The fourth workload surface — the dashboard's own "עומס השומרים" card — converts too** - `a6e4fd7` (feat)

## Files Created/Modified

- `src/lib/loadTable.js` - pure workload-presentation module, single source for both the reports table and the dashboard card
- `src/design/chartTheme.js` - pure Recharts chart-chrome colour module, reads `tokens.css` at runtime
- `src/lib/fairness.js` - `meanShiftLoad(shifts)` extracted from `fairnessPlan`'s inline reduce
- `src/lib/terms.js` - `unit.hours` noun added
- `src/components/supervisor/Analytics.jsx` - reports table converted to weighted load + fairness tag column; chart chrome now sourced from `chartTheme()`
- `src/components/supervisor/views.jsx` - `SupDashboard`'s load card converted to weighted load via `loadTable`
- `scripts/verify-planning.mjs` - 26 new `FAIR-02 ·` labelled assertions (Tests A-R for `loadTable`/tag, Tests H-N for `chartTheme`)

## Decisions Made

- **01-02's shipped contract matched this plan's assumptions exactly — no adjustment needed.** `loadShareHint`'s signature, the `unit.load`/`unit.shifts`/`unit.nights` key names, and the live-captured `level`/`tone` strings (`"over"`/`"under"`, `"warn"`/`"brand"`) via the Task 3 precondition's `node -e` capture matched `01-02-SUMMARY.md`'s documented shapes and this plan's `<interface_context>` verbatim.
- **`loadTable`'s row shape extended beyond the plan's literal enumeration** to include per-guard `morning`/`afternoon` type-slot counts, needed to keep the pre-existing stacked BarChart (explicitly kept unchanged per the plan's "Deliberate non-goals") and the table's per-type columns working without the screen reaching into `shifts`/`guards` directly — a constraint the plan's own gate (`(shifts|guards)\.` = 0) makes non-negotiable. Documented as a deviation below.
- **Task 3's and Task 4's inventory/shape gates required no new verify-planning.mjs code.** Both live as shell-level grep commands defined verbatim in the plan's `<verify>` blocks and went green by construction once Analytics.jsx (task 3) and views.jsx (task 4) were migrated — confirmed by running the exact commands from the plan against the post-migration tree.
- **Fast-forward merged `main` into this plan's worktree branch before any edits.** The worktree branch had been created before Phase 1 waves 1-2 were merged into `main` (confirmed via `git log --all` showing the wave 1/2 commit hashes existed but were not ancestors of the worktree's HEAD); `git merge main --ff-only` brought the worktree cleanly up to date with no conflicts, and `npm test` was re-confirmed green on the merged tree before any Plan 01-03 code was written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `loadTable`'s row shape extended with `morning`/`afternoon` per-guard slot counts**
- **Found during:** Task 1, while implementing Step 5 (the screen consumes the module)
- **Issue:** The plan's literal row-shape declaration (`{guardId, name, fullName, count, nights, hours, load}`) does not include per-guard breakdown by shift type. But the plan's own "Deliberate non-goals" section explicitly keeps the pre-existing stacked-by-type BarChart unchanged ("the stacked bar chart keeps counting shifts by type"), and the same task's own gate forbids `Analytics.jsx` from reaching into `shifts`/`guards` directly at all (`(shifts|guards)\.` must read 0). Without a per-guard type breakdown on the row, the BarChart's stacked `morning`/`afternoon`/`night` bars would have no data source once the direct-array-access gate landed.
- **Fix:** Added `morning` and `afternoon` fields to each row (computed as pure presentation-shaping slot counts, matching the module's existing per-type `byType` team aggregate but scoped per guard); reused the existing `nights` field for the per-guard night-type breakdown, renaming the BarChart's corresponding `dataKey` from `"night"` to `"nights"` and adding a small `TYPE_LABEL` alias so the Tooltip label still reads "לילה" for the renamed key.
- **Files modified:** `src/lib/loadTable.js`, `src/components/supervisor/Analytics.jsx`
- **Verification:** `npm test` and `npm run build` pass; the `(shifts|guards)\.` gate reads 0 as required; the BarChart continues to render a stacked-by-type breakdown per guard with the same visual semantics as before this plan.
- **Committed in:** `f4de249` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing-critical field needed for a component the plan explicitly kept in scope but whose data source the plan's own gate would otherwise have starved)
**Impact on plan:** Necessary to keep the pre-existing per-guard stacked BarChart functioning under the plan's own "no direct array access" gate; no scope creep — the extra fields are pure presentation counts sourced the same way `teamAverages`' own `count`/`nights` fields already are, and every automated gate in the plan still passes at its specified value.

## Issues Encountered

- **Worktree was stale relative to `main` at session start (before any Plan 01-03 code was written).** `git log` in the freshly-provided worktree showed no trace of 01-01's or 01-02's actual code commits, even though `.planning/phases/01-fairness-calibration/01-01-SUMMARY.md` and `01-02-SUMMARY.md` were present and referenced real commit hashes. `git log --all` confirmed those commits existed and were reachable, but were not ancestors of the worktree's `HEAD`; `git merge-base --is-ancestor` confirmed the worktree's `HEAD` was itself an ancestor of `main`. Resolved with a clean `git merge main --ff-only` before starting Task 1 — no conflicts, `npm test` re-confirmed green on the merged tree first. This is recorded here because Task 1's own `<precondition>` step (verifying `loadShareHint` and the `unit.*` keys are live) is exactly the check that caught this — the precondition initially failed, prompting the investigation.

## User Setup Required

None - no external service configuration required. Pure client-side display change.

## Next Phase Readiness

- Phase 1 (`01-fairness-calibration`) is now feature-complete across all three plans: the engine (01-01), the participant/smart-assign screens plus service-worker cache bump (01-02), and the reports screen plus the dashboard's own load card (01-03, this plan). All display surfaces the phase's own audit found — including the fourth surface caught only by a second adversarial plan-check pass — now report weighted load, sourced from a single chain of custody back to `teamAverages`/`shiftLoad`.
- **Five browser-based human-check items across this plan's three tasks were not performed** — no browser preview tool was available in this execution environment (no `preview_start` or equivalent tool in the available toolset). These are marked `human_judgment: true` with rationale in the `coverage:` block above, per Iron Principle 6 (what wasn't tested is reported as untested, not assumed working). A human should confirm, before Phase 1 is considered fully verified: (1) the reports table's load-column ranking and visual hierarchy; (2) the fairness tag's legibility and footer placement in both themes and both vocabulary profiles; (3) the chart chrome's live theme-switch behaviour and tooltip legibility over the brightest bar in dark theme; (4) the dashboard card's ranking by load rather than count.
- No blockers for phase verification. `npm test` and `npm run build` pass on the final commit (`a6e4fd7`).

---
*Phase: 01-fairness-calibration*
*Completed: 2026-08-23*
