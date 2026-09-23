---
phase: 11-inline-demo-cleanup
plan: 01
subsystem: database
tags: [supabase, postgres, react-hooks, data-layer]

# Dependency graph
requires: []
provides:
  - "gs_work_items.is_demo boolean not null default false (migration 0022), mapped isDemo <-> is_demo in api.js"
  - "src/lib/sequenceGuard.js — pure createSequenceGuard() race guard, wired into useGuardian.js's refresh()"
  - "api.unmaterializePositionWeek(positionId, dates) + actions.deletePosition(id, weekDates)"
  - "demoData.js's demoShiftIdsForWeek(shifts, weekDates) + actions.deleteDemoDataForWeek(weekDates)"
affects: [11-02-inline-board-editing, 11-03-demo-cleanup-ui]

# Actuals (#2632)
actuals:
  tokens: 5000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure createSequenceGuard() factory (next()/isCurrent(token)) used to gate a single async choke point against out-of-order resolution — no React/DOM dependency, testable in Node like autoAssign.js/fairness.js/conflicts.js."
    - "unmaterializePositionWeek mirrors clearAssignments' no-.select()-no-count convention (zero rows deleted is legitimate), not deleteShift's .select()+count convention (zero rows is a failure) — the two conventions coexist deliberately in api.js depending on whether the caller already knows the row exists."

key-files:
  created:
    - supabase/migrations/0022_work_items_is_demo.sql
    - src/lib/sequenceGuard.js
  modified:
    - src/lib/api.js
    - src/lib/demoData.js
    - src/hooks/useGuardian.js
    - scripts/verify-planning.mjs

key-decisions:
  - "is_demo lives only on gs_work_items, not on gs_work_item_assignments — 'demo assignment' is derived (any assignment on an is_demo=true work item), leaning on the existing on-delete-cascade FKs instead of a second flag (11-CONTEXT.md decision, adopted as-is)."
  - "deletePosition(id, weekDates = []) — default empty array keeps every existing caller (RosterWizard, PositionsScreen) byte-identical; only a caller that opts into passing weekDates gets the FK safety net."
  - "deleteDemoDataForWeek reuses api.deleteShifts unchanged instead of adding a new DB endpoint — the destructive surface area stays exactly what it was before this plan."

patterns-established:
  - "Pattern: sequencing token issued before an async call, checked before every state-painting branch after it (success and failure) — reusable anywhere refresh()-shaped races can occur."

requirements-completed: [INLINE-02, INLINE-04, INLINE-01, INLINE-03]

coverage:
  - id: D1
    description: "gs_work_items.is_demo column exists and round-trips through api.js's shiftFromRow/shiftToRow/shiftRowToWorkItem in both directions, including the pre-migration/missing-column case"
    requirement: INLINE-02
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — six INLINE-02 checks (present/absent/round-trip/shiftRowToWorkItem pass-through)"
        status: pass
    human_judgment: false
  - id: D2
    description: "seedDemoTeam and seedArmyRoster (via positionPlanToShiftRow) are the only two insert points across demoData.js that set is_demo:true; every other write path defaults to false"
    requirement: INLINE-02
    verification:
      - kind: unit
        ref: "static grep check — exactly 2 occurrences of `is_demo: true` in src/lib/demoData.js"
        status: pass
    human_judgment: false
  - id: D3
    description: "refresh() in useGuardian.js is sequenced with createSequenceGuard so a stale response can never overwrite a fresher one, regardless of resolve order, without touching any of the ~12 existing call sites or the realtime subscription"
    requirement: INLINE-04
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — four INLINE-04 sequenceGuard checks (monotonic tokens, isCurrent true/false, out-of-order resolve simulation)"
        status: pass
      - kind: manual_procedural
        ref: "PLAN.md Task 2 <human-check> — rapid double-action race scenario in a live logged-in browser session, across stepper/board/ScheduleMgmt"
        status: unknown
    human_judgment: true
    rationale: "The plan's own verify block requires live-browser confirmation of the race-condition fix under real double-click timing against a real Supabase session; this executor had no stored login credentials or browser session for this app and did not fake the check. See the report's Checkpoint section for exact repro steps."
  - id: D4
    description: "unmaterializePositionWeek deletes only the given week's realized gs_work_items rows for a position, tolerating zero rows deleted as legitimate (mirrors clearAssignments, not deleteShift)"
    requirement: INLINE-01
    verification:
      - kind: unit
        ref: "static check — unmaterializePositionWeek body contains no .select() call"
        status: pass
    human_judgment: false
  - id: D5
    description: "deletePosition(id, weekDates) unmaterializes only the passed week before deleting the position; default weekDates=[] preserves existing caller behavior"
    requirement: INLINE-01
    verification:
      - kind: unit
        ref: "static check — deletePosition action signature and unmaterializePositionWeek call site"
        status: pass
    human_judgment: false
  - id: D6
    description: "demoShiftIdsForWeek is pure and correctly isolates demo-shift ids for a given week from a mixed dataset (demo/real, this-week/other-week)"
    requirement: INLINE-03
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — four INLINE-03 demoShiftIdsForWeek checks"
        status: pass
    human_judgment: false
  - id: D7
    description: "deleteDemoDataForWeek(weekDates) is a no-op with no write when there is no demo data in the week, and reuses api.deleteShifts otherwise"
    requirement: INLINE-03
    verification:
      - kind: unit
        ref: "static check — deleteDemoDataForWeek references demoShiftIdsForWeek and api.deleteShifts"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-23
