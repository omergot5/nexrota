# Architecture Research

**Domain:** Constraint-based shift/task assignment (small-team workforce rostering)
**Researched:** 2026-08-21
**Confidence:** MEDIUM (general pattern) / HIGH (grounded in this codebase's actual pipeline)

## Standard Architecture

### System Overview — where the three new dimensions land

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Data layer (Supabase → api.js row mappers)                         │
│  gs_shifts (hour-range) · gs_tasks (day-range, migrating to hours)  │
│  gs_role_compatibility (category×category) · NEW: eligibility rows  │
│  NEW: gs_standing_positions (recurrence rule)                       │
├───────────────────────────────────────────────────────────────────── ┤
│  Materialization step (impure, runs in api.js, calls a pure         │
│  function underneath)                                                │
│  standing position + weekStart → concrete assignable rows            │
│  (deterministic id = hash(positionId, weekStart), idempotent upsert) │
├─────────────────────────────────────────────────────────────────────┤
│  PURE ENGINES (src/lib/, no React, no network, Node-testable)        │
│                                                                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │ eligibility.js│  │ conflicts.js  │  │ fairness.js   │  (siblings) │
│  │ person×category│ │ category×     │  │ rolling load  │            │
│  │ NEW            │  │ category      │  │ debt          │            │
│  │               │  │ (existing)    │  │ (existing)     │            │
│  └──────┬────────┘  └──────┬────────┘  └──────┬────────┘            │
│         │  (index lookups, called FROM autoAssign + UI)              │
│         ▼                  ▼                   ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ autoAssign.js — checkHardConstraints() / scoreCandidate()   │    │
│  │ operates on a unified "assignable interval" shape, whether  │    │
│  │ it originated from gs_shifts or gs_tasks                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│  UI (SmartAssign, WeekFlow, per-position schedule view — read-only  │
│  consumers of engine output; never re-implement constraint logic)   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `eligibility.js` (new) | Person → allowed category set. Absolute hard filter, no override. | Pure module mirroring `conflicts.js`'s `compatIndex`/`pairRule` shape: `eligibilityIndex(rows)` builds a `Map<personId, Set<category>\|null>`; `null` (no row) means "eligible for everything" — matches "כשיר להכול כברירת מחדל." |
| `conflicts.js` (existing) | Category × category compatibility, overridable with a reason. | Unchanged. Distinct axis from eligibility — do not merge the two modules; they have opposite override semantics (this one *can* be overridden, eligibility *cannot*). |
| `fairness.js` (existing) | Rolling-window load debt, single load metric. | Extend `shiftLoad()`'s domain: once tasks carry hours, `shiftHours`/`shiftLoad` must apply to task-shaped assignables too, or the exact "kitchen doesn't count toward fairness" bug in `PROJECT.md` reproduces itself one level down. |
| `autoAssign.js` `checkHardConstraints()` (existing, extended) | Ordered hard-constraint pipeline that discards, never scores, a disqualified candidate. | Insert an eligibility check as the **first** check (cheapest, O(1) index lookup, no interval math needed) — before availability, before overlap/rest computation. |
| `autoAssign.js` `flexibility()` (existing, extended) | Drives most-constrained-first shift ordering. | Must count *eligible AND available* candidates, not just available ones, or the MCF heuristic misorders shifts (see Anti-Pattern below — this is the single most important correctness change). |
| Materializer (new, pure core + impure I/O shell) | Standing position + target week → concrete assignable rows. | Pure function `materializeWeek({ position, weekStart })` returns row objects with a **deterministic derived id** (e.g. `${positionId}:${weekStart}`), called from `api.js`, which does the actual upsert. |
| `gs_standing_positions` (new table) | Recurrence definition: category, required count, hour/day range, active flag. | Person↔position linkage is a *declaration of eligibility for that position's category*, not an assignment — it should write into the same eligibility index `eligibility.js` reads, not a separate mechanism. |

## Recommended Project Structure

```
src/lib/
├── autoAssign.js       # unchanged file, extended: new hard-constraint check,
│                        # fixed flexibility(), unified interval adapter call
├── eligibility.js       # NEW — person × category, absolute, mirrors conflicts.js shape
├── conflicts.js         # unchanged — category × category, overridable
├── fairness.js          # unchanged logic, wider input domain (shifts ∪ tasks)
├── dates.js             # extended: taskInterval()/shiftInterval() collapse into
│                        # one adapter that both shift-shaped and task-shaped
│                        # assignables go through
├── recurring.js         # NEW — pure materializeWeek(position, weekStart) → rows
└── conflicts.js, fairness.js, autoAssign.js all stay pure and Node-testable
```

### Structure Rationale

- **One new pure module per new *kind* of rule, not one growing `autoAssign.js`.** `conflicts.js` already set this precedent (category×category lives in its own file, `autoAssign.js` doesn't know the word "category" today). `eligibility.js` should follow the identical shape: an index-builder + a pure lookup function, so `checkAssignment()` (used by both the engine and manual/swap approval) and `autoAssign()`'s inner loop call the *same* function — the same "one checker, every caller" principle the codebase already documents for hard constraints.
- **`recurring.js` is a materializer, not a scheduler.** It never decides *who* works a standing position — that's still `autoAssign()`'s job, fed by whatever `eligibility.js` says. Keeping it a separate file keeps `autoAssign.js`'s existing contract (`shifts[], guards[], availability{}, rules` → assignments) untouched; the materializer just grows the `shifts` array before `autoAssign()` ever runs.
- **`dates.js` gets the interval adapter, not `autoAssign.js`.** `shiftInterval()` already lives there; a task-aware sibling (or a generalized version) belongs next to it so both `autoAssign.js` and `conflicts.js` can eventually share one definition of "what time window does this row occupy," instead of `conflicts.js` keeping its own day-string `taskWindow()` forever.

## Architectural Patterns

### Pattern 1: Eligibility as a filtering hard constraint, not a scoring term

**What:** A dedicated, absolute, non-overridable check inside `checkHardConstraints()` that runs before any of the existing interval-math checks (overlap, rest, consecutive-hours), because it's the cheapest possible reject (index lookup, O(1)) and — more importantly — because it's a *fact about the person*, not a *hypothesis about the world*.

**When to use:** Any dimension the product has declared cannot be overridden with a reason (this is exactly the "Out of Scope" decision already recorded in `PROJECT.md`: "עקיפת חסימת כשירות" is explicitly rejected, unlike `conflicts.js`'s overridable rule). Literature on nurse/workforce rostering is unanimous on this split: qualification/skill constraints are hard-filtered (discard the candidate), while soft criteria are scored, precisely because penalizing a hard violation risks a solution that still *looks* legal but silently isn't (MEDIUM confidence — cross-checked across nurse-rostering and CP-workforce sources independently converging on the same split).

**Trade-offs:** A hard, unconditional filter can produce unfillable shifts (0 eligible candidates) where a scored/soft version would always produce *something*, just at low quality. This is the correct trade for NexRota given the product decision, but it changes the failure mode from "bad pick" to "visible hole" — which must be surfaced distinctly (see Anti-Pattern 2).

**Example (shape, not literal code to merge):**
```javascript
// eligibility.js — same shape as conflicts.js's compatIndex/pairRule
export function eligibilityIndex(rows = []) {
  const index = new Map(); // personId -> Set<category> | null (null = eligible for all)
  for (const row of rows) {
    if (!row?.personId) continue;
    const set = index.get(row.personId) ?? new Set();
    set.add(row.category);
    index.set(row.personId, set);
  }
  return index;
}
export function isEligible(index, personId, category) {
  if (!category) return true;           // untagged assignable — nothing to check against
  const allowed = index.get(personId);
  return !allowed || allowed.has(category); // absence of any row = eligible for everything
}
```
```javascript
// autoAssign.js — checkHardConstraints(), new FIRST check
if (shift.category && !isEligible(eligibility, guard.id, shift.category)) {
  return { ok: false, code: "ineligible", reason: `לא כשיר/ה ל"${shift.category}"` };
}
```

### Pattern 2: Unified assignable interval via an adapter, not a merged table

**What:** Keep `gs_shifts` and `gs_tasks` as separate persisted rows (lower migration risk, RLS/UI already keyed to them), but give both a shared in-memory shape before they reach `checkHardConstraints`/`scoreCandidate`/`shiftLoad`: `{ id, category, start, end, hasHours }` produced by one adapter function.

**When to use:** Whenever the engine needs to reason about "does this occupy time," regardless of whether the row started life as a shift or a task. This is the direct implementation of the `PROJECT.md` decision "משימה נושאת שעות ונכנסת לאותו מנוע."

**Trade-offs:** The adapter must decide what to do with **legacy day-range task rows that have no hours yet** — this is the single highest-risk correctness question in this milestone (see Anti-Pattern 1 below). Get it wrong and every existing task silently breaks the rest/consecutive-hours math for whole days.

**Example:**
```javascript
// dates.js
export function assignableInterval(row) {
  if (row.startTime && row.endTime) {
    return { ...shiftInterval(row), hasHours: true };   // shift, or a migrated task
  }
  // legacy day-range task: no real hours known.
  // DO NOT synthesize a 00:00–23:59 interval — see Anti-Pattern 1.
  return { start: null, end: null, hasHours: false };
}
```

### Pattern 3: Materialize standing positions into ordinary rows, don't special-case them downstream

**What:** A pure `materializeWeek(position, weekStart)` function turns a recurrence definition into concrete assignable rows with **deterministic, derived IDs** (`${positionId}:${weekStart}`, not a random UUID), tagged `source: "standing"` and `standingPositionId`. Once written, they are indistinguishable from any manually-created shift/task to `autoAssign()`, `eligibility.js`, `conflicts.js`, and `fairness.js`.

**When to use:** Any time a recurring definition needs to enter a pipeline built around concrete per-week rows. This is the standard "materialize, then treat uniformly" pattern for recurrence in scheduling systems — it avoids threading a `isRecurring` branch through every downstream engine.

**Trade-offs:** Requires the materializer to be idempotent (safe to call twice for the same week) precisely *because* the ID is deterministic — re-running it must upsert, not duplicate. This is a data-layer extension of the same determinism principle the engines already enforce; getting it right here matters just as much as inside `autoAssign.js` itself.

**Example:**
```javascript
// recurring.js
export function materializeWeek({ position, weekStart }) {
  const days = expandRecurrence(position.pattern, weekStart); // pure, no I/O
  return days.map((date) => ({
    id: `${position.id}:${weekStart}:${date}`, // deterministic — not crypto.randomUUID()
    category: position.category,
    date,
    startTime: position.startTime, // null if position itself hasn't been given hours
    endTime: position.endTime,
    requiredGuards: position.requiredCount,
    standingPositionId: position.id,
    source: "standing",
  }));
}
```

## Data Flow

### Smart Assignment flow, extended with the three new dimensions

```
[Standing positions] ──materializeWeek()──▶ [concrete shift/task rows for the week]
                                                      │
[gs_eligibility rows] ──eligibilityIndex()──▶ [index] │
                                                      ▼
[shifts ∪ tasks-with-hours] ──assignableInterval()──▶ [unified candidates]
                                                      │
                                       autoAssign({ shifts, guards, availability, eligibility, rules })
                                                      │
                          checkHardConstraints(): eligibility → availability → overlap →
                                                   consecutive-hours → rest → weekly-cap → night-cap
                                                      │
                                       scoreCandidate() over survivors only
                                                      │
                                       most-constrained-first fill (flexibility() now
                                       counts eligible ∧ available candidates)
                                                      │
                                       local-search balance pass (reuses the SAME
                                       checkHardConstraints — eligibility comes for free)
                                                      │
                          assignments[] + unfilled[] (blocker code "ineligible" distinct
                          from "unavailable"/"rest"/etc. — different remedy, different UI copy)
```

### Key Data Flows

1. **Eligibility is read, never written, by `autoAssign.js`.** It's an input the same way `availability` is — built once per run from team-scoped rows, passed in, never mutated. Both the greedy fill loop and the balance pass consult the same `checkHardConstraints`, so eligibility correctness is enforced in exactly one place.
2. **Materialization happens before `autoAssign()` is ever called**, as a distinct step (likely triggered when a supervisor opens/builds a week, mirroring how `WeekFlow` already assembles the shift set today). The pure `materializeWeek()` function has no knowledge of Supabase; `api.js` is what turns its output into an upsert.
3. **Task hours migration is a one-time backfill, not a runtime fallback.** Legacy day-range tasks must get real `startTime`/`endTime` (or an explicit `hasHours: false` flag that the interval/rest math *skips*, not defaults) before they can safely enter `autoAssign()` — see Anti-Pattern 1.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (single small team per `team_code`, tens of guards, tens of shifts+tasks/week) | None needed. Eligibility lookup is O(1) per candidate check; total pipeline stays O(shifts × guards × balancePasses), same class as today. Precomputed "candidate pools per category" (the technique large CP workforce systems use to shrink search space over thousands of employees) is not warranted here — it would be optimization for a scale this product doesn't have and isn't asked to reach (see Out of Scope: no org model this cycle). |
| If team sizes grow materially | Still no algorithmic change needed — build the `eligibilityIndex` once per `autoAssign()` call (already the plan) rather than per-candidate, which is already the cheapest possible shape. |

### Scaling Priorities

1. **Not a bottleneck concern for this milestone.** The real risk in this milestone is correctness (feasibility, migration defaults), not performance — flag any proposal to add precomputed candidate pools or a constraint-solver library (OR-Tools/CP-SAT style) as premature for this product's current scale; it would also very likely violate the "pure, dependency-free engine, Node-testable in one file" constraint.

## Anti-Patterns

### Anti-Pattern 1: Letting a day-range task default to a full 24-hour interval once it enters `checkHardConstraints`

**What people do:** Treat "no hours yet" as "occupies the whole day (00:00–23:59)" so the existing interval math (`blockHoursAround`, `smallestRestGap`) "just works" without a branch.

**Why it's wrong:** A 24-hour interval instantly exceeds `maxConsecutiveHours` (12) and makes `minRestHours` (8) impossible to satisfy against *any* adjacent shift — every guard with one open legacy task that week becomes unassignable to anything else. This is not a hypothetical: it is the exact mechanism by which "the migration silently breaks everyone's week" would happen, and it would be very easy to ship without noticing in a small manual test.

**Do this instead:** Give `assignableInterval()` (or equivalent) an explicit `hasHours` flag. Rows with `hasHours: false` participate in overlap/day-cap/eligibility/category-conflict checks (all of which only need dates, which `conflicts.js`'s `taskWindow()` already proves is sufficient) but are **excluded** from `blockHoursAround`/`smallestRestGap`/`shiftLoad` until a real backfill gives them hours. Treat the hours backfill as a required migration step for this milestone's rollout, not an optional follow-up — until it's done, legacy tasks stay outside the load/rest math the same way they are today (invisible to `autoAssign.js`), which is a known, already-documented gap rather than a newly introduced outage.

### Anti-Pattern 2: Reporting an eligibility-caused unfilled shift with the same blocker vocabulary as an availability-caused one

**What people do:** Reuse the existing `unfilled[].blockers` / `explainUnfilled()` codes (`unavailable`, `rest`, `weekly-cap`, …) and lump a new "nobody is qualified" case into `"no-availability"` or similar, because it's the path of least code change.

**Why it's wrong:** The supervisor's remedy is completely different. "Everyone said no" is fixed by asking someone to reconsider; "nobody is qualified" is fixed by assigning someone to the category (a data-model action, not a scheduling one). Collapsing them into one bucket in `explainUnfilled()` hides the actual next action from the person reading the screen — which directly contradicts this product's stated purpose ("מסבירה כל החלטה שהיא מקבלת").

**Do this instead:** Give eligibility its own blocker `code: "ineligible"` (as sketched in Pattern 1's example) with its own label in `explainUnfilled()`'s `labels` map, and consider surfacing a distinct call-to-action in the UI ("no one is eligible for this category — add someone") separate from the existing "no one answered" messaging.

### Anti-Pattern 3: Fixing most-constrained-first ordering only for eligibility's effect on the greedy fill, and forgetting `flexibility()`

**What people do:** Add the eligibility check inside `checkHardConstraints()` (correct) and stop there, assuming the existing `flexibility()` shift-ordering function (which currently only excludes guards marked `unavailable`) will keep working "well enough."

**Why it's wrong:** Most-constrained-first is a *heuristic quality* property, not a correctness one — nothing crashes if it's wrong, but fill rate quietly degrades. A shift where 8 of 10 guards are "available" but only 1 is eligible for its category will be scheduled *late* by `flexibility()` (which still sees 8 free candidates), even though it is in fact the most constrained shift in the whole week. By the time it's processed, that one eligible person may already be capped out on hours/nights, producing an avoidable unfilled shift that a correct ordering would have prevented.

**Do this instead:** `flexibility()` must count guards who are both available *and* eligible for the shift's category. This is a small, cheap change (same index lookup as the hard-constraint check) but it is the difference between eligibility being "correctly blocked" and "correctly and *efficiently* scheduled around."

### Anti-Pattern 4: Reaching for randomized repair/annealing to resolve infeasibility introduced by the new hard constraints

**What people do:** When a hard, non-overridable constraint (eligibility) makes some weeks genuinely infeasible to fill completely, literature on this exact problem family (nurse rostering) commonly reaches for genetic/memetic algorithms with randomized repair steps to explore out of local optima.

**Why it's wrong here:** This violates the project's non-negotiable determinism principle ("אין `Math.random()` במנוע השיבוץ. אותם נתונים ⟵ אותו סידור, תמיד") and the existing `balanceWorkload()` local search is already a deterministic, stable-sorted descent — introducing randomized restarts to "try harder" on infeasible weeks would be a regression, not an improvement, for this product's actual requirement (an explainable, reproducible roster, not a maximally-optimal one).

**Do this instead:** When a week is genuinely infeasible (0 eligible+available candidates for a required slot), that is the correct, honest output — surface it via `unfilled[]`/`explainUnfilled()` (Anti-Pattern 2) rather than trying to algorithmically paper over it. If a future milestone wants a seeded deterministic technique (e.g., a fixed, data-derived tie-break seed) that would need to be re-derived identically from the same inputs every time and reviewed explicitly against the determinism principle before adoption — it is not something to introduce as a side effect of the eligibility work.

## Integration Points

### External Services

None new. This milestone stays entirely within the existing Supabase + pure-engine boundary; no new external service is implied by eligibility, task-hour unification, or standing-position materialization.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `eligibility.js` ↔ `autoAssign.js` | Direct function call (`isEligible(index, guardId, category)`), same pattern as `conflicts.js`'s `pairRule` today, though `conflicts.js` is not currently imported by `autoAssign.js` — this milestone is the first time a category-aware module needs to reach into the assignment engine. | Pass the prebuilt index in, don't rebuild it per candidate. |
| `eligibility.js` ↔ standing-position UI | Person↔position linkage writes an eligibility row; it is a declaration, not an assignment. | Reuse the eligibility table/index — do not build a second "who can work this position" mechanism. |
| `dates.js` `assignableInterval()` ↔ `conflicts.js` `taskWindow()` | Both compute "what time window does this row occupy," at different granularities (ms-precision for the engine, ISO-date for conflicts). | Do not force them into one function immediately — `conflicts.js`'s day-level windows are sufficient for category conflicts and don't need hour precision. Revisit only if a future milestone needs hour-precision category conflicts. |
| `api.js` ↔ `recurring.js` | `api.js` calls the pure `materializeWeek()`, then performs the actual upsert (impure I/O). | Keep the split exactly like `autoAssign()` (pure) vs `applyPlan()` in `api.js` (impure) already does — this milestone should follow, not invent, that boundary. |
| `fairness.js` ↔ unified assignable shape | `shiftLoad()`/`shiftHours()` currently assume shift-shaped input (`type`, `startTime`, `endTime`). | Once tasks-with-hours flow through the same engine, `fairness.js`'s rolling-load tally must accept both shapes without a special case — it already just reads `shift.type`/`shift.date`/`assignedGuards`, so this mostly falls out of Pattern 2 for free, provided task rows expose the same field names after the adapter runs. |

## Suggested Build Order

1. **`eligibility.js` first.** Smallest blast radius: one new pure module, one new hard-constraint check, one `flexibility()` fix, one new blocker code. Directly unblocks the product's stated first non-negotiable ("מודל כשירויות" is item 2 in Active, right after the fairness-metric unification). Ships value on its own — categories can be assigned before anything else in this list exists.
2. **Unified assignable interval (task hours) second.** Bigger blast radius (touches `dates.js`, `autoAssign.js`, `conflicts.js`, `fairness.js` simultaneously) and has the highest correctness risk in the milestone (Anti-Pattern 1). Depends on nothing from step 1 technically, but doing it second means the hard-constraint pipeline it's being inserted into already has the eligibility check in place and stable, reducing the number of moving parts changing at once.
3. **Standing positions / materializer third.** Conceptually depends on both: it needs the unified assignable shape to materialize into (step 2) and its person↔position linkage is implemented in terms of the eligibility index (step 1). Building it first would mean migrating its output format again once step 2 lands.
4. **Unified board/view (the fifth Active item) last**, once all three engine-level dimensions exist and agree — it is a read-only consumer of the other three, not a dependency for any of them.

## Sources

- [Nurse scheduling problem — Wikipedia](https://en.wikipedia.org/wiki/Nurse_scheduling_problem) — MEDIUM
- [A Constraint-directed Local Search Approach to Nurse Rostering Problems (arXiv)](https://arxiv.org/pdf/0910.1253) — MEDIUM
- [Second International Nurse Rostering Competition (INRC-II) — Problem Description and Rules (arXiv)](https://arxiv.org/pdf/1501.04177) — MEDIUM
- [Optimatch: Applying Constraint Programming to Workforce Management of Highly-skilled Employees](https://www.researchgate.net/publication/4291880_Optimatch_Applying_Constraint_Programming_to_Workforce_Management_of_Highly-skilled_Employees) — MEDIUM
- [A Constraint-Based Approach for Skilled Workforce Scheduling Problem](https://www.scientific.net/AMM.631-632.1295) — MEDIUM
- [CP-SAT Rostering: Constraint Programming for Workforce](https://mbrenndoerfer.com/writing/cp-sat-rostering-constraint-programming-workforce-scheduling) — MEDIUM
- [Greedy constructive heuristic and local search algorithm for solving Nurse Rostering Problems](https://www.researchgate.net/publication/252027282_Greedy_constructive_heuristic_and_local_search_algorithm_for_solving_Nurse_Rostering_Problems) — MEDIUM
- Codebase — `src/lib/autoAssign.js`, `src/lib/conflicts.js`, `src/lib/fairness.js`, `docs/database/schema-and-rls.md`, `docs/algorithm/auto-assign.md`, `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` — HIGH (primary source, read directly)

---
*Architecture research for: NexRota — eligibility, unified assignable intervals, and standing-position materialization*
*Researched: 2026-08-21*
