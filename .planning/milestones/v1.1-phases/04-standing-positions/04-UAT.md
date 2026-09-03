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
result: pass

### 4. 04-01 Task 3 human-check — dashboard confirmation of materialized rows
expected: |
  Define a template position, confirm materialized shift rows carry `position_id` in the
  Supabase dashboard, and confirm a second `ensurePositionsForWeek` call on the same week
  adds nothing.
result: pass

## Summary

total: 4
passed: 4
failed: 0
pending: 0
skipped: 0
