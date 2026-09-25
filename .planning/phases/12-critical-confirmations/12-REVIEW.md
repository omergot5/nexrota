---
phase: 12-critical-confirmations
reviewed: 2026-09-25T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - CLAUDE.md
  - src/components/ui.jsx
  - src/hooks/useGuardian.js
  - src/components/supervisor/views.jsx
  - src/components/supervisor/WeekFlow.jsx
  - src/components/supervisor/RosterWizard.jsx
  - src/components/supervisor/PositionsScreen.jsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 12: אישורי פעולות קריטיות — Code Review Report

**Reviewed:** 2026-09-25
**Depth:** deep (cross-file, `ConfirmDialog` → `useGuardian.js` action → `api.js` call-chain traced)
**Files Reviewed:** 7
**Status:** issues_found

## Summary

The phase delivers exactly what CONFIRM-01..06 asked for: one generic `ConfirmDialog` (`src/components/ui.jsx`), wired into all eight identified destructive-write call sites, with the five in-scope `useGuardian.js` actions correctly converted from `deferred()`/UndoBar to immediate `run()+refresh()` writes so pre-confirm replaces the undo window instead of stacking on it (matching the locked decision in `12-CONTEXT.md`). `removeRoleCompatibility`'s real protection gap was also closed. This part of the implementation is sound and I did not find a functional break in the confirm/cancel gate itself — Cancel/Escape/backdrop/X all correctly route through the same `closeUnlessPending` path and never call `onConfirm`, which is the load-bearing guarantee CONFIRM-06 depends on.

What I found instead are second-order defects that the "does the dialog gate the write" framing does not surface: a systemic failure-handling gap in `ConfirmDialog` itself (every wired action swallows its own errors, so the dialog cannot distinguish "confirmed and succeeded" from "confirmed and silently failed"), a genuine Hebrew grammar defect that appears in every publish/unpublish confirmation body, and one documentation location (`.claude/CLAUDE.md`) that Phase 12's own closing plan (12-06) flagged as needing a manual edit outside its worktree — and that edit does not appear to have landed, meaning the exact "code and docs must agree" problem this phase exists to fix is still open in that one file.

## Warnings

### WR-01: `ConfirmDialog` always closes on confirm, even when the wrapped action fails

**File:** `src/components/ui.jsx:673-681`
**Issue:** `confirm()` does:
```js
const confirm = async () => {
  setPending(true);
  try {
    await onConfirm();
  } finally {
    setPending(false);
  }
  onClose();
};
```
`onClose()` runs unconditionally after the `try/finally`, which only skips it if `onConfirm()` *throws*. But every single `onConfirm` currently wired into this component ultimately calls a `useGuardian.js` action built on `run()` (`src/hooks/useGuardian.js:266-278`), and `run()` catches its own errors, calls `setError(...)`, and returns `undefined` unless `{ rethrow: true }` is passed — none of the eight CONFIRM-02..05 call sites pass it. That means `await onConfirm()` never rejects for any of the wired dialogs, so `confirm()` always reaches `onClose()`, and the dialog closes exactly the same way whether `actions.deleteShifts`, `actions.removeGuard`, `actions.deletePosition`, `actions.replaceShifts`, or `actions.publish` actually succeeded on the server or failed (network drop, RLS denial, etc.). The only failure signal left is a separate error banner elsewhere in the screen (`SupervisorApp.jsx:450-452`) — easy to miss right after a user just clicked a destructive "מחק שבוע"/"הסר מהצוות" button and watched the modal disappear, which reads as "done."

This is worse than a cosmetic gap for `replaceShifts` specifically (`src/hooks/useGuardian.js:599-604`), which is two non-atomic server calls (`api.deleteShifts` then `api.createShifts`) with no rollback: if the delete succeeds and the create then fails, the confirm dialog still closes silently, `refresh()` is never reached (the throw happens before it), and the client continues showing the **pre-delete** shifts as if nothing happened while the server has actually already deleted them and never created the replacements — a real "week appears fine on screen, is actually empty in the DB" divergence that only self-corrects on the next `refresh()`/reload.

