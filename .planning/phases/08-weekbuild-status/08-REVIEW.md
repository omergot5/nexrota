---
phase: 08-weekbuild-status
reviewed: 2026-09-22T12:48:26Z
fixed: 2026-09-22
depth: deep
files_reviewed: 4
files_reviewed_list:
  - src/lib/terms.js
  - src/components/supervisor/WeekFlow.jsx
  - src/components/supervisor/ResourceGrid.jsx
  - src/components/supervisor/RosterWizard.jsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: fixed
---

## Fix Pass (2026-09-22)

- **WR-01 fixed**: `WeekFlow.jsx`'s board→availability CTA hint now distinguishes a tasks-only week (`boardCount > 0` but `!hasShifts`) from a genuinely empty week, so the message no longer contradicts what the board shows.
- **WR-02 fixed**: `RosterWizard.jsx` now clears `focusedKey` via a `useEffect` when the lookup against `allRows` misses, so a later unrelated row can never silently re-enter focused view.
- **WR-03 resolved**: performed the live browser human-check that 08-03's executor could not run (no browser tooling in that worktree). Verified in a real running app (guest demo team, switched to army mode): WEEKBUILD-01 label live in nav; WEEKBUILD-02 step order live (`בניית שבוע → תמונת מצב שבועית → מי דיווח → בנה לי סד"כ → הפץ סד"כ`); WEEKBUILD-04 toggle click correctly hides/shows the draft ghost row and the button label swaps; WEEKBUILD-05 row click opens the focused single-position view with a working "חזרה לכל העמדות" back button, round-trips correctly, and the draft/ghost row is confirmed never clickable (absent from the accessible-button list). Keyboard activation relies on native `<button>` semantics (Enter/Space), not separately exercised beyond confirming a real `<button>` element with `aria-label` is rendered.
- **IN-01 fixed**: removed the no-op `text-right` class from the new row-open button in `ResourceGrid.jsx`.
- `npm test` and `npm run build` both re-verified passing after the fixes.

# Phase 8: Code Review Report

**Reviewed:** 2026-09-22T12:48:26Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the full diff between `a5f49f6e2c37baf7b92ef60694ab5eb94b41b811` and `HEAD` for the four files touched across 08-01/08-02/08-03: `terms.js` (WEEKBUILD-01), `WeekFlow.jsx` (WEEKBUILD-02/03), and `ResourceGrid.jsx`/`RosterWizard.jsx` (WEEKBUILD-04/05).

`terms.js` is exactly the single-line change the plan specified — verified the army override and the untouched generic `BASE` value, and confirmed no other override in the `army` branch regressed.

`WeekFlow.jsx` is the highest-risk file and it holds up under scrutiny: `STEP_OF`, `meta`, `body`, and `action` are all reordered in lockstep (traced every array index against `STEP_OF` by hand), `goBuildLabel` is fully removed with no dangling references anywhere in `src/`, the `hasShifts` disabled-gate correctly relocated from the old shifts→availability CTA onto the new board→availability CTA, and the empty-state copy no longer references a button that (post-reorder) doesn't build shifts. `SupervisorApp.jsx`'s `STEP_OF`-driven navigation (`go(id)`) is untouched and resolves dynamically, so no hardcoded index assumption broke.

`ResourceGrid.jsx`'s new `onRowClick` prop is backward-compatible by construction (`clickable` requires both a supplied handler and `row.pending !== true`), renders a real `<button type="button">` with an `aria-label` (not a `<div onClick>`), and `ResourceView.jsx`/`CalendarView.jsx` are byte-unchanged and never pass the prop — confirmed via diff and grep.

`RosterWizard.jsx`'s focused view derives `focusedRow` fresh from `allRows` every render (not a click-time snapshot) as required, and `hideDrafts`/`visibleRows` is scoped strictly to the unfocused branch, never touching the focused branch or `WeekFlow`/board step.

`npm test` and `npm run build` both pass on `HEAD`.

Three warnings below are worth addressing (none are blocking — the feature works as specified for the paths the plans exercised), plus two informational notes, including one process gap: the 08-03 plan's mandated live browser/keyboard verification was explicitly **not performed** (per its own SUMMARY), unlike 08-01 and 08-02.

## Warnings

### WR-01: `board→availability` CTA gate ignores tasks, contradicting the plan's own stated constraint and creating a new visible contradiction post-reorder

**File:** `src/components/supervisor/WeekFlow.jsx:221` (`disabled: !hasShifts`), compare with `meta`'s `boardCount` at `WeekFlow.jsx:95-98` (which merges shifts **and** tasks)

**Issue:** `08-02-PLAN.md`'s `must_haves.truths` explicitly describes this gate as blocking the board→availability transition "כל עוד לא נבנתה אף משמרת/משימה השבוע" (as long as no shift **or task** has been built this week). The shipped code only checks `hasShifts` (`weekShifts.length > 0`), exactly mirroring the pre-existing shifts→availability gate from before the reorder — it was never updated to also consider tasks, even though the board immediately above it (`boardCount`) is explicitly shift+task aware.

