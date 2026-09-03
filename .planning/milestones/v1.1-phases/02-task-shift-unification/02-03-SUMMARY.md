---
phase: 02-task-shift-unification
plan: 03
subsystem: scheduling-engine
tags: [react, ui-wiring, memoization, wcag, load-reporting]

# Dependency graph
requires:
  - phase: 02-task-shift-unification (plan 02-01)
    provides: "windowsOverlap, isTaskEngineEligible, taskAsShiftShape, withEngineTasks (src/lib/dates.js) — the engine primitives and the single reporting merge this plan wires into every call site"
  - phase: 02-task-shift-unification (plan 02-02)
    provides: "gs_tasks.start_time/end_time, TaskMgmt's hour fields, isSingleDayTask-gated form — the persisted data this plan's badge and hour display read"
provides:
  - "tasks prop threaded through SupervisorApp -> WeekFlow -> SmartAssign/AssignView, and through SwapMgmt/MySwaps, so every legality check the engine can answer now sees a person's tasks"
  - "withEngineTasks wired at all four reporting call sites (GuardApp's teamAverages, SupDashboard's loadTable, Analytics' loadTable, AssignView's fairnessPlan) — one merge, not four"
  - "TaskRow's frozen badge (lock icon + Hebrew words, neutral tone) — visible only when !isTaskEngineEligible(task); an eligible task shows its hours instead"
  - "SupDashboard's open-tasks StatCard subtitle stating the counted/frozen split"
  - "Reports pie chart gains a task-only slice so the header count and the pie total reconcile"
affects: []

# Actuals (#2632)
actuals:
  tokens: 5400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One merge helper (withEngineTasks) called inside the useMemo that already exists at each reporting call site — never a private per-file merge."
    - "UI-level eligibility checks read isTaskEngineEligible directly rather than re-deriving 'has hours' inline, so a badge or a filter can never disagree with what the engine actually did."
    - "Week-scoped task list for the auto-assign run (SmartAssign's weekTasks), narrowed the same way weekShifts already is, to avoid a task from outside the planned week silently consuming a maxShiftsPerWeek slot."

key-files:
  created: []
  modified:
    - src/components/SupervisorApp.jsx
    - src/components/supervisor/WeekFlow.jsx
    - src/components/SmartAssign.jsx
    - src/components/supervisor/views.jsx
    - src/components/supervisor/Analytics.jsx
    - src/components/GuardApp.jsx

key-decisions:
  - "Analytics.jsx had no pre-existing import from dates.js (the plan assumed one existed to extend) — added a fresh `import { withEngineTasks } from \"../../lib/dates.js\"` statement instead. Same outcome the plan intended (no second/duplicate import of the same symbol), just no prior import line to extend."
  - "Reports pie gets a separate type list (SHIFT_TYPES plus a task entry, using terms.js's `nav.tasks` label and the shift palette's neutral `custom` tone) rather than modifying SHIFT_TYPES itself, because the stacked bar's legend still reads SHIFT_TYPES directly and has no task segment to legend."
  - "Frozen-badge Hebrew wording settled on \"מחוץ למנוע\" (short, words not an abbreviation) with a `title` attribute carrying the one-sentence explanation, per the plan's D-03 instruction."
  - "SupDashboard's open-tasks subtitle text: \"{counted} נספרות במנוע · {frozen} קפואות\", shown only when there is at least one open task, matching D-04's 'always, once there is at least one open task' rule."

patterns-established:
  - "Reporting call sites merge tasks in via withEngineTasks inside their existing useMemo, keyed on the arrays it reads — no call site allocates a merged array outside a memo."
  - "A frozen/counted UI decision (badge, hours display, dashboard split) always reads isTaskEngineEligible directly — never re-derives 'has hours and is single-day' inline."

requirements-completed: [UNIF-02, UNIF-05]

