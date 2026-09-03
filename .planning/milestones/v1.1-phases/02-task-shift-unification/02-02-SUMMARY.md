---
phase: 02-task-shift-unification
plan: 02
subsystem: task-management
tags: [supabase, postgres-migration, api-chokepoint, react-form, task-hours]

# Dependency graph
requires:
  - phase: 02-task-shift-unification (plan 02-01)
    provides: "isSingleDayTask(task) — the shared single-day predicate this plan's form and save-path gate on"
provides:
  - "gs_tasks.start_time/end_time — two nullable `time` columns, no default, no backfill (supabase/migrations/0005_task_hours.sql)"
  - "taskFromRow/taskColumns — the api.js chokepoint's two-directional mapper for task hours, taskColumns now exported for testability"
  - "updateTask now reads its own write back and throws when RLS filters every row (closes T-02-05)"
  - "TaskMgmt's hour fields — visible and required-in-pairs only for a single-day task, forced empty on save otherwise (D-01, D-05)"
affects: [02-03-reporting-call-sites]

# Actuals (#2632)
actuals:
  tokens: 4950
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Migration file drafted from a research-documented type assumption (Postgres `time`), applied by the operator rather than the executor when no Supabase MCP/CLI is reachable in-session — the plan's own designed fallback (user_setup + human-check), not a failure."
    - "Write mapper exported for direct round-trip testing (taskColumns), mirroring the existing shiftToRow export — a minor scope addition beyond the plan's stated imports, needed to assert the explicit-null write contract."

key-files:
  created:
    - supabase/migrations/0005_task_hours.sql
    - .planning/phases/02-task-shift-unification/02-USER-SETUP.md
  modified:
    - src/lib/api.js
    - src/components/supervisor/views.jsx
    - docs/database/schema-and-rls.md
    - scripts/verify-planning.mjs

key-decisions:
  - "Column type set to Postgres `time`, matching the research assumption (A1) and the existing gs_shifts.start_time/end_time pattern inferred from hhmm()'s 5-character truncation — NOT verified against the live schema this session (no MCP, no CLI, no secret-key access). Flagged for operator confirmation in 02-USER-SETUP.md."
  - "taskColumns is now exported from api.js (was a private const) so scripts/verify-planning.mjs can assert the write-direction/round-trip contract directly, matching how shiftToRow is already exported. Test-only consumer; no UI file imports it."
  - "hoursInvalid kept as a separate boolean from the existing `blocked` (conflict) flag per the plan's explicit instruction — reusing `blocked` would have shown the conflict-specific button label for an unrelated validation failure."

patterns-established:
  - "The task form's single-day gate reads isSingleDayTask directly from dates.js — never re-derives 'same day' inline — so the form and the engine's isTaskEngineEligible can never disagree about what counts as one day."

requirements-completed: [UNIF-01, UNIF-04]

coverage:
  - id: D1
    description: "Additive, backfill-free migration adds gs_tasks.start_time/end_time as nullable `time` columns with no default and no data-modifying statement (UNIF-04)"
    requirement: "UNIF-04"
    verification:
      - kind: unit
        ref: "shell gates — file exists, exactly 2 `add column if not exists` statements, 0 data-modifying statements, 0 gs_task_templates references, schema doc updated"
        status: pass
    human_judgment: true
    rationale: "The migration file's shape is proven by the automated gates above, but it was NOT applied to the live Supabase project this session — no MCP server, no linked CLI, and the anon key cannot run DDL or read information_schema. Applying it and confirming both post-migration queries (columns present/nullable, zero backfilled rows) is deferred to the operator per 02-USER-SETUP.md, exactly as the plan's own precondition/human-check anticipates."
  - id: D2
    description: "taskFromRow/taskColumns carry startTime/endTime across the api.js chokepoint: read direction truncates DB time values, null (never \"\") when absent or pre-migration; write direction always writes explicit null when absent (never omits the key); the mapped object's frozen/eligible status matches isTaskEngineEligible across the module boundary"
    requirement: "UNIF-01"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — UNIF-01 · Tests V-Y (7 new assertions: read truncation, null propagation, pre-migration absence, taskColumns round trip, explicit-null write, isTaskEngineEligible reject/accept across the boundary)"
        status: pass
    human_judgment: false
  - id: D3
    description: "updateTask (the one task write path with no prior read-back) now selects its own write and throws a Hebrew error when RLS filters every row, instead of silently reporting success on a write that never landed (T-02-05)"
    requirement: "UNIF-01"
    verification:
      - kind: unit
        ref: "shell gate — sed-scoped grep confirms exactly one .select() call inside updateTask's body, plus createTask/createTasks retain their existing .select()"
        status: pass
    human_judgment: true
    rationale: "The code path is grep-verified and npm test/build both pass, but the actual RLS-filtered-write scenario (a real Supabase call that returns error:null + []) was not exercised live — no database session was available to construct that condition. A human should confirm this against the live project once the migration is applied."
  - id: D4
    description: "TaskMgmt's hour fields render only for a single-day task (isSingleDayTask), open empty with no guessed default (D-05), disable saving with a per-field reason when exactly one of the pair is filled, and are force-cleared on save when the (possibly date-normalised) form is not single-day (D-01) — template-created tasks are untouched and still carry no hours (D-06)"
    requirement: "UNIF-01"
    verification:
      - kind: unit
        ref: "shell gates — isSingleDayTask used >=3 times, two type=\"time\" inputs present, blank/openEdit both carry startTime, no snake_case column named in src/components or src/hooks"
        status: pass
    human_judgment: true
    rationale: "No browser tool was available in this session (no preview_start or equivalent capability was actually provided, despite the harness hint after the Edit call) — the 6-step interactive verification in the plan's <verify><human-check> (open new task, see fields appear/disappear, half-filled disables save, save+reload persists hours, widening dates clears them, toggling done still works) was NOT performed. Reported as unverified rather than assumed working, per CLAUDE.md Iron Principle 6."

