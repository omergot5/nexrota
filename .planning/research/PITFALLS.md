# Pitfalls Research: Eligibility Model, Task/Shift Unification, Fairness Metric Recalibration

**Domain:** Adding qualification constraints and merging temporal entity types into a shipped, deterministic scheduling engine (NexRota)
**Researched:** 2026-08-21
**Confidence:** HIGH for codebase-grounded findings (direct read of `autoAssign.js`, `conflicts.js`, `fairness.js`, `api.js`, schema docs, `PROJECT.md`, `CONCERNS.md`); MEDIUM for general industry patterns (expand/contract migration, KPI-drift/dashboard-trust literature) cross-checked across multiple independent sources via web search.

This is not generic "how to build a scheduler" research. Every pitfall below traces to a specific line, table, or decision already present in NexRota's shipped code and `PROJECT.md`.

---

## Critical Pitfalls

### Pitfall 1: Eligibility table shape inverts the product's own default-allow rule

**What goes wrong:**
`PROJECT.md` commits to two decisions: eligibility is a flat category set, and the default for a new person is "eligible for everything, manager narrows." The natural way to build "no override, hard block" is an **allow-list** table (`gs_eligibility(guard_id, category)`, row present = permitted). But an allow-list table is a **default-deny** structure: on day one, every existing `gs_profiles` row (and every newly created one, until seeded) has zero rows, meaning nobody is eligible for anything until a supervisor manually grants each person each category. That is the exact opposite of the stated default, and it fails two ways at once:
- **New team / entry test failure:** a stranger who just joined a fresh team via the 6-character code cannot get a filled roster on the first run — every shift comes back "no one eligible," with nobody there to explain why, directly violating the entry test in `PROJECT.md` and `CONTEXT_PACK.md` ("אדם שמקבל את האפליקציה לידיו מסיים סידור שבועי מלא בלי שאף אחד יסביר לו כלום").
- **Existing-team migration failure:** every one of the ~50 already-running teams (per `CONCERNS.md` scaling notes) has guards who have been doing "מטבח" or "שמירות" for months under free-text `category` values on `gs_tasks`. The moment the eligibility gate ships, if it's default-deny, `autoAssign` refuses to reassign these same people to the work they already do.

**Why it happens:**
"Absolute block, no override" *sounds* like it should be implemented as an allow-list (`row = permission granted`), which is the natural, intuitive design for a permissions feature — but it's the wrong shape for a system whose only other precedent (`conflicts.js`) is explicitly default-allow ("היעדר שורה = מותר"). Teams copy the mental model of "permissions = grants" from generic RBAC examples instead of matching the codebase's own established idiom.

**How to avoid:**
Implement eligibility as a **restriction table**, not a grant table: `gs_eligibility(guard_id, category, ...)` where a row means "explicitly restricted from this category," OR store an explicit `eligible_categories` array/jsonb on `gs_profiles` that defaults to a sentinel meaning "all" (e.g., `null` = all categories, a populated array = only these). Either shape must satisfy: **absence of a row/value = eligible for everything.** Mirror `pairRule`'s pattern in `conflicts.js` exactly (`hit ? ... : { rule: "allow" }`). Write the migration to backfill nothing for existing profiles — the whole point of default-allow is that no backfill is required.

**Warning signs:**
- Schema design doc or migration proposes `CREATE TABLE gs_eligibility (guard_id, category)` with no explicit "row = restriction" comment.
- A code review question "does a new guard show up as a candidate before any admin action?" gets answered with "not until someone assigns categories."
- Manual QA: create a brand-new team, add one guard, run auto-assign — if any shift/task category returns zero candidates due to eligibility, the shape is wrong.

**Phase to address:** Eligibility model phase (schema + engine integration), before any UI work. This is a schema-shape decision that is expensive to reverse after data exists — decide and test it first.

---

### Pitfall 2: Eligibility enforced in some code paths, silently bypassable in others

**What goes wrong:**
`autoAssign.js` has at least four distinct places that decide "can this guard take this slot": the greedy-fill candidate loop (`checkHardConstraints` inside the `while` loop, line ~449-458), the balancing pass (`checkHardConstraints` again, inside `balanceWorkload`, line ~549), the standalone swap-approval checker (`checkAssignment`, used by swap-request approval), and — for tasks — a *separate* engine entirely (`findConflicts` in `conflicts.js`, which today never touches `checkHardConstraints`). If eligibility is added only to `checkHardConstraints` and the merge into `checkAssignment`/`findConflicts`/manual-assignment UI is missed, the product's stated guarantee — "כשירות היא עובדה על האדם... אין נימוק שמשנה זאת" (absolute, no override, unlike the conflicts matrix) — becomes untrue in exactly the paths a manager is most likely to use under pressure: manual assignment and swap approval.

**Why it happens:**
The engine has organically grown four semi-independent decision points because it was built incrementally (shifts first, hard constraints, then a separate swap checker, then a separate conflicts engine for tasks). Adding a new hard rule "once, in the obvious place" (the greedy loop) feels complete because `npm test` for the auto-assign path will pass, while the swap-approval and manual-assignment paths — which reuse `checkAssignment`, a *different* function — silently keep working the old way.

