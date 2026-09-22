---
phase: 09-rest-time-demo-button
reviewed: 2026-09-22T00:00:00Z
fixed: 2026-09-22
depth: deep
files_reviewed: 1
files_reviewed_list:
  - src/components/supervisor/views.jsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: fixed
---

## Fix Pass (2026-09-22)

- **CR-01 fixed**: `SeedDemoDialog`'s body now reads `{t("unit.shifts")}` instead of the hardcoded `"משמרות"`. Live-verified in a fresh army-mode team (0 guards, registered specifically to reach this untested state) — dialog now correctly reads "...כפופים, **תורנויות** ושיבוצים..." instead of "משמרות".
- **WR-01 fixed**: added local `pending` state around the `onConfirm` call; `Modal`'s `onClose` (wired to Escape/backdrop/header-✕) and the "ביטול" button are now both gated so they can't dismiss the dialog mid-write.
- **WR-02 fixed**: removed the stale `loading={busy}` from both trigger buttons (`SupDashboard`'s and `TeamView`'s) — opening the dialog no longer spuriously spins/disables on unrelated in-flight app actions.
- **IN-01 fixed**: added a `useEffect` resetting `guardCount` to 20 whenever the dialog transitions to `open`. Live-verified: selected 7, cancelled, reopened — picker correctly showed 20 again.
- `npm test` and `npm run build` re-verified passing after all four fixes. Live verification performed against two additional test teams (clean generic + clean army), both cleaned up from Supabase afterward.

# Phase 9: Code Review Report

**Reviewed:** 2026-09-22
**Depth:** deep
**Files Reviewed:** 1 (`src/components/supervisor/views.jsx`), cross-referenced against `src/lib/terms.js`, `src/components/ui.jsx`, `src/hooks/useGuardian.js`, `src/components/SupervisorApp.jsx`, `src/components/AuthPage.jsx`
**Status:** issues_found

## Summary

Reviewed the merged diff for both 09-01 (rest-hours card relocation, REST-01/02) and 09-02 (shared `SeedDemoDialog`, REST-03/04) against `git diff 6331f65...HEAD -- src/`. Confirmed the diff touches exactly one file as claimed, `npm test` and `npm run build` both pass, and `AuthPage.jsx`/`startGuestDemo` in `useGuardian.js` are byte-for-byte untouched (`git diff` on those two files is empty).

**09-01 (rest-hours relocation):** Verified byte-identical. The `RestHoursSettings({ team, actions, busy })` component contains the exact same JSX (title, icon, subtitle, `[10, 12].map` toggle, `actions.updateTeamSettings({ restHours })` write path) as the removed `SupDashboard` card, is defined once, placed immediately before `FairnessWindowSettings`, and rendered exactly once as a `TeamView` sibling between `DeadlineSettings` and `FairnessWindowSettings`. The stale "why it's on the dashboard" comment was fully deleted (not left orphaned) and replaced with a freshly-written JSDoc block. No other `SupDashboard`/`TeamView` content was disturbed. This plan is clean.

**09-02 (shared demo dialog):** Structurally sound — one `SeedDemoDialog` definition, rendered exactly twice, both trigger buttons kept their exact original text/icon/visibility conditions, the guard-count `Segmented` moved correctly into the dialog body, and `onSeedDemo` is only ever invoked through `SeedDemoDialog`'s `onConfirm` prop (zero direct `onSeedDemo(...)` calls remain in the file). However, tracing the call chain into `terms.js` and `SupervisorApp.jsx` (things the two live-browser sessions — both against clean, presumably `security`-mode accounts — would not have surfaced) turned up one BLOCKER-level terminology bug and two edge-case WARNINGs around the dialog's dismiss paths and the trigger buttons' loading state.

## Critical Issues

### CR-01: Hardcoded "משמרות" in SeedDemoDialog body breaks army-mode vocabulary rule

**File:** `src/components/supervisor/views.jsx:93`
**Issue:** `SeedDemoDialog`'s body text reads:
```jsx
הפעולה מוסיפה {t("noun.memberPlural")}, משמרות ושיבוצים לדוגמה לצוות הנוכחי — נתונים אמיתיים, לא תצוגה
זמנית. שום דבר לא נוצר עד לחיצה על "צור נתוני הדגמה".
```
`{t("noun.memberPlural")}` is correctly mode-aware, but `"משמרות"` is a raw hardcoded literal. `src/lib/terms.js` defines `"unit.shifts"` as `"משמרות"` for civil/security/restaurant but overrides it to `"תורנויות"` for army mode (`PROFILE_TERMS.army["unit.shifts"] = "תורנויות"`). This is exactly the pattern the project's own iron rule forbids: CLAUDE.md's choke-point table states `src/lib/terms.js` is "the only place that knows every word the user sees... ולכן אין מחרוזת ממשק קשיחה ברכיבים" (no hardcoded interface string in components). The very same diff gets this right one function away — `RestHoursSettings` (line ~2454) correctly renders `מנוחה מינימלית בין {t("unit.shifts")}` — which confirms the author knew the correct pattern but didn't apply it to the newly-written dialog copy.

Effect: an army-mode manager who opens either demo-fill button sees "משמרות" in the confirmation dialog instead of "תורנויות", inconsistent with every other screen in the product for that team. `npm test` does not catch this — `scripts/verify-terms.mjs` only validates the `terms.js` dictionary's internal consistency (no orphaned overrides), it does not scan component source for raw hardcoded vocabulary. The live-browser verification the coordinator performed used two freshly registered clean accounts; nothing in either plan's `human-check` steps calls out testing in army mode, so this was never exercised.