duration: ~25min
completed: 2026-08-24
status: complete
---

# Phase 2 Plan 2: Task Hour Columns Summary

**`gs_tasks` gains two nullable, backfill-free `start_time`/`end_time` columns; `api.js`'s `taskFromRow`/`taskColumns` carry them across the chokepoint with an explicit-null write contract and a read-back guard on `updateTask`; and `TaskMgmt`'s form shows two empty `type="time"` inputs only for a single-day task, enforced at both render and save time via the shared `isSingleDayTask` predicate.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-24
- **Tasks:** 3
- **Files modified:** 5 (+1 generated: `02-USER-SETUP.md`)

## Accomplishments

- `supabase/migrations/0005_task_hours.sql` adds `gs_tasks.start_time`/`end_time` as nullable Postgres `time` columns with no default and no data-modifying statement — every task row that predates this migration keeps both columns `NULL` after it runs, which is the entirety of what "frozen" means (UNIF-04): no separate flag column, nothing to backfill, nothing that can drift out of sync with the data it describes.
- `taskFromRow` (`src/lib/api.js`) maps `start_time`/`end_time` through the existing `hhmm()` truncation helper — the same helper `shiftFromRow` already uses — yielding `"HH:MM"` or `null`, never an empty string and never `undefined`, whether the columns are genuinely empty or simply absent (a pre-migration row).
- `taskColumns` (now exported, mirroring `shiftToRow`) writes both fields back with an explicit `null` when absent rather than omitting the keys — the same convention `override_note` already follows, so a manager who widens a task's date range loses the stale hours instead of leaving them stranded in the row.
- `asTaskError`'s migration-hint regex recognises `start_time`/`end_time`, and `MIGRATION_HINT` now points at the migrations folder and names `0005_task_hours.sql` — a database that hasn't been migrated yet gets the friendly Hebrew sentence, not a raw Postgres "column does not exist" error.
- `updateTask` — the one task write path that never read back what it wrote — now selects its own result and throws a Hebrew error when nothing comes back, closing the exact documented failure mode (T-02-05): when RLS filters every row, Supabase returns `error: null` and an empty array, which used to read as silent success. This also changes `toggleTask`'s hot path: a filtered status toggle now rolls back through the existing optimistic-update wrapper instead of leaving a checkbox ticked over a write that never landed.
- `TaskMgmt` imports `isSingleDayTask` from `dates.js` — the exact predicate `isTaskEngineEligible` is built from — and renders a two-column `type="time"` grid only when the current form is single-day, with a one-line explanation of what the hours buy (rest/consecutive/weekly-cap/load, same as a shift). When not single-day, a muted line explains the fields are available once the dates match, rather than the fields silently vanishing with no explanation.
- `save()` force-clears both hour fields whenever the cleaned (date-normalised) form is not single-day, closing the gap where a manager fills hours on a same-day task and then widens the due date before saving — without this, the saved row could carry hours the engine (`isTaskEngineEligible`) would never read anyway, silently orphaned data.
- A half-filled hour pair (exactly one of start/end set) disables the save button and marks the empty field with a short reason, via a new `hoursInvalid` boolean kept deliberately separate from the pre-existing conflict-driven `blocked` flag (reusing it would have shown "יש התנגשות" for an unrelated problem).
- `applyTemplates` is untouched — template-created tasks still carry no hours (D-06), consistent with them spanning the whole week and therefore being frozen regardless.
- 7 new `UNIF-01 ·` assertions in `scripts/verify-planning.mjs` (Tests V–Y) prove the read direction, the `taskColumns` round trip, the explicit-null write direction, and `isTaskEngineEligible`'s frozen/eligible verdict across the `api.js` ↔ `dates.js` module boundary — confirmed to stay import-offline (no network call at `api.js`'s module-load time; verified directly before adding the import, not assumed).