**How to avoid:**
Build a single `isEligible(guard, category)` lookup (same pattern as `compatIndex`/`pairRule` in `conflicts.js`: build an index once per run, O(1) lookup after). Thread it through every one of: `checkHardConstraints`, `balanceWorkload`'s move-legality check, `checkAssignment` (swap approval and manual-assignment live-check), and the merged task engine. Add one blocker code (`"ineligible"`) that all four paths can return, and a single test in `verify-scheduler.mjs` that asserts an ineligible guard is rejected by all four entry points, not just `autoAssign`.

**Warning signs:**
- Grep for `checkHardConstraints(` finds calls that don't pass the same eligibility index (or none at all).
- A manual test: mark a guard ineligible for "מטבח," then try (a) auto-assign, (b) drag them onto a מטבח slot manually, (c) approve a swap onto that slot. All three must refuse; if any succeeds, enforcement is partial.
- `checkAssignment`'s docstring already says it must run "the *same* checker the engine runs — a swap that the engine would never have produced must not be reachable by approving a request either." This existing design intent is the test to hold eligibility to.

**Phase to address:** Eligibility model phase — verification step should explicitly enumerate all four entry points before marking the phase done.

---

### Pitfall 3: Eligibility is only enforced in client-side pure JS — no server-side or RLS backstop

**What goes wrong:**
`CONCERNS.md` already flags that "Authorization depends entirely on Supabase RLS policies with no server-side validation checks." `autoAssign.js`, `checkAssignment`, and the eligibility index all live in a pure JS module that ships to the browser. A product claim of "absolute block, no override" is a claim about business logic, but the actual enforcement boundary in this architecture is RLS. If eligibility is implemented purely as an in-browser filter, a supervisor's browser console (or any direct Supabase REST/PostgREST call using a valid session) can insert a row into `gs_assignments` for an "ineligible" guard-category pair, and nothing stops it. This doesn't matter for the honest-manager case, but it means the "absolute" guarantee is a UI convenience, not a system property — worth being explicit about, since the product's whole differentiator is that its decisions are trustworthy and defensible.

**Why it happens:**
The existing hard constraints (rest, consecutive hours, caps) already have this same gap and it hasn't bitten the product yet, because breaking them by hand requires deliberate console tampering with low payoff. Eligibility is different in kind: "the waiter can't be scheduled to cook" is closer to a business/legal invariant a manager might actually want enforced at the data layer (e.g., a compliance-driven qualification), so the gap is more consequential here than for the existing soft-touch constraints.

**How to avoid:**
Decide explicitly, and document the decision: either (a) accept client-side-only enforcement as sufficient for this product's threat model (single-team, low-stakes, code-based access) and say so, or (b) add a Postgres check/trigger on `gs_assignments` that validates eligibility server-side using the same table. Given the "no server-side validation" debt is already logged in `CONCERNS.md`, this is a good, small, self-contained place to close that gap for the one constraint marketed as truly non-negotiable — without having to solve the whole server-side-validation backlog.

**Warning signs:**
- "Absolute, no override" language appears in UI copy or `PROJECT.md` while the only enforcement is a JS function that ships to the client.
- No RLS policy or trigger exists on `gs_assignments` referencing the new eligibility table.

**Phase to address:** Eligibility model phase, as a scoped decision (not a blocker) — pick the enforcement boundary knowingly rather than by default.

---

### Pitfall 4: Legacy day-range tasks have no hours — naive backfill poisons the merged engine

**What goes wrong:**
Existing `gs_tasks` rows carry `start_date`/`due_date` only. The migration decision "משימה נושאת שעות ונכנסת למנוע השיבוץ" (a task carries hours and enters the assignment engine) requires every task to have `start_time`/`end_time` to compute `shiftInterval`, `shiftHours`, and `shiftLoad`. Two backfill temptations are both dangerous:
- **Default to a full day (00:00–23:59):** every legacy task becomes a ~24h block. `shiftLoad` would compute a load of 24× the type multiplier — instantly dwarfing every real shift in the rolling 14-day fairness window (`fairness.js`), so any guard with even one historical task shows an enormous artificial "carried" load, producing nonsense `fairnessPlan` deficits (`needs: -40` etc.) for weeks after the migration ships.
- **Default to a short placeholder (e.g., 1h):** silently understates historical load, making guards who did real multi-day task work look under-loaded, so the balance pass then over-assigns them new shifts to "catch up" on load they never actually owed.
Either way, `checkHardConstraints`'s `maxConsecutiveHours` (12h) and `minRestHours` (8h) checks, which today never see tasks, will suddenly evaluate every legacy multi-day task against hour-based rules it was never designed to satisfy — a task that spanned three real calendar days at "00:00–23:59" instantly reads as 72 consecutive hours, either raising an exception path in the engine or (worse) silently corrupting the guard's `load.shifts` interval list used for real future assignments.

