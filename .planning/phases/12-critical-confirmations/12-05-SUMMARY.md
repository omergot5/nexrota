---
phase: 12-critical-confirmations
plan: 05
subsystem: ui
tags: [react, confirmation-dialog, roster-wizard, positions]

# Dependency graph
requires:
  - phase: 12-critical-confirmations (12-01)
    provides: "generic ConfirmDialog component (src/components/ui.jsx)"
  - phase: 12-critical-confirmations (12-02)
    provides: "actions.deletePosition(id, weekDates) converted to immediate run()+refresh() write (no UndoBar) in useGuardian.js"
provides:
  - "RosterWizard.jsx's position-delete flow (trash-icon in the editing panel, army mode) gated behind ConfirmDialog before actions.deletePosition — draft-seed deletion stays immediate, no dialog"
  - "PositionsScreen.jsx's standalone position-delete flow (the 'עמדות קבועות' screen, all domains) gated behind ConfirmDialog before actions.deletePosition"
  - "CONFIRM-05's last named candidate (deletePosition) wired — with 12-03 (deleteShifts/clearWeek) and 12-04 (deleteDemoDataForWeek), all five pre-confirm actions from the phase's closed review list are now wired to ConfirmDialog"
affects: [12-06]

# Actuals (#2632)
actuals:
  tokens: 1570
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Same confirmState/setConfirmState + single <ConfirmDialog> render pattern established in 12-03 (views.jsx) and 12-04 (WeekFlow.jsx), reused here across two more files for the same destructive action (deletePosition) reached from two independent UI entry points"
    - "Branch-conditional confirm: RosterWizard's removeItem only opens ConfirmDialog for the item.position branch (a real, server-persisted position) — the item.seed branch (an unsaved draft) stays a pure local-state removal with no dialog, since there is nothing on the server to lose"

key-files:
  created: []
  modified:
    - src/components/supervisor/RosterWizard.jsx
    - src/components/supervisor/PositionsScreen.jsx

key-decisions:
  - "Confirmed the plan's must_haves distinction in code: RosterWizard's removeItem branches on item.position vs item.seed — only the former (a position that already exists in gs_positions) opens ConfirmDialog. The seed/draft branch (item.seed.id, or a built-in SEED_POSITIONS entry with no id at all) remains an immediate, dialog-free removal, matching the plan's explicit rationale that a draft has no server data to protect."
  - "setActiveKey(null) in RosterWizard's real-position branch was moved from unconditional (running immediately on click, before any confirmation) to inside ConfirmDialog's onConfirm, running only after the await actions.deletePosition(...) call resolves — this was T-12-05-B in the plan's threat register (closing the editing panel before the delete succeeds would be misleading UX while a confirm dialog is still open)."
  - "No shared helper was introduced between the two files (unlike ScheduleMgmt's askPublish in 12-03) — RosterWizard and PositionsScreen have structurally different call sites (item-branch conditional vs. a flat onDelete prop) and no existing shared abstraction layer between them for this action; introducing one would be unplanned architectural scope for a two-call-site, one-plan task."
  - "STATE.md, ROADMAP.md, and REQUIREMENTS.md were deliberately NOT edited directly in this plan's commits, per the orchestrating session's explicit instruction: 12-06 may be running concurrently and touching the same three centralized docs. The specific updates needed are recorded below under 'Next Phase Readiness / Centralized Docs Update Needed' for the orchestrating session to reconcile after merge (same precedent as 12-04, reconciled separately in commit e48766c)."

patterns-established: []

requirements-completed: [CONFIRM-05]