**Fix:** Either (a) have `ConfirmDialog` inspect a return value/rethrown error from `onConfirm` and keep the dialog open with an inline error state on failure (requires passing `{ rethrow: true }` through the wired actions), or, at minimum, (b) document this behavior explicitly in the `ConfirmDialog` header comment (it currently documents Cancel's behavior in detail but says nothing about what happens when the confirmed action fails), and consider making `replaceShifts` order-safe (e.g. create the new rows before deleting the old ones, so a mid-failure leaves the week over-full rather than empty).

### WR-02: Broken Hebrew grammar in every publish/unpublish confirmation body

**File:** `src/components/supervisor/views.jsx:1450-1459`, `src/components/supervisor/WeekFlow.jsx:305-318`
**Issue:** Both `askPublish` (`views.jsx`) and the WeekFlow CTA dialog build the body as:
```js
`${scopeLabel} ${t("unit.shifts")} ייראו מיד אצל כל ${t("noun.memberPlural")} המשובצים.`
```
Two independent problems in this one sentence:
1. `${scopeLabel} ${t("unit.shifts")}` — for the "publish all"/"unpublish all" buttons, `scopeLabel` is the literal string `"כל השבוע"` (`views.jsx:1474`, `:1485`), producing **"כל השבוע משמרות ייראו מיד..."** — grammatically broken word order (reads as "the whole week shifts will be seen", not a valid Hebrew noun phrase). For the per-day toggle, `scopeLabel` is `formatDateHe(date)` (e.g. `"יום ראשון, 5 באוקטובר"`), producing **"יום ראשון, 5 באוקטובר משמרות ייראו מיד..."** — a date directly followed by "shifts" with no connector at all. Correct Hebrew needs something like `"כל משמרות השבוע"` / `"משמרות יום ראשון, 5 באוקטובר"`.
2. `אצל כל ${t("noun.memberPlural")} המשובצים` — missing the definite article: **"כל שומרים המשובצים"** mixes an indefinite noun (`שומרים`) with a definite adjective (`המשובצים`), which is not valid Hebrew. It needs to be `"כל השומרים המשובצים"`.

This is user-facing text shown on every single publish and unpublish confirmation (the two most-used dialogs in the whole phase, per CONFIRM-02/04), and the project's own review scope for this pass explicitly calls out RTL/Hebrew vocabulary conventions.
**Fix:** Rewrite the sentence construction, e.g.:
```js
`כל ${t("unit.shifts")} ${scopeLabel === "כל השבוע" ? "השבוע" : scopeLabel} ייראו מיד אצל כל ה${t("noun.memberPlural")} המשובצים.`
```
or restructure to avoid concatenating a bare date/label directly against a noun — pass a pre-composed Hebrew phrase per call site instead of gluing `scopeLabel` in front of `unit.shifts`.

### WR-03: `.claude/CLAUDE.md` documentation edit from 12-06 does not appear to have landed

**File:** `.claude/CLAUDE.md` (not in this diff — gitignored, per 12-06-SUMMARY.md's own finding)
**Issue:** 12-06-SUMMARY.md documents in detail that `.claude/CLAUDE.md`'s "Dependency Patterns" section ("Undo pattern: delay write 8 seconds, allow cancel without reverting") and its "Architectural Constraints → Offline-read only" section (naming `optimistic()`/`deferred()` as the only two write mechanisms) both still contradict the code after Phase 12, and that the plan could not commit the fix itself because the file is gitignored — it explicitly hands off two exact edits for "the orchestrating session" to apply directly to the real file outside the worktree. Reading the actual current `.claude/CLAUDE.md` in this repo, neither edit is present: "Dependency Patterns" still only says "Undo pattern: delay write 8 seconds, allow cancel without reverting" with no mention of the pre-confirm track, and "Offline-read only" still says only `optimistic()`/`deferred()` are the write mechanisms, with no `run()`. This is exactly the "code and docs disagree" failure mode this phase exists to close (per `12-CONTEXT.md`'s domain statement), left open in the one file the plan itself flagged as needing a manual follow-up that apparently never happened.
**Fix:** Apply the two edits 12-06-SUMMARY.md already wrote out verbatim (see its "Environment Constraint" section) to the real `.claude/CLAUDE.md`.

### WR-04: `deletePosition`/`removeItem` treat the write as successful even when it silently failed

**File:** `src/hooks/useGuardian.js:932-947`, `src/components/supervisor/RosterWizard.jsx:284-297`
**Issue:** `actions.deletePosition` is wrapped in `run()`, which never rethrows by default (see WR-01). `RosterWizard.jsx`'s `removeItem` onConfirm does:
```js
onConfirm: async () => {
  await actions.deletePosition(item.position.id, weekDates);
  if (item.key === resolvedActiveKey) setActiveKey(null);
},
```
Since `actions.deletePosition(...)` always resolves (never rejects, per WR-01), `setActiveKey(null)` runs unconditionally — closing the editing panel for the position even when the delete actually failed server-side (e.g. `unmaterializePositionWeek` throws, or `api.deletePosition` itself throws and is rethrown then swallowed by `run()`). The user sees the panel close as if the deletion succeeded, learns otherwise only from a separate error banner if they happen to notice it.
**Fix:** Same root cause as WR-01 — once `onConfirm` can signal failure (e.g. via `{ rethrow: true }` on `deletePosition`), guard `setActiveKey(null)` behind a successful result instead of running it unconditionally after `await`.

## Info

### IN-01: Position-delete dialog body no longer distinguishes "will cascade" from "won't cascade"

**File:** `src/components/supervisor/PositionsScreen.jsx:49-58`, `src/components/supervisor/RosterWizard.jsx:284-297`
**Issue:** Before Phase 12, `deletePosition`'s UndoBar label was computed conditionally (`hasMaterializedWeek`) so it only warned about cascading shift/assignment deletion when the position actually had shifts materialized for the current week (`useGuardian.js`, pre-diff). The new `ConfirmDialog` body is static in both call sites — "כולל שיבוצים שכבר בוצעו לה השבוע הנוכחי **(אם יש)**" — always hedging with "if any" instead of telling the manager definitively whether this particular delete will or won't touch this week's shifts. This is a minor loss of the specific, actionable warning the old UndoBar label gave.
**Fix:** Optional — if worth restoring, compute the same `hasMaterializedWeek` check (which was removed from `useGuardian.js` in 12-02 since it was only used for the label) at the call site and vary the body text accordingly.

### IN-02: `ConfirmDialog`'s doc comment doesn't cover the confirm-failure path

**File:** `src/components/ui.jsx:647-659`
**Issue:** The component's header comment documents point (1), the CONFIRM-06 cancel guarantee, in detail, but says nothing about what happens if `onConfirm` itself fails — which, per WR-01, is silently treated the same as success today. Future authors wiring a ninth action into this component have no documented signal that they need to opt into `{ rethrow: true }` (or otherwise handle failure) if they want the dialog to reflect it.
**Fix:** Add a third documented point noting the current all-actions-swallow-errors assumption and what a caller must do differently if that assumption doesn't hold for their action.

### IN-03: `askPublish` day-toggle button has no busy/loading guard (pre-existing, not introduced by this phase)

**File:** `src/components/supervisor/views.jsx:1526-1539`
**Issue:** The per-day publish/unpublish `<Btn>` has no `loading={busy}`/`disabled={busy}` prop, unlike the "פרסם הכל"/"בטל פרסום" buttons in the same component (`views.jsx:1470-1490`), which do. This predates Phase 12 (the original `onClick={() => actions.publish(...)}` had the same gap) and Phase 12 did not introduce or fix it — noted only because this phase specifically re-touched this exact button to route it through `askPublish`, and it would have been a natural place to close the gap while already editing this call site.
**Fix:** Add `disabled={busy}` (or `loading={busy}`) to the day-toggle button for consistency with its sibling buttons in the same header.

---

## Fix Pass (2026-09-25)

- **WR-01 fixed**: `run()`'s `{ rethrow: true }` option is now passed by `deleteShifts`, `replaceShifts`, `removeGuard`, and `deletePosition`; `optimistic()` now forwards an `options` param and `publish` passes `{ rethrow: true }` too. `ConfirmDialog.confirm()` in `ui.jsx` now only calls `onClose()` when `onConfirm()` resolves — a caught rejection leaves the dialog open instead of closing silently, relying on the existing error banner to explain the failure (not a duplicate inline error, per the review's own suggested minimal fix).
- **WR-02 fixed**: `askPublish` (`views.jsx`) now takes a pre-composed `scopeShiftsPhrase` instead of gluing a raw `scopeLabel` in front of `unit.shifts` — both the all-week ("כל משמרות השבוע") and per-day ("משמרות יום ראשון, 27 בספטמבר") call sites now read as valid Hebrew noun phrases. The missing definite article ("כל שומרים" → "כל השומרים") is fixed in both `views.jsx` and the equivalent `WeekFlow.jsx` CTA dialog body.
- **WR-03**: not a real finding — verified directly that the `.claude/CLAUDE.md` edit documented in 12-06-SUMMARY.md *is* present in the real file (`grep` confirms both the "Pre-confirm pattern" line and the `run()` mention). The reviewer's own isolated worktree never had this file materialized (it's gitignored — worktrees only get tracked files), so it read an absent/stale copy rather than the real one in the main checkout. No action needed.
- **WR-04 fixed**: resolved as a side effect of WR-01's `deletePosition` rethrow fix — `RosterWizard.jsx`'s `removeItem` already had `setActiveKey(null)` written *after* the `await actions.deletePosition(...)` call with no separate guard, anticipating this exact fix (its own comment cites "T-12-05-B"); no code change needed there.
- **IN-01**: not fixed — accepted as an optional, non-blocking restoration (would require re-adding the `hasMaterializedWeek` computation at the call site, which 12-02 deliberately removed from `useGuardian.js` once it was label-only).
- **IN-02 fixed**: `ConfirmDialog`'s header comment now documents the confirm-failure path (point 3) — the all-callers-must-rethrow-to-signal-failure assumption is now explicit for future callers.
- **IN-03 fixed**: added `loading={busy}` to the day-toggle publish button in `views.jsx` (the exact call site this phase already re-touched for `askPublish` wiring), matching its sibling "פרסם הכל"/"בטל פרסום" buttons.
- Live-verified after the fixes: registered a fresh test team, seeded demo data, confirmed (a) unpublish-all's dialog now reads "כל משמרות השבוע יחזרו למצב טיוטה — השומרים לא יראו אותן יותר כמפורסמות" (correct grammar), (b) confirming it closes the dialog and unpublishes successfully (0/14, no regression from the rethrow/close-on-success-only change), and (c) the day-toggle dialog reads "משמרות יום ראשון, 27 בספטמבר ייראו מיד אצל כל השומרים המשובצים" (correct grammar). `npm test` and `npm run build` both pass.

### Post-review gap (found by `gsd-verifier`, 2026-09-25)

`deleteDemoDataForWeek` (`useGuardian.js:745-758`) was the one ConfirmDialog-wired action the WR-01 fix pass above missed — it still called plain `run()` with no `{ rethrow: true }`, so its own `ConfirmDialog` (`WeekFlow.jsx`'s "מחק נתוני הדגמה לשבוע זה") would have closed silently on failure exactly like the original WR-01 bug, contradicting this document's claim that every wired action was fixed. Fixed by adding the same `{ rethrow: true }` option used by its siblings. `npm test`/`npm run build` pass. Live-verified: registered a fresh test team (`phase12ftest`), seeded 20 guards/14 shifts of demo data, opened the demo-cleanup `ConfirmDialog`, confirmed it — dialog closed correctly and the board went from 14 shifts to empty with no console errors (success path unaffected by the rethrow addition). Test team cleaned up via cascading SQL delete afterward. Committed as `cbc514a`.

---

_Reviewed: 2026-09-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