**Why it happens:**
"Just backfill a default" is the fastest way to satisfy a NOT NULL constraint and get `npm test` green again, and it's invisible in a demo with a fresh database that has no legacy tasks to backfill.

**How to avoid:**
Do not retroactively force legacy tasks into the hour-based engine. Freeze pre-migration `gs_tasks` rows as a historical, day-granularity record excluded from `checkHardConstraints`, `shiftLoad`, and the rolling fairness window — the same way `fairness.js` already excludes deleted guards from averages. Only tasks created *after* the migration (which require hours at creation time, closing the gap PROJECT.md calls out) enter the unified engine. Document this explicitly as a permanent two-tier boundary (with a fixed cutover date) rather than a temporary hack, since a real backfill of hours would require the manager to remember true minute-level hours for old paperwork — data that doesn't exist and can't be honestly recovered.

**Warning signs:**
- A migration script that writes `start_time`/`end_time` into every existing `gs_tasks` row.
- `fairnessPlan` deficits (`needs`) becoming wildly negative or positive immediately after deploy, for guards who have old tasks but no unusual recent shifts.
- `checkHardConstraints`'s `consecutive` blocker firing for guards who did nothing unusual this week — a sign a legacy task interval leaked into `load.shifts`.

**Phase to address:** Task/shift unification phase. Should be a named design decision ("legacy tasks are frozen, out of scope for the unified engine") documented in `PROJECT.md`'s Key Decisions table before implementation starts, per the "expand/contract" pattern used broadly for backward-compatible schema changes — expand (add hour columns, nullable, only required for new rows), migrate new writers to the new shape, and never force-contract the historical rows into a shape they were never designed for.

---

### Pitfall 5: Two conflict-detection granularities never reconciled — false or missed conflicts once tasks carry hours

**What goes wrong:**
`conflicts.js`'s `taskWindow`/`windowsOverlap` compares **ISO date strings inclusively** (`x.from <= y.to && y.from <= x.to`) — day-level granularity, correct for a system where tasks only ever had day ranges. `autoAssign.js`'s `overlaps`/`shiftInterval` compares **millisecond timestamps** — hour-level granularity, correct for shifts. Once tasks carry hours, these two engines start disagreeing at the exact case that matters most: two tasks on the same calendar day, at non-overlapping hours (e.g., 06:00–08:00 and 20:00–22:00). `findConflicts` will still flag them as conflicting (day-level compare says same day = overlap), even though the person is legitimately free between them — an over-restriction that makes previously-fine schedules suddenly infeasible. Conversely, if only `autoAssign`'s interval logic is updated and `conflicts.js` is left as-is (because it's a separate, rarely-touched module — see `CONCERNS.md`'s "Conflict Detection Module... no tests for this module at all"), the reverse gap reappears: the exact "two engines blind to each other" bug that `PROJECT.md`'s Context section names as the second defect motivating this whole cycle ("אדם יכול להיות משובץ למטבח ולתורנות לילה באותו יום בלי שאף מנוע יגיד מילה").

