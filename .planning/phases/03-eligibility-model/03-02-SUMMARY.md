---
phase: 03-eligibility-model
plan: 02
subsystem: schema-and-data-layer
tags: [supabase, postgres-migration, api-chokepoint, qualification, manual-assignment]

# Dependency graph
requires:
  - phase: 03-eligibility-model (plan 03-01)
    provides: "isQualified(guard, category)/checkQualification({guard, shift}) — the pure engine functions this plan's mapper and manual-assignment gate call"
provides:
  - "gs_profiles.qualified_categories / gs_shifts.category — two nullable columns, no default, no backfill (supabase/migrations/0006_qualification.sql)"
  - "profileFromRow/shiftFromRow/shiftToRow — the api.js chokepoint's mappers for both new fields; setGuardQualifications(profileId, categories) — the narrow write path, with a read-back guard"
  - "toggleAssignment (useGuardian.js) now gates the assign direction on checkQualification — QUAL-04's fourth route is closed"
  - "setGuardQualifications(id, categories) action — the write path plan 03-04's editor screen will call"
affects: [03-03-assign-view-display, 03-04-manual-assignment-gate]

# Actuals (#2632)
actuals:
  tokens: 5650
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Migration written and committed, but NOT applied to the live database this session — no Supabase MCP server and no linked CLI reachable from this worktree. Documented in 03-USER-SETUP.md for the orchestrator (confirmed Supabase MCP access) to apply post-merge, exactly as Phase 2's 0005_task_hours.sql migration was handled."
    - "setGuardQualifications mirrors updateTeamSettings's read-back idiom (.select() + throw-when-empty), not setGuardExempt's blind-update idiom — the plan explicitly calls out setGuardExempt's own gap as a separate, out-of-scope pre-existing issue rather than silently copying it forward into new code."

key-files:
  created:
    - supabase/migrations/0006_qualification.sql
    - .planning/phases/03-eligibility-model/03-USER-SETUP.md
  modified:
    - src/lib/api.js
    - src/hooks/useGuardian.js
    - docs/database/schema-and-rls.md
    - scripts/verify-planning.mjs

key-decisions:
  - "D-03 enforced at the one write door into the column: setGuardQualifications normalises any non-array or empty-array argument to null before writing, so the database can never hold both null and [] as two spellings of 'unrestricted'."
  - "P-01 confirmed exactly as 03-01 and 03-RESEARCH.md specified: toggleAssignment's gate calls checkQualification({guard, shift}) alone — neither checkAssignment nor checkHardConstraints — and a Hebrew comment states which four constraints (rest, consecutive hours, weekly cap, availability) remain unenforced on this path and why that is deliberate, not an oversight."
  - "The gate applies to the assign direction only. Removing a person from a shift is never blocked, matching every other hard constraint in this codebase and specifically preserving a supervisor's ability to remove someone from shifts they were just narrowed away from."
  - "Migration application deferred to the orchestrator post-merge (no MCP/CLI reachable this session) — this is the plan's own documented fallback path, not a skipped step."

patterns-established:
  - "setGuardQualifications(id, categories) is the exact action shape plan 03-04's editor screen calls — optimistic, patches both d.guards and d.members, defined inside the memoised actions object."

requirements-completed: [QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06]

