---
phase: 04-standing-positions
plan: 02
subsystem: frontend
tags: [react, supervisor-ui, guard-ui, terms, positions]

requires:
  - phase: 04-standing-positions
    plan: 01
    provides: "gs_positions live in Supabase, src/lib/positions.js pure module (qualifiedGuardsForPosition, workingGuardIdsForWeek, expectedDatesForWeek), useGuardian actions (addPosition/updatePosition/deletePosition/ensurePositionsForWeek)"

provides:
  - "src/components/supervisor/PositionsScreen.jsx — dedicated screen: single-form position definition (D-01 two shapes), position list, and per-position POS-05 two-list display"
  - "src/components/SupervisorApp.jsx — 'positions' nav item under 'עוד', view wiring, and the useEffect that calls ensurePositionsForWeek(weekDates[0]) on every week change (POS-01's 'no button' trigger)"
  - "src/components/GuardApp.jsx — read-only 'positions.mine' block in MySchedule, showing active positions the current user is qualified for"
  - "src/components/supervisor/views.jsx — categoryOptions exported so PositionsScreen and TeamView share one taxonomy (D-01)"
  - "src/lib/terms.js — nav.positions, positions.shape.template/weekly, positions.qualified/working/mine keys, with army overrides for nav.positions and positions.working"

affects: [05-unified-board]

actuals:
  tokens: 6544
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "POS-05 two-list separation carried into the UI layer unchanged: PositionCard calls qualifiedGuardsForPosition and workingGuardIdsForWeek directly, never deriving one list from the other's output"
    - "Four independent distinguishing channels (heading text, icon, item shape, per-item text suffix) applied identically on both the supervisor screen and the guard screen — one visual vocabulary for the qualified/working distinction, not two"
    - "POS-01's 'no button' trigger implemented as a useEffect keyed on weekDates[0], relying on ensurePositionsForWeek's existing no-op-when-nothing-missing guarantee (04-01, T-04-05) instead of adding a second guard here"

key-files:
  created:
    - src/components/supervisor/PositionsScreen.jsx
  modified:
    - src/components/SupervisorApp.jsx
    - src/components/supervisor/views.jsx
    - src/components/GuardApp.jsx
    - src/lib/terms.js

key-decisions:
  - "Task split within one file: PositionsScreen.jsx was built in two committed layers — Task 1 shipped the form/list/nav wiring without the qualified/working lists, Task 2 added those lists to the existing PositionCard — so each plan task has its own atomic, independently buildable/testable commit rather than one large diff."
  - "Weekday/hour validation for weekly-shape positions is enforced at the existing api.js positionToRow boundary (04-01, unchanged) rather than duplicated in the screen; the screen still defensively filters weekdays to integers 0–6 before calling addPosition/updatePosition (T-04-03) in case a future caller of this form ever bypasses the toggle buttons."
  - "The 'working' list's per-guard dates are computed in PositionCard from shifts/tasks + weekDates (already held by the screen) rather than from a new return shape on workingGuardIdsForWeek — the pure function's existing signature (returning IDs only) stays untouched; date grouping is presentation, not a second definition of who is working."

requirements-completed: [POS-01, POS-02, POS-05]

coverage:
  - id: D1
    description: "Supervisor defines a position once, from a dedicated form (two shapes, D-01), and never returns to a 'create shift' button — subsequent weeks materialize on their own."
    requirement: "POS-01"
    verification:
      - kind: unit
        ref: "grep -c 'ensurePositionsForWeek' src/components/SupervisorApp.jsx = 2 (import/action wiring + useEffect call), inside a useEffect keyed on weekDates[0]"
        status: pass
      - kind: manual
        ref: "PLAN 04-02 Task 1 human-check (dev server, define a template position, switch weeks forward/back, verify shift rows appear with no extra click, no duplicates on repeat)"
        status: not_run
    human_judgment: true
    rationale: "No browser automation tool (chromium-cli, Playwright) is available in this Windows worktree environment, and the human-check requires an authenticated live-Supabase session (real team code, real login) that this agent has no credentials for. Automated evidence (build, unit tests, source-level grep) confirms the wiring is present and correct; the actual click-through was not observed and is reported as not run, per CLAUDE.md's 'what was not tested is reported as untested' rule."
  - id: D2
    description: "'Qualified' and 'working this week' render as two lists that cannot be confused, distinguished on four independent channels (heading, icon, item shape, per-item text) on both the supervisor and guard screens."
    requirement: "POS-05"
    verification:
      - kind: unit
        ref: "scripts/verify-positions.mjs — POS-05 section (already proven at the pure-function layer in 04-01); this plan's grep checks confirm PositionsScreen.jsx and GuardApp.jsx call qualifiedGuardsForPosition/workingGuardIdsForWeek directly and use distinct t() keys and Icon names (key vs calendar)"
        status: pass
      - kind: manual
        ref: "PLAN 04-02 Task 2/3 human-check (greyscale screenshot test, cover-the-headings test, reduce a working guard's qualification and confirm list migration)"
        status: not_run
    human_judgment: true
    rationale: "Same environment constraint as D1 — no browser tool available, no live-Supabase credentials in this worktree. The code-level guarantee (two different pure functions over two different source fields, verified in 04-01's unit tests; four distinct rendering channels verified by source read and grep) is strong, but the actual visual/perceptual check (grey-scale, hand-covering test) was not observed and is reported as not run."
  - id: D3
    description: "The qualification-editor's shared category taxonomy is reused by the position form (D-04); no second category list is invented for positions."
    requirement: "POS-02"
    verification:
      - kind: unit
        ref: "grep -c 'export const categoryOptions' src/components/supervisor/views.jsx = 1, git diff on categoryOptions shows only the export keyword added; grep -c 'categoryOptions' src/components/supervisor/PositionsScreen.jsx = 3 (import + Select options)"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 2: Standing Positions Screen Summary