status: complete
---

# Phase 11 Plan 01: Data/State Layer for Inline Editing + Demo Cleanup + Week-Status Race Summary

**`gs_work_items.is_demo` end-to-end, a pure `sequenceGuard` fix for the `refresh()` race, and backend-only support for army-safe position deletion + weekly demo-data cleanup — no UI files touched.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-23T09:36:00Z (approx, worktree checkout time)
- **Completed:** 2026-09-23T09:45:00Z
- **Tasks:** 3 (all `type="auto"`/`type="tracer"`, no checkpoint tasks)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `gs_work_items.is_demo boolean not null default false` (migration 0022), mapped through `api.js` in both directions, flagged `true` at exactly the two demo-data insert points (`seedDemoTeam`, `positionPlanToShiftRow` used by `seedArmyRoster`) — every other write path (manual create/update/materialize) keeps defaulting to `false`.
- `src/lib/sequenceGuard.js`, a pure `createSequenceGuard()` factory, wired into `useGuardian.js`'s `refresh()` as a single choke-point fix for the out-of-order `loadTeam()` resolution race described in `11-CONTEXT.md` §4 — none of the ~12 existing `refresh()` call sites or the realtime subscription were touched.
- `api.unmaterializePositionWeek(positionId, dates)` + `actions.deletePosition(id, weekDates = [])`: unmaterializes only the displayed week's realized shifts for an army position before the `gs_positions` DELETE, avoiding a live foreign-key violation (`gs_work_items.position_id` has no `on delete cascade`).
- `demoData.js`'s pure `demoShiftIdsForWeek(shifts, weekDates)` + `actions.deleteDemoDataForWeek(weekDates)`: no-op when nothing to delete, otherwise reuses the existing `api.deleteShifts` (RLS + row-count check already in place) through `deferred()` for the standard 8-second undo — no new destructive DB endpoint.

## Task Commits

Each task was committed atomically:

1. **Task 1: is_demo end-to-end — migration → api.js → demoData.js (INLINE-02)** - `d67e077` (feat)
2. **Task 2: refresh() — sequence guard against out-of-order resolution (INLINE-04)** - `aa84041` (fix)
3. **Task 3: army FK safety net + "מחק נתוני הדגמה לשבוע זה" backend (INLINE-01, INLINE-03)** - `fdac24d` (feat)

**Plan metadata:** pending final `docs(11-01): complete plan` commit (created after this summary).

## Files Created/Modified
- `supabase/migrations/0022_work_items_is_demo.sql` - New migration adding `is_demo` to `gs_work_items`, no new RLS policy
- `src/lib/api.js` - `SHIFT_SELECT`/`shiftFromRow`/`shiftToRow` map `is_demo`↔`isDemo`; `shiftRowToWorkItem` documented (no code change — rest-spread already carries it); new `unmaterializePositionWeek(positionId, dates)`
- `src/lib/demoData.js` - `is_demo: true` on the two demo-seed insert points; new pure `demoShiftIdsForWeek(shifts, weekDates)`
- `src/lib/sequenceGuard.js` - New pure module: `createSequenceGuard()` → `{ next(), isCurrent(token) }`
- `src/hooks/useGuardian.js` - `refresh()` gated by `refreshSeqRef`; `deletePosition` signature extended with `weekDates = []`; new `deleteDemoDataForWeek` action
- `scripts/verify-planning.mjs` - Round-trip/unit tests for `is_demo`, `createSequenceGuard`, and `demoShiftIdsForWeek`

