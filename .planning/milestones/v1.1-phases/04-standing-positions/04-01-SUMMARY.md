---
phase: 04-standing-positions
plan: 01
subsystem: database
tags: [supabase, postgres, rls, autoAssign, react-hooks]

requires:
  - phase: 03-qualification
    provides: isQualified()/qualifiedCategories, category as the shared qualification surface

provides:
  - "gs_positions table live in Supabase with RLS (team-scoped read, supervisor-only write)"
  - "position_id nullable FK on gs_shifts and gs_tasks (on delete set null), non-partial unique indexes for idempotency"
  - "src/lib/positions.js — pure weekly-materialization module (expectedDatesForWeek, plannedRowsForWeek, missingRowsForWeek, qualifiedGuardsForPosition, workingGuardIdsForWeek)"
  - "api.js position CRUD + materializeTemplateShifts; useGuardian actions addPosition/updatePosition/deletePosition/ensurePositionsForWeek"
  - "A working D-02 tracer: a template position's materialized shifts are filled by the real, unmodified autoAssign()"

affects: [04-02-positions-screen, 04-03-weekly-rotation]

actuals:
  tokens: 11051
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Deterministic weekly materialization: identity = (positionId, date), derived only from the sundayISO argument, never wall clock"
    - "Non-partial unique index for supabase-js upsert(onConflict) compatibility — NULL≠NULL already guards multi-null rows without a WHERE predicate"
    - "T-04-05 DoS gate: ensurePositionsForWeek returns {created:0} with zero writes/refresh() when nothing is missing"

key-files:
  created:
    - supabase/migrations/0007_standing_positions.sql
    - supabase/migrations/0008_positions_index_fix.sql
    - src/lib/positions.js
    - scripts/verify-positions.mjs
    - .planning/phases/04-standing-positions/deferred-items.md
  modified:
    - src/lib/api.js
    - src/hooks/useGuardian.js
    - scripts/verify-backend.mjs
    - package.json

key-decisions:
  - "Task 1 schema decision (locked before any SQL was written): required_guards kept on gs_positions (default 1, exposed but not required); weekly-shape identity date is start_date=Sunday/due_date=Saturday (spans the week), a deliberate deviation from 04-RESEARCH.md's original due_date=Sunday sketch; rotation stays a flat all-time turn count, not a rolling window."
  - "Rule 1 auto-fix: the partial unique index on (position_id, date) from 0007 could not be targeted by supabase-js's upsert(onConflict) bare-column-list inference — Postgres requires the predicate to be part of the ON CONFLICT clause for a partial index, which supabase-js's API cannot express. Fixed in 0008 with a non-partial index; NULL≠NULL in Postgres already prevents position_id=NULL rows from colliding, so no functional protection was lost."
  - "A1 resolved live: gs_shifts.start_time/end_time are NOT NULL (confirmed via Supabase list_tables — no nullable flag, unlike gs_shifts.category). Confirms weekly-shape positions correctly route to gs_tasks (nullable hours), never gs_shifts."

patterns-established:
  - "Position definitions are a separate table from their weekly realizations — gs_positions holds config, gs_shifts/gs_tasks rows (tagged with position_id) are the plain, ordinary weekly instances, filled by the existing engines unmodified."

requirements-completed: [POS-01, POS-02, POS-03, POS-04]

