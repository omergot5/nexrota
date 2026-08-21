# Project Research Summary: NexRota Milestone 2

**Project:** NexRota — Fairness Calibration, Qualifications Model, Task/Shift Unification, Standing Positions, Unified Board
**Domain:** Constraint-based workforce shift/roster scheduling with qualifications and recurring positions
**Researched:** 2026-08-21
**Confidence:** HIGH (foundational), MEDIUM (feature/market analysis), HIGH (architecture grounded in codebase)

## Executive Summary

NexRota is a deterministic scheduling engine that has shipped a working v1. This milestone unifies three things: (1) the fairness metric from "spread of shifts" to "spread of weighted load hours," (2) a qualifications model that blocks absolutely with no override, and (3) tasks and shifts into one assignable entity. Together, these fix what the product identifies as its core bug — measuring fairness in one place while scheduling in another, and managing two invisible worlds (shifts and tasks) that never communicate.

The research confirms: **no new external dependencies are required.** The stack (React 18, Supabase, Vercel) is fixed; the work is pure architectural unification using hand-rolled code matching existing patterns in `autoAssign.js`, `conflicts.js`, and `dates.js`. The biggest risk is not technical complexity but coordination: the milestone's five phases have deep dependencies, and shipment order matters enormously.

PROJECT.md's stated phase order (fairness → eligibility → task hours → standing positions → unified board) is **supported by all research** as the correct sequence, grounded in dependencies and risk mitigation.

## Key Findings

### Recommended Stack

**Zero new runtime dependencies.** The milestone adds three new pure modules (`eligibility.js`, `recurring.js`, extended `dates.js`) and modifies existing ones (`autoAssign.js`, `fairness.js`, `conflicts.js`) — all hand-rolled, all Node-testable.

- **Postgres + Supabase RLS:** New tables (`gs_qualifications`, `gs_standing_positions`) use the same join-table-plus-index pattern and `team_code` isolation already proven. RLS must be added at table-creation time (not retroactively).

- **Hand-rolled date/interval math in `dates.js`:** The codebase already performs all recurrence and scheduling math without libraries (`startOfWeek`, `weekFrom`, `shiftInterval`, `minutesOfTime`).

- **Pure constraint engines:** `autoAssign.js`, `conflicts.js`, `fairness.js` remain pure Node modules, testable via `npm test` scripts.

### Expected Features

**Table stakes:** Flat qualification set per person (default-all), qualification as hard filter (no override), tasks carrying real hours participating in same engine as shifts.

**Differentiators:** Absolute eligibility block (healthcare-grade, baseline here), flat categories (not Position+Tag), standing position membership = eligibility declaration, task/shift unified in one engine.

**Anti-features NOT shipping:** Hierarchical roles, manager override, credential expiration, mandatory editor at onboarding.

### Architecture Approach

Three new dimensions land in existing pure-engine pipeline. **Four critical components:** (1) `eligibility.js` mirrors `conflicts.js` with default-allow semantics; (2) `autoAssign.js` inserts eligibility as first hard-constraint check; (3) `dates.js` introduces `assignableInterval()` adapter; (4) `recurring.js` pure materializer with deterministic IDs.

### Critical Pitfalls

1. **Eligibility default-deny shape** — Allow-list breaks new-team entry. Use restriction table or null-defaulted array.
2. **Eligibility enforced one path only** — Four decision points; all must enforce. Use single `isEligible()` lookup.
3. **Legacy tasks backfilled to 24h** — Dwarfs fairness. Freeze pre-migration tasks outside engine.
4. **Conflict-detection granularities** — Day-level vs millisecond disagreement. Unify to one function.
5. **Fairness constants miscalibrated** — Re-derive constants and add unit tests, not just token-swap.

## Implications for Roadmap

PROJECT.md's phase order is **fully supported by research.**

### Phase 1: Fairness Metric Recalibration
**Rationale:** Foundation. Both `balanceWorkload` and `fairnessScore` measure shift-count, contradicting the product's promise.
**Delivers:** Load-based balance, re-derived coefficient, unit tests, cache bump.

### Phase 2: Eligibility Model
**Rationale:** Second-most fundamental. Prerequisite for standing positions. Must precede task hours.
**Delivers:** `gs_qualifications` table, `eligibility.js` module, enforced in all four entry points.

### Phase 3: Task/Shift Unification
**Rationale:** Tasks currently invisible to hard constraints. After eligibility. Before standing positions.
**Delivers:** Tasks with hours, adapter, legacy tasks frozen, conflict-detection reconciled.

### Phase 4: Standing Positions
**Rationale:** Quality-of-life; prerequisite for unified board. After task unification.
**Delivers:** `gs_standing_positions` table, `recurring.js` materializer, determinism test.

### Phase 5: Unified Board
**Rationale:** Read-only UI consumer. Last, once engine work is stable.
**Delivers:** Combined shift+task view, per-position forward view.

**Research supports this order:** Serial implementation required. Parallel work introduces correctness hazards.

### Research Flags

**Needing planning research:** Phase 2 (RLS, enforcement), Phase 3 (legacy task behavior), Phase 4 (determinism).
**Standard patterns:** Phase 1 (recalibration), Phase 5 (React work).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct inspection confirmed; zero new dependencies |
| Features | MEDIUM–HIGH | Confirmed across 8 competitors; some novel |
| Architecture | HIGH | Grounded in codebase |
| Pitfalls | HIGH | Each traces to specific code |

**Overall: HIGH**

### Gaps to Address

1. **Fairness constants** — Re-derive during Phase 1 using representative rosters
2. **Legacy task cutover boundary** — Decide during Phase 3
3. **Eligibility enforcement boundary** — Decide Phase 2 (database vs. client)
4. **RLS validation** — Standard practice; phase planning

---

**Research completed:** 2026-08-21  
**Ready for requirements:** Yes