coverage:
  - id: D1
    description: "SmartAssign's autoAssign() call receives a week-narrowed task list (weekTasks), so a task from outside the planned week cannot silently consume a maxShiftsPerWeek slot; the underlying rest/overlap/consecutive/weekly-cap rejection logic for task-seeded load was already proven in plan 02-01"
    requirement: "UNIF-02"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — UNIF-02 · Tests H-P (rest/overlap/consecutive/weekly-cap via a task, proven in plan 02-01 against autoAssign() directly)"
        status: pass
      - kind: other
        ref: "shell gate — grep confirms SmartAssign.jsx's autoAssign({...}) call includes `tasks: weekTasks`, and weekTasks is memoised on [tasks, weekDates]"
        status: pass
    human_judgment: true
    rationale: "The engine-level rejection logic (rest/overlap/consecutive/weekly-cap via a task) is unit-tested against autoAssign() directly in plan 02-01. What this plan adds is UI wiring — SmartAssign.jsx actually passing the week's tasks into that call. No browser tool (mcp__Claude_Browser__* or equivalent) was available in this session to run the plan's own <human-check> (open the assignment step, run auto-assign, confirm a task-colliding guard is skipped with the same reason text a shift collision produces). Reported as unverified in the browser, not assumed working."
  - id: D2
    description: "Approving a swap (SwapMgmt) and a participant accepting one (MySwaps) both run checkAssignment with the guard's tasks included, unnarrowed to a week"
    requirement: "UNIF-02"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — UNIF-02 (checkAssignment with seeded task load, proven in plan 02-01 against the lib function directly)"
        status: pass
      - kind: other
        ref: "shell gate — grep confirms both src/components/supervisor/views.jsx's SwapMgmt and src/components/GuardApp.jsx's MySwaps pass `tasks` into checkAssignment({...})"
        status: pass
    human_judgment: true
    rationale: "checkAssignment()'s task-aware rejection is unit-tested at the lib level (02-01). The UI wiring (both call sites actually passing tasks, and the supervisor/participant sides showing the same verdict) was grep-verified structurally but not exercised live in a browser — no browser tool was available this session."
  - id: D3
    description: "The participant's own fairness row (GuardApp's MySchedule -> teamAverages) includes their task hours, via withEngineTasks merged with publishedAll (tasks are not filtered by `published` — a task has no such flag)"
    requirement: "UNIF-02"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — UNIF-02 · withEngineTasks/loadTable/fairnessPlan post-merge coherence tests (Test S/T/U, plan 02-01) prove the merge function itself is coherent"
        status: pass
      - kind: other
        ref: "shell gate — grep confirms GuardApp.jsx's MySchedule builds `withTasks = withEngineTasks(publishedAll, tasks)` inside a useMemo and passes it to teamAverages() in place of publishedAll"
        status: pass
    human_judgment: true
    rationale: "The merge helper's correctness is unit-tested (02-01). Whether a real participant's fairness number visibly rises by their task hours, and whether it matches the number the supervisor's reports table shows for the same person, requires opening the app in a browser as two different sessions — not exercised this session, no browser tool available."
  - id: D4
    description: "All four reporting call sites (GuardApp teamAverages, SupDashboard loadTable, Analytics loadTable, AssignView fairnessPlan) route through the single withEngineTasks merge inside their existing memo — none grew a private merge"
    requirement: "UNIF-02"
    verification:
      - kind: unit
        ref: "npm test — full suite (180 assertions, 0 failures) after all four call sites were wired, confirming no regression to any existing UNIF/FAIR assertion"
        status: pass
      - kind: other
        ref: "shell gates — grep confirms withEngineTasks appears at all four call sites (GuardApp.jsx x2, views.jsx x4 incl. SupDashboard+AssignView, Analytics.jsx x4); `git diff --name-only -- src/lib/loadTable.js src/lib/fairness.js src/lib/autoAssign.js` is empty, confirming no engine module was edited"
        status: pass
    human_judgment: false
  - id: D5
    description: "Frozen task carries a visible badge (lock icon + Hebrew words, neutral tone) derived from isTaskEngineEligible; an active/eligible task carries no badge and shows its hours behind a clock icon instead (D-03)"
    requirement: "UNIF-05"
    verification:
      - kind: other
        ref: "shell gates — sed-scoped grep on TaskRow's body confirms exactly one `icon=\"lock\"` and at least one `name=\"clock\"`; isTaskEngineEligible appears >=2 times in views.jsx (TaskRow's eligible check + SupDashboard's split)"
        status: pass
    human_judgment: true
    rationale: "Structural presence of the badge/hours markup and its data source (isTaskEngineEligible) is grep-verified. Actual visual rendering — badge legible in dark mode, hover title showing the explanation, badge absent on an eligible row, hours present instead — was not confirmed in a browser this session (no browser tool available), per the plan's own <human-check>."
  - id: D6
    description: "SupDashboard's open-tasks card states how many open tasks count in the engine and how many are frozen, derived from the same isTaskEngineEligible predicate (D-04 within D-08's scope boundary)"
    requirement: "UNIF-05"
    verification:
      - kind: other
        ref: "shell gate — grep confirms StatCard's subtitle is built from openTasksCounted/openTasksFrozen, both derived via isTaskEngineEligible filtering openTasksList; arithmetic (frozen = openTasks - counted) is correct by construction"
        status: pass
    human_judgment: true
    rationale: "The subtitle's arithmetic is guaranteed correct by construction (frozen is derived as the complement of counted), but the actual on-screen appearance and wording were not visually confirmed in a browser this session."
  - id: D7
    description: "Every reporting call site's merge happens inside the useMemo already at that site, keyed on its inputs — no per-render work added"
    requirement: "UNIF-02"
    verification:
      - kind: other
        ref: "shell gate — grep confirms Analytics.jsx still has >=3 useMemo calls after the edit, and every withEngineTasks call site (checked by reading each diff) sits inside an existing useMemo body, never in render body or inside a .map"
        status: pass
    human_judgment: false
  - id: D8
    description: "WeekCalendar.jsx and CalendarView.jsx remain untouched and still render no task — the D-08 scope boundary holds after this plan, not just before it"
    requirement: "UNIF-05"
    verification:
      - kind: other
        ref: "shell gates — `git diff --name-only main..HEAD -- src/components/supervisor/WeekCalendar.jsx src/components/supervisor/CalendarView.jsx` is empty; case-insensitive grep for 'task' in both files returns 0 matches, matching the plan's own pre-check"
        status: pass
    human_judgment: false
  - id: D9
    description: "The reports pie chart's task slice reconciles with the header's total-assigned count, closing the pre-existing gap where loadTable counted tasks in byType/totalAssigned but the pie's SHIFT_TYPES filter had no bucket for them"
    requirement: "UNIF-02"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — UNIF-02 · loadTable byType.task/totalAssigned coherence (Test T, plan 02-01) proves the underlying numbers already agreed before this plan's chart fix"
        status: pass
    human_judgment: true
    rationale: "The underlying data (byType.task, totalAssigned) was already proven coherent at the lib level in plan 02-01. This plan adds the missing pie-chart bucket so the *rendered* chart visually reconciles with the header count — that rendering was not confirmed in a browser this session."

