---
phase: 05-unified-board
plan: 04
subsystem: ui
tags: [react, unified-merge, tailwind, node-verify]

# Dependency graph
requires:
  - phase: 05-unified-board (05-01)
    provides: "UnifiedBoard.jsx (shifts, tasks, guards, dates, scopeGuardId, empty props) mounted as WeekFlow step 0"
  - phase: 05-unified-board (05-02)
    provides: "per-assignee QUAL-08 qualification lock baked into UnifiedBoard.jsx's BoardRow"
  - phase: 05-unified-board (05-03)
    provides: "PositionsScreen.jsx four-week forward forecast (BOARD-02), untouched by this plan"
provides:
  - "SupervisorApp.jsx's \"יומן\" tab week mode now mounts the same UnifiedBoard component WeekFlow step 0 renders — one board, two entry points, never two sources of truth"
  - "WeekCalendar.jsx deleted from the repository — the shifts-only week grid no longer exists anywhere"
affects: []

# Actuals (#2632)
actuals:
  tokens: 3728
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Second mount point, same component: the calendar tab's week Segmented option now renders UnifiedBoard with the same common props (shifts, tasks, guards, dates) WeekFlow already passes — no second board implementation, no second merge path."

key-files:
  created: []
  modified:
    - src/components/SupervisorApp.jsx
    - src/components/supervisor/UnifiedBoard.jsx

key-decisions:
  - "Task 1 (checkpoint:decision, D-01 costly-reversibility gate) was resolved by the human user via the orchestrator's AskUserQuestion BEFORE this execution began, selecting option 'repoint' — not re-asked or re-litigated by this executor. See 'Checkpoint Decision' section below for the full record."
  - "onOpenShift (WeekCalendar's per-shift click callback) has no counterpart on UnifiedBoard and was dropped rather than rewired — the board is read-only by design (D-03, D-08); inventing a navigation affordance nobody specified would grow a write path on a surface meant to stay read-only."
  - "A stray comment in UnifiedBoard.jsx referencing 'WeekCalendar.jsx' by name (missingOfItem's doc comment, unrelated to the plan's two originally-known references) was found via repository-wide grep before deletion and reworded — the plan explicitly calls for resolving any third reference discovered since planning."

patterns-established: []

requirements-completed: [BOARD-01, BOARD-04]

coverage:
  - id: D1
    description: "The \"יומן\" tab's week mode renders UnifiedBoard (shifts, tasks, guards, dates=weekDates) instead of WeekCalendar; onOpenShift callback dropped"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "npm test (4 scripts: verify-scheduler.mjs, verify-planning.mjs, verify-positions.mjs, verify-board.mjs) — all pass, exit 0"
        status: pass
      - kind: other
        ref: "grep -c UnifiedBoard src/components/SupervisorApp.jsx (2, >= required 2); grep -c CalendarView src/components/SupervisorApp.jsx (2, unchanged); grep -vE comments src/components/SupervisorApp.jsx | grep -c onOpenShift (0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "WeekCalendar.jsx no longer exists in the repository and nothing imports or references it"
    requirement: "BOARD-01"
    verification:
      - kind: other
        ref: "test -f src/components/supervisor/WeekCalendar.jsx (false); grep -rn WeekCalendar src/ scripts/ (zero matches, including the reworded stray comment)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run build completes without error after the deletion"
    requirement: "BOARD-01"
    verification:
      - kind: other
        ref: "npm run build — vite build, 900 modules transformed, exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "BOARD-04 comprehension test (D-13): a person who has never seen NexRota builds a full week on the unified board unaided and describes in their own words what it shows, including confirming the calendar tab's week mode shows the identical board"
    requirement: "BOARD-04"
    verification: []
    human_judgment: true
    rationale: "This is a parallel worktree executor with no browser tool available and no way to recruit a real naive human. The dev server was started on port 3000 and confirmed to respond (HTTP 200), but the six-point human walkthrough itself (Task 2's <human-check> block) was NOT performed — see 'Not Verified' section below. This must be run by a live person before phase BOARD-04 sign-off, per CLAUDE.md's own iron rule 6 (\"מה שלא נבדק מדווח כלא נבדק\")."

duration: ~15min
completed: 2026-09-02
status: complete
---

# Phase 05 Plan 04: Calendar Tab Repointed to Unified Board Summary

**The "יומן" tab's week mode now mounts the identical `UnifiedBoard` component `WeekFlow` step 0 renders, and `WeekCalendar.jsx` — the shifts-only week grid it replaces — is deleted from the repository, closing D-01's "replaces entirely, not joined by" promise structurally rather than by convention.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-02
- **Tasks:** 2 (Task 1 checkpoint:decision pre-resolved by orchestrator; Task 2 executed)
- **Files modified:** 3 (2 modified, 1 deleted)

## Checkpoint Decision (Task 1)

Task 1 was a `checkpoint:decision` (gate=`blocking`) presenting three options for the fate of the "יומן" tab's week mode: `repoint`, `remove-toggle`, `keep`. **This decision was made by the human user via the orchestrator's `AskUserQuestion` before this execution began** — not re-asked or re-litigated by this executor, per explicit instruction.

**Decision: `repoint`** — repoint the "יומן" tab's week mode to render `UnifiedBoard`, and delete `WeekCalendar.jsx`.

