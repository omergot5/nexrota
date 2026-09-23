---
phase: 10-more-menu-audit
reviewed: 2026-09-23T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - src/components/SupervisorApp.jsx
  - src/components/supervisor/views.jsx
  - src/components/supervisor/CalendarView.jsx
  - src/components/supervisor/ResourceGrid.jsx
  - src/components/supervisor/ResourceView.jsx
  - src/lib/categories.js
  - src/components/supervisor/RosterWizard.jsx
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-09-23
**Depth:** deep
**Files Reviewed:** 7 (6 changed in `git diff 1422818..HEAD -- src/`, plus `RosterWizard.jsx` pulled in via cross-file trace of the deleted `ResourceView` screen)
**Status:** issues_found

## Summary

This is a genuinely small, mostly subtractive/organizational phase, and it reads that way: `moreItems()`/`views` correctly drop `resources` with no dangling comma or map-key issues, `onNavigate` is correctly wired from `common` into `SupDashboard`, the new "לדוח המלא" link follows the exact `Btn variant="ghost"` sibling pattern the plan specified, and `npm test` / `npm run build` both pass cleanly against the current tree (910 modules, no warnings beyond the pre-existing chunk-size notice). The MORE-01 audit comment anchored above `moreItems()` accurately reflects the decisions in `10-CONTEXT.md`, and `ResourceGrid.jsx`/`buildResourceRows` are confirmed still consumed correctly by `CalendarView.jsx` and `RosterWizard.jsx`.

Two real issues turned up on cross-file tracing, both stemming from the same root cause: the 10-02 cleanup's "zero dangling references" verify gate only grepped for the literal string `ResourceView`, which is narrower than what MORE-03 actually promised (no leftover reference to the *removed screen*, in any language). That gap let stale, present-tense Hebrew comments survive in `RosterWizard.jsx`, and — independently — a byte-identical copy of the deleted `ResourceView.jsx` is currently sitting untracked in the working tree, which the git-diff-based verification the phase relied on would never see.

## Warnings

### WR-01: Four RosterWizard.jsx comments still describe the deleted "מסך המשאבים" as if it currently exists

**File:** `src/components/supervisor/RosterWizard.jsx:14-16, 145, 314, 446-448`
**Issue:** 10-02 (MORE-03) deleted `ResourceView.jsx` and its summary/the MORE-01 audit comment both assert "no dangling import or mention of it remains anywhere under `src/`." That claim was verified with a grep for the literal identifier `ResourceView`, and three comments containing that exact string (in `CalendarView.jsx`, `ResourceGrid.jsx`, `categories.js`) were reworded accordingly. However, four comments in `RosterWizard.jsx` reference the same deleted screen only by its Hebrew display name and were missed:
- L14-15: `"פאנל התצוגה (06-02) מצייר מעתה את אותו דפוס משותף שמסך המשאבים והיומן מציגים"` — "the pattern that the resources screen and the calendar display" (present tense).
- L145: `"שמסך המשאבים והיומן קוראים ממנו."` — same present-tense claim.
- L314: `"תצוגת השבוע: אותו מסלול נתונים בדיוק כמו 'מבט משאבים' (D-02)"`.
- L447: `"אותו מבנה בדיוק שמסך המשאבים והיומן מציגים (D-04)"`.

All four now describe a two-screen reality ("the resources screen and the calendar") that stopped being true the moment this same phase deleted `ResourceView.jsx`; today only the calendar (and `RosterWizard` itself) render that grid. This is exactly the kind of misleading documentation MORE-03's own acceptance bar ("no dangling mention... anywhere") was meant to rule out — it just wasn't caught because the verify step matched on the code identifier, not the concept.
**Fix:** Reword these four comments the same way the three in `CalendarView.jsx`/`ResourceGrid.jsx` were, e.g.:
```diff
- // פאנל התצוגה (06-02) מצייר מעתה את אותו דפוס משותף שמסך המשאבים והיומן
- // מציגים (ResourceGrid, D-04), מתוך פריטי העבודה בפועל של השבוע
+ // פאנל התצוגה (06-02) מצייר מעתה את אותו דפוס משותף שהיומן מציג (מסך
+ // "מבט משאבים" הנפרד הוסר ב-Phase 10) — ResourceGrid, D-04 — מתוך פריטי
+ // העבודה בפועל של השבוע
```
and similarly at L145, L314, L447.

### WR-02: Deleted `ResourceView.jsx` has resurfaced untracked in the working tree

**File:** `src/components/supervisor/ResourceView.jsx` (untracked; not in `git diff 1422818..HEAD`)
**Issue:** Commit `b81a374` (10-02, MORE-03) deletes `src/components/supervisor/ResourceView.jsx` from git, and both `10-02-SUMMARY.md` and the MORE-01 comment in `SupervisorApp.jsx` state it was removed from disk. `git status` currently shows this exact path as untracked (`??`), and its contents are byte-identical to the pre-deletion version (diffed against `b81a374~1:src/components/supervisor/ResourceView.jsx` — no textual differences). Nothing currently imports it (confirmed via grep across `src/`, and `npm run build` completes at 910 modules with no reference to it), so it has no effect on the running app today. But it is a live landmine: it directly contradicts MORE-03's "removed without breaking any existing feature" claim as observed on disk, and the next broad `git add -A`/`git add .` in this working tree would silently resurrect the exact dead-code duplication (`ResourceView` vs. `CalendarView` week mode) the audit specifically recommended removing — undoing MORE-03 without anyone noticing, since it would look like a routine "new file" commit rather than a revert.
**Fix:** Delete the stray file from the working tree (or confirm it's a leftover from a stale worktree/checkout and clean it up) before the next commit that touches this directory. Worth a `git status` sanity check as part of closing this phase.

## Info

### IN-01: MORE-01 audit comment has no enforcement against future drift

**File:** `src/components/SupervisorApp.jsx:39-65`
**Issue:** The audit table is a faithful, accurate transcription of `10-CONTEXT.md` today, but it lives as a plain comment above `moreItems()`. The only check tying it to reality was a one-off `node -e` gate run during 10-03's execution (verifying a handful of tokens like `swaps`/`resources`/`כפול`/`המלצה` are present in the comment text) — that gate is not part of the persisted `npm test` suite (`scripts/verify-*.mjs`), so if `moreItems()` changes again in a future phase (e.g., a sixth item added, or `positions` gets a shortcut after all), nothing will fail to flag that this comment's table and "מסקנה תפעולית" paragraph are now stale.
**Fix:** Not blocking for this phase, but worth considering: fold a lightweight structural check (e.g., "every `id` in `moreItems()` appears as a table row in the comment directly above it") into `scripts/verify-planning.mjs` or a new `scripts/verify-*.mjs`, so `npm test` catches drift automatically rather than relying on manual discipline the next time this menu changes.

---

## Fix Pass (2026-09-23)

- **WR-01 fixed**: reworded all four stale present-tense comments in `RosterWizard.jsx` (L14-16, L145-146, L315-316, L448-449) so none claim the deleted "מסך משאבים" still renders the shared grid — each now notes the screen was removed in Phase 10 and only the calendar (+ this wizard) consume `ResourceGrid` today.
- **WR-02 fixed**: deleted the stray untracked `src/components/supervisor/ResourceView.jsx` from the working tree (byte-identical leftover from before commit `b81a374`'s deletion). `git status` now shows no trace of it.
- **IN-01**: not fixed — accepted as non-blocking per the review's own note; no automated drift-check added.
- `npm test` and `npm run build` both re-run clean after the fixes (910 modules, no new warnings).

---

_Reviewed: 2026-09-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
