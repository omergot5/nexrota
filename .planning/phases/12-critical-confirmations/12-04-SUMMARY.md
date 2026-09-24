---
phase: 12-critical-confirmations
plan: 04
subsystem: ui
tags: [react, confirmation-dialog, weekflow]

# Dependency graph
requires:
  - phase: 12-critical-confirmations (12-01)
    provides: "generic ConfirmDialog component (src/components/ui.jsx)"
  - phase: 12-critical-confirmations (12-02)
    provides: "deleteDemoDataForWeek converted to immediate write (no UndoBar) in useGuardian.js"
provides:
  - "WeekFlow's CTA-bar publish button (4th publish entry point) gated behind ConfirmDialog before actions.publish"
  - "WeekFlow's 'מחק נתוני הדגמה לשבוע זה' button gated behind ConfirmDialog before the immediate-write actions.deleteDemoDataForWeek"
affects: [13-unpublish-bug-fix]

# Actuals (#2632)
actuals:
  tokens: 1250
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Same confirmState/setConfirmState + single <ConfirmDialog> pattern established in 12-03's views.jsx, reused here in a different file (WeekFlow.jsx) for a different pair of destructive actions"

key-files:
  created: []
  modified:
    - src/components/supervisor/WeekFlow.jsx

key-decisions:
  - "No shared askPublish-style helper was introduced for the CTA button, unlike 12-03's ScheduleMgmt. WeekFlow's action[4] is a single call site that only ever publishes (disabled once published === weekShifts.length, so it never calls publish(ids, false)) -- a helper abstracting publish/unpublish toggling would be over-engineering for a single, one-directional call site."
  - "Confirmed via 12-CONTEXT.md re-read that Task 2 (demo-cleanup button) IS in this plan's explicit scope (CONFIRM-03) -- not deferred to 12-05/12-06. Both tasks from 12-04-PLAN.md were executed."
  - "No changes to useGuardian.js/api.js/actions.publish/actions.deleteDemoDataForWeek -- the known 'ביטול הפצה' (unpublish) bug (STATE.md, Phase 13 scope) was deliberately left untouched, matching 12-03's precedent."
  - "Did not touch action[3] (the earlier wizard step's 'הסידור מוכן -- לשלוח לצוות' navigation button, onClick: () => setStep(4)) -- it only calls setStep, never actions.publish, so it is out of scope entirely; only action[4] (the actual publish CTA on the final 'schedule' step) was in scope per 12-CONTEXT.md finding sec2 point #4 and the plan's own read_first line numbers."

patterns-established: []

requirements-completed: [CONFIRM-02, CONFIRM-03, CONFIRM-04]

coverage:
  - id: D1
    description: "כפתור ה-CTA 'הסידור מוכן — לשלוח לצוות' בשלב 'שליחה לצוות' של WeekFlow פותח ConfirmDialog לפני actions.publish(...,true)"
    requirement: "CONFIRM-02, CONFIRM-04"
    verification:
      - kind: automated_ui
        ref: "inline node assertions (ConfirmDialog imported; publish CTA onClick opens setConfirmState, no direct actions.publish call) + npm test + npm run build, all pass"
        status: pass
      - kind: manual_procedural
        ref: "Not performed in this worktree — no Supabase credentials/dev server available here. Requires the orchestrating session's live browser + Supabase access, following the same pattern used for 12-03's live verification."
        status: pending
    human_judgment: true
    rationale: "Live-browser verification (dialog opens before write, Cancel leaves nothing changed, Confirm publishes immediately, CTA label flips to 'הסידור אצל הצוות' after reload) requires a running dev server against live Supabase, unavailable in this isolated worktree."
  - id: D2
    description: "כפתור 'מחק נתוני הדגמה לשבוע זה' ב-WeekFlow פותח ConfirmDialog לפני actions.deleteDemoDataForWeek, בלי UndoBar אחרי"
    requirement: "CONFIRM-03"
    verification:
      - kind: automated_ui
        ref: "inline node assertions (demo-cleanup button opens setConfirmState, no direct actions.deleteDemoDataForWeek call) + npm test + npm run build, all pass"
        status: pass
      - kind: manual_procedural
        ref: "Not performed in this worktree — same credential constraint as D1."
        status: pending
    human_judgment: true
    rationale: "Live-browser verification (dialog opens, Cancel leaves demo data untouched, Confirm deletes immediately with no UndoBar, real assignments in the same week survive) requires a running dev server against live Supabase, unavailable in this isolated worktree."