coverage:
  - id: D1
    description: "gs_positions table live with RLS: team-scoped read, supervisor-only write, verified against the real database"
    requirement: "POS-01"
    verification:
      - kind: integration
        ref: "npm run test:backend — '=== standing positions (gs_positions) ===' section, all 8 checks"
        status: pass
    human_judgment: false
  - id: D2
    description: "Idempotent weekly materialization: (position_id, date) uniqueness enforced at the DB layer, upsert(ignoreDuplicates:true) is a safe no-op on repeat"
    requirement: "POS-04"
    verification:
      - kind: integration
        ref: "npm run test:backend — duplicate insert rejected, ignoreDuplicates:true no-op, exactly one row survives"
        status: pass
      - kind: unit
        ref: "scripts/verify-positions.mjs — POS-04 · missingRowsForWeek section (5 rows, second call empty, shuffled-order stable, other-position row does not suppress)"
        status: pass
    human_judgment: false
  - id: D3
    description: "expectedDatesForWeek produces deterministic, wall-clock-independent weekly identity dates for both position shapes"
    requirement: "POS-03"
    verification:
      - kind: unit
        ref: "scripts/verify-positions.mjs — POS-03 section (exact 5 dates, stable across repeats, same offset in past/future weeks, weekly-shape single Saturday date)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Qualification for a position is a pure derivation over the unmodified isQualified()/qualifiedCategories — no new write path, no second qualification concept"
    requirement: "POS-02"
    verification:
      - kind: unit
        ref: "scripts/verify-positions.mjs — POS-02/D-04 section + POS-05 section (qualified vs. working lists proven to derive from different fields)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A template-shape position's materialized shifts are filled end-to-end by the real, unmodified autoAssign(), with no unqualified guard ever selected"
    verification:
      - kind: unit
        ref: "scripts/verify-positions.mjs — D-02 · מקצה לקצה section, including the shuffled-guard-order determinism check"
        status: pass
    human_judgment: false
  - id: D6
    description: "POS-05 minimal screen (dedicated UI showing qualified vs. working lists) — explicitly out of scope for this plan"
    verification: []
    human_judgment: true
    rationale: "This plan (04-01) built the vertical data/engine slice only. The dedicated screen is 04-02's deliverable; the pure functions it will consume (qualifiedGuardsForPosition, workingGuardIdsForWeek) are proven here but not yet wired into any component."

duration: ~90min
completed: 2026-08-27
status: complete
---

# Phase 4 Plan 1: Standing Position Tracer Slice Summary

**`gs_positions` live in Supabase with RLS, a pure weekly-materialization module, and a template position filled end-to-end by the real, unmodified `autoAssign()` — the vertical slice that proves the architecture before the phase expands.**

## Performance

- **Duration:** ~90 min (across two live-migration round trips with the orchestrator)
- **Tasks:** 3 (schema decision, migration + live push, tracer slice)
- **Files modified:** 9 (2 new migrations, 1 new pure module, 1 new test script, api.js, useGuardian.js, verify-backend.mjs, package.json, deferred-items.md)

## Accomplishments

- `gs_positions` table live in the production Supabase project (`biauxcgphdhwewszupsq`) with RLS proven live: team-scoped read, supervisor-only write, both confirmed against the real database via `npm run test:backend`.
- `position_id` nullable FK added to `gs_shifts` and `gs_tasks` (`on delete set null` — history survives position deletion), with a unique index on `(position_id, date)`/`(position_id, due_date)` that actually supports `supabase-js`'s `upsert(..., {onConflict, ignoreDuplicates:true})` idempotency path (a real bug was found and fixed here — see Deviations).
- `src/lib/positions.js`: a new pure module (no React, no Supabase, no wall clock) computing weekly identity dates, planned rows, missing rows, the qualified pool, and who's actually working — fully covered by `scripts/verify-positions.mjs`, now wired into `npm test`.
- `src/lib/api.js` and `src/hooks/useGuardian.js` extended with position CRUD, `materializeTemplateShifts`, and the `ensurePositionsForWeek` action — which is a genuine no-op (`{created: 0}`, no write, no `refresh()`) when a week has nothing missing (the T-04-05 DoS mitigation).
- End-to-end proof (D-02): a template position's materialized shift rows, fed into the real `autoAssign()` unmodified, get filled from the qualified pool only — no unqualified guard is ever selected, and the result is stable under shuffled guard-array order.

## Task Commits

Each task was committed atomically:

1. **Task 1: schema decision (checkpoint:decision)** — resolved via the locked decision supplied by the orchestrator (matching the plan's recommended option א'); documented in the 0007 migration header, no separate commit.
2. **Task 2: migration 0007 + live push** — `d919e7c` (feat)
3. **Task 2 (deviation fix): non-partial index** — `579b58a` (fix) — discovered live via `npm run test:backend`, applied live by the orchestrator
4. **Task 2: verify-backend.mjs extension + deferred-items.md** — `1ae89a1` (test)
5. **Task 3: tracer slice (positions.js, api.js, useGuardian.js, verify-positions.mjs, package.json)** — `c1b621f` (feat)