**A dedicated, minimal PositionsScreen where a supervisor defines a position once (two shapes) and sees two visually and textually unambiguous lists — who's qualified vs. who's actually working this week — mirrored as a read-only permission list on the guard's own schedule screen.**

## Performance

- **Duration:** single session
- **Tasks:** 3 (form/list/nav wiring; POS-05 two-list display; guard-side "qualified for" block)
- **Files modified:** 5 (1 new component, 4 modified: SupervisorApp.jsx, views.jsx, GuardApp.jsx, terms.js)
- **Diff size:** ~26KB raw (~6.5K tokens at chars/4)

## Accomplishments

- `PositionsScreen.jsx`: a new dedicated screen reachable from "עוד" — a single modal form defines a position (template or weekly shape, D-01), a card list shows all defined positions with shape/category/schedule badges, and each card shows the two POS-05 lists side by side.
- The two lists are provably independent in source: the "qualified" list calls `qualifiedGuardsForPosition(position, guards)` (reads `guard.qualifiedCategories`); the "working" list calls `workingGuardIdsForWeek(position, {shifts, tasks}, weekDates[0])` (reads `assignedGuards`/`assignees` on realized rows). No code path in the new file derives one from the other.
- Four independent distinguishing channels applied to both lists, on both the supervisor screen and the guard screen: different `t()` heading, different `Icon` (`key` vs `calendar`), different item shape (bordered chip vs. filled row with dates), and a different per-item text suffix (qualification label vs. work date). A colour-blind reader or a screen reader loses none of the distinction.
- Two distinct empty states carrying two different meanings: "no one qualified for this category" is a warning (the position structurally cannot fill), "no one working yet" is neutral (the normal pre-assignment state).
- An unqualified-but-manually-assigned guard is deliberately **not** filtered out of the working list — the plan explicitly calls for this double display as proof the two lists are not the same field.
- `SupervisorApp.jsx` gained the `positions` nav entry under "עוד" and a `useEffect` calling `actions.ensurePositionsForWeek(weekDates[0])` on every week change — this is POS-01's "no button" materialization trigger, relying entirely on 04-01's existing no-op-when-nothing-missing guarantee.
- `GuardApp.jsx`'s `MySchedule` gained a read-only "העמדות שאני כשיר/ה להן" block below the existing shift list, rendering only active positions the signed-in guard is qualified for, via the same unmodified `qualifiedGuardsForPosition`. No button, no date, no action — a permission list, never mistakable for a work list. Renders nothing when empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: positions screen — form, list, nav wiring** — `b5584f4` (feat)
2. **Task 2: POS-05 — two lists that cannot be confused** — `7c8c1a0` (feat)
3. **Task 3: guard side — "qualified for" is not "assigned to"** — `52c8e69` (feat)
4. **Fix: dropped a literal "BOARD-02" string from a header comment** — `ff18df1` (fix) — see Deviations

## Files Created/Modified

- `src/components/supervisor/PositionsScreen.jsx` — new: position definition form (D-01 two shapes), position list, per-position POS-05 two-list display
- `src/components/SupervisorApp.jsx` — `positions` nav item, view wiring, `ensurePositionsForWeek` useEffect
- `src/components/supervisor/views.jsx` — `categoryOptions` exported (body unchanged)
- `src/components/GuardApp.jsx` — `positions.mine` block in `MySchedule`
- `src/lib/terms.js` — `nav.positions`, `positions.shape.template/weekly`, `positions.qualified/working/mine` in `BASE`; `nav.positions` and `positions.working` overridden in `army`

## Decisions Made

