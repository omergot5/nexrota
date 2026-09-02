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
| 05-01-T1 | 05-01 | 1 | BOARD-01 | T-05-03 | Merge of eligible + timeless items plus explicitly-counted outside/undated equals `shifts.length + tasks.length`, no silent drop | unit | `node scripts/verify-board.mjs` | ❌ W0 — created by this task | ⬜ pending |
| 05-01-T1 | 05-01 | 1 | BOARD-01 | — | Timeless items anchor to `dueDate \|\| startDate` and carry no `startTime`/`endTime` property at all | unit | `node scripts/verify-board.mjs` | ❌ W0 — created by this task | ⬜ pending |
| 05-01-T1 | 05-01 | 1 | BOARD-01 | T-05-03 | `boardItemsForDates` is order-independent: repeated and shuffled-input calls stringify identically | unit | `node scripts/verify-board.mjs` | ❌ W0 — created by this task | ⬜ pending |
| 05-01-T1 | 05-01 | 1 | BOARD-01 | T-05-01 | The board holds no write path — read-only surface (D-03, D-08) | source assertion | `npm run build` + source review in acceptance criteria | ✅ n/a | ⬜ pending |
| 05-01-T2 | 05-01 | 1 | BOARD-04 | — | One date-range sentence, shared by the board and the task list — no second definition | unit + grep | `npm test` | ✅ exists | ⬜ pending |
| 05-02-T1 | 05-02 | 2 | BOARD-03 | T-05-06 | Per-assignee lock state read from `isQualified` at render time, no divergence from `checkQualification`, no re-derivation | unit + grep | `node scripts/verify-scheduler.mjs` / `node scripts/verify-planning.mjs` | ✅ exists | ⬜ pending |
| 05-02-T2 | 05-02 | 2 | BOARD-01 | T-05-04 | The participant's board sources shifts through the published filter; tasks pass unfiltered by design | source assertion | `npm test` + source review in acceptance criteria | ✅ exists | ⬜ pending |
| 05-03-T1 | 05-03 | 2 | BOARD-02 | T-05-08 | `plannedRowsForWeek` across 4 consecutive `sundayISO` values produces 4 pairwise-disjoint, deterministic row sets for both position shapes | unit | `node scripts/verify-positions.mjs` | ✅ exists — extended by this task | ⬜ pending |
| 05-03-T2 | 05-03 | 2 | BOARD-02 | T-05-07 | The forecast surface exposes no assign/toggle/delete path (D-08) | grep + source assertion | `npm test` | ✅ exists | ⬜ pending |
| 05-04-T2 | 05-04 | 3 | BOARD-01 | T-05-11 | Exactly one week view survives; `WeekCalendar.jsx` is gone and nothing imports it | grep + build | `npm run build` | ✅ exists | ⬜ pending |
| 05-04-T2 | 05-04 | 3 | BOARD-04 | — | Naive new-manager comprehension test (D-13) | manual | `<human-check>` on 05-04 Task 2 — harvested into `05-UAT.md` at end of phase | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs filled in by the planner on 2026-09-02 when the four PLAN.md files were created.*
*`workflow.human_verify_mode` is `end-of-phase`, so every manual observation is carried as a `<verify><human-check>` block on its task and harvested at phase verification — not as a mid-plan halt. The `checkpoint:decision` in 05-04 is unaffected by that mode and does halt, because it gates the work rather than verifying it.*

---

## Wave 0 Requirements

- [ ] `scripts/verify-board.mjs` — covers BOARD-01's merge-completeness, timeless-anchoring and determinism behaviour for the new pure merge function. **Created inside 05-01 Task 1**, the phase's tracer task, alongside the functions it tests — the tracer carries its own runnable verify rather than deferring it.
- [ ] `package.json`'s `test` script gains `node scripts/verify-board.mjs` in the same task, so the assertion is part of `npm test` from the moment it exists
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
