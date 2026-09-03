---
status: testing
phase: 05-unified-board
source: [05-VERIFICATION.md]
started: 2026-09-03T00:00:00Z
updated: 2026-09-03T08:00:00Z
---

## Current Test

number: 4
name: Guard side — merged list, timed-only hero, matching qualification lock
expected: |
  A task assigned to the guard appears in their duty list next to their
  shifts, ordered by time. The hero "התורנות הבאה שלך" card only ever shows
  an item with a real clock time (never timeless). Nothing shown twice.
  After a supervisor narrows the guard's qualification on a category they're
  already assigned to (on both a shift and a task), both rows show the
  identical lock/"לא כשיר/ה"/neutral ring — from both the guard's own view
  and the supervisor's.
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
result: issue
reported: "ולמי שהראיתי האפליקצייה בכלל לא עונה על מה שאמרת האפליקצייה בילבלה אותו מאוד , ניראלי צריך לעשות פה עבודה"
severity: major

### 2. יומן tab, week mode — same board, both entry points
expected: |
  Confirm it renders the identical UnifiedBoard component the "השבוע" flow
  shows — not a different grid — and that the month view still works
  unchanged. Same board, same items, same qualification locks, in both
  entry points.
result: pass
source: automated
note: |
  Live browser check this session (Claude Browser MCP, functionally
  equivalent to Playwright-MCP — no such tool was configured by that name):
  seeded a fresh demo, opened "יומן" tab week mode, confirmed identical
  row cards/items/coverage badges to the "השבוע" board. Toggled to month
  view — CalendarView renders unchanged, unaffected by the repoint.

### 3. עמדות קבועות — four-week forecast, both shapes, read-only
expected: |
  Each position shows four week sections forward. A template position's rows
  for the current week appear realized (no badge); the next three weeks
  carry "מתוכנן". A weekly-shape position shows exactly one row per week,
  four weeks, no hours printed. No shape-specific colour/icon/card style.
  Tapping a "מתוכנן" row opens only the position's edit dialog — nothing in
  the section can assign, unassign, disable or delete.
result: pass
source: automated
note: |
  Live browser check this session: created a template position (Sunday,
  08:00-16:00). "4 השבועות הקרובים" rendered with current week's date/time
  and 3 following weeks each carrying "מתוכנן", uniform card style, no
  assign/edit-shift affordance anywhere in the section (D-08 read-only
  confirmed). Did not separately create a weekly-shape position to confirm
  its one-row-per-week rendering live — that half rests on
  scripts/verify-positions.mjs's automated assertions, not a live render.

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
note: |
  NOT independently verified live — a second guard-role session shares
  localStorage/auth with the supervisor tab in this browser tool (no private
  window available), so a real logged-in guard view was not reachable this
  session. What IS confirmed: the code review's critical finding on this
  exact code path (GuardApp.jsx's team-wide board silently dropping
  task-only days) was found, fixed, and independently re-verified by the
  phase verifier by reading the diff — not by a live render. Leaving this
  pending rather than claiming a pass I didn't observe.

### 5. Manager board — completeness and visual signals
expected: |
  Count every shift and task for the visible week against the "משימות"
  screen — nothing missing. A task with no hours and a task spanning
  multiple days each show the "מחוץ למנוע" badge and a date range, never a
  clock time. An under-staffed shift row shows the alert icon, "חסרים N"
  text and a warn ring together. Clearing the week to empty shows a worded
  invitation, not a warning/error banner.
result: pass
source: automated
note: |
  Live browser check this session: created a multi-day, no-hours task
  (6-12 Sept) via "משימות" — TaskMgmt showed the "מחוץ למנוע" badge with
  the same date range. On the unified board it appeared exactly once, on
  Saturday (dueDate anchor), ahead of the timed shift rows for that day
  (timeless-first per D-16), badge + date range, no fabricated clock time.
  Under-staffed shift rows showed the alert icon + "חסרים 1"/"חסרים 2" text
  together with the warn-coloured ring. Did not separately clear the week
  to empty to observe the worded empty state live — that rests on source
  review (EmptyState usage, not Alert) plus D-15's design intent, not a
  live render of that specific state.

## Summary

total: 5
passed: 3
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

- gap_id: G-05-1
  truth: "A naive first-time viewer of the unified board correctly identifies, unprompted, what happens each day, which items carry a clock time vs. not, and that a locked person can't do that item — without anyone explaining the app to them (BOARD-04, D-13)."
  status: failed
  reason: "User reported: ולמי שהראיתי האפליקצייה בכלל לא עונה על מה שאמרת האפליקצייה בילבלה אותו מאוד , ניראלי צריך לעשות פה עבודה (the app confused the naive viewer significantly and did not deliver the described comprehension result)"
  severity: major
  test: 1
  artifacts: []
  missing: []