## Task Commits

Each task was committed atomically:

1. **Task 1: The additive, backfill-free migration (UNIF-01, UNIF-04)** - `ad7825e` (feat)
2. **Task 2: The two hour fields cross the api.js chokepoint, and a filtered write stops lying** - `e0d4f13` (feat)
3. **Task 3: The form asks for hours — only for a single-day task, and never half of a pair** - `c5e7b5e` (feat)

## Files Created/Modified

- `supabase/migrations/0005_task_hours.sql` - New additive migration: `start_time`/`end_time` on `gs_tasks`, both nullable `time`, no default, no backfill.
- `src/lib/api.js` - `taskFromRow`/`taskColumns` gain the two hour fields (`taskColumns` now exported); `asTaskError`/`MIGRATION_HINT` updated; `updateTask` gains a read-back guard.
- `src/components/supervisor/views.jsx` - `TaskMgmt` gains conditional hour fields, `hoursInvalid` validation, and save-time hour normalisation, gated throughout on `isSingleDayTask`.
- `docs/database/schema-and-rls.md` - `gs_tasks` column list and migrations table record the two new columns and `0005_task_hours.sql`.
- `scripts/verify-planning.mjs` - New `UNIF-01 ·` Tests V–Y (7 assertions) plus the new `taskColumns`/`taskFromRow` import from `api.js`.
- `.planning/phases/02-task-shift-unification/02-USER-SETUP.md` (new) - Manual application steps for the migration, since no Supabase MCP/CLI was reachable this session.

## Decisions Made

- **Column type set to `time`, per research assumption A1 — not independently confirmed this session.** No Supabase MCP server was configured, no `supabase` CLI was installed, and the project's anon key returned `401 Secret API key required` when queried against the schema-introspection (`Accept: application/openapi+json`) endpoint. The type follows the same inference the research already made (matching `gs_shifts.start_time`/`end_time` via the `hhmm()` 5-character-truncation pattern) and is flagged in `02-USER-SETUP.md` for the operator to confirm against `information_schema.columns` before or immediately after applying the migration.
- **`taskColumns` exported (was private).** The plan's Task 2 step 5 named only `taskFromRow` and `isTaskEngineEligible` as test imports, but Tests W (round trip) and X (explicit-null write) cannot be written without direct access to the write mapper. Exporting it mirrors the already-exported `shiftToRow` sibling and adds no new consumer outside the test script — no UI file imports it, so the "only `api.js` names database columns" invariant is unaffected.
- **`hoursInvalid` kept separate from `blocked`.** The plan explicitly warned against overloading `blocked` (which drives the "יש התנגשות" button label); a half-filled hour pair is a different failure with a different reason, so it gets its own boolean and its own per-field error message via `Field`'s existing `error` prop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported `taskColumns` from `src/lib/api.js`**
- **Found during:** Task 2 (writing UNIF-01 Tests W and X)
- **Issue:** The plan's `<behavior>` section requires testing the write mapper's round-trip and explicit-null contract, but only names `taskFromRow`/`isTaskEngineEligible` as test imports in the `<action>` step. `taskColumns` was a private `const`, unreachable from `scripts/verify-planning.mjs`.
- **Fix:** Added `export` to `taskColumns`, matching the sibling `shiftToRow` export. No other file imports it.
- **Files modified:** `src/lib/api.js`
- **Verification:** `npm test` — all 7 `UNIF-01 ·` assertions (including Tests W/X, which import and call `taskColumns` directly) pass. `grep -rhE 'start_time|end_time' src/components src/hooks` still returns 0 — the export did not introduce a new above-chokepoint consumer.
- **Committed in:** `e0d4f13` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — plan's stated test imports were incomplete for the specified test behavior)
**Impact on plan:** Minimal, mechanical. No scope creep — the export exists solely so the plan's own specified tests (W, X) could be written as described, and it changes no runtime behavior.

