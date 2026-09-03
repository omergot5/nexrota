# Milestones

## v1.1 כיול ואיחוד (Shipped: 2026-09-03)

**Phases completed:** 5 phases, 17 plans, 46 tasks
**Timeline:** 2026-08-23 → 2026-09-03 (11 days)
**Git range:** `ac353fb` (feat(01-01): score fairness by weighted load) → `9b3fdb3` (v1.1 close) — 155 commits, 112 files changed, +20,973/−743 lines

**Key accomplishments:**

- **Fairness calibration (Phase 1):** the balance-pass and the fairness score the manager sees both converted from shift-count units to weighted-load units, re-deriving both tuned constants instead of swapping in count-tuned literals — closing the exact bug that motivated this cycle (a week where one guard carried zero nights still scored "perfect fairness").
- **Task/shift unification (Phase 2):** one shared overlap function now serves both engines; an hour-bearing task feeds the same rest/overlap/consecutive/weekly-cap constraints and load bookkeeping a shift does, while a pre-migration task stays frozen outside the engine untouched.
- **Qualification model (Phase 3):** a fifth hard-constraint family — qualification — closes the auto-assign, balance-pass, manual-assignment and swap-approval routes through one insertion, non-overridable, with a default-allow rule that leaves every unconfigured team untouched.
- **Standing positions (Phase 4):** a position defined once (two shapes) materializes into deterministic weekly rows automatically every week via the same engine, with separate "who's qualified" vs. "who's working this week" views for supervisor and guard.
- **Unified board (Phase 5):** one screen merges shifts, tasks and positions into a single day-grouped list across every entry point (השבוע, יומן, guard's own schedule) — and a UAT-caught comprehension bug (an overloaded padlock icon meaning two different things) was diagnosed, fixed, and live-verified before close.

**Known verification overrides:** Phases 1-3 each have a full goal-backward VERIFICATION.md (re-ran the phase's own reproduction fixture, live Supabase checks, browser-driven confirmation of every success criterion) predating the canonical `status:` frontmatter contract the current GSD tooling requires — the tooling reports them as "missing" on a format technicality, not because the work wasn't done. Closed with an explicit user override rather than blocking on a cosmetic backfill. 1 item newly acknowledged at this close (see STATE.md Deferred Items — pre-existing NUL-byte separator in `conflicts.js`, no observed impact), 0 carried forward from a prior close.

**Requirements bookkeeping fix:** REQUIREMENTS.md's traceability table had FAIR-01..06 (Phase 1) still marked "Pending" despite 01-VERIFICATION.md confirming all six implemented and verified — a stale-checkbox gap, not a missing feature. Corrected before archiving; 29/29 v1 requirements now Complete.

---
