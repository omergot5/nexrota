---
phase: 03-eligibility-model
plan: 01
subsystem: scheduling-engine
tags: [constraint-engine, qualification, hard-constraint, determinism, pure-functions]

# Dependency graph
requires:
  - phase: 02-task-shift-unification
    provides: "taskAsShiftShape(task) — the task-to-engine-item adapter this plan extends with `category` (D-01)"
provides:
  - "isQualified(guard, category) — the default-allow qualification predicate, exported from autoAssign.js"
  - "checkQualification({guard, shift}) — the {ok, code, reason} wrapper checkHardConstraints and callers (plan 03-02/03-03) use"
  - "checkHardConstraints's first branch is now qualification — closes the auto-assign, balance-pass and swap-approval routes through one insertion"
  - "taskAsShiftShape(task).category — the field plan 03-02/03-04 read to judge a task the same way a shift is judged (D-01)"
  - "explainUnfilled's labels map carries a distinct 'unqualified' entry — the exact Hebrew wording plans 03-03/03-04 must reuse: \"לא כשירים לתפקיד\""
affects: [03-02-schema-and-editor, 03-03-assign-view-display, 03-04-manual-assignment-gate]

# Actuals (#2632)
actuals:
  tokens: 7800
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Default-allow evaluated first on the falsy side (category, then list) so a work item or guard with no data is unrestricted — same shape as gs_role_compatibility's absence-means-allowed convention, applied one level down at person granularity"
    - "A hard constraint with genuinely no escape hatch: one destructured argument, no second parameter, proven by a length===1 assertion and by three named-but-inert extra properties (override/force/overrideNote) producing an identical refusal"
    - "Structural label-coverage test: read the engine's own source text at test time and assert every code it can emit has a display label, instead of hand-maintaining a parallel list that silently drifts"

key-files:
  created: []
  modified:
    - src/lib/autoAssign.js
    - src/lib/dates.js
    - scripts/verify-planning.mjs
    - scripts/verify-scheduler.mjs

key-decisions:
  - "D-03 confirmed as implemented: absent, null and empty qualifiedCategories are treated identically as \"no restriction\" — isQualified's very first check is the category, not the list, so a work item with no category short-circuits to true before the guard's list is even read."
  - "P-01 confirmed: checkQualification takes only {guard, shift} — no roster, no availability map, no rules object — keeping it callable from plan 03-04's manual-assignment path without dragging rest/consecutive/weekly-cap enforcement into a code path that has never had them."
  - "Qualification is inserted as checkHardConstraints's very first branch, before the pre-existing `unavailable` check — no other branch depends on it having run, and it depends on none of them, so the ordering is free to express the product meaning (a person who may never do this kind of work is refused for that reason first)."

patterns-established:
  - "isQualified(guard, category) is the single definition of qualification the whole product must use — plan 03-03's candidate grid and plan 03-04's manual-assignment gate both import it directly from autoAssign.js rather than re-deriving the rule."

requirements-completed: [QUAL-01, QUAL-02, QUAL-04, QUAL-05, QUAL-06, QUAL-08]

