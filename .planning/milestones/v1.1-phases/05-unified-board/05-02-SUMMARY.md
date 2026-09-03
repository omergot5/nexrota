---
phase: 05-unified-board
plan: 02
subsystem: ui
tags: [react, qualification, unified-merge, tailwind, node-verify]

requires:
  - phase: 05-unified-board
    provides: "05-01 — boardItemsForDates/boardShapeOf (src/lib/dates.js) and UnifiedBoard.jsx (mounted as WeekFlow step 0), with scopeGuardId already wired for this plan to consume"
provides:
  - "People (src/components/supervisor/views.jsx) — optional isBlocked(guard)/blockedLabel/blockedTitle/blockedClassName props, applying the four-signal QUAL-08 treatment to just the blocked avatar in a stack, byte-identical to prior behaviour when absent"
  - "UnifiedBoard.jsx — per-assignee isQualified(guard, item.category) check at render time, same code path for shifts and tasks, neutral ring only (never ring-danger)"
  - "GuardApp.jsx MySchedule — mounts UnifiedBoard twice (own scope + team-wide), replacing the shifts-only mine/rest/team-schedule builders; a participant now sees tasks alongside shifts, ordered by time"
affects: [05-03-position-board-qualification, 05-04-position-board-and-calendar-tab]

actuals:
  tokens: 5864
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "People(ids, guards, isBlocked, blockedLabel, blockedTitle, blockedClassName) — the QUAL-08 four-signal treatment is authored once by the caller (UnifiedBoard.jsx) and applied generically inside the shared avatar-stack component, so views.jsx never hardcodes a second copy of the block label/ring classes."
    - "GuardApp.jsx finds its own hero item by walking boardItemsForDates' own day/time-sorted output instead of writing a second shift+task sort in this file — the single merge path (P-05, 05-01) now has two call sites (UnifiedBoard.jsx and GuardApp.jsx) but never a second implementation."

key-files:
  created: []
  modified:
    - src/components/supervisor/UnifiedBoard.jsx
    - src/components/supervisor/views.jsx
    - src/components/GuardApp.jsx

key-decisions:
  - "QUAL-08 markup ownership split: the literal strings/classes (\"לא כשיר/ה\", ring-hairline-strong, the refusal sentence) live in UnifiedBoard.jsx as the single source of truth; People (views.jsx) stays a generic avatar-stack primitive that only renders what it's handed. This satisfies both the plan's acceptance-criteria greps (which target UnifiedBoard.jsx specifically) and 'keep People byte-identical when the new prop is absent' for TaskRow's existing usage."
  - "D-10 scope enforced structurally, not by a separate check: People's isBlocked callback only ever receives guards already resolved from item.assignedGuards (the ids array passed in), so there is no code path that could evaluate isQualified against a guard not already on the item."
  - "NextDuty (GuardApp.jsx) now resolves its background colour via shiftTone(shift.color, shift.type) instead of shift.color directly, and only renders the location line when shift.location is present — required because the hero item can now be a task-shaped object (from taskAsShiftShape) which carries neither field. This is in-scope for Task 2 (P-04 says the hero renders 'the first timed upcoming item', not 'the first upcoming shift'), not a separate deviation."
  - "GuardApp.jsx's hero selection and the participant board's date window are both built by filtering/deduplicating plain arrays (never re-sorting shift/task items) so the plan's 'no second merge/sort path' constraint holds — the only sort of scheduled items in this file is inside boardItemsForDates itself, called from two sites."

patterns-established:
  - "Generic-primitive + caller-owns-copy: a shared display primitive (People) accepts style/text as props rather than hardcoding a second copy of domain vocabulary, keeping the single canonical wording (QUAL-08) in exactly one file."

requirements-completed: [BOARD-01, BOARD-03]