coverage:
  - id: D1
    description: "מחיקת עמדה מ-RosterWizard (removeItem, מצב army) פותחת ConfirmDialog רק כשמדובר בעמדה אמיתית (item.position) — הסרת seed טיוטה (עדיין לא נשמר) נשארת מיידית, בלי דיאלוג"
    requirement: "CONFIRM-05"
    verification:
      - kind: automated_ui
        ref: "inline node assertions (ConfirmDialog imported from ../ui.jsx; removeItem opens setConfirmState for the item.position branch; item.seed.id branch remains untouched) + npm test + npm run build, all pass"
        status: pass
      - kind: manual_procedural
        ref: "Not performed in this worktree — no Supabase credentials/dev server available here. Requires the orchestrating session's live browser + Supabase access, following the same pattern used for 12-03/12-04's live verification: (1) add a draft item via 'הוסף משימה' and delete it before saving — must disappear immediately with no dialog; (2) delete a real, already-saved position — must open ConfirmDialog first, Cancel must leave it unchanged (confirm via reload), Confirm must delete it permanently; (3) ideally after visiting the 'השבוע' step to materialize the current week, delete a position whose week is materialized — must not raise a raw FK violation (Phase 11 fix must still hold)."
        status: pending
    human_judgment: true
    rationale: "Live-browser verification (dialog timing, Cancel no-op, permanent delete on Confirm, and the Phase 11 FK-safety-net interaction with a materialized week) requires a running dev server against live Supabase, unavailable in this isolated worktree."
  - id: D2
    description: "מחיקת עמדה מ-PositionsScreen (המסך העצמאי, כל תחום) פותחת ConfirmDialog לפני actions.deletePosition"
    requirement: "CONFIRM-05"
    verification:
      - kind: automated_ui
        ref: "inline node assertions (ConfirmDialog imported from ../ui.jsx; confirmTarget state present; onDelete no longer calls actions.deletePosition(p.id, weekDates) directly) + npm test + npm run build, all pass"
        status: pass
      - kind: manual_procedural
        ref: "Not performed in this worktree — same credential constraint as D1. Requires opening 'עמדות קבועות' (via 'עוד') in any domain (not just army), clicking the trash icon next to an existing position, and verifying: (1) ConfirmDialog opens before any change; (2) Cancel leaves it unchanged (confirm via reload); (3) Confirm deletes it permanently; (4) if the position's current week is materialized, deletion succeeds without a raw FK violation (Phase 11 fix still holds)."
        status: pending
    human_judgment: true
    rationale: "Live-browser verification requires a running dev server against live Supabase, unavailable in this isolated worktree."

duration: ~10min
completed: 2026-09-25
status: complete
---

# Phase 12 Plan 05: RosterWizard + PositionsScreen deletePosition ConfirmDialog Wiring Summary

**Both remaining UI entry points that call `actions.deletePosition` — `RosterWizard.jsx`'s army-mode trash button and `PositionsScreen.jsx`'s standalone "עמדות קבועות" screen — now stop on `ConfirmDialog` before deleting, completing CONFIRM-05's closed review list of five pre-confirm actions.**

## Performance

- **Duration:** ~10 min of active execution
- **Tasks:** 2/2 completed
- **Files modified:** 2 (`src/components/supervisor/RosterWizard.jsx`, `src/components/supervisor/PositionsScreen.jsx`)

## Accomplishments

- `RosterWizard.jsx`'s `removeItem` now branches: a real, server-persisted position (`item.position`) opens `ConfirmDialog` with a danger-toned "למחוק את [title]?" prompt before calling `actions.deletePosition(id, weekDates)`; an unsaved draft/seed (`item.seed`) is removed immediately with no dialog, since it has no server data to protect.
- `setActiveKey(null)` for the real-position branch moved from running unconditionally on click to running only inside `onConfirm`, after `await actions.deletePosition(...)` resolves — mitigating T-12-05-B (closing the editing panel before the delete succeeds, while the confirm dialog is still open, would have been misleading UX).
- `PositionsScreen.jsx`'s `PositionCard`'s `onDelete` prop now opens a `confirmTarget` state (holding the target position object) instead of calling `actions.deletePosition` directly; a single `ConfirmDialog` rendered next to the existing edit `Modal` calls `actions.deletePosition(confirmTarget.id, weekDates)` only from `onConfirm`.
- Both dialogs reuse the same danger-toned copy pattern already established in 12-03/12-04 ("תימחק לצמיתות... הפעולה לא הפיכה"), referencing the existing cascade-safety UndoBar label's severity language without duplicating it.
- No changes to `useGuardian.js`, `api.js`, or `actions.deletePosition`'s immediate-write mechanism (already converted from `deferred()` to `run()+refresh()` in 12-02) — this plan is a pure UI gate in front of an existing call, per the plan's own scope.