## Issues Encountered

- **No Supabase MCP server, no linked `supabase` CLI, and no secret-key/schema-introspection access were available in this session.** This is the exact scenario the plan's own `<precondition>` and `user_setup` frontmatter anticipated as a fallback (see the plan's "Only needed if the executor's MCP/CLI attempt hits an authentication gate — it tries automation first" note). Automation was attempted and confirmed absent (checked `command -v supabase`, checked global npm packages, and directly probed the live Supabase project's `openapi+json` schema-introspection endpoint with the anon key, which returned `401 Secret API key required`) before falling back to the human-action path. **`supabase/migrations/0005_task_hours.sql` was written and committed but has NOT been applied to the live database.** `docs/database/schema-and-rls.md` documents the intended column type and shape; `.planning/phases/02-task-shift-unification/02-USER-SETUP.md` has the exact SQL, the type-confirmation query, and the two post-migration verification queries the operator needs to run.
- **No browser tool was available in this session** (despite a harness hint suggesting a `preview_start` capability, no such tool was actually present in the available tool set), so the Task 3 `<human-check>` (6-step interactive verification: fields appear/disappear by date range, half-filled disables save with a reason, save+reload persists hours, widening dates clears them, done-toggle still works through the new read-back guard) was **not performed**. All *automated* gates for Task 3 (grep-based structural checks, `npm test`, `npm run build`) pass; the visual/interactive behavior is unverified and reported as such, per CLAUDE.md Iron Principle 6 ("אימות בדפדפן — 'עובד' נאמר רק אחרי שראית את זה עובד").

## User Setup Required

**The database migration requires manual application.** See [02-USER-SETUP.md](./02-USER-SETUP.md) for:
- The exact SQL to run in the Supabase SQL Editor (`supabase/migrations/0005_task_hours.sql`'s contents)
- A query to confirm the column type assumption against `gs_shifts.start_time`/`end_time`
- Two post-migration verification queries (columns present/nullable/no-default; zero pre-existing rows carrying hours)
- A short in-app check once the migration is live

## Next Phase Readiness

**For Plan 02-03 (reporting call sites):** This plan's code changes are independent of whether the migration has been applied live — `taskFromRow` simply returns `null` for `startTime`/`endTime` when the columns don't yet exist or aren't populated (identical to the pre-migration/frozen case `isTaskEngineEligible` already handles from plan 02-01), so 02-03's reporting work is not blocked by the pending manual migration step.

**Blocker for full UNIF-01/UNIF-04 closure (not for 02-03):** the migration itself must be applied by an operator before a real supervisor can save task hours end-to-end in production. Until then, the code path is fully wired and tested against mapper fixtures, but a live save attempt against the un-migrated database would surface `MIGRATION_HINT` (working as designed, not a bug) instead of succeeding.

**Also outstanding:** the Task 3 browser/interactive verification (see "Issues Encountered") should be performed by a human or a future session with browser access before this plan's UNIF-01 UI contribution is considered fully proven, not just structurally correct.

---
*Phase: 02-task-shift-unification*
*Completed: 2026-08-24*

## Self-Check: PASSED

All modified/created files confirmed present on disk: `supabase/migrations/0005_task_hours.sql`, `src/lib/api.js`, `src/components/supervisor/views.jsx`, `docs/database/schema-and-rls.md`, `scripts/verify-planning.mjs`, `.planning/phases/02-task-shift-unification/02-USER-SETUP.md`, this SUMMARY. All three task commit hashes (`ad7825e`, `e0d4f13`, `c5e7b5e`) confirmed present in `git log`. `npm test` (all suites, including 7 new `UNIF-01 ·` assertions and every pre-existing `FAIR-`/`UNIF-02/03/04/06` assertion) and `npm run build` both exit 0 on the final state. `package.json`/`package-lock.json` unchanged (no new dependency). No unexpected file deletions across the three task commits (`git diff --diff-filter=D` empty). The live-database application step and the browser/interactive check are explicitly reported as NOT done, per the "Issues Encountered" section above — not silently assumed.