## Decisions Made
- `is_demo` placement and "demo assignment is derived" — followed `11-CONTEXT.md`'s locked decision exactly, no deviation.
- `unmaterializePositionWeek` deliberately mirrors `clearAssignments`' no-`.select()` convention rather than `deleteShift`'s `.select()`+count convention, because zero rows deleted is a legitimate outcome here (position not yet materialized for the week) rather than an RLS-filtered failure.
- Placed `deleteDemoDataForWeek` next to `clearAssignments`/`deleteShifts` in the `actions` object, per the plan's own guidance, reusing `api.deleteShifts` unchanged.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' automated `<verify>` blocks pass (`npm test`, `npm run build`, and every task-specific `node -e` structural check).

## Issues Encountered

**Supabase migration not applied to the live database.** The orchestrating instructions asked for migration 0022 to be applied via Supabase MCP tools (project_id `biauxcgphdhwewszupsq`) as part of execution. This executor's tool set (spawned as a subagent inside a git worktree) does not include any `mcp__supabase__*` tools, the Supabase CLI, or `psql` — none were available to invoke, and no database credentials (service role key, DB password) are present in the worktree to apply DDL through any other channel. The anon/publishable key in `src/lib/supabaseClient.js` cannot run `ALTER TABLE` regardless of RLS. **The migration file exists at `supabase/migrations/0022_work_items_is_demo.sql` and is committed, but has not been run against the live database.** Someone with Supabase MCP access or dashboard/CLI access needs to apply it before `is_demo` reads/writes will work against the real backend (the code gracefully treats a missing column as `isDemo: false`, so this does not break existing functionality — it just means demo-flagging isn't live yet).

## User Setup Required

**Apply migration 0022 to the live Supabase project (`biauxcgphdhwewszupsq`) before Plan 11-03 (which builds "מחק נתוני הדגמה לשבוע זה" UI) is tested live:**
```sql
alter table gs_work_items
  add column if not exists is_demo boolean not null default false;
```
Run via Supabase Studio SQL editor, the Supabase CLI (`supabase db push` once linked), or Supabase MCP tools — whichever is available to the operator applying this. No RLS policy changes needed.

## Requirements Traceability

This plan's frontmatter lists `requirements: [INLINE-02, INLINE-04, INLINE-01, INLINE-03]`, matching the IDs also claimed by `11-02-PLAN.md` (INLINE-01) and `11-03-PLAN.md` (INLINE-03, INLINE-01, INLINE-02, INLINE-04) — this is the data/state foundation, not the full user-facing capability REQUIREMENTS.md describes (which needs the inline board UI from 11-02 and the demo-cleanup button + live "מצב השבוע" verification from 11-03). **`REQUIREMENTS.md` checkboxes were deliberately left unchecked by this plan** rather than marked complete prematurely — checking them now would misrepresent INLINE-01/03 (backend-only here, UI still pending) and INLINE-04 (fix implemented and unit-tested, but not yet confirmed by the live-browser reproduction the requirement itself demands: "מאומת בתרחיש שחזור מלא"). INLINE-02 is closest to fully done at the data layer, but even it depends on the still-unapplied migration 0022 to be true against the live database. Whichever of 11-02/11-03 completes last should run `requirements mark-complete` once the full picture is verified.

## Next Phase Readiness

Data/state layer is ready for Plan 11-02 (inline board editing) and Plan 11-03 (demo cleanup UI + "מצב השבוע" verification) to wire UI against:
- `isDemo` is available on every shift object returned by `api.loadTeam`/`shiftFromRow` (once migration 0022 is applied live).
- `actions.deleteDemoDataForWeek(weekDates)` and `actions.deletePosition(id, weekDates)` are ready to be called from UI with no further backend work.
- `refresh()`'s race-condition fix is in place and unit-tested, but **needs the live-browser human-check from Task 2** (see below) before INLINE-04 can be marked fully verified.

**Outstanding before Phase 11 is fully closed:**
1. Apply migration 0022 to the live database (see User Setup Required above).
2. Live-browser verification of the `refresh()` race fix (Task 2's `<human-check>`, D3 above) — could not be performed by this executor (no stored app credentials/session). Repro steps, copied from the plan: run `npm run dev`, log in as a supervisor with a team that has at least one shift and one guard, open "בניית שבוע", go to step "שיבוץ" (assign), and click the same person against the same shift twice in rapid succession (assign then unassign, or assign one person then another) before the first "שומר…" indicator disappears. Confirm: (1) the stepper's counts settle on the correct number; (2) the board step's avatars match what's actually assigned; (3) the "שליחה לצוות" step's publish count matches. Repeat via a quick delete-then-add of a shift in the non-army "shifts" step if timing allows. A single (non-rapid) action should still update immediately as before — no regression.

---
*Phase: 11-inline-demo-cleanup*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 6 files created/modified this plan verified present on disk; all 3 task commit hashes (`d67e077`, `aa84041`, `fdac24d`) verified present in `git log`.
