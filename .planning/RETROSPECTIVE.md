# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — כיול ואיחוד

**Shipped:** 2026-09-03
**Phases:** 5 | **Plans:** 17 | **Tasks:** 46 | **Commits:** 155

### What Was Built
- Fairness scoring and the balance pass converted from shift-count to weighted-load units across every surface (engine, SmartAssign, Analytics, dashboard card)
- One shared overlap function unifying tasks-with-hours into the same scheduling engine as shifts (rest, consecutive, weekly-cap, load)
- A flat qualification model blocking every assignment route (auto, balance, manual, swap) with no override
- Standing positions that materialize deterministically every week through the real engine
- A unified board merging shifts/tasks/positions into one screen, reused identically across every entry point (השבוע, יומן, guard schedule)

### What Worked
- UAT caught a real comprehension bug (G-05-1: an overloaded padlock icon meaning two unrelated things) that source-level review had missed — live browser verification with a fresh seeded demo team was decisive, not a formality.
- The gap-closure loop (diagnose → plan → execute → live-verify → close) ran end-to-end without manual intervention once the UAT gap was logged.
- Deterministic Node test gates (`verify-*.mjs`) proven failing before each fix and passing after, wired into `npm test`, made every phase's claims checkable rather than asserted.
- Sequencing UNIF before QUAL (overriding the original research doc's suggested order) avoided a second identical blind spot — the reasoning is recorded in ROADMAP.md and held up through execution.

### What Was Inefficient
- **Verification format drift silently orphaned Phase 1-3's real work.** Those phases' VERIFICATION.md files predate the canonical `status:` frontmatter contract the GSD tooling now requires, so `init.manager` reported them as "missing" at milestone close — despite each one containing a real goal-backward verification (live DB checks, browser-driven checks). This required a manual override decision at close instead of being caught earlier. **Lesson:** when a tooling contract changes mid-project, backfill or flag existing artifacts against the new contract immediately, not at the next milestone boundary.
- **REQUIREMENTS.md traceability went stale.** FAIR-01 through FAIR-06 (Phase 1 — the requirements the whole milestone was motivated by) stayed checked `[ ]`/"Pending" in REQUIREMENTS.md for the entire milestone even after 01-VERIFICATION.md confirmed all six implemented and passing. Nothing in the phase-transition workflow updates REQUIREMENTS.md automatically; it only happened to surface because milestone close audits the traceability table. **Lesson:** either the phase-transition step should sync REQUIREMENTS.md checkboxes automatically, or a lighter per-phase check should exist so this isn't caught only at the very end.
- **A resolved debug session's own status field lagged its fix.** `board04-comprehension-confusion.md` stayed `status: diagnosed` (with `fix`/`verification` fields empty) even after the gap-closure plan that fixed it merged and was live-verified — because the debug-session file and the UAT/gap-closure flow are two separate artifacts with no automatic cross-link. It surfaced only in the milestone-close artifact audit. **Lesson:** when a gap-closure plan resolves a diagnosed debug session, update that session file as part of closing the gap, not as a separate cleanup pass.

### Patterns Established
- Live browser verification (Claude Browser MCP) as the actual UAT mechanism for comprehension-shaped acceptance criteria (BOARD-04/D-13), not just automated test scripts — necessary because "does a naive viewer understand this" cannot be asserted in Node.
- `scripts/verify-*.mjs` gates: proven failing pre-fix, passing post-fix, wired into `npm test`'s `&&` chain only after the fix lands (never a red commit on main).

### Key Lessons
1. A tooling/schema change (verification frontmatter contract) needs a migration pass across existing artifacts, not silent "missing" reports discovered at the next major gate.
2. REQUIREMENTS.md traceability is not self-maintaining — it needs an explicit sync point, ideally at phase transition rather than milestone close.
3. Diagnosed-but-unresolved artifacts (debug sessions, gaps) need their resolution to close the loop on the SAME artifact, not rely on a downstream audit to notice the mismatch.

### Cost Observations
- Sessions: multiple, across 2026-08-23 → 2026-09-03 (11 days)
- Notable: three separate "stale bookkeeping" issues (verification format, requirements checkboxes, debug session status) were all caught by the SAME mechanism — the milestone-close artifact audit (`audit-open`) and the readiness gate in `init.manager` — suggesting that gate is doing real work and is worth keeping strict rather than relaxing it for convenience.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.1 | multiple | 5 | First milestone tracked end-to-end by GSD tooling on an already-shipped brownfield product; established the goal-backward VERIFICATION.md convention (later formalized into frontmatter) |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.1 | 6 Node scripts in `npm test` chain (scheduler, planning, board-signals + phase-specific gates) | Engine-level (autoAssign/fairness/conflicts/positions/dates) fully covered; UI covered via live browser UAT, not automated | 0 — deterministic Node scripts only, no new runtime deps |

### Top Lessons (Verified Across Milestones)

1. Live UAT against a naive/fresh viewer catches comprehension failures that code review and automated tests structurally cannot.