coverage:
  - id: D1
    description: "isQualified/checkQualification default-allow: absent, null and empty qualifiedCategories are qualified for every category; a falsy shift category is unrestricted for everyone, even for a guard with a narrowing list"
    requirement: "QUAL-02"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — QUAL-02 · assertions (bare guard, null list, empty list, falsy category × 3)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A guard with an explicit narrowing list is qualified for listed categories and refused for a category not on the list"
    requirement: "QUAL-01"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — QUAL-01 · assertions (two-member list, mutation-safety, repeated-call stability)"
        status: pass
    human_judgment: false
  - id: D3
    description: "checkQualification returns the same {ok, code, reason} shape every other hard constraint returns, with code exactly 'unqualified' and a non-empty Hebrew reason naming the blocked category"
    requirement: "QUAL-06"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — QUAL-06 · assertions (passing shape, failing shape, no-Latin-letters reason)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No argument on any exported function converts a qualification refusal into an approval — checkQualification accepts exactly one parameter"
    requirement: "QUAL-05"
    verification:
      - kind: unit
        ref: "scripts/verify-planning.mjs — QUAL-05 · assertions (override/force/overrideNote inert, length===1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A guard excluded from a category is refused by the auto-assign fill loop, by the balance pass and by checkAssignment (the swap-approval entry point), all through the single checkHardConstraints insertion — and is still assigned to a shift carrying no category"
    requirement: "QUAL-04"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — QUAL-04 · Tests 1-9 (exclusion across the full result, uncategorised-shift assignment, unfilled blocker with code+guardId, control run without the narrowing list, checkAssignment refuse/approve, balance-pass non-override, original-fixture non-regression, determinism)"
        status: pass
    human_judgment: false
  - id: D6
    description: "No qualification pre-filter exists over activeGuards anywhere in autoAssign/balanceWorkload — every candidate still reaches checkHardConstraints so a fully-excluded shift's unfilled entry names the blocked guard by id (Pitfall 6)"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — QUAL-04 · Test 3/4 (unfilled blocker code + guardId); grep gate (no activeGuards.filter(...isQualified...))"
        status: pass
    human_judgment: false
  - id: D7
    description: "taskAsShiftShape carries category (falling back to empty string, matching taskFromRow's convention) so the Phase 2 task/shift bridge does not drop the field qualification is judged on"
    requirement: "QUAL-04"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — D-01 · Tests (taskAsShiftShape with/without category, withEngineTasks preserves it)"
        status: pass
    human_judgment: false
  - id: D8
    description: "explainUnfilled produces a distinct, all-Hebrew sentence for a fully-unqualified slot vs. a fully-unavailable one, joins mixed blockers with correct counts, and leaves the empty-blockers team-wide sentence unchanged"
    requirement: "QUAL-08"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — QUAL-08 · assertions (no Latin letters, distinct from unavailable, count-prefixed, mixed join, empty-blockers unchanged)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Every hard-constraint code checkHardConstraints/checkQualification can emit has a matching label in explainUnfilled's map — a structural test reading the engine's own source, not a hand-maintained list"
    requirement: "QUAL-06"
    verification:
      - kind: unit
        ref: "scripts/verify-scheduler.mjs — QUAL-06 · structural coverage test (extracts code: literals from both function bodies, asserts each maps to a Hebrew label)"
        status: pass
    human_judgment: false

duration: ~20 min
completed: 2026-08-26
status: complete
---

# Phase 3 Plan 1: Qualification Hard Constraint Summary