duration: ~10min
completed: 2026-09-24
status: complete
---

# Phase 12 Plan 04: WeekFlow CTA Publish + Demo-Cleanup ConfirmDialog Wiring Summary

**Both of `WeekFlow.jsx`'s remaining un-gated destructive actions — the wizard's bottom CTA publish button (4th publish entry point) and "מחק נתוני הדגמה לשבוע זה" — now stop on a shared `ConfirmDialog` before writing, completing CONFIRM-02/03/04 together with 12-03.**

## Performance

- **Duration:** ~10 min of active execution
- **Tasks:** 2/2 completed
- **Files modified:** 1 (`src/components/supervisor/WeekFlow.jsx`)

## Accomplishments

- `WeekFlow`'s bottom CTA button ("הסידור מוכן — לשלוח לצוות" / `t("action.publish")` on the final "schedule" step) now opens `ConfirmDialog` before calling `actions.publish(weekShifts.map((s) => s.id), true)` — the 4th and last of the four UI entry points that call `actions.publish` found in Phase 12's codebase investigation (12-CONTEXT.md findings §2), all now gated between this plan and 12-03.
- `WeekFlow`'s "מחק נתוני הדגמה לשבוע זה" button (Phase 11, INLINE-03) now opens the same shared `ConfirmDialog` before calling the immediate-write `actions.deleteDemoDataForWeek` — completing CONFIRM-03's second named action (the first, "מחק שבוע", was wired in 12-03).
- Both actions share a single `confirmState`/`setConfirmState` pair and a single `<ConfirmDialog>` render at the bottom of `WeekFlow`, following the same pattern 12-03 established in `views.jsx`.
- Updated the stale code comment above the demo-cleanup button that explicitly documented the old "UndoBar only, no confirm dialog" convention (עקרון ברזל 3) — left accurate wording would have contradicted the code beneath it.
- No changes anywhere to `useGuardian.js`, `api.js`, or the publish/unpublish write path — the known pre-existing "ביטול הפצה" bug (Phase 13 scope) was deliberately left untouched, per the plan's explicit instruction.

## Task Commits

Each task was committed atomically:

1. **Task 1: CTA-בר פרסום מקצה-לקצה דרך ConfirmDialog (CONFIRM-02/04)** - `59f5f90` (feat)
2. **Task 2: "מחק נתוני הדגמה לשבוע זה" דרך ConfirmDialog (CONFIRM-03)** - `bfdc326` (feat)

_Note: This plan carries no `tdd="true"` tasks — no separate RED/GREEN commits. Task 1 is `type="tracer"` per the plan frontmatter, but since this is a non-interactive autonomous execution and no automated end-to-end `<verify>` failed, no HALT was triggered before Task 2._

## Files Created/Modified

- `src/components/supervisor/WeekFlow.jsx` — Imported `ConfirmDialog` from `../ui.jsx`; added `confirmState`/`setConfirmState` (shared by both tasks); changed `action[4]`'s `onClick` to open the dialog instead of calling `actions.publish` directly; changed the demo-cleanup `<Btn>`'s `onClick` to open the dialog instead of calling `actions.deleteDemoDataForWeek` directly; updated the now-stale comment above the demo-cleanup button; added one `<ConfirmDialog>` render after `<PrimaryAction {...action} />`.

## Decisions Made