## Files Created/Modified

- `supabase/migrations/0007_standing_positions.sql` — `gs_positions` table + RLS + FK columns + (initially partial) unique indexes
- `supabase/migrations/0008_positions_index_fix.sql` — replaces the partial indexes with non-partial ones (bug fix)
- `src/lib/positions.js` — pure weekly-materialization + qualification/working-list module
- `src/lib/api.js` — `positionFromRow`/`positionToRow`, position CRUD, `materializeTemplateShifts`, `positions` in `loadTeam`, `positionId` round-trips on shift/task mappers
- `src/hooks/useGuardian.js` — `positions: []` in `EMPTY`, `addPosition`/`updatePosition`/`deletePosition`/`ensurePositionsForWeek` actions
- `scripts/verify-positions.mjs` — new standalone Node test, wired into `npm test`
- `scripts/verify-backend.mjs` — new `gs_positions` live RLS/idempotency section
- `package.json` — `test` script now runs `verify-positions.mjs` as a third step
- `.planning/phases/04-standing-positions/deferred-items.md` — logs pre-existing, unrelated `test:backend` flakiness discovered during this work

## Decisions Made

- **Task 1 (schema shape, locked before any SQL was written):** `required_guards` kept on `gs_positions` (default 1, exposed but not required); the "weekly, no-hours" shape's identity date is `start_date = Sunday` / `due_date = Saturday` (spans the whole week visually) — a deliberate deviation from 04-RESEARCH.md's original `due_date = Sunday` sketch; rotation stays a flat all-time turn count (04-03 inherits this, not re-derives it).
- **A1 resolved live:** `gs_shifts.start_time`/`end_time` are `NOT NULL` (confirmed via Supabase `list_tables` — no `nullable` flag, unlike `gs_shifts.category`). Confirms weekly-shape positions correctly route to `gs_tasks` (nullable hours), never `gs_shifts` — the research's routing recommendation was correct, and now verified rather than assumed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Partial unique index incompatible with `supabase-js`'s `onConflict` idempotency path**
- **Found during:** Task 2, `npm run test:backend` live verification
- **Issue:** `0007_standing_positions.sql` created `gs_shifts_position_date_idx`/`gs_tasks_position_date_idx` as **partial** unique indexes (`where position_id is not null`, following 04-RESEARCH.md's sketch). `supabase-js`'s `.upsert(rows, {onConflict: "position_id,date", ignoreDuplicates: true})` builds a bare-column-list `ON CONFLICT` target, which Postgres cannot match against a partial index without the predicate also appearing in the `ON CONFLICT` clause — something `supabase-js`'s API has no way to express. Live error: `there is no unique or exclusion constraint matching the ON CONFLICT specification`. This would have broken `materializeTemplateShifts()` — and therefore POS-04 — in production, not just in the test.
- **Fix:** `supabase/migrations/0008_positions_index_fix.sql` drops and recreates both indexes as **non-partial**. This is equally safe: Postgres unique indexes never treat `NULL = NULL` as a match, so existing `position_id IS NULL` rows still never collide with each other or with anything else, with or without the predicate. The partial predicate in 0007 was extra caution that turned out to break the exact write path it was meant to protect.
- **Files modified:** `supabase/migrations/0008_positions_index_fix.sql`
- **Verification:** `npm run test:backend` — all 8 `gs_positions` checks pass after the fix, including both the duplicate-insert-rejected and the `ignoreDuplicates:true`-is-a-no-op checks.
- **Committed in:** `579b58a`

---

**Total deviations:** 1 auto-fixed (1 bug, discovered via live integration testing exactly as the tracer-slice pattern is meant to surface)
**Impact on plan:** Essential correctness fix for POS-04 — without it, the phase's idempotency guarantee would have silently failed the first time a real supervisor's browser called `ensurePositionsForWeek` twice. No scope creep; the fix is two migration files touching only the two new indexes.

## Post-Merge Finding — RLS pattern broke `state.positions` for the anonymous demo flow

- **Found during:** Orchestrator's mandatory browser verification of the full merged phase (both 04-01 and 04-02), after both plans reported complete. Not caught by `verify-backend.mjs`'s `gs_positions` checks, since those don't exercise the anonymous demo login flow specifically.
- **Issue:** `0007_standing_positions.sql`'s `gs_positions_read`/`gs_positions_write` policies used a raw inline `team_code in (select team_code from gs_profiles where user_id = auth.uid())` subquery — mirroring the precedent in `gs_task_templates`/`gs_role_compatibility` exactly as 04-RESEARCH.md recommended. Live in the running app (demo/anonymous session), this pattern returned **zero rows** for `gs_positions` while the equivalent `gs_shifts`/`gs_profiles` policies — built on the project's `gs_my_team()`/`gs_is_supervisor()` `SECURITY DEFINER` helper functions — loaded correctly in the exact same session (verified live via React fiber inspection: `state.shifts.length=15`, `state.positions.length=0`). The two older precedent tables mask this same failure mode for themselves because they add `team_code is null or ...`, so their shared/default rows still show even when the team-scoped branch is broken; `gs_positions` has no such fallback and was the first table where the gap became visible. Net effect: `ensurePositionsForWeek` read an empty `positions` array and silently no-op'd (`{created: 0}`) for every week except the one where a position happened to already be materialized — a direct violation of POS-01's "מנהל מגדיר עמדה פעם אחת... בלי שנגע בכלום."
- **Fix:** `supabase/migrations/0009_positions_rls_use_helpers.sql` rewrites both policies to use `gs_my_team()`/`gs_is_supervisor()`, matching `gs_shifts`'s proven-working shape exactly instead of the older raw-subquery precedent.
- **Files modified:** `supabase/migrations/0009_positions_rls_use_helpers.sql`, `src/lib/api.js` (MIGRATION_HINT text updated to name 0009 as latest)
- **Verification:** Live in-browser regression test across two fresh anonymous demo sessions: created a template-shape position, then navigated forward through 3+ never-before-visited weeks with no page reload. Before the fix: `state.positions.length` was `0` and zero new rows appeared in any week after the first. After the fix: `state.positions.length` was `1` immediately, and each new week navigated to materialized the position's shift on first view — confirmed both on-screen and via direct `gs_shifts` query. Test data cleaned up after verification.
- **Committed in:** (this commit)

---

## Issues Encountered

- **Transient `test:backend` flakiness, unrelated to this phase:** repeated rapid `npm run test:backend` runs (needed to validate the `gs_positions` fix) intermittently produced `permission denied for function gs_join_team` / `Request rate limit reached` failures in the pre-existing "returning guard" and "preferences" sections. Confirmed not reproducible in an isolated single-supervisor/single-guard debug run exercising the same `gs_positions` RLS path, and confirmed the `gs_positions` section itself passes cleanly (8/8) once spaced out from other runs. Logged to `.planning/phases/04-standing-positions/deferred-items.md`; out of this task's scope per the executor's scope boundary (pre-existing, unrelated files).
- **Access model across two live-migration round trips:** this worktree has no Supabase MCP/CLI/credentials by design — both `0007` and the corrective `0008` were written and committed here, then applied live by the orchestrator, which also ran the `information_schema`/`list_tables` verification queries this summary's A1 finding depends on.

## User Setup Required

None — no external service configuration required beyond the two migrations, both already applied live by the orchestrator.

## Next Phase Readiness

- **04-02 (minimal POS-05 screen):** can consume `qualifiedGuardsForPosition`/`workingGuardIdsForWeek` directly — both proven pure and correctly distinguishing "qualified" from "working" (Pitfall 2 of 04-RESEARCH.md).
- **04-03 (weekly, no-hours shape + rotation):** inherits the Task 1 schema decision verbatim (Saturday-as-identity-date for weekly shape, flat all-time rotation count) without re-deriving it, and can route weekly-shape realization through `gs_tasks` with confidence — A1 is now a verified fact, not an assumption.
- **No blockers.** The one real risk this tracer slice existed to surface (index/upsert incompatibility) was found and fixed within this plan, before any other plan built on top of it.

---
*Phase: 04-standing-positions*
*Completed: 2026-08-27*