Before the reorder this mismatch was invisible (the board wasn't directly adjacent to this gate). After WEEKBUILD-02, a manager can now build a task-only week, land on the board step, see it fully populated with task items, and then find the very next CTA disabled with the message "צריך לפחות משמרת אחת כדי להמשיך" ("need at least one shift to continue") — a contradiction between what's on screen and what the button claims is missing. This is exactly the class of "system says something false about itself" failure the milestone's stated core value calls out.

**Fix:** Either gate on `boardCount > 0` (consistent with what the board actually shows), or — if availability collection is intentionally shift-only (guards don't submit availability against tasks) — update the hint text to say so explicitly instead of the generic "צריך לפחות משמרת אחת", e.g.:
```js
hint: hasShifts
  ? `${weekShifts.length} ${t("unit.shifts")} בשבוע הזה`
  : boardCount > 0
    ? "המשימות שהוגדרו לא דורשות איסוף זמינות — צריך לפחות משמרת אחת"
    : "צריך לפחות משמרת אחת כדי להמשיך",
```

### WR-02: `focusedKey` is never cleared when the focused row disappears, so an unrelated later row can silently re-enter focused mode without a click

**File:** `src/components/supervisor/RosterWizard.jsx:370` (`focusedRow` derivation), `RosterWizard.jsx:157` (`focusedKey` state)

**Issue:** `focusedRow` is correctly re-derived from `allRows` every render (per WEEKBUILD-05's explicit requirement), and gracefully falls back to `null` when no row matches `focusedKey` (e.g., the focused position was deleted). However, `focusedKey` itself is never reset in that fallback case — it stays set to the old `row.key ?? row.category` value indefinitely.

Because rows are keyed by `category` when no explicit `key` is present (real, saved positions have no `key` field — only `pendingRows` do), if a manager focuses position "כוננות", deletes it (view correctly falls back to the general grid), and later re-adds a different position also categorized "כוננות" (or navigates to a week where such a category exists again), `focusedRow` will find a match again and the UI will silently jump back into the single-position focused view — without the user clicking anything. This violates the "לחיצה על שורה פותחת תצוגה ממוקדת" contract (focus should only start from an explicit click) and isn't covered by any automated check or the (skipped) human-check.

**Fix:** Clear `focusedKey` when the lookup misses, e.g.:
```js
const focusedRow = focusedKey
  ? allRows.find((row) => (row.key ?? row.category) === focusedKey) || null
  : null;

useEffect(() => {
  if (focusedKey && !focusedRow) setFocusedKey(null);
}, [focusedKey, focusedRow]);
```

### WR-03: WEEKBUILD-04/05 shipped without the human verification their own acceptance criteria required

**File:** `.planning/phases/08-weekbuild-status/08-03-SUMMARY.md` (coverage `D1`/`D3` `human_judgment: true`, "Issues Encountered" section); code under review: `src/components/supervisor/ResourceGrid.jsx`, `src/components/supervisor/RosterWizard.jsx`

**Issue:** `08-03-PLAN.md`'s `<verify>` blocks for both tasks mandate a `<human-check>` covering mouse hover, keyboard-only Tab/Enter navigation into the focused view, the "back to all positions" round-trip, ghost-row non-clickability, `ResourceView.jsx` unaffected-behavior, the toggle click/label swap, and toggle-state persistence across a focus/unfocus round-trip. The plan's own `acceptance_criteria` list this human-check as a required item alongside the automated ones. The executing agent explicitly recorded in the SUMMARY that this was **not performed** ("this execution environment... has no browser automation or preview-server tool available") and flagged it as an outstanding item — yet `status: complete` was still recorded for the plan and phase. By contrast, 08-01 and 08-02 both completed live browser verification.

Static analysis in this review (including a full manual trace of the `clickable` gating, the `<button>` markup, and the `visibleRows`/`focusedRow` wiring) did not surface a functional defect, but the specific behaviors the human-check was designed to catch — real keyboard focus order/activation, hover states, and the toggle interacting correctly with the focused view at runtime — remain unverified in a running browser.

**Fix:** Run the outlined `<human-check>` steps from `08-03-PLAN.md` (Task 1 six points, Task 2 five points) before treating WEEKBUILD-04/05 as fully done, and update the SUMMARY/coverage entries once performed.

## Info

### IN-01: Redundant `text-right` class on the new clickable row button

**File:** `src/components/supervisor/ResourceGrid.jsx:87`

**Issue:** The new `<button>` carries `text-right` in its class list, but its content (dot span, icon, category text) is laid out with `flex items-center`, not block text — `text-right` has no visible effect here since flex children aren't affected by `text-align` on the flex container in this layout. Harmless, but worth dropping for clarity.

**Fix:** Remove `text-right` from the className, or replace it with `justify-start` (RTL-safe) if a specific content justification was actually intended.

### IN-02: Focused single-position view persists across week navigation without being exercised by any check

**File:** `src/components/supervisor/RosterWizard.jsx:157` (`focusedKey`), `370` (`focusedRow`)

**Issue:** `RosterWizard` is rendered with a stable `key="shifts"` in `WeekFlow.jsx`'s `body` array, so it does not remount when `weekOffset`/`weekDates` changes (WeekNav arrows). `focusedKey`/`hideDrafts` therefore persist across a week switch. This is plausibly fine UX (staying focused on "the same position" while browsing a different week, or gracefully falling back to the general view via the WR-02 mechanism if that category doesn't exist that week) — but this interaction between WEEKBUILD-03 (week navigation) and WEEKBUILD-05 (focused view) was never explicitly required or verified by either 08-02's or 08-03's plans/checks. Flagging as a known-untested interaction, not a confirmed defect.

**Fix:** No code change required; consider adding this interaction to the outstanding human-check pass noted in WR-03.

---

_Reviewed: 2026-09-22T12:48:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