**A fifth hard-constraint family — qualification — inserted as the first branch of `checkHardConstraints`, closing the auto-assign, balance-pass and swap-approval routes through one insertion, with a default-allow rule that leaves every pre-migration shift and every unconfigured team untouched.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-26T09:45:00+02:00 (approx.)
- **Completed:** 2026-08-26T10:11:14+02:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `isQualified(guard, category)` and `checkQualification({guard, shift})` are new named exports from `src/lib/autoAssign.js`, placed next to `availStatus`/`availComment` in the `// ---------- small helpers ----------` section. `isQualified` checks category first (falsy → unrestricted), then reads the guard's list defensively through optional chaining, then treats absence/`null`/empty array as unrestricted — only a non-empty array is consulted, and then with a plain membership test.
- `checkQualification` returns the same `{ok: true}` / `{ok: false, code, reason}` shape every other hard constraint in the module returns, with `code: "unqualified"` and a Hebrew `reason` quoting the blocked category name. It accepts exactly one destructured argument and no second parameter — verified with a `.length === 1` assertion plus three negative tests (`override`, `force`, `overrideNote` all produce an identical refusal to the base call).
- `checkHardConstraints` (`src/lib/autoAssign.js`) now calls `checkQualification` as its very first branch, before the pre-existing `unavailable` check, and returns the refusal unchanged on failure. Because the greedy fill loop, `balanceWorkload`, and `checkAssignment` (both swap screens' entry point) all reach `checkHardConstraints`, this single insertion closes three of QUAL-04's four routes at once.
- The greedy fill loop's candidate source (`activeGuards`, full active roster) is untouched — no pre-loop qualification filter was added anywhere in `autoAssign` or `balanceWorkload`. A fully-excluded shift's `unfilled[]` entry still carries a per-candidate `code: "unqualified"` blocker naming the guard, proving the candidate reached the check rather than being silently dropped (Pitfall 6).
- `taskAsShiftShape` (`src/lib/dates.js`) now carries `category` on the object it returns, falling back to `""` for a task with none — matching `taskFromRow`'s existing convention for the same field (`api.js`). This closes the Phase 2 bridge gap D-01 names: a task can now be judged by the same code that judges a shift.
- `explainUnfilled`'s `labels` map gained `unqualified: "לא כשירים לתפקיד"`, placed adjacent to and visibly distinct from `unavailable: "סימנו לא זמינים"`. A fully-unqualified empty slot now reads distinctly from a fully-unavailable one, with a comment explaining the two situations send a manager to different screens (editing qualifications vs. chasing availability).
- A new structural test in `verify-scheduler.mjs` reads `src/lib/autoAssign.js`'s own source text at test time, extracts every `code:` string literal from `checkHardConstraints`'s and `checkQualification`'s function bodies, and asserts each one has a matching key in `explainUnfilled`'s `labels` map — so the next hard-constraint code added to the engine cannot silently regress this the way `unqualified` nearly did.
- 18 new `QUAL-` assertions added to `scripts/verify-planning.mjs` (unit level: default-allow, narrowing, no-override, shape, mutation-safety) and 22 new `QUAL-`/`D-01` assertions added to `scripts/verify-scheduler.mjs` (integration level: full-engine fixture proving all three routes blocked, a control run proving qualification specifically caused the block, `checkAssignment` refuse/approve, balance-pass non-override, determinism, and the label-distinction/structural-coverage tests). All pre-existing `FAIR-`/`UNIF-` assertions (28+19 in `verify-scheduler.mjs`, 33+36 in `verify-planning.mjs`) still print `ok`, unchanged in count from before this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: The two helpers, and the default-allow rule that keeps a new team unblocked (QUAL-01, QUAL-02, QUAL-05, QUAL-06)** - `de62f6d` (feat)
2. **Task 2: One insertion closes three of the four routes, and the Phase 2 bridge stops dropping the field (QUAL-04, QUAL-05, D-01)** - `41b474b` (feat)
3. **Task 3: An empty slot says nobody is qualified, not nobody is available (QUAL-08, QUAL-06)** - `9b5ca51` (feat)

## Files Created/Modified

- `src/lib/autoAssign.js` - Adds `isQualified`/`checkQualification` exports; inserts the qualification branch as the first check in `checkHardConstraints`; adds the `unqualified` label to `explainUnfilled`'s `labels` map.
- `src/lib/dates.js` - `taskAsShiftShape` gains a `category` field (falls back to `""`), carrying the Phase 2 task/shift bridge's field qualification is judged on.
- `scripts/verify-planning.mjs` - New unit-level `QUAL-01/02/05/06` assertion block (18 assertions) plus `isQualified`/`checkQualification` added to the existing `autoAssign.js` import line.
- `scripts/verify-scheduler.mjs` - New integration-level `QUAL-04`/`QUAL-02`/`D-01` assertion block (13 assertions, new `ql-` prefixed fixture) and `QUAL-08`/`QUAL-06` assertion block (9 assertions, structural label-coverage guard); `explainUnfilled`, `readFileSync` added to imports.

## Decisions Made

- **Exact Hebrew wording locked for reuse by plans 03-03/03-04:**
  - Refusal reason (per-candidate, `checkQualification`): `` לא מוגדר/ת כשיר/ה לקטגוריית "${category}" `` — e.g. `לא מוגדר/ת כשיר/ה לקטגוריית "סיור"`.
  - Aggregate slot label (`explainUnfilled`'s `labels.unqualified`): `לא כשירים לתפקיד` — used in the `${n} ${label}` template, e.g. `2 לא כשירים לתפקיד`.
  - Both plans downstream should reuse these strings verbatim rather than inventing parallel wording.
- **`explainUnfilled` is the only place the code-to-Hebrew mapping happens.** Grepped `src/components/` for a second code-to-label map (e.g. a hand-written `unavailable`/`rest`/`consecutive` switch) — none found. Only `src/components/SmartAssign.jsx` calls `explainUnfilled` (line 563, via the imported function). Plan 03-03 should wire the same function/labels rather than inventing a second map.
- **`checkQualification`'s destructuring reads `shift?.category` defensively**, matching the posture `checkAssignment` already takes for a missing shift argument — a caller passing an incomplete work item gets the permissive answer, not a thrown error.
- **The balance-pass test (Task 2, Test 7) does not rely on `keepExisting`'s locking behaviour to pass.** The excluded-category shift in that mini-fixture is filled through the normal greedy loop (unlocked), not pre-set on the shift object, so `balanceWorkload`'s move attempt genuinely reaches `checkHardConstraints` and is genuinely blocked by the new qualification branch — not trivially protected by the pre-existing "never move a locked/manual assignment" rule. `keepExisting: true` is still passed to the run (matching the plan's literal instruction) but has no effect on this particular shift since it carries no pre-existing `assignedGuards`.

## Deviations from Plan

None - plan executed exactly as written. One implementation-detail refinement within Task 3's scope: the plan's `<action>` text describes extracting `code:` literals from `checkHardConstraints`'s body alone; because Task 2's insertion delegates to `checkQualification` (`const qualCheck = checkQualification({ guard, shift }); if (!qualCheck.ok) return qualCheck;`) rather than inlining a duplicate `code: "unqualified"` literal — the correct, DRY implementation the plan itself specifies in Task 1 — the literal `"unqualified"` does not textually appear inside `checkHardConstraints`'s body. The structural test was written to extract from both `checkHardConstraints`'s and `checkQualification`'s function bodies (since the former delegates to the latter as its first branch), which still excludes unrelated codes like `checkAssignment`'s `"missing"` and still fails loudly (rather than passing vacuously) if either extraction comes back empty or implausibly short. This is not a Rule 1-4 code deviation — no product behaviour changed — but is recorded because it is a literal-text deviation from the `<action>` block's stated extraction scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**For Plan 03-02 (schema and editor):** `guard.qualifiedCategories` and `shift.category` are the exact field names the engine reads — the migration and `api.js` mapper must produce these names on the app-layer object. `checkQualification`'s narrow `{guard, shift}` signature (P-01, confirmed in this plan) is what plan 03-04's manual-assignment gate will call directly, without dragging rest/consecutive/weekly-cap into `toggleAssignment`.

**For Plan 03-03 (assign-view display):** Reuse `isQualified(guard, shift.category)` directly (already exported) to decide per-candidate lock state, and reuse the exact Hebrew wording recorded above (`checkQualification`'s reason string and `explainUnfilled`'s `unqualified` label) rather than inventing new copy. No second code-to-Hebrew mapping exists in `src/components` today — `explainUnfilled` is the only one, called only from `SmartAssign.jsx`.

**For Plan 03-04 (manual assignment gate):** `checkQualification({guard, shift})` is ready to be called from `toggleAssignment` (`useGuardian.js`) on the assign direction only, before the optimistic paint — exactly the pattern `03-RESEARCH.md`'s code example shows. No changes were made to `useGuardian.js` in this plan; that route (QUAL-04's fourth) remains open and is plan 03-04's explicit scope.

No blockers for 03-02, 03-03 or 03-04.

---
*Phase: 03-eligibility-model*
*Completed: 2026-08-26*

## Self-Check: PASSED

All modified files confirmed present on disk (`src/lib/autoAssign.js`, `src/lib/dates.js`, `scripts/verify-planning.mjs`, `scripts/verify-scheduler.mjs`, this SUMMARY). All three task commit hashes (`de62f6d`, `41b474b`, `9b5ca51`) confirmed present in `git log`. `npm test` exits 0 with zero `FAIL` lines across both scripts (18 `QUAL-` assertions ok in `verify-planning.mjs`; 18 `QUAL-`, 3 `D-01`, 28 `FAIR-`, 19 `UNIF-` assertions ok in `verify-scheduler.mjs`). `npm run build` exits 0; `package.json`/`package-lock.json` unchanged (no new dependency).