**Fix:**
```jsx
<p className="text-xs text-muted">
  הפעולה מוסיפה {t("noun.memberPlural")}, {t("unit.shifts")} ושיבוצים לדוגמה לצוות הנוכחי — נתונים אמיתיים, לא
  תצוגה זמנית. שום דבר לא נוצר עד לחיצה על "צור נתוני הדגמה".
</p>
```

## Warnings

### WR-01: SeedDemoDialog's dismiss paths aren't gated while confirm is in flight

**File:** `src/components/supervisor/views.jsx:70-89` (interacting with `src/components/ui.jsx:598-606, 619, 633`)
**Issue:** `confirm()` is:
```jsx
const confirm = async () => {
  await onConfirm(guardCount);
  onClose();
};
```
`onConfirm` (= `startDemo` in `SupervisorApp.jsx:175`, wired through `actions.seedDemo`) sets the app-wide `busy` flag for the duration of the write, and the primary `Btn` is correctly gated by `loading={busy}` so it can't be double-clicked. But once a user clicks "צור נתוני הדגמה", four *other* ways to dismiss the dialog remain fully live while that write is still pending: the "ביטול" button (`onClick={onClose}`, no `disabled`/`busy` check), the `Modal`'s `Escape` handler (`ui.jsx:602`, unconditional `onClose?.()`), the backdrop click (`ui.jsx:619`, unconditional `onClick={onClose}`), and the header `x` `IconBtn` (`ui.jsx:633`, unconditional `onClick={onClose}`). Because `Modal` unmounts its children on `open=false` (`ui.jsx:608`), any of these make the dialog visually disappear as if the operation stopped — but the already-in-flight `seedDemo` call (and, per `startDemo`, the subsequent navigation to `"smart"`) completes regardless. A user who gets impatient and hits Escape/backdrop/ביטול mid-write will see the dialog vanish, conclude nothing happened, and then be surprised when demo data appears (and navigation to the smart-assign screen fires) a moment later.

This directly undercuts the locked REST-04 decision's stated guarantee — "ביטול, Escape, או קליק מחוץ לפאנל סוגרים בלי ליצור שום רשומה" — which is technically true only in the sense that these paths never *call* `onConfirm` themselves; it doesn't hold once `onConfirm` was already dispatched by the primary button. No `human-check` step in either plan exercises this race (both only test: open → verify nothing created → Cancel closes cleanly → reopen → Confirm creates), so a live click-through in the normal, unhurried order would never surface it.

**Fix:** Disable the dismiss affordances while a confirm is pending, e.g. track local pending state and pass it through:
```jsx
const [pending, setPending] = useState(false);
const confirm = async () => {
  setPending(true);
  try {
    await onConfirm(guardCount);
  } finally {
    setPending(false);
  }
  onClose();
};
// ...
<Modal open={open} onClose={pending ? undefined : onClose} ...>
  ...
  <Btn variant="secondary" onClick={onClose} disabled={pending}>ביטול</Btn>
```
(and pass a `busy || pending`-aware `onClose` guard into `Modal` if it should also block Escape/backdrop/header-close during the write).

### WR-02: Dialog-trigger buttons stay gated by the global `busy` flag even though opening the dialog does no network work

**File:** `src/components/supervisor/views.jsx:227, 2795`
**Issue:** Both trigger buttons kept `loading={busy}` from the original implementation:
```jsx
<Btn variant="outline" size="sm" icon="sparkles" onClick={() => setDemoDialogOpen(true)} loading={busy}>
```
`Btn` sets `disabled={disabled || loading}` (`ui.jsx:185`), so whenever the app-wide `busy` flag is true for *any* unrelated in-flight action (saving qualifications, changing rest-hours, publishing a shift, etc.), these buttons become disabled and show a spinner — even though clicking them now performs zero network I/O, only `setDemoDialogOpen(true)`. Previously `loading={busy}` made sense because the click *was* the write; now the click and the write are decoupled by the dialog, so gating the open-action behind an unrelated global busy state is a regression in intent (not a data-integrity bug, since `SeedDemoDialog` itself still separately and correctly gates its own confirm button on `busy`).

**Fix:** Drop `loading={busy}` from the two trigger buttons (they no longer perform the write themselves):
```jsx
<Btn variant="outline" size="sm" icon="sparkles" onClick={() => setDemoDialogOpen(true)}>
  מלא לי נתוני הדגמה
</Btn>
```

## Info

### IN-01: `guardCount` doesn't reset to default (20) after a Cancel/dismiss + reopen

**File:** `src/components/supervisor/views.jsx:68`
**Issue:** `SeedDemoDialog` owns `const [guardCount, setGuardCount] = useState(20)` at the component level, but `SeedDemoDialog` itself is never unmounted (only `Modal`'s internal children unmount via `if (!open) return null`). If a user changes the selection to, say, 7, then cancels, then reopens the dialog, they'll see 7 pre-selected rather than the documented default of 20. Low-impact (arguably even a mild feature — remembers the last choice within a session), but it's an untested edge case worth a conscious decision either way rather than an accidental side effect of the `useState` placement.
**Fix:** If a fresh-default-on-every-open is desired, reset `guardCount` in the `onClick` that sets `demoDialogOpen(true)`, or reset it inside a `useEffect` keyed on `open` transitioning to `true`.

---

_Reviewed: 2026-09-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