This is the option the plan itself recommended: it keeps the existing entry point (nobody discovers a vanished button, satisfying BOARD-04's no-surprise bar) while collapsing the two disagreeing week views into one — the exact failure mode BOARD-01 exists to eliminate. `CalendarView` (month mode) was explicitly out of scope and untouched.

## Accomplishments

- `src/components/SupervisorApp.jsx`: the calendar tab's week `Segmented` branch now mounts `UnifiedBoard` with `shifts`, `tasks`, `guards`, `dates={weekDates}` — the same values `common` already carries into `WeekFlow`. The `Segmented` control itself, its two option labels, and `calMode` state are unchanged. `CalendarView` in the month branch is unchanged.
- The `onOpenShift` callback `WeekCalendar` took (navigating back to "השבוע" on shift click) has no counterpart on the read-only board and was dropped rather than rewired — no click-through navigation affordance was invented.
- `WeekCalendar.jsx` (282 lines — the CSS-grid, hours-on-the-vertical-axis week view) deleted via `git rm`.
- Repository-wide grep for `WeekCalendar` found a third reference beyond the plan's anticipated two (import + mount): a doc comment inside `UnifiedBoard.jsx`'s `missingOfItem` explaining its accounting matched `missingOf` "ב-WeekCalendar.jsx". Reworded per the plan's own instruction to resolve any newly-discovered reference before considering the deletion complete.
- The app now has exactly one week view in the manager's app — the unified board — reachable from two entry points ("השבוע" flow and the "יומן" tab), both rendering the identical component.

## Task Commits

Task 1 required no commit (checkpoint, pre-resolved by orchestrator, no code change of its own).

1. **Task 2: הפניית לשונית "יומן" ללוח המאוחד, ופרישת WeekCalendar** - `7b90d3c` (feat)

**Plan metadata:** this SUMMARY's own commit (docs)

## Files Created/Modified

- `src/components/SupervisorApp.jsx` — `WeekCalendar` import replaced with `UnifiedBoard`; week-mode branch of the calendar tab mounts `UnifiedBoard` instead of `WeekCalendar`, `onOpenShift` dropped
- `src/components/supervisor/UnifiedBoard.jsx` — one doc comment reworded to remove its now-dangling reference to the deleted file's name
- `src/components/supervisor/WeekCalendar.jsx` — deleted (`git rm`)

## Decisions Made

See `key-decisions` in frontmatter — summarized:
- Task 1's checkpoint decision (`repoint`) was made by the human before this execution started; recorded here, not re-asked.
- `onOpenShift` dropped, not rewired — read-only surface, no invented write path.
- The stray third `WeekCalendar` reference (a comment) was resolved per the plan's explicit "if a third has appeared since, resolve it before deleting" instruction.

## Deviations from Plan

None beyond what the plan itself anticipated. The plan explicitly foresaw and instructed the resolution of any newly-discovered `WeekCalendar` reference beyond the two known at planning time; finding and rewording the stray comment in `UnifiedBoard.jsx` is exactly that anticipated case, not an unplanned deviation.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Not Verified (browser / human UAT)

This is a parallel worktree executor with **no browser tool available** and no way to recruit a real human unfamiliar with the app. Per CLAUDE.md's own iron rule 6 ("מה שלא נבדק מדווח כלא נבדק" — what isn't tested is reported as untested), the following from Task 2's `<human-check>` block (the BOARD-04 comprehension test, D-13) was **NOT performed**:

1. A first-time manager lands on "השבוע" and identifies what they see first (the board, or something else).
2. That person builds a full week unaided — shifts, assignment, publish — with every hesitation/question/backtrack recorded.
3. That person describes in their own words what the board shows, and specifically does NOT describe "shifts" and "tasks" as two visually distinct kinds of things (a D-12 failure if they do).
4. The "יומן" tab in week mode is confirmed to show the identical board, not a different grid.
5. "עוד" → "עמדות קבועות" is confirmed to show each position four weeks forward with no assign-affordance anywhere in that section.
6. A participant is confirmed to see both tasks and shifts in one list.

**What WAS confirmed automatically in this session:**
- `npm test` (all 4 scripts, including `verify-board.mjs`'s BOARD-01 assertions and `verify-positions.mjs`'s BOARD-02 assertions) — pass, exit 0.
- `npm run build` — completes without error.
- Repository-wide grep confirms zero remaining `WeekCalendar` references (import, mount, or file).
- The dev server was started on port 3000 (`npm run dev`) and confirmed to respond with HTTP 200 — the server itself is usable; only the live human walkthrough is outstanding.

This joins the same class of unrun browser checks already logged by 05-01, 05-02, and 05-03's summaries (six-item, five-item, and seven-item walkthroughs respectively, all still outstanding). All four plans' human-check items should be run together in a single live-browser session before Phase 05 is signed off — recommend a human run `npm run dev` and walk through all four checklists in one pass, since they build on the same running app state.

## Next Phase Readiness

- D-01 is satisfied structurally: the app has exactly one week-view component (`UnifiedBoard`), reachable from two entry points that can never disagree because they render the same code.
- BOARD-01's "no two screens to cross-reference" claim is now structurally true, not merely intended — verified by the fact that `WeekCalendar.jsx` no longer exists to disagree with anything.
- This is the final wave of Phase 05. All four plans' code-level and automated-test-level work is complete; the phase's one remaining gap before full sign-off is the stacked live-browser human-check backlog described above (05-01 through 05-04), which requires a human with a browser — not available to any of this phase's parallel worktree executors.

## Self-Check: PASSED

- FOUND: src/components/SupervisorApp.jsx
- FOUND: src/components/supervisor/UnifiedBoard.jsx
- MISSING (intentional — deleted by design): src/components/supervisor/WeekCalendar.jsx
- FOUND commit 7b90d3c (Task 2, feat)
- `npm test` (4 scripts) and `npm run build` both re-confirmed green immediately before writing this summary.

---
*Phase: 05-unified-board*
*Completed: 2026-09-02*