duration: ~35min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 3: Wire the Unified Engine Into Every Screen Summary

**`tasks` now reaches every engine question (autoAssign, both checkAssignment call sites) and every reporting figure (teamAverages, both loadTable call sites, fairnessPlan) through one shared merge helper, and a frozen task carries a neutral lock-icon badge on the only surface that renders one — an active task shows its hours instead.**

## Performance

- **Duration:** ~35 min (task-commit window 00:07–00:16 UTC+2, plus prior file discovery/reading)
- **Completed:** 2026-08-26
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `tasks` is threaded from `SupervisorApp`'s `common` object through `WeekFlow` to `SmartAssign` (week-narrowed via a new `weekTasks` memo) and to `AssignView` (unnarrowed, merged inside its existing `fairnessPlan` memo); `SwapMgmt` and `GuardApp`'s `MySwaps` both pass the full, unnarrowed task list into `checkAssignment`.
- `GuardApp` destructures `tasks` from `state` (already populated by `useGuardian`, per plan 02-01's finding) and passes it to `MySchedule` and `MySwaps`.
- All four reporting call sites — `GuardApp`'s `teamAverages`, `SupDashboard`'s `loadTable`, `Analytics`'s `loadTable`, and `AssignView`'s `fairnessPlan` — now merge tasks in via `withEngineTasks` (plan 02-01) inside their existing `useMemo`. No call site grew a private merge; no engine module (`autoAssign.js`, `fairness.js`, `loadTable.js`) was touched.
- `GuardApp`'s participant fairness merge deliberately does not filter tasks by `published` (unlike shifts) — a task carries no such flag, it is work that exists, not a draft awaiting release. This is documented inline so the asymmetry with `publishedAll` on the line above doesn't read as an oversight.
- The reports screen's pie chart gains a task-only slice (a separate list layered on top of `SHIFT_TYPES`, using `terms.js`'s `nav.tasks` label and the shift palette's neutral `custom` tone), so the header's `totalAssigned` count and the pie's total now reconcile — `SHIFT_TYPES` itself, and the stacked bar's legend that reads it, are unchanged.
- `TaskRow` (the only surface in the codebase that renders an individual task) derives eligibility from `isTaskEngineEligible` — the same predicate the engine uses — and shows either a neutral badge with a lock icon and the words "מחוץ למנוע" (never colour alone) plus a `title` explaining why, **or** the task's hours behind a clock icon. Never both, never neither.
- `SupDashboard`'s open-tasks `StatCard` gains a subtitle stating the counted/frozen split, computed with the same `isTaskEngineEligible` predicate, shown once there is at least one open task.
- `WeekCalendar.jsx` and `CalendarView.jsx` were not touched — confirmed both before and after this plan's edits that neither file contains any reference to a task (case-insensitive grep, 0 matches in both), matching D-08's scope boundary from `02-RESEARCH.md`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread tasks to every place that asks the engine a question (UNIF-02)** - `9c6766a` (feat)
2. **Task 2: One merge feeds every load figure on every screen (UNIF-02)** - `aa10ab5` (feat)
3. **Task 3: Counted or frozen, visible without being noise (UNIF-05)** - `7876de6` (feat)

## Files Created/Modified

- `src/components/SupervisorApp.jsx` - `tasks` added to the `common` object and to the explicit `<SwapMgmt>`/`<AnalyticsDash>` props.
- `src/components/supervisor/WeekFlow.jsx` - `tasks = []` added to the signature, to its own `common` object, and to the `<SmartAssign>` element.
- `src/components/SmartAssign.jsx` - `tasks = []` added to the signature; a new `weekTasks` memo narrows tasks to the planned week; passed into `autoAssign({..., tasks: weekTasks})`.
- `src/components/supervisor/views.jsx` - `SwapMgmt` and `AssignView` gain `tasks = []` and pass/merge it into `checkAssignment`/`fairnessPlan`; `SupDashboard`'s `loadTable` memo merges tasks via `withEngineTasks`; `SupDashboard`'s open-tasks `StatCard` gains a counted/frozen subtitle; `TaskRow` gains the frozen badge and the hours display.
- `src/components/supervisor/Analytics.jsx` - `AnalyticsDash` gains `tasks = []`; its `loadTable` memo merges tasks via `withEngineTasks` (new import from `dates.js`); the pie's `typeStats` now reads from a task-inclusive type list instead of `SHIFT_TYPES` alone.
- `src/components/GuardApp.jsx` - `MySwaps` gains `tasks = []` and passes it into `checkAssignment`; `MySchedule` gains `tasks = []`, merges it with `publishedAll` via `withEngineTasks`, and feeds the merged array to `teamAverages`; the shell destructures `tasks` from `state` and passes it to both child screens.

## Decisions Made

- **Analytics.jsx's `dates.js` import is new, not extended.** The plan assumed an existing import from `dates.js` to extend; `Analytics.jsx` had none before this plan (confirmed via `git show HEAD:...Analytics.jsx | grep`). Added a single fresh `import { withEngineTasks } from "../../lib/dates.js"` — same outcome the plan intended (no duplicate import of the same symbol), just no prior line to extend.
- **Pie chart's task slice lives in a separate list, not in `SHIFT_TYPES`.** `SHIFT_TYPES` stays exactly as it was because the stacked bar's legend reads it directly and has no task segment to legend; a new list (`SHIFT_TYPES` plus a task entry) feeds only the pie's `typeStats`.
- **Frozen badge wording:** "מחוץ למנוע" (short, words not an abbreviation), with a `title` attribute carrying the one-sentence explanation (no hours, or spans more than a day — so it doesn't count toward rest, consecutive hours, weekly cap or load).
- **Dashboard subtitle wording:** `"{counted} נספרות במנוע · {frozen} קפואות"`, shown only once `openTasks > 0`, per D-04's "always, once there is at least one open task" instruction.

## Deviations from Plan

None - plan executed exactly as written, aside from the Analytics.jsx import decision documented above (not a deviation under Rules 1-4 — the plan's own instruction ("extend the existing import") simply didn't apply to a file with no such import; the outcome, one import statement for the new symbol, is what the plan intended).

## Issues Encountered

- **No browser tool (`mcp__Claude_Browser__*`, `preview_start`, or equivalent) was available in this session**, matching plans 02-01 and 02-02's reported experience. Per the task instructions, the plan's own `<human-check>` steps — confirming in a running dev server that (1) a task-colliding shift is actually blocked by the smart-assignment run with a task-aware reason, (2) the swap-approval screen and the participant's swap screen agree on legality, (3) the participant's fairness figure visibly rises by their task hours and matches the supervisor's reports table, (4) the frozen badge and hours line render correctly (including in dark mode), and (5) the dashboard's counted/frozen subtitle appears and updates — were **not performed**. All *automated* verification (structural grep gates, `npm test` — 180 assertions, 0 failures — and `npm run build`) passed. The `coverage:` block above marks every deliverable that depends on live browser rendering as `human_judgment: true` with an explicit rationale, rather than claiming visual verification that did not happen, per CLAUDE.md's iron principle 6 ("אימות בדפדפן — 'עובד' נאמר רק אחרי שראית את זה עובד").
- **Worktree branch was stale at spawn** (same condition plans 02-01 and 02-02 hit): `git merge-base HEAD main` showed the worktree's branch (`worktree-agent-ab030f8867d65ad0c`) was a pure ancestor of `main` with zero unique commits, predating all of `.planning/` and both prior Phase 2 plans. Verified the zero-unique-commits condition first, then fast-forwarded (`git merge main --ff-only`) — a lossless ref move, not a destructive reset. `npm test` and `npm run build` both passed cleanly on the fast-forwarded worktree before any edits began.

## User Setup Required

None - no external service configuration required. (The `0005_task_hours.sql` migration from plan 02-02 was already confirmed applied per the phase's most recent commit before this plan started.)

## Next Phase Readiness

**Phase 2 (task-shift-unification) is now feature-complete across all three waves.** `windowsOverlap`/`isTaskEngineEligible`/`taskAsShiftShape`/`withEngineTasks` (02-01) are wired into every enumerated call site (02-03); the hour columns and form (02-02) feed the badge and hours display (02-03).

**Outstanding before the phase can be called fully verified, not just structurally correct:**
- The five `<human-check>` items listed under "Issues Encountered" above need a human or a session with browser access to confirm — this is the honest gap this plan is reporting, matching the rigor of `01-03-SUMMARY.md`'s own honest gap.
- Plan 02-02's own outstanding browser verification (TaskMgmt's hour-field form behavior) is still open per that plan's summary and was not re-attempted here — out of this plan's scope (files_modified didn't include the form itself).

No code blockers for a phase-level `/gsd-verify-work` pass; the blockers are exclusively "seen it work in a browser" claims that remain unverified in this environment.

---
*Phase: 02-task-shift-unification*
*Completed: 2026-08-26*

## Self-Check: PASSED

All modified files confirmed present on disk (`src/components/SupervisorApp.jsx`, `src/components/supervisor/WeekFlow.jsx`, `src/components/SmartAssign.jsx`, `src/components/supervisor/views.jsx`, `src/components/supervisor/Analytics.jsx`, `src/components/GuardApp.jsx`, this SUMMARY). All three task commit hashes (`9c6766a`, `aa10ab5`, `7876de6`) confirmed present in `git log`. `npm test` (180 assertions, 0 failures) and `npm run build` both exit 0 on the final state. `package.json`/`package-lock.json` unchanged (no new dependency). No unexpected file deletions across the three task commits (`git diff --diff-filter=D` empty for each). `src/lib/autoAssign.js`, `src/lib/fairness.js`, `src/lib/loadTable.js`, `src/components/supervisor/WeekCalendar.jsx`, `src/components/supervisor/CalendarView.jsx` confirmed unmodified. The browser/interactive checks are explicitly reported as NOT done, per "Issues Encountered" above — not silently assumed.
