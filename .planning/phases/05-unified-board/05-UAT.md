---
status: testing
phase: 05-unified-board
source: [05-VERIFICATION.md]
started: 2026-09-03T00:00:00Z
updated: 2026-09-03T00:00:00Z
---

## Current Test

number: 1
name: BOARD-04 comprehension test (D-13)
expected: |
  A person who has never seen NexRota gets the running app and one sentence:
  "בנה סידור שבועי מלא" — no other explanation. As supervisor, do they land on
  the unified board first when opening "השבוע"? Do they build a full week
  (shifts, assignment, publish) unaided, with every hesitation/question/
  backtrack recorded? Afterward, ask them to describe in their own words what
  the board shows — they should correctly identify, unprompted: what happens
  each day; that some items carry a clock time and some do not; that a person
  with a lock icon can't do that item. If they describe "shifts" and "tasks"
  as two visually distinct kinds of things, that's a D-12 failure, not a pass.
awaiting: user response

## Tests

### 1. BOARD-04 comprehension test (D-13)
expected: |
  A person who has never seen NexRota gets the running app and one sentence:
  "בנה סידור שבועי מלא" — no other explanation. As supervisor, do they land on
  the unified board first when opening "השבוע"? Do they build a full week
  (shifts, assignment, publish) unaided, with every hesitation/question/
  backtrack recorded? Afterward, ask them to describe in their own words what
  the board shows — they should correctly identify, unprompted: what happens
  each day; that some items carry a clock time and some do not; that a person
  with a lock icon can't do that item. If they describe "shifts" and "tasks"
  as two visually distinct kinds of things, that's a D-12 failure, not a pass.
result: [pending]

### 2. יומן tab, week mode — same board, both entry points
expected: |
  Confirm it renders the identical UnifiedBoard component the "השבוע" flow
  shows — not a different grid — and that the month view still works
  unchanged. Same board, same items, same qualification locks, in both
  entry points.
result: [pending]

### 3. עמדות קבועות — four-week forecast, both shapes, read-only
expected: |
  Each position shows four week sections forward. A template position's rows
  for the current week appear realized (no badge); the next three weeks
  carry "מתוכנן". A weekly-shape position shows exactly one row per week,
  four weeks, no hours printed. No shape-specific colour/icon/card style.
  Tapping a "מתוכנן" row opens only the position's edit dialog — nothing in
  the section can assign, unassign, disable or delete.
result: [pending]

### 4. Guard side — merged list, timed-only hero, matching qualification lock
expected: |
  A task assigned to the guard appears in their duty list next to their
  shifts, ordered by time. The hero "התורנות הבאה שלך" card only ever shows
  an item with a real clock time (never timeless). Nothing shown twice.
  After a supervisor narrows the guard's qualification on a category they're
  already assigned to (on both a shift and a task), both rows show the
  identical lock/"לא כשיר/ה"/neutral ring — from both the guard's own view
  and the supervisor's.
result: [pending]

### 5. Manager board — completeness and visual signals
expected: |
  Count every shift and task for the visible week against the "משימות"
  screen — nothing missing. A task with no hours and a task spanning
  multiple days each show the "מחוץ למנוע" badge and a date range, never a
  clock time. An under-staffed shift row shows the alert icon, "חסרים N"
  text and a warn ring together. Clearing the week to empty shows a worded
  invitation, not a warning/error banner.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