## Task Commits

Each task was committed atomically:

1. **Task 1: מחיקת עמדה ב-RosterWizard (army) מקצה-לקצה דרך ConfirmDialog (CONFIRM-05)** - `8b7d01e` (feat)
2. **Task 2: מחיקת עמדה ב-PositionsScreen (המסך העצמאי) דרך ConfirmDialog (CONFIRM-05)** - `8731a9c` (feat)

_Note: Task 1 is `type="tracer"` per the plan frontmatter. This was a non-interactive autonomous execution; the tracer's automated `<verify>` checks (import, branch-conditional dialog wiring, `npm test`, `npm run build`) all passed, so no HALT was triggered before Task 2. The live-browser tracer feedback gate itself is deferred to the orchestrating session (see coverage D1/D2 above), consistent with 12-03/12-04's precedent._

## Files Created/Modified

- `src/components/supervisor/RosterWizard.jsx` — Imported `ConfirmDialog` from `../ui.jsx`; added `confirmState`/`setConfirmState`; `removeItem` now opens the dialog only for the `item.position` branch, with `setActiveKey(null)` moved inside `onConfirm`; added one `<ConfirmDialog>` render at the end of the component's JSX.
- `src/components/supervisor/PositionsScreen.jsx` — Imported `ConfirmDialog` from `../ui.jsx`; added `confirmTarget`/`setConfirmTarget`; `PositionCard`'s `onDelete` prop now sets `confirmTarget` instead of calling `actions.deletePosition` directly (the `PositionCard` prop signature itself is unchanged); added one `<ConfirmDialog>` render next to the existing edit `Modal`.

## Decisions Made

- Verified in code (not just from the plan's prose) that RosterWizard's `item.position` vs `item.seed` distinction is the correct gate boundary: `item.position` only exists for entries built from `positions.filter((p) => p.active)` (real `gs_positions` rows), while `item.seed` covers both built-in `SEED_POSITIONS` templates (no `id`) and user-added blank drafts (`draft-${Date.now()}-...` id) — neither of which has a server-side row until saved via `save()`.
- No shared confirm-helper was introduced across the two files — they have structurally different call sites (a branching function vs. a flat prop callback) and no existing shared layer between them; a new abstraction would be unplanned scope for a two-call-site plan.
- Deliberately did not touch `STATE.md`, `ROADMAP.md`, or `REQUIREMENTS.md` in this plan's commits, since `12-06` may be running concurrently against the same three files (per the orchestrating session's explicit instruction for this plan). See "Centralized Docs Update Needed" below.

## Deviations from Plan

### Auto-fixed Issues

None — the code changes matched the plan's `<action>` blocks, with one calibration adjustment to comment length (see below), which does not change any acceptance criterion.

### Noted but not fixed (verify-script character-budget calibration, not a code defect)

**1. Task 1's second automated `<verify>` check has a tight character-budget window**
- **Found during:** Task 1 verification
- **Issue:** The plan's check slices `s.slice(i, i+700)` starting at `const removeItem` and expects both `setConfirmState` and `item.seed.id` inside that 700-character window. The plan's own suggested `<action>` code block, if transcribed with its full inline rationale comments verbatim, produces a `removeItem` body long enough to push `item.seed.id` past the 700-character mark, causing a false-negative failure even though the branch-conditional logic itself is correctly implemented.
- **Why not fixed as a code issue:** The underlying logic (only `item.position` opens the dialog; `item.seed.id` branch is untouched; `setActiveKey(null)` moved inside `onConfirm`) is correct and matches the plan's `<acceptance_criteria>` and `<must_haves>` verbatim. This is a plan verify-snippet calibration issue, not an implementation defect.
- **Fix applied:** Trimmed the inline comments around `removeItem` to be more concise (moving the CONFIRM-05/T-12-05-B rationale into a single comment block above the function instead of duplicated inline prose), which brought `item.seed.id` inside the 700-character window without changing any logic. Re-ran the check — it now passes as originally written by the plan.
- **Files modified:** `src/components/supervisor/RosterWizard.jsx` (comment-only adjustment within the same commit as the rest of Task 1).
- **Verification:** All three of Task 1's automated checks (import check, branch-conditional check, `npm test`, `npm run build`) pass exactly as the plan wrote them, with no changes to the check scripts themselves.