**Why it happens:**
`conflicts.js` and `autoAssign.js` are deliberately separate pure modules (that's a stated architectural strength — testable in isolation), but "separate" makes it easy to update one and forget the other exists, especially since `conflicts.js` has zero test coverage today (`CONCERNS.md`) and nobody notices a silent regression in it.

**How to avoid:**
When tasks gain hours, migrate `taskWindow`/`windowsOverlap` to use the same millisecond-interval representation as `shiftInterval`/`overlaps` — ideally the *same function*, imported from one place, not two independent implementations of "do these two time ranges overlap." This is precisely the unification `PROJECT.md` is asking for ("שני מנועים עיוורים זה לזה"); doing it at the data-model level only, without also collapsing the two overlap-comparison functions into one, ships half the fix.

**Warning signs:**
- After the merge, `taskWindow` still returns `{from, to}` as bare date strings rather than timestamps.
- A test with two same-day, non-overlapping-hour tasks assigned to the same person: if `findConflicts` still flags it, the day-level comparison wasn't updated.
- `windowsOverlap` and `overlaps` remain two separately-maintained functions in two files after the migration — a strong signal the reconciliation was skipped.

**Phase to address:** Task/shift unification phase — this is the load-bearing part of "one board" (`Active` item 5), not a side detail; without it, the unification is cosmetic (same screen) rather than structural (same engine).

---

### Pitfall 6: Fairness formula recalibration by mechanical find-replace produces plausible-looking but meaningless numbers

**What goes wrong:**
Two spots in `autoAssign.js` count shifts instead of load, and `PROJECT.md` correctly identifies both:
- `balanceWorkload` (line ~522-532): sorts guards by `load.get(id).count` and stops when `gapSize < 2` (an integer shift-count difference).
- `buildResult`'s `fairnessScore` (line ~633-642): computes `variance` over `perGuard.map(p => p.shifts)` (again, counts), then `100 - Math.sqrt(variance) * 15`, where **15 was tuned specifically so "each full shift of spread costs ~15 points."**
The obvious fix — swap `count`/`shifts` for `load` in these expressions — changes the *units* without re-deriving the *constants*. `gapSize < 2` meant "stop once nobody is more than 2 shifts ahead"; if `gapSize` becomes a load difference, "< 2" now means "stop once nobody is more than 2 load-hours ahead" (roughly 15% of one shift), a far tighter bar that will either run the balance loop to its 40-pass ceiling routinely or converge on a different, un-validated notion of "flat enough." Likewise the `* 15` coefficient in `fairnessScore` was calibrated against integer shift-count variance; feeding it load-value variance (a different numeric scale, since load values are hours×1.0–1.4) produces a score that still "looks like" a 0–100 badge but no longer means what the 15-point-per-shift comment says it means. The result: a fix that makes `npm test` pass (if tests aren't updated to assert specific thresholds) and *looks* correct in a demo, while silently shipping a differently-broken calibration.

**Why it happens:**
The two lines PROJECT.md points to as the bug are single-token substitutions (`.count` → `.load`), which makes the fix look trivially small — but the surrounding constants (`gapSize < 2`, `* 15`) were derived against the old units and don't automatically carry over. This is a classic "the diff is small, the semantics are not" trap, worsened by `CONCERNS.md`'s note that these exact lines ("Balancing Algorithm... Moves are applied immediately with no rollback... hardcoded magic number") already have no dedicated tests.

**How to avoid:**
Treat this as a deliberate recalibration, not a substitution:
1. Re-derive `gapSize`'s threshold in load units (e.g., "stop once nobody is more than X hours of weighted load ahead," picking X by testing against representative rosters, not by unit-converting the old `2`).
2. Re-derive `fairnessScore`'s coefficient by computing load-variance on a few representative known-fair and known-unfair rosters and choosing a constant that reproduces sensible scores (100 for flat, dropping meaningfully for real imbalance) — document the derivation in a comment the way the current `15` is explained.
3. Add explicit unit tests (new, since none exist today) asserting expected `fairnessScore` and `balanceWorkload` convergence behavior for fixed input rosters, so the recalibration is pinned and any future accidental edit is caught.

**Warning signs:**
- The diff for this phase touches only `.count`/`.shifts` → `.load` tokens with no changes to `2` or `15`.
- Balance pass starts hitting its 40-iteration cap on rosters that converged in a handful of passes before.
- `fairnessScore` values cluster near 0 or near 100 far more often than before, on the same kinds of rosters — a sign the coefficient no longer matches the new scale.

**Phase to address:** Fairness recalibration phase (PROJECT.md places this first, before eligibility/unification — correctly, since building on top of a self-contradictory fairness engine "multiplies the contradiction").

---

### Pitfall 7: Stale PWA cache serves the old fairness formula next to the new one — same roster, two "correct" numbers

**What goes wrong:**
The fairness score is computed **client-side**, inside `autoAssign.js`, which ships as part of the frontend bundle. `CONCERNS.md` already documents that offline/cache state is fragile: "Offline mode persists stale data without clear expiration... Silent fallback to cached data masks network issues... No conflict resolution if cache is older than server." Once the fairness formula changes, a supervisor whose browser served the pre-update bundle (from the service worker cache, since this is a PWA per `CONTEXT_PACK.md`) computes the *old* count-based `fairnessScore` and `balanceWorkload` result, while a colleague on the same team who happened to reload after the deploy gets the *new* load-based numbers — for the identical underlying roster data. Two supervisors on the same team, looking at the same week, see different fairness scores and disagree about who needs a shift. This is worse than the bug that motivated the whole cycle: at least today's bug (`fairnessScore 100` while one person carries all the nights) is *consistently* wrong everywhere; a mid-rollout cache split makes it *inconsistently* wrong, which is much harder to diagnose and directly erodes the trust the product is built on ("שקיפות שמדווחת מספר שגוי גרועה מאי-שקיפות" — PROJECT.md's own words about *why this cycle exists*, ironically the same risk shape as the rollout itself).

**Why it happens:**
Client-side computation is otherwise a strength here (works offline, no server round-trip, deterministic and auditable) — but it means a formula change is really a *client code* change, and client code changes on a PWA are gated entirely by cache invalidation timing that engineers don't control per-device. Nobody thinks of "ship a bugfix to a pure function" as a rollout-coordination problem, because it isn't one for most bugfixes — it becomes one specifically because the *displayed number's meaning* changes, not just its correctness.

**How to avoid:**
Treat the fairness-formula change like a breaking API change, not a silent patch: bump the service worker's cache version so all clients are forced to fetch the new bundle on next load (standard PWA update pattern — `skipWaiting`/update-available prompt), and consider tagging the fairness payload with a formula-version marker so a supervisor comparing screenshots across devices can at least tell the numbers came from different code (general industry pattern for exactly this failure mode: "treat metric definitions like code — version them... show the metric definition version on the dashboard," per dashboard-trust literature, MEDIUM confidence, cross-checked across multiple sources). Since `PROJECT.md` explicitly defers push/SMS notifications this cycle, an in-app one-time banner ("סרגל ההוגנות חושב מחדש — הנטל, לא הספירה" or similar) is a lightweight, notification-free way to signal the change without requiring the deferred delivery channel.

**Warning signs:**
- Two devices on the same team, same week, showing different fairness scores after a deploy — the canonical symptom.
- No service-worker version bump accompanies the fairness-formula commit.
- Support/bug reports describing "the fairness number is different than what I saw yesterday" without any underlying data change.

**Phase to address:** Fairness recalibration phase — the deploy step, not just the code change. Verification should explicitly include "force-refresh an old cached client and confirm it can't silently keep computing the old formula."

---

### Pitfall 8: Recurring standing-position materialization can reintroduce non-determinism into a previously deterministic engine

**What goes wrong:**
Iron Principle #1 in `CLAUDE.md`/`PROJECT.md` is absolute: "אין `Math.random()` במנוע... אותם נתונים ⟵ אותו סידור, תמיד." A standing position that "recurs weekly and materializes into concrete rows" (`Active` item 4) is, by construction, a **generator process** — something runs on a schedule or on-demand and writes new `gs_shifts`/`gs_tasks`-shaped rows into the database. That generator sits *outside* the pure `autoAssign`/`fairness`/`conflicts` modules and is exactly the kind of code most likely to accidentally introduce non-determinism the engine itself was designed to avoid: using `Date.now()`/wall-clock as part of a generated row's identity or ordering, relying on Postgres's default (unordered) row return order when the materialized rows are later read back into the engine, or generating IDs whose sort order isn't stable. None of `autoAssign`'s internal sorts have a problem *if* their inputs arrive in a consistent order — but every sort in the engine (`ordered`, `sorted` in `balanceWorkload`, `candidates.sort`) relies on deterministic tie-breaking (`tieBreak`, `String(a.id).localeCompare(...)`) precisely because upstream ordering was never guaranteed to be stable. A new query path that feeds materialized standing-position rows into `shifts`/`guards` without an explicit `.order()` clause is the most likely place this regresses, since it's new code that hasn't internalized the "always assume unordered input" discipline the rest of the codebase already has.

**Why it happens:**
Materialization is naturally framed as "run this weekly," which pulls in wall-clock and scheduling concerns that the rest of the engine deliberately has none of. It's easy to build and test the generator against "today," get a green demo, and never notice that a second run against the same declared standing position on a different day (or a different server) produces DB rows with different UUIDs, different insertion order, or a different `created_at`, which then feeds the engine differently only if the engine (or a component built on top of it) implicitly trusts row order.

**How to avoid:**
Keep the generator itself outside the "no `Math.random()`" guarantee (it's fine for row UUIDs and `created_at` to be non-deterministic — that's normal DB behavior) but audit that nothing downstream depends on it. Concretely: every query that loads shifts/tasks/standing-position rows for `autoAssign` must have an explicit `ORDER BY` (by a stable key such as id or date+id), matching the discipline already implicit in the engine's own tie-breaking. Add a regression test to `verify-scheduler.mjs`: run `autoAssign` twice on the same logical dataset but with the input arrays shuffled between runs, and assert identical output — this catches order-dependence regardless of where it was introduced.

**Warning signs:**
- Any new Supabase query for standing-position rows without `.order(...)`.
- `verify-scheduler.mjs` has no "shuffle the input arrays, expect identical output" test today (worth adding regardless, since it would also catch this class of bug in the existing engine).
- Two consecutive `git blame`-adjacent runs of the same week's schedule (before and after a server restart, or across two different `node` processes) produce different assignment order in logs, even if the final assignment set is the same.

**Phase to address:** Standing positions phase. The determinism regression test belongs in the same phase, not deferred — it's cheap to add and directly protects the product's flagship guarantee.

---

### Pitfall 9: Stacked constraints (eligibility + conflicts + hard rules) produce silently unfillable shifts with no diagnosable reason

**What goes wrong:**
Today, `explainUnfilled` has a fixed vocabulary of blocker codes (`unavailable`, `rest`, `consecutive`, `overlap`, `weekly-cap`, `night-cap`, `no-availability`, `maybe-blocked`, `already`) and produces a human sentence like "3 סימנו לא זמינים · 2 חוסמי מנוחה." Eligibility is a *new* way for the candidate pool to hit zero, and it stacks with everything else: a shift that requires category X, where the only two people eligible for X are also blocked by the conflicts matrix from a same-day position, or already at their weekly cap. Once eligibility is live, "no one eligible" needs to be visible and distinguishable from "eligible people exist but are all unavailable/capped" — these require completely different manager actions (loosen eligibility vs. find more availability vs. relax caps). If the new blocker code isn't added to `explainUnfilled`'s `labels` map, an eligibility-caused empty slot falls through to the generic `code || code` fallback (an ugly raw string) or, worse, if eligibility filtering happens *before* `checkHardConstraints` is even called (e.g., pre-filtering the candidate list rather than returning a blocker), it never reaches `roundBlockers` at all and the shift shows "אין שומרים זמינים בצוות" — actively misleading, since the real reason is "no one is *qualified*," not "no one is *free*." This directly threatens the entry-test property that the product explains every decision, including every empty slot.

**Why it happens:**
The cheapest implementation of eligibility is to filter `activeGuards` down to eligible ones *before* the candidate loop even starts (a one-line `.filter()`), which is fast and correct for who gets assigned — but it bypasses the blocker-reporting path entirely, since `roundBlockers` is only populated inside the loop over guards who were considered.

**How to avoid:**
Route eligibility through `checkHardConstraints` (or an equivalent check reachable from the same place `roundBlockers` is populated) rather than pre-filtering the guard list, so an ineligible guard still produces a `{ok: false, code: "ineligible", reason: "לא כשיר/ה לקטגוריה X"}` entry. Add `ineligible` to `explainUnfilled`'s `labels` map. Consider a manager-facing distinction in the unfilled-shift explanation between "everyone eligible is otherwise blocked" and "nobody is eligible at all" — the latter is a configuration problem (raise it prominently, since it likely means the manager forgot to grant eligibility for a newly split category), the former is a scheduling problem.

**Warning signs:**
- Eligibility implemented as `activeGuards.filter(g => isEligible(g, shift.category))` before the candidate loop, rather than as a check inside it.
- `explainUnfilled`'s `labels` map unchanged after the eligibility phase ships.
- A manually-constructed test case (one category, one eligible person, that person unavailable) shows "אין שומרים זמינים בצוות" instead of surfacing that eligibility narrowed the pool to begin with.

**Phase to address:** Eligibility model phase, verification step — this is the "manager can self-diagnose an empty slot" check and belongs in that phase's UAT, not deferred to the unified-board phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Backfill legacy `gs_tasks` rows with placeholder hours (00:00–23:59 or similar) | Satisfies NOT NULL constraint, unblocks migration in one script | Poisons rolling-window fairness load and hard constraints for weeks (Pitfall 4) | Never — freeze legacy rows outside the unified engine instead |
| Implement eligibility as `activeGuards.filter()` before the candidate loop | Simple, fast, correct for *who gets picked* | Breaks `explainUnfilled` diagnosability for empty slots (Pitfall 9) | Never for this product, given the "explains every decision" promise; acceptable only in a product without that guarantee |
| Swap `.count` for `.load` in `balanceWorkload`/`fairnessScore` without re-deriving `2`/`15` constants | Smallest possible diff, fastest to ship | Numbers look plausible but are miscalibrated (Pitfall 6) | Never — always acceptable to spend an extra day re-deriving constants against representative rosters |
| Ship eligibility enforcement only inside `autoAssign`'s greedy loop, skip `checkAssignment`/swap approval | Passes the existing `autoAssign`-focused test suite fastest | "No override" promise silently false in manual assignment and swap flows (Pitfall 2) | Never — the entry points must be enumerated and covered together |
| Skip the service-worker cache-bust when shipping the fairness formula change | One less deploy step to think about | Two supervisors on the same team see different numbers for the same roster (Pitfall 7) | Never for a *meaning*-changing formula update; acceptable for pure bugfixes that don't change what the number represents |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase RLS on new tables (`gs_eligibility` and any standing-position table) | Ship the table without RLS, as already happened once with `gs_role_compatibility` per `CONCERNS.md` ("New table added without explicit RLS creation... info leak") | Write and test RLS (team_code scoping) in the same migration that creates the table; test with a low-privilege session before merging |
| `api.js` write paths for new eligibility/standing-position writes | Update without `.select()` — RLS filters silently, Supabase returns `error: null` and an empty array, "success" that wrote nothing (documented existing footgun in `CONTEXT_PACK.md` §8) | Every new mutation in `api.js` for these tables must include `.select()` and check the returned row count, following the existing pattern |
| Service worker / PWA cache on formula changes | Assume a code deploy reaches all clients promptly | Bump cache version / trigger update-prompt specifically when a *displayed number's meaning* changes, not just for ordinary bugfixes |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Eligibility checked with inline `.includes()`/array scan per guard per shift inside the O(shifts × guards) greedy loop | Noticeable slowdown re-appears on the ~50-guard/100-shift ceiling already documented in `CONCERNS.md` | Build an eligibility index once per run (`Set` or `Map` keyed by `guardId-category`), mirroring `compatIndex`'s precomputed-index pattern in `conflicts.js`, rather than filtering inline per candidate | At the same ~100+ guard scale where the existing algorithm already shows >2s runtimes (per `CONCERNS.md` Scaling Limits) |
| Unified task/shift engine roughly doubles the number of "slots" `checkHardConstraints` evaluates per guard (tasks + shifts now share one load list) | Balance pass (already O(shifts × balancePasses) and already flagged as a bottleneck) takes proportionally longer once tasks are included | Reuse the existing `blockHoursAround`/`smallestRestGap` machinery (already O(n) over a guard's own load list, not the whole roster) rather than introducing a second parallel bookkeeping structure for tasks | Same scale threshold as today's existing bottleneck — team size in the 50-100 range |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating "eligibility is absolute, no override" as fully enforced when it only exists in client-side pure JS (`autoAssign.js`, `checkAssignment`) | A direct Supabase write (console, replayed request) can still create an assignment for an ineligible guard-category pair, since there's no server-side or RLS-level check (Pitfall 3; `CONCERNS.md` already flags "no server-side validation checks" generally) | Explicitly decide and document the enforcement boundary; add a Postgres check/trigger on `gs_assignments` referencing the eligibility table if the "absolute" claim needs to be literally true, not just UI-true |
| Reusing the existing default-allow pattern (`gs_role_compatibility`'s missing-RLS incident) for the new eligibility table | Info leak: any authenticated user could read another team's eligibility rules if RLS isn't added at the same time the table ships | Copy the working RLS pattern from `gs_availability`/`gs_shifts` (team_code scoping) into the new table's migration, not as a follow-up |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Standing position shown as "assigned to me" when it's really "I'm in the eligible pool" (per `PROJECT.md`: "שיוך אנשים אליה = הצהרת כשירות, לא שיבוץ") | A participant sees their name on a standing position, believes they're working it, and is confused/upset when the engine assigns someone else that week — with nobody there to explain, violating the entry test | Give standing-position membership its own explicit label distinct from an actual weekly assignment, and carry a `reason` string (matching the existing `gs_assignments.reason` contract) explaining *why* a specific person was picked for that week's materialized row |
| Fairness score changing meaning between releases with no in-product explanation (notifications are explicitly out of scope this cycle) | Supervisors interpret a sudden change in who "needs a shift" as the system contradicting itself — the exact trust failure this cycle is meant to fix, reintroduced at the transition moment | A lightweight one-time in-app banner/tooltip at the fairness display, not requiring the deferred push/SMS channel, explaining the recalibration once |
| Empty slot shown with a generic "no one available" message when the real cause is eligibility | Manager can't self-diagnose why a shift won't fill, has to guess or ask someone — same failure class the entry test is designed to prevent | Distinguish "no one eligible" from "no one available" in `explainUnfilled` (Pitfall 9) |

## "Looks Done But Isn't" Checklist

- [ ] **Eligibility model:** Often missing enforcement in the balance pass, swap approval (`checkAssignment`), and manual-assignment UI — verify all four entry points reject an ineligible guard, not just `autoAssign`'s greedy loop (Pitfall 2).
- [ ] **Eligibility default:** Often implemented as an allow-list (default-deny) instead of the required default-allow shape — verify a brand-new guard with zero eligibility rows is a candidate for every category (Pitfall 1).
- [ ] **Unified task/shift engine:** Often missing an explicit decision on legacy day-range tasks — verify pre-migration `gs_tasks` rows are excluded from `shiftLoad`/`checkHardConstraints`, not force-backfilled with placeholder hours (Pitfall 4).
- [ ] **Conflict detection after tasks gain hours:** Often left on day-level string comparison — verify `taskWindow`/`windowsOverlap` (or their replacement) use the same millisecond-interval comparison as `shiftInterval`/`overlaps` (Pitfall 5).
- [ ] **Fairness recalibration:** Often a mechanical `.count` → `.load` substitution with no re-derivation of `gapSize < 2` or the `* 15` variance coefficient — verify both constants were explicitly re-tuned and documented, with new unit tests pinning expected behavior (Pitfall 6).
- [ ] **Fairness rollout:** Often missing a service-worker cache-bust — verify a stale cached client cannot keep computing the old formula after deploy (Pitfall 7).
- [ ] **Standing position materialization:** Often missing explicit `.order()` on the read path — verify a shuffled-input regression test exists in `verify-scheduler.mjs` and passes (Pitfall 8).
- [ ] **Empty-slot diagnosis:** Often missing an `ineligible` blocker code — verify `explainUnfilled` distinguishes "nobody eligible" from "nobody available" (Pitfall 9).
- [ ] **New tables' RLS:** Often shipped without RLS, repeating the known `gs_role_compatibility` incident — verify with a low-privilege session test before merge (Integration Gotchas).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Eligibility default-deny ships and locks out an existing team | HIGH | Emergency migration flipping the table's default semantics or seeding every existing profile with "all categories," plus manual outreach to affected teams — expensive precisely because there's no in-app notification channel to explain the fix (Pitfall 1, 7) |
| Fairness formula recalibrated with unrederived constants (wrong `gapSize`/`15`) ships | MEDIUM | Re-derive constants against representative rosters, ship a second corrective patch, force cache-bust again — a second trust hit right after the first is repaired, so worth getting right the first time |
| Legacy task backfill pollutes fairness numbers | MEDIUM–HIGH | Retroactively exclude pre-migration tasks from the rolling window (the fix that should have shipped originally), which requires a data audit to identify the cutover boundary cleanly |
| Two-engine conflict-detection mismatch ships (Pitfall 5) | LOW–MEDIUM | Since `conflicts.js` and `autoAssign.js` are pure, isolated modules, unifying the interval comparison later is a contained, testable fix — lower cost than the data-shape pitfalls above, but still a second round of manager confusion in the meantime |

## Pitfall-to-Phase Mapping

Ordering follows `PROJECT.md`'s stated sequence (fairness calibration → eligibility → task/shift hours → standing positions → unified board), since it is already justified there ("הכיול קודם להרחבה").

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 6. Fairness formula recalibration by find-replace | Phase 1 — Fairness calibration | New unit tests pin `fairnessScore` and `balanceWorkload` convergence for fixed representative rosters; diff review confirms `2`/`15` constants were re-derived, not substituted |
| 7. Stale cache serves old formula | Phase 1 — Fairness calibration (deploy step) | Force-refresh test on a pre-deploy cached client; confirm it cannot compute the old formula post-deploy |
| 1. Eligibility default-deny shape | Phase 2 — Eligibility model | New team + new guard, zero eligibility rows, is a candidate for every category in `autoAssign` |
| 2. Eligibility enforced in only one code path | Phase 2 — Eligibility model | Enumerated test across `autoAssign`, `balanceWorkload`, `checkAssignment` (swap + manual), all reject the same ineligible pair |
| 3. Eligibility not enforced server-side | Phase 2 — Eligibility model | Explicit written decision on enforcement boundary; RLS/trigger test if "absolute" is meant literally |
| 9. Silent unfillable shifts / undiagnosable empty slots | Phase 2 — Eligibility model | Manually construct a category-with-no-eligible-people case; confirm `explainUnfilled` names it, not a generic "no one available" |
| 4. Legacy task backfill poisons load | Phase 3 — Task/shift unification | Deploy against a copy of production-shaped data with historical `gs_tasks`; confirm `fairnessPlan` deficits are unaffected by pre-migration rows |
| 5. Two overlap-comparison functions never reconciled | Phase 3 — Task/shift unification | Same-day, non-overlapping-hour task pair test; confirm `findConflicts` no longer false-flags it |
| 8. Non-deterministic standing-position materialization | Phase 4 — Standing positions | Shuffled-input regression test added to `verify-scheduler.mjs`; explicit `.order()` audit on every new read path |
| Standing-position pool-vs-assignment UX confusion | Phase 4 — Standing positions | UAT with a fresh participant account: confirm standing-position membership and actual weekly assignment are visually and textually distinguishable |
| RLS gaps on new tables | Phase 2 and Phase 4 (whichever ships each new table) | Low-privilege session test against each new `gs_` table before merge |

## Sources

- Direct read of `src/lib/autoAssign.js`, `src/lib/conflicts.js`, `src/lib/fairness.js`, `src/lib/api.js`, `docs/database/schema-and-rls.md`, `docs/product/CONTEXT_PACK.md`, `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md` — HIGH confidence, primary source, ground truth as of 2026-08-21.
- [Expand and Contract Method for Database Changes (Medium)](https://medium.com/@jasminfluri/expand-and-contract-method-for-database-changes-414d236f236f), [Using the expand and contract pattern (Prisma Data Guide)](https://www.prisma.io/dataguide/types/relational/expand-and-contract-pattern), [Backward-Compatible Database Migrations: Expand-Contract (tech-champion.com)](https://tech-champion.com/database/backward-compatible-database-migrations-the-expand-contract-pattern-for-zero-downtime-releases/) — MEDIUM confidence, cross-checked across multiple independent sources; underlies Pitfall 4's "freeze legacy data, don't force-migrate" recommendation.
- [Trusted Metrics: Why KPI Drift Breaks Data Trust (elitmind.com)](https://www.elitmind.com/resources/trusted-metrics-why-kpi-drift-breaks-confidence-in-data-platforms), [KPI misalignment: why teams report different numbers (bluepes.com)](https://bluepes.com/blog/multiple-versions-of-truth-kpi-misalignment), [Metric Definitions Matter More Than Dashboards (PowerMetrics)](https://www.powermetrics.app/blog/why-metric-definitions-matter-more-than-dashboards) — MEDIUM confidence, cross-checked across multiple independent sources; underlies Pitfall 7's "version the metric definition, don't ship silently" recommendation.
- [Optimize Shifts With Constraint-Based Scheduling Algorithms (myshyft.com)](https://www.myshyft.com/blog/constraint-based-scheduling/), [Employee Scheduling Problems: 10 Issues and Fixes That Work (synerion.com)](https://www.synerion.com/blog/employee-scheduling-problems-10-issues-and-fixes-that-work) — MEDIUM confidence; general confirmation that eligibility/credential rules stacked with hard constraints are a documented cause of infeasible schedules and diagnosability failures industry-wide, corroborating Pitfall 9.

---
*Pitfalls research for: NexRota — eligibility model, task/shift unification, and fairness metric recalibration on a live, deterministic scheduling product*
*Researched: 2026-08-21*