coverage:
  - id: D1
    description: "A person already assigned to an item but no longer qualified for its category shows the QUAL-08 four-signal lock (disabled affordance, replaced \"לא כשיר/ה\" label, lock glyph, neutral ring) on the board, per-assignee not per-item"
    requirement: "BOARD-03"
    verification:
      - kind: unit
        ref: "npm test (scripts/verify-board.mjs, verify-scheduler.mjs, verify-planning.mjs, verify-positions.mjs — all pass; isQualified itself is exercised there, the new render-time call site is not separately unit-tested)"
        status: pass
      - kind: other
        ref: "grep -c isQualified/ring-hairline-strong/'לא כשיר/ה' UnifiedBoard.jsx (all >=1), grep -vE comments | grep -c ring-danger (0), grep -c qualifiedCategories UnifiedBoard.jsx (0) — all pass per plan's acceptance criteria"
        status: pass
    human_judgment: true
    rationale: "No browser session available to this parallel worktree agent. The plan's own Task 2 <human-check> (narrow a participant's qualification on both a shift and a task, confirm identical lock/wording/neutral ring on both) was not run — source-level and grep verification passed, but visual/pixel confirmation is outstanding."
  - id: D2
    description: "A participant opening the app sees their tasks alongside their shifts in one time-ordered list (own scope), and the team-wide schedule block renders through the same component"
    requirement: "BOARD-01"
    verification:
      - kind: unit
        ref: "npm test (scripts/verify-board.mjs proves boardItemsForDates' merge-completeness/ordering, which both UnifiedBoard.jsx and GuardApp.jsx now consume identically)"
        status: pass
      - kind: other
        ref: "grep -c UnifiedBoard GuardApp.jsx (6, >= the required 3: import + 2 mounts), grep -c teamAverages/qualifiedGuardsForPosition unchanged, grep -vE comments | grep -c \"a.startTime.localeCompare(b.startTime)\" GuardApp.jsx (0 — no second sort)"
        status: pass
    human_judgment: true
    rationale: "The plan's Task 2 <human-check> (seed a participant with a task and shifts, confirm merged ordering, hero-card timed-only selection, no duplication, empty-state wording) requires a running dev server and browser — not available in this parallel worktree agent session. Recorded as unrun-verify in WINDOWS.md."
  - id: D3
    description: "The hero 'next duty' card only ever shows a timed item; a timeless item never appears there, and the hero item is not duplicated in the board beneath it"
    requirement: "BOARD-01"
    verification:
      - kind: other
        ref: "Source reading: next is selected by walking myBoard.days[*].timed only (never .timeless); boardShifts/boardTasksForMine filter out next.id before being passed to the participant's UnifiedBoard mount"
        status: pass
    human_judgment: true
    rationale: "Structural/logical correctness confirmed by code reading and passing build/tests; live-browser confirmation of no visual duplication is part of the same unrun human-check above."
  - id: D4
    description: "A participant with nothing this week gets the worded two-branch empty state (nothing published vs. published-but-unassigned), heading updated to the participant copy"
    requirement: "BOARD-01"
    verification:
      - kind: other
        ref: "Source reading: myEmpty.title = 'אין לך כלום השבוע' (UI-SPEC), myEmpty.body keeps the exact two-branch ternary on publishedAll.length, passed to UnifiedBoard's empty prop"
        status: pass
    human_judgment: true
    rationale: "Not visually confirmed in a browser this session — same constraint as D1/D2."

duration: ~35min
completed: 2026-09-02
status: complete
---

# Phase 5 Plan 2: Board Qualification Lock + Guard Board Summary Summary

**Per-assignee QUAL-08 lock treatment ported into `UnifiedBoard.jsx` via an extended `People` primitive, and `GuardApp.jsx`'s `MySchedule` rebuilt to mount the same board component the manager sees — closing the gap RESEARCH.md found where the guard side showed zero tasks.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-02 (session start)
- **Completed:** 2026-09-02
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `People` (views.jsx) gained optional `isBlocked(guard)` / `blockedLabel` / `blockedTitle` / `blockedClassName` props — when a per-person predicate is supplied, exactly that avatar in the stack gets the four-signal QUAL-08 treatment (non-interactive, replaced "לא כשיר/ה" label, lock glyph at size 11/strokeWidth 2.5, neutral ring — never `ring-danger`); every existing caller (`TaskRow` and any other) that doesn't pass the new props renders byte-identically to before.
- `UnifiedBoard.jsx` now calls `isQualified(guard, item.category)` per assignee at render time, scoped to exactly the people already in `item.assignedGuards` (D-10) — the same code path for both shifts and engine-eligible/timeless tasks (BOARD-03), with the QUAL-08 wording/classes defined once in this file and handed to `People` as props.
- `GuardApp.jsx`'s `MySchedule` replaced its shifts-only `mine`/`rest`/hand-rolled team-day-grouping with two `UnifiedBoard` mounts: one scoped to the signed-in guard (`scopeGuardId`), one team-wide — a participant's tasks now appear alongside their shifts, ordered by time, for the first time (RESEARCH.md's correction to D-02's premise is now actually built, not just verified).
- `NextDuty`'s hero card is now robust to a task-shaped item (no `color`/`location` fields): resolves colour via `shiftTone(shift.color, shift.type)` and only renders the location line when present.
- Hero selection walks `boardItemsForDates`' own day/time-sorted output instead of writing a second sort — no second merge path introduced in `GuardApp.jsx`.