- No `askPublish`-style shared helper was introduced for the CTA button (unlike 12-03's `ScheduleMgmt`, which has three publish/unpublish call sites sharing one helper). `WeekFlow`'s `action[4]` is a single, one-directional call site (always `publish(ids, true)`, disabled once fully published) — a generic toggle helper would be unnecessary abstraction here, matching the plan's own guidance.
- Re-confirmed against `12-CONTEXT.md` that Task 2 (demo-cleanup button) is explicitly in this plan's scope (CONFIRM-03, `must_haves.truths` line 2) rather than deferred elsewhere — both tasks in `12-04-PLAN.md` were executed as written.

## Deviations from Plan

### Auto-fixed Issues

None — the code changes matched the plan's `<action>` blocks essentially verbatim.

### Noted but not fixed (verification-script false negative, not a code defect)

**1. Task 1's first automated `<verify>` check has an off-by-a-few-characters slice boundary**
- **Found during:** Task 1 verification
- **Issue:** The plan's check `s.slice(0,1200)` expects to find `ConfirmDialog` within the first 1200 characters of the file. `WeekFlow.jsx` has a pre-existing 20-line file-header comment (present before this plan touched the file at all) that pushes the import line's start to character offset ~1198 — so the word `ConfirmDialog` (13 characters) only partially falls inside the slice window, and the literal check fails even though the import is correctly present and correctly placed.
- **Why not fixed as a code issue:** The import is correct (`import { Btn, ConfirmDialog, PrimaryAction, Segmented } from "../ui.jsx";`, confirmed by direct read and by a wider-window variant of the same check). This is a miscalibrated literal boundary in the plan's own verify snippet, not a defect in the implementation — nothing in the actual acceptance criteria ("`ConfirmDialog` is imported in `WeekFlow.jsx`") is unmet.
- **Verification performed instead:** Manually confirmed `ConfirmDialog` appears on line 23 as part of the `../ui.jsx` import, and re-ran the same check with a larger slice (`s.slice(0,1500)`) which passes. The plan's other two automated checks (publish-onClick wiring, demo-button onClick wiring) both pass exactly as written. `npm test` and `npm run build` both pass.
- **Files modified:** None (no code change — this is a note about the verify script's literal boundary, not the implementation).

---

**Total deviations:** 0 code deviations. 1 noted verification-script calibration issue (does not affect correctness).
**Impact on plan:** None — all acceptance criteria are met by direct inspection and by the plan's other automated checks plus `npm test`/`npm run build`.

## Issues Encountered

None beyond the verify-script note documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Ready (automated):** Both tasks pass their automated `<verify>` assertions (modulo the noted slice-boundary false negative on one sub-check, confirmed a false negative by manual inspection), `npm test`, and `npm run build`.
- **Live-browser verification NOT performed in this worktree** — this worktree has no `.env`/Supabase credentials to run `npm run dev` against a live backend. Per this plan's own instructions and 12-03's precedent, live verification of both `<human-check>` blocks (CTA publish dialog end-to-end; demo-cleanup dialog end-to-end) should be performed by the orchestrating session, which has a working dev server with live Supabase credentials, following the same "register a fresh disposable test team, click through, report results, clean up" pattern already used for 12-03.
- **What needs live verification, concretely:**
  1. Navigate WeekFlow to the "schedule" step (5th/rightmost step) without using any of `ScheduleMgmt`'s internal publish buttons; click the bottom CTA ("הסידור מוכן — לשלוח לצוות"); confirm a `ConfirmDialog` opens before any write; Cancel leaves shifts unpublished; Confirm publishes immediately; reload shows the CTA now reading "הסידור אצל הצוות".
  2. On a week with both real assignments and demo data (seed demo data if needed), click "מחק נתוני הדגמה לשבוע זה"; confirm a `ConfirmDialog` opens before any write; Cancel leaves demo data untouched; Confirm deletes demo data immediately with no UndoBar; reload confirms real assignments survived and demo data is gone server-side.
- **Known, intentionally untouched:** The "ביטול הפצה" (unpublish) bug (STATE.md Blockers, 12-CONTEXT.md finding §2, Phase 13 scope) is expected to still be present underneath the new `ConfirmDialog` gate on this button — this plan only gates the existing publish call and does not investigate or fix it, per explicit instruction. This CTA button only ever calls `publish(ids, true)` (never `false`), so the unpublish bug is not directly reachable through this specific button regardless.

---
*Phase: 12-critical-confirmations*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: `src/components/supervisor/WeekFlow.jsx` (modified file)
- FOUND: commit `59f5f90` (Task 1)
- FOUND: commit `bfdc326` (Task 2)
- FOUND: `.planning/phases/12-critical-confirmations/12-04-SUMMARY.md` (this file)