---

**Total deviations:** 0 logic deviations. 1 comment-length calibration to fit the plan's own verify-script character budget (no behavior change).
**Impact on plan:** None — all acceptance criteria are met exactly as specified; the fix only shortened comment prose, never touched the branching logic, the dialog wiring, or the `onConfirm` timing.

## Issues Encountered

None beyond the verify-script character-budget note documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready (automated):** Both tasks pass their automated `<verify>` assertions, `npm test`, and `npm run build`.
- **Live-browser verification pending** (not performed in this worktree — no Supabase credentials/dev server available here). Per this plan's execution instructions, the orchestrating session should perform it following the same pattern already used for 12-03/12-04 (register a fresh disposable army-mode test team, click through, report results, clean up):
  1. **RosterWizard (army mode):** (a) Add a draft item via "הוסף משימה" and delete it before saving — must disappear immediately, no dialog. (b) On an already-saved real position, click delete — `ConfirmDialog` must open before anything changes; Cancel must leave it unchanged (verify via reload); Confirm must delete it permanently. (c) If possible, visit the "השבוע" step first (to materialize the current week), then delete a position whose week is materialized — must not raise a raw FK violation (Phase 11 fix must still hold on top of this change).
  2. **PositionsScreen (standalone "עמדות קבועות" screen, any domain):** Click the trash icon next to an existing position — `ConfirmDialog` must open before anything changes; Cancel must leave it unchanged (verify via reload); Confirm must delete it permanently; if the position's current week is materialized, deletion must succeed without a raw FK violation.
- **Centralized Docs Update Needed (deferred to avoid conflict with 12-06):**
  - `REQUIREMENTS.md`: mark `CONFIRM-05` complete (checkbox + traceability table), attributing it to `12-05` — note that CONFIRM-05 as a whole (per `12-CONTEXT.md`'s closed review list) may also require cross-referencing 12-03's `deleteShifts`/`clearWeek` wiring and 12-04's `deleteDemoDataForWeek` wiring if `REQUIREMENTS.md` tracks CONFIRM-05 as a single multi-part item rather than per-action.
  - `ROADMAP.md`: update Phase 12's plan-progress table row for `12-05` (PLAN vs SUMMARY task counts: 2/2).
  - `STATE.md`: advance current plan position past `12-05`, record this plan's decisions (see "Decisions Made" above) and duration, and note the pending live-browser verification (D1/D2 above) as an open item until the orchestrating session performs it.
  - This mirrors 12-04's precedent, where the plan-completion commit (`cb645c2`) added only the SUMMARY.md file, and STATE.md/ROADMAP.md were reconciled separately afterward (commit `e48766c`).
- **CONFIRM-05 scope status:** With this plan, all five actions from `12-CONTEXT.md`'s closed review list (`deleteShifts`/`clearWeek` — 12-03; `deleteDemoDataForWeek` — 12-04; `deletePosition`'s two call sites — this plan) are now wired to `ConfirmDialog`, pending only the live-browser verification noted above.

---
*Phase: 12-critical-confirmations*
*Completed: 2026-09-25*

## Self-Check: PASSED

- FOUND: `src/components/supervisor/RosterWizard.jsx` (modified file)
- FOUND: `src/components/supervisor/PositionsScreen.jsx` (modified file)
- FOUND: commit `8b7d01e` (Task 1)
- FOUND: commit `8731a9c` (Task 2)
- FOUND: `.planning/phases/12-critical-confirmations/12-05-SUMMARY.md` (this file)