coverage:
  - id: D1
    description: "Additive, backfill-free migration adds gs_profiles.qualified_categories (jsonb) and gs_shifts.category (text) as nullable columns with no default and no data-modifying statement"
    requirement: "QUAL-01, QUAL-02, QUAL-03"
    verification:
      - kind: unit
        ref: "shell gates — file exists, exactly 2 `add column if not exists` statements, 0 data-modifying statements, 0 default keywords outside comments, 0 gs_tasks references outside comments, 0 create policy/table/index statements, schema doc updated"
        status: pass
    human_judgment: true
    rationale: "The migration file's shape is proven by the automated gates above, but it was NOT applied to the live Supabase project this session — no MCP server, no linked CLI reachable from this worktree (command -v supabase returned nothing). Applying it and confirming the three post-migration queries (columns present/nullable/defaultless; both backfill counts return 0) is deferred to the orchestrator per 03-USER-SETUP.md, exactly as the plan's own precondition/human-check anticipates and exactly as Phase 2's 0005_task_hours.sql migration was handled."
  - id: D2
    description: "profileFromRow/shiftFromRow/shiftToRow carry qualifiedCategories/category across the api.js chokepoint: absent, null and malformed (non-array) values on the profile side all map to null; a shift's absent category maps to empty string (matching taskFromRow's convention); the write mapper produces an explicit null key with no fallback string; a profile mapped from a row with no list is qualified for an arbitrary category via isQualified, proving the mapper's convention and the engine's default-allow rule agree"
    requirement: "QUAL-01, QUAL-03"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — new QUAL-01/QUAL-02/QUAL-03 section (13 assertions: profile read direction × malformed-value sweep, layer-crossing default-allow proof, shift read/write direction, explicit-null write, round trip, full-key-set preservation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "setGuardQualifications(profileId, categories) normalises empty/non-array input to null, writes the column, reads its own write back via .select(\"id\"), and throws a Hebrew permission sentence when nothing came back (T-03-06)"
    requirement: "QUAL-01"
    verification:
      - kind: unit
        ref: "shell gate — sed-scoped extraction confirms exactly one .select( call and at least two throw statements inside the function body"
        status: pass
    human_judgment: true
    rationale: "The code path is grep-verified and npm test/build both pass, but the actual RLS-filtered-write scenario (a real Supabase call returning error:null + []) was not exercised live — no database session is available (migration not yet applied; see D1). A human/future session should confirm this against the live project once the migration is applied."
  - id: D4
    description: "toggleAssignment resolves the guard from dataRef.current (live snapshot), gates the assign direction only through checkQualification, throws the refusal's Hebrew reason through run() with no optimistic paint first, and calls neither checkAssignment nor checkHardConstraints; removal is never gated; no override/force path exists anywhere in the file"
    requirement: "QUAL-04, QUAL-05, QUAL-06"
    verification:
      - kind: unit
        ref: "shell gates — checkQualification present exactly once inside toggleAssignment's sed-scoped body, dataRef.current.guards present, checkAssignment/checkHardConstraints absent, override/force absent from all non-comment lines in the file"
        status: pass
    human_judgment: true
    rationale: "All structural/automated gates pass, npm test and npm run build both exit 0, but the interactive/browser half of this (clicking an unqualified person in the live UI and seeing the Hebrew refusal) needs plan 03-04's qualification editor to exist first — there is currently no UI path to narrow a person's qualifications, so the negative case (nothing blocked when nobody has been narrowed) is the only half verifiable now. This is explicitly named as deferred in the plan's own <human-check> instructions, not an oversight."

duration: ~35 min
completed: 2026-08-26
status: complete
---

# Phase 3 Plan 2: Schema, Chokepoint Mappers, and the Manual-Assignment Gate Summary

**`gs_profiles.qualified_categories` and `gs_shifts.category` added as nullable, backfill-free columns; `api.js`'s three mappers carry both across the chokepoint with a default-allow-preserving read direction and an explicit-null write direction; and `toggleAssignment` gates the assign-only direction on `checkQualification` alone, closing QUAL-04's fourth route without silently expanding the manual-assignment path's scope.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-26
- **Tasks:** 3
- **Files modified:** 4 (+2 created: `0006_qualification.sql`, `03-USER-SETUP.md`)

## Accomplishments

- `supabase/migrations/0006_qualification.sql` adds `gs_profiles.qualified_categories` (`jsonb`, nullable, no default) and `gs_shifts.category` (`text`, nullable, no default) with no data-modifying statement, no index and no policy — every existing row reads `NULL` in both columns after it runs, which is the entirety of what QUAL-02's "unrestricted by default" promise means at the storage layer. The header records why the person's list is `jsonb` rather than Postgres `text[]` (P-02: matches the two existing person/position array columns already in this schema) and why no second column lands on `gs_tasks` (D-02: the existing `category` column already is the task's qualification field).
- `profileFromRow` (`src/lib/api.js`) gains `qualifiedCategories`, reading the column only when it is genuinely an array (`Array.isArray`) — absent, `null`, a stray string, a number, an object all map to `null` rather than propagating a value `.includes` could not safely be called on.
- `setGuardQualifications(profileId, categories)` is new, alongside `setGuardExempt`. It normalises an empty or non-array argument to `null` before writing (D-03 enforced at the column's one write door), then reads its own write back via `.select("id")` and throws a Hebrew permission sentence when nothing comes back — the exact failure this project's own constraints document names (RLS filtering every row returns `error: null` + `[]`, which reads as silent success without the check). Copied `updateTeamSettings`'s read-back shape, not `setGuardExempt`'s blind-update shape.
- `shiftFromRow` gains `category` (empty-string fallback, matching `taskFromRow`'s convention for the identical field — D-01); `shiftToRow` writes it as an explicit `null` key with no fallback string, unlike `location`'s `"כניסה ראשית"` default — a category nobody typed must stay absent, because a category is a restriction and a fallback here would restrict people against a rule nobody wrote.
- `MIGRATION_HINT` now names `0006_qualification.sql` as the newest migration. No equivalent unknown-column translator was built for shift writes (the plan explicitly scoped this out as a new mechanism on a path this phase does not otherwise touch) — a shift write against an un-migrated database will surface a raw Postgres error rather than the friendly Hebrew sentence `asTaskError` gives task writes.
- `toggleAssignment` (`src/hooks/useGuardian.js`) now resolves the guard from `dataRef.current.guards` alongside the existing shift lookup, and — on the assign direction only, before any optimistic paint — calls `checkQualification({guard, shift})`. A refusal throws the check's Hebrew reason through the file's existing `run()` helper, landing in the app's shared error banner with no new plumbing (QUAL-06). This is `useGuardian.js`'s first import from `src/lib/autoAssign.js`.
- The gate calls **neither** `checkAssignment` nor `checkHardConstraints` — only `checkQualification`. A Hebrew comment directly above it states P-01 plainly: rest, consecutive hours, the weekly cap and availability remain completely unenforced on this path, and that is deliberate — closing that wider gap would start refusing assignments a supervisor has always been able to make by hand, and is a separate product conversation this phase did not have. Removal is never gated, matching every other hard constraint in this codebase.
- `setGuardQualifications(id, categories)` was added to the `actions` object, mirroring `setGuardExempt`'s exact optimistic shape: it patches the matching person in **both** `d.guards` and `d.members`, so the roster screen and the assignment screen can never disagree about who is qualified. It is defined inside the same memoised `actions` object, preserving referential stability.
- 13 new `QUAL-01`/`QUAL-02`/`QUAL-03` assertions added to `scripts/verify-planning.mjs`, in a new banner section titled "api.js — כשירות ותצוגה חוצות את נקודת החנק" — covering the profile read direction (real list, `null`, absent, and a three-value malformed-input sweep: string/number/object), the layer-crossing proof (a profile mapped from a row with no list is qualified for an arbitrary category when handed straight to `isQualified`), the shift read/write direction, the explicit-null write contract, the round trip, and full-key-set preservation on `shiftFromRow`. All pre-existing `FAIR-`/`UNIF-`/`QUAL-` assertions (61 `FAIR-`, 55 `UNIF-`, 49 `QUAL-` total across both scripts after this plan) still print `ok` — 0 `FAIL` lines anywhere in `npm test`'s output.

## Task Commits

Each task was committed atomically:

1. **Task 1: Two nullable columns, no default, no backfill (QUAL-01, QUAL-02, QUAL-03, D-02, D-03, P-02)** - `b17ba95` (feat)
2. **Task 2: Both fields cross the api.js chokepoint, and the write reads itself back (QUAL-01, QUAL-03, D-01, D-03, P-02)** - `242c042` (feat)
3. **Task 3: The fourth route — manual assignment refuses on qualification, and on qualification alone (QUAL-04 route 3, QUAL-05, QUAL-06, P-01)** - `a604efe` (feat)

## Files Created/Modified

- `supabase/migrations/0006_qualification.sql` (new) - Additive migration: `qualified_categories` (`jsonb`) on `gs_profiles`, `category` (`text`) on `gs_shifts`, both nullable, no default, no backfill.
- `src/lib/api.js` - `profileFromRow`/`shiftFromRow`/`shiftToRow` gain the new fields; `setGuardQualifications` added; `MIGRATION_HINT` updated.
- `src/hooks/useGuardian.js` - `toggleAssignment` gains a guard lookup and a pre-write qualification gate on the assign direction; `setGuardQualifications` action added; first import from `src/lib/autoAssign.js`.
- `docs/database/schema-and-rls.md` - `gs_profiles`/`gs_shifts` column lists record the two new columns; `gs_tasks.category` entry notes it is also the task's qualification field; migrations table gains a row for `0006_qualification.sql`.
- `scripts/verify-planning.mjs` - New `QUAL-01`/`QUAL-02`/`QUAL-03` banner section (13 assertions); import line extended with `profileFromRow`, `shiftFromRow`, `shiftToRow`.
- `.planning/phases/03-eligibility-model/03-USER-SETUP.md` (new) - Manual application steps for the migration, since no Supabase MCP/CLI was reachable this session.

## Decisions Made

- **Migration written and committed but NOT applied live this session.** `command -v supabase` returned nothing (no linked CLI), and no Supabase MCP server is configured in this worktree. This is exactly the fallback the plan's own precondition and `user_setup` frontmatter anticipate — automation was attempted first (checked for both routes) and confirmed absent before falling back to the documented human/orchestrator path, mirroring how Phase 2's `0005_task_hours.sql` was handled. See "Migration Application" below for the exact verbatim status.
- **`setGuardQualifications` copies `updateTeamSettings`'s read-back shape, not `setGuardExempt`'s.** The plan explicitly instructs against adding the read-back to `setGuardExempt` in this plan (a separate, real, pre-existing gap, out of scope here) while requiring it on the new function — followed exactly as written.
- **The QUAL-01/QUAL-03 test section's malformed-value sweep uses a `for` loop over three values (string, number, object) rather than three separate `check()` calls.** This is a minor structural choice within the plan's own instruction to assert "a profile row whose column somehow holds a non-array value" — the loop produces three distinct labelled assertions (visible individually in `npm test` output) with less duplication than writing each out by hand.

## Deviations from Plan

### Observed plan-verification-tooling quirks (not code deviations — no behavior affected)

**1. Task 2's snake-case leak-check gate includes `scripts` in its search path, which conflicts with the same task's own required test-writing pattern.**
- **Found during:** Task 2, running the automated `<verify>` gates.
- **What the plan's literal gate says:** `grep -rhE 'qualified_categories' src/components src/hooks scripts | grep -vE '^\s*(//|\*|/\*)' | wc -l` must equal `0`.
- **Why it cannot pass as literally written together with the rest of Task 2:** the same task's `<read_first>`/`<behavior>` explicitly requires writing mapper-crossing assertions in `scripts/verify-planning.mjs` using DB-row-shaped fixtures (the established "Test V/W/X" idiom from Phase 2, which itself uses `start_time`/`end_time` as literal fixture keys in the same file). Constructing a fixture like `{ qualified_categories: [...] }` to test `profileFromRow`'s read direction necessarily names the column literally in non-comment code. Phase 2's equivalent gate (`02-02-PLAN.md` line 234) checked only `src/components src/hooks` — deliberately excluding `scripts` for this exact reason.
- **What was verified instead:** the gate's evident intent — "no snake_case qualification column leaked above the api layer" (i.e., into application/UI code) — checked directly: `src/components` and `src/hooks` both return zero occurrences of `qualified_categories`. Only `scripts/verify-planning.mjs` contains it, in exactly the fixture role Test V/W/X already established as legitimate.
- **No fix applied; no code changed.** This is a note about the plan's own `<verify>` command text, not a defect in the implementation.

**2. Task 3's `setGuardQualifications` sed-range gate (`sed -n '/setGuardQualifications: (/,/),$/p'`) truncates one line early, before reaching the `d.members` line, for both the new action and its `setGuardExempt` sibling.**
- **Found during:** Task 3, running the automated `<verify>` gates.
- **Why:** the pattern's end-anchor `/),$/` matches the *first* line ending in `),` — which is the `guards:` line (`...: g)),`), not the final closing-paren line. The same sed range applied to the pre-existing `setGuardExempt` action (written in a prior phase) truncates identically, confirming this is a property of the regex, not of the new code.
- **What was verified instead:** direct file read (`src/hooks/useGuardian.js` lines 624-632) confirms `setGuardQualifications` patches both `d.guards` (line 628) and `d.members` (line 629) inside the same `optimistic(...)` call, exactly mirroring `setGuardExempt`'s two-array shape as the plan requires.
- **No fix applied; no code changed.**

**Total deviations:** 0 code deviations (Rules 1-4 did not trigger). 2 observed plan-verification-tooling quirks recorded above for transparency — both confirmed not to indicate any actual gap in the implementation.

## Migration Application

**Status: NOT applied to the live database this session.**

- **Route attempted:** Supabase MCP server (none configured in this worktree) → linked `supabase` CLI (`command -v supabase` returned nothing, not installed). Neither of the two automated routes the plan names was reachable. This is the documented fallback ("operator with SQL-editor access") the plan itself anticipates.
- **Verbatim post-migration query output:** none — cannot be produced without a live connection. The three verification queries (`information_schema.columns` for both new columns; the two zero-backfill counts) are written out in full in `.planning/phases/03-eligibility-model/03-USER-SETUP.md` for the orchestrator to run after applying the migration.
- **Exact column types `information_schema` would report:** not observed this session — expected `jsonb`/`YES`/no-default for `gs_profiles.qualified_categories`, and `text`/`YES`/no-default for `gs_shifts.category`, per the migration file's own `add column if not exists` statements, but this is the migration's stated intent, not a confirmed live fact.
- **Next step:** the orchestrator (confirmed Supabase MCP access) applies `supabase/migrations/0006_qualification.sql` post-merge, the same way Phase 2's `0005_task_hours.sql` was applied, and records the verbatim results in `03-USER-SETUP.md`.

## Observed Open Issues (named per plan instruction, not silently left implicit)

**The four hard constraints `toggleAssignment` still does not enforce**, listed explicitly because P-01 left this open on purpose and a future reader finding one constraint (qualification) here could otherwise reasonably assume the others were considered and rejected on merit:
1. **Rest** — the 8-hour minimum gap between shifts.
2. **Consecutive hours** — the 12-hour continuous-work ceiling.
3. **Weekly cap** — the 6-shift-per-week limit.
4. **Availability** — whether the person marked themselves available for this shift at all.

None of these were checked by `toggleAssignment` before this plan, and none are checked by it now — only qualification was added. Closing the wider gap is a real, separately-scoped product decision (a supervisor who has always been able to force a manual assignment by hand would suddenly be refused for reasons unrelated to qualification), not something this phase should smuggle in as a side effect of qualification work.

**`setGuardExempt` still writes without reading back its result** — an adjacent, pre-existing gap in the same file `setGuardQualifications` was modeled after. The plan explicitly instructs against fixing it in this plan (a currently-silent path would start throwing, which is an unscoped behaviour change for a different feature). Recorded here so it reaches triage rather than being rediscovered from scratch later.

**A shift write against an un-migrated database surfaces a raw Postgres error, not a friendly Hebrew hint.** Task writes get `asTaskError`'s translation via `MIGRATION_HINT`'s regex; no equivalent exists for shift writes, and the plan explicitly scoped building one out of this phase. Until `0006_qualification.sql` is applied (see "Migration Application" above), any shift write that includes `category` will surface Postgres's raw "column does not exist" message.

## Task 3 Step 6 — Can an edit and a click race into an inconsistent painted state?

**Conclusion: no race, confirmed by reading both code paths.** `setGuardQualifications` patches `d.guards` (and `d.members`) optimistically the instant it is called — the paint happens synchronously before the network write resolves. `toggleAssignment` reads the guard via `dataRef.current.guards.find(...)` at the moment of the click, and `dataRef.current` is kept in sync with the latest committed `data` state by the existing `useEffect(() => { dataRef.current = data; }, [data])` mirror. A click that happens immediately after a qualification-narrowing edit therefore always sees the narrowed list, because the optimistic patch has already updated `data` (and thus `dataRef.current`) by the time any subsequent click handler runs on the same JS thread — React state updates from a prior synchronous call are committed before the next user-triggered event can fire.

## Issues Encountered

- **No Supabase MCP server or linked CLI reachable this session** — see "Migration Application" above. This blocks live confirmation of the three post-migration properties (columns present/nullable/defaultless; zero-backfill on both tables) but does not block any of this plan's code from being correct against the mapper/engine contracts, which are proven by the 13 new unit assertions plus the two `node -e` layer-crossing gates.
- **The interactive half of Task 3's `<human-check>` cannot be exercised yet** — it requires one shift carrying a category and one person narrowed away from it, and plan 03-04 has not shipped the qualification editor yet. The negative half (nothing blocked when nobody has been configured) was confirmed structurally (the gate only fires when `checkQualification` returns `ok: false`, and a bare/unconfigured guard is always qualified per QUAL-02's default-allow rule, already proven by the 03-01 and 03-02 unit assertions) but was not exercised in a live browser this session.

## User Setup Required

**The database migration requires manual (or orchestrator-MCP) application.** See [03-USER-SETUP.md](./03-USER-SETUP.md) for:
- The exact SQL to run in the Supabase SQL Editor (`supabase/migrations/0006_qualification.sql`'s contents)
- Three post-migration verification queries (both columns present/nullable/defaultless; both zero-backfill counts)
- A short in-app check to perform once plan 03-04 ships the qualification editor

## Next Phase Readiness

**For Plan 03-03 (assign-view display):** `shift.category` and `guard.qualifiedCategories` are the exact field names now available on every app-layer object returned by `loadTeam` — no query change was needed since both arrive through the existing `select *` calls. `isQualified(guard, shift.category)` (already exported from plan 03-01) is ready to drive per-candidate lock state directly.

**For Plan 03-04 (manual assignment gate / qualification editor):** `setGuardQualifications(id, categories)` is wired end-to-end (action → api → column, with read-back) and ready for a form to call. `toggleAssignment`'s gate is already live — 03-04's editor screen is what will make the gate observable in the browser for the first time (currently no UI exists to narrow anyone's qualifications, so the gate has never actually refused a real click). The migration must be applied to the live database (see "Migration Application") before either plan's live/browser verification can be completed end-to-end.

No blockers for 03-03 or 03-04 from this plan's code. The one external blocker (migration application) is tracked in `03-USER-SETUP.md`, not in this plan's own scope.

---
*Phase: 03-eligibility-model*
*Completed: 2026-08-26*

## Self-Check: PASSED

All modified/created files confirmed present on disk: `supabase/migrations/0006_qualification.sql`, `src/lib/api.js`, `src/hooks/useGuardian.js`, `docs/database/schema-and-rls.md`, `scripts/verify-planning.mjs`, `.planning/phases/03-eligibility-model/03-USER-SETUP.md`, this SUMMARY. All three task commit hashes (`b17ba95`, `242c042`, `a604efe`) confirmed present in `git log`. `npm test` exits 0 with 0 `FAIL` lines (61 `FAIR-`, 55 `UNIF-`, 49 `QUAL-` assertions all `ok` across both scripts, including the 13 new `QUAL-01`/`QUAL-02`/`QUAL-03` mapper-crossing assertions and the pre-existing `QUAL-` assertions from plan 03-01). `npm run build` exits 0; `package.json`/`package-lock.json` unchanged (no new dependency). The live-database migration application is explicitly reported as NOT done this session, per "Migration Application" above — not silently assumed.
