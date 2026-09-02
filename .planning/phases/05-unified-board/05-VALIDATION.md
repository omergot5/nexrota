---
phase: 05
slug: unified-board
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-02
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — standalone Node ES-module scripts, `console.log("  ok ...")`/`"  FAIL ..."`, non-zero exit on failure |
| **Config file** | none — `package.json`'s `"test"` script is the config: `node scripts/verify-scheduler.mjs && node scripts/verify-planning.mjs && node scripts/verify-positions.mjs` |
| **Quick run command** | `node scripts/verify-board.mjs` (new file — Wave 0) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/verify-board.mjs` (or the closest existing verify-*.mjs script touched by that task)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, **plus** the live BOARD-04 UAT walkthrough (D-13) — this phase's own acceptance criteria require a human-observation comprehension test that cannot be automated
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-merge | TBD | TBD | BOARD-01 | — | Merge of eligible + timeless items totals `shifts.length + tasks.length` for a fixture week, no silent drop | unit | `node scripts/verify-board.mjs` | ❌ W0 | ⬜ pending |
| TBD-anchor | TBD | TBD | BOARD-01 | — | Timeless items anchor to `dueDate \|\| startDate`, never fabricate a time | unit | `node scripts/verify-board.mjs` | ❌ W0 | ⬜ pending |
| TBD-forward | TBD | TBD | BOARD-02 | — | `plannedRowsForWeek` across 4 consecutive `sundayISO` values produces 4 distinct, deterministic row sets for both position shapes | unit | `node scripts/verify-positions.mjs` (extend) | ✅ exists — extend | ⬜ pending |
| TBD-qual | TBD | TBD | BOARD-03 | — | Per-assignee lock state derivable from existing engine data, no divergence from `checkQualification` | unit | `node scripts/verify-scheduler.mjs` / `node scripts/verify-planning.mjs` | ✅ exists | ⬜ pending |
| TBD-comprehension | TBD | TBD | BOARD-04 | — | Naive new-manager comprehension test (D-13) | manual | UAT — see Manual-Only Verifications | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders — the planner fills in real plan/task IDs when PLAN.md files are created.*

---

## Wave 0 Requirements

- [ ] `scripts/verify-board.mjs` — covers BOARD-01's merge-completeness and timeless-anchoring behavior for the new pure merge function
- [ ] No new fixtures/conftest-equivalent needed — this codebase has no shared fixture file; each `verify-*.mjs` script is self-contained with inline literals (confirmed pattern in `verify-positions.mjs`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A manager who has never seen the app builds a full weekly schedule on the unified board alone and explains in their own words what the board shows, with no explanation from anyone | BOARD-04 | Explicitly a human-observation acceptance test per the phase's own success criteria (D-13); cannot be automated | Fresh demo team → supervisor opens "השבוע" → build a full week on the unified board with zero guidance → ask them to describe what they're looking at → confirm they correctly identify shifts vs. tasks vs. qualification blocks without being told |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