- **Task-per-commit split within one file:** `PositionsScreen.jsx` was authored in two layers matching the plan's task boundaries — Task 1's commit has the form/list/nav wiring without the two lists; Task 2's commit adds the lists to the existing `PositionCard`. This kept each commit buildable and testable on its own, matching the plan's atomic-commit requirement even though both tasks target the same file.
- **No new date-tracking API on `workingGuardIdsForWeek`:** the pure function's signature (returns sorted guard IDs only) is untouched from 04-01. Per-guard "which date are they working" is computed in `PositionCard` from `shifts`/`tasks`/`weekDates` the screen already holds — presentation grouping, not a second source of truth.
- **Weekday validation defense-in-depth:** `api.js`'s `positionToRow` (04-01, unchanged) already nulls `weekdays`/`startTime`/`endTime` for weekly-shape positions and only the form's own toggle buttons can produce a `weekdays` value — but the screen still filters to integers 0–6 before calling `addPosition`/`updatePosition`, per the plan's explicit T-04-03/ASVS V5 instruction, in case a future caller bypasses the toggle UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking self-check] Literal "BOARD-02" string in a header comment broke the plan's own D-05 verification grep**
- **Found during:** running the phase's `<verification>` checks after Task 3, specifically `grep -ri "BOARD-02" src/` (must be empty per D-05: no rolling-schedule view in this phase)
- **Issue:** `PositionsScreen.jsx`'s header comment explained the scope boundary by quoting the actual requirement ID ("...זו BOARD-02 בפאזה 5"), which is exactly the string the phase's own automated check searches for and expects to find nowhere in `src/`.
- **Fix:** reworded the comment to describe the same boundary ("זה תחום פאזה 5, לא כאן") without the literal requirement ID.
- **Files modified:** `src/components/supervisor/PositionsScreen.jsx`
- **Verification:** `grep -ri "BOARD-02" src/` now returns no matches; `npm run build` and `npm test` still pass.
- **Committed in:** `ff18df1`

---

**Total deviations:** 1 auto-fixed (self-inflicted verification-check conflict, caught before handoff)
**Impact on plan:** None on functionality — comment-only change, same boundary meaning preserved.

## Known Stubs

None. All rendered lists (qualified, working, positions.mine) are wired to live `positions`/`guards`/`shifts`/`tasks` data from `useGuardian`'s state, not placeholder or mock data.

## Browser Verification — NOT PERFORMED

Per CLAUDE.md's "אימות בדפדפן" rule ("'עובד' נאמר רק אחרי שראית את זה עובד. מה שלא נבדק מדווח כלא נבדק"), this must be stated plainly rather than implied:

**No browser verification was performed for this plan.** This worktree agent's environment has:
- No `chromium-cli` binary on `PATH`.
- No Playwright (or any browser-automation package) installed in the project or globally reachable.
- No credentials for a live Supabase team/supervisor/guard account, which the plan's human-check steps require (login with a real team code, define a position, switch weeks, view as a qualified-but-unassigned guard).

What **was** verified, mechanically, and is real evidence:
- `npm run build` passes after every task's commit (Vite compiles all new/changed JSX with no errors).
- `npm test` passes (257 checks, exit code 0) after every task's commit — including the pre-existing `verify-positions.mjs` POS-02/POS-05 unit coverage from 04-01, which this plan's UI consumes without modification.
- Every grep-based acceptance criterion in the plan (`categoryOptions` export, `t("nav.positions")`, `ensurePositionsForWeek` wiring, the five/six new `terms.js` keys plus army overrides, `qualifiedGuardsForPosition`/`workingGuardIdsForWeek` usage, `name="key"`/`name="calendar"` icon presence, absence of `confirm(`, absence of `<Btn`/`onClick`/dates in the guard block) was run directly against the committed files and passed.
- Source-level read-through of `PositionCard` and the `MySchedule` addition confirms the four distinguishing channels are structurally present (different `t()` string, different `Icon` name, different DOM shape/class, different per-item text) — but this is a code-reading confirmation, not an observed rendered screenshot.

**What remains genuinely unverified:** whether the screen actually renders correctly in a browser, whether the modal opens/closes/saves against a real Supabase team, whether the week-switch `useEffect` actually materializes shift rows with no duplicate on repeat navigation, and whether the visual four-channel distinction reads clearly to an actual human eye (the plan's own grey-scale/hand-covering tests). These are exactly the plan's `<human-check>` items and are marked `not_run` in the `coverage` frontmatter above, not silently assumed passing.

## Issues Encountered

None beyond the self-caught BOARD-02 grep conflict documented above.

## User Setup Required

None for this plan's code. Browser/UAT verification (see above) requires a human with dev-server access and a live Supabase team account — recommended as the immediate next step before this plan is considered fully done from a product standpoint, even though all automated gates pass.

## Next Phase Readiness

- **05-unified-board (BOARD-01/02/03/04):** can build the rolling multi-week schedule view on top of `positions`, `qualifiedGuardsForPosition`, and `workingGuardIdsForWeek` without re-deriving any of them; this plan deliberately did not touch that surface (D-05).
- **Blocker for full sign-off, not for downstream code:** the browser/UAT checks above should be run by a human (or a future agent with browser tooling and Supabase credentials) before this phase is marked verified in the product sense. No code-level blocker exists for Phase 5 to proceed.

---
*Phase: 04-standing-positions*
*Completed: 2026-08-27*