## Task Commits

1. **Task 1: מנעול הכשירות על הלוח — ברמת האדם, בניסוח המדויק של QUAL-08** - `9eddf50` (feat)
2. **Task 2: מסך המשתתף עובר לאותו לוח — משמרות ומשימות ברשימה אחת** - `7722539` (feat)

## Files Created/Modified

- `src/components/supervisor/views.jsx` — `People` extended with `isBlocked`/`blockedLabel`/`blockedTitle`/`blockedClassName`, rendering the QUAL-08 four-signal chip per blocked avatar
- `src/components/supervisor/UnifiedBoard.jsx` — imports `isQualified`; `BoardRow` passes the per-assignee qualification predicate + QUAL-08 copy/classes to `People`
- `src/components/GuardApp.jsx` — `MySchedule` rebuilt around two `UnifiedBoard` mounts; `NextDuty` made task-shape-safe; `guardColor` import removed (only used by deleted hand-rolled markup)

## Decisions Made

See `key-decisions` in frontmatter — summarized:
- QUAL-08's literal copy/classes live in `UnifiedBoard.jsx` (satisfies the plan's file-specific grep acceptance criteria); `People` stays a generic primitive driven by props.
- D-10 (only scan people already assigned) is enforced structurally by `People`'s own `ids` parameter, not a separate guard.
- `NextDuty`'s colour/location handling extended to support task-shaped hero items, in-scope per P-04.
- No second sort of shifts/tasks was written in `GuardApp.jsx`; hero selection and the participant board both go through `boardItemsForDates`.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed beyond what the plan itself already anticipated (NextDuty's task-shape handling is explicitly implied by P-04's wording "the first timed upcoming item," not a separate architectural change).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Not Verified (browser UAT)

This is a parallel worktree executor with no browser/preview tool available in this session. Per CLAUDE.md's iron rule 6 ("מה שלא נבדק מדווח כלא נבדק"), the following items from Task 2's `<human-check>` block were **not run** and must be confirmed in a real browser before this plan is considered fully verified:

1. A task assigned to a participant appears in their duty list alongside their shifts, ordered by time.
2. The hero "התורנות הבאה שלך" card shows an item with a real clock time; a timeless item never appears there.
3. Nothing appears twice — the hero item is not repeated in the list beneath it.
4. Narrowing a participant's qualification away from a category they're already assigned to (on both a shift and a task) shows the identical lock, "לא כשיר/ה" wording, and neutral ring — not a red one — on both, from both the supervisor's and the participant's own view.
5. A participant with no assignments sees the worded empty state, distinguishing "nothing published yet" from "published but not assigned."

`npm test` and `npm run build` were run and pass after each task commit (automated `<verify>` steps). Source-level reading confirms the structural/logical claims (D-10 scoping, no second sort, hero exclusion, empty-state branching). Recorded as `unrun-verify` candidates for `.planning/WINDOWS.md`.

## Next Phase Readiness

- `People`'s new `isBlocked`/`blockedLabel`/`blockedTitle`/`blockedClassName` props are available for any future per-person block treatment (e.g. a future position-board qualification display, 05-03/05-04) without a second implementation.
- `UnifiedBoard.jsx` and `GuardApp.jsx`'s `MySchedule` are the single, shared rendering path for both manager and guard views — BOARD-03's "identical treatment on task and shift" promise now holds structurally, not by convention.
- The live browser UAT walkthrough (five items above) should be run before the phase is signed off — recommend a human (or a future agent with browser access) run it against `npm run dev` on port 3000, alongside 05-01's still-outstanding six-item walkthrough.

## Self-Check: PASSED

- FOUND: src/components/supervisor/UnifiedBoard.jsx, src/components/supervisor/views.jsx, src/components/GuardApp.jsx, .planning/phases/05-unified-board/05-02-SUMMARY.md
- FOUND commit 9eddf50 (Task 1)
- FOUND commit 7722539 (Task 2)
- `npm test` (4 scripts) and `npm run build` both re-confirmed green after each task commit.

---
*Phase: 05-unified-board*
*Completed: 2026-09-02*
