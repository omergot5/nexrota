---
phase: 04
slug: standing-positions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (standalone Node scripts) — `npm test` runs `scripts/verify-scheduler.mjs && scripts/verify-planning.mjs` |
| **Config file** | none — see Wave 0 |
| **Quick run command** | `node scripts/verify-positions.mjs` (new file, see Wave 0) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/verify-positions.mjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, plus one live-browser check per CLAUDE.md's "אימות בדפדפן" rule — a position must actually appear un-touched next week, and re-viewing the same week must not duplicate or reshuffle it.
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | POS-02 | — | `isQualified(guard, position.category)` correctly derives the qualified pool, unmodified from Phase 3 | unit | `node scripts/verify-positions.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POS-03 | — | `expectedDatesForWeek()` returns the same dates for a template position regardless of call order/repetition | unit | `node scripts/verify-positions.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POS-04 | — | `nextRotationGuard()` returns the same pick given the same guards/history in shuffled input order (determinism); tally excludes guards outside the qualified pool | unit | `node scripts/verify-positions.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POS-04 | — | Materialization is idempotent: calling it twice for the same week does not change or duplicate the realized rows | integration (pure-JS simulation of the upsert decision; real-backend round trip is manual/backend check before phase close) | `node scripts/verify-positions.mjs` (simulation) + manual/backend check | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POS-05 | — | The two lists ("qualified" / "working this week") never derive from the same underlying field | unit (pure data-shape assertion — no component test runner in this project) | `node scripts/verify-positions.mjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POS-04 | T-04-01 (Elevation of Privilege) | RLS write policy on `gs_positions` restricted to `role = 'supervisor'`, mirroring existing team-scoped write policies | manual/backend | Supabase SQL check / `npm run test:backend` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | POS-01 | T-04-02 (Information Disclosure) | RLS read policy on `gs_positions` scoped to the caller's `team_code`, identical to the existing pattern on every other team-scoped table | manual/backend | Supabase SQL check / `npm run test:backend` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs, plan numbers and waves are TBD until the planner assigns them — this table is a requirement→test contract, not a task list.*

---

## Wave 0 Requirements

- [ ] `scripts/verify-positions.mjs` — new standalone Node test file, wired into `package.json`'s `"test"` script (append `&& node scripts/verify-positions.mjs`), covering POS-02 through POS-05 exactly as this codebase already does for `conflicts.js`/`fairness.js` in `verify-planning.mjs`.
- [ ] Framework install: none — reuses the existing zero-dependency Node-script convention.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Position materializes untouched into next week's board | POS-01 | Requires real week rollover + live Supabase state, not simulable in a pure-JS unit test | Define a position, advance to the following week in the running app, confirm the position's rows appear without any manual action |
| RLS enforcement (write restricted to supervisor, read scoped to team) | POS-01/04 | RLS is enforced by Postgres at the database layer, not exercised by pure-JS unit tests | Attempt writes/reads against `gs_positions` as a non-supervisor and as a cross-team user via `npm run test:backend` or direct Supabase check before phase close |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
