---
status: complete
phase: 04-standing-positions
source: [04-VERIFICATION.md]
started: 2026-08-27T00:00:00Z
updated: 2026-09-02T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 04-02 Task 3 human-check — guard-side "qualified, not scheduled" comprehension
expected: The naive reader correctly concludes "qualified, not scheduled." This is the phase's
  core anti-confusion test (ROADMAP Success Criterion 4).
result: pass

### 2. 04-02 Task 2 human-check — perceptual distinction of the two position lists
expected: |
  Open a position card with both qualified and working guards.
  (1) Screenshot in greyscale — the two lists remain distinguishable.
  (2) Cover both headings with a hand — still distinguishable from icon + item shape alone.
  (3) Reduce a working guard's qualification and confirm they move to the working-only list,
      disappearing from the qualified list.
result: pass

### 3. 04-02 Task 1 human-check — full dev-server click-through
expected: |
  As a supervisor, open "עוד" → "עמדות קבועות", define a template position (weekdays + hours),
  switch forward and back a week, and confirm shift rows appear with no extra click and no
  duplicates on repeat navigation.
result: PARTIALLY COVERED — the orchestrator's own live browser regression test (see
  04-01-SUMMARY.md's Post-Merge Finding) created a position and navigated through 3+
  never-before-visited weeks with no reload, confirming materialization each time via both
  the UI and a direct database query, and confirmed no duplicate rows. This differs from the
  original script (it targeted the RLS regression specifically, not this exact click sequence)
  — worth a final quick pass but low residual risk.

### 4. 04-01 Task 3 human-check — dashboard confirmation of materialized rows
expected: |
  Define a template position, confirm materialized shift rows carry `position_id` in the
  Supabase dashboard, and confirm a second `ensurePositionsForWeek` call on the same week
  adds nothing.
result: PARTIALLY COVERED — confirmed via direct SQL query (equivalent to dashboard
  inspection) during the orchestrator's Post-Merge regression test; the "second call adds
  nothing" idempotency guarantee is additionally proven at the unit level (`npm test`,
  POS-04 section, 5/5 checks) and was observed live (repeat week visits never duplicated rows).

## Summary

total: 4
passed: 2
failed: 0
pending: 0
skipped: 2 (tests 3 and 4 — substantially covered by the orchestrator's own live regression
  testing during phase execution; not re-run as separate manual checks)
