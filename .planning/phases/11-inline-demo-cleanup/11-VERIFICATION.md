---
phase: 11-inline-demo-cleanup
verified: 2026-09-24T00:00:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 11: עריכה אינטואיטיבית + ניקוי הדגמה + באג "מצב השבוע" — Verification Report

**Phase Goal:** מנהל מוסיף ומוחק שיבוצים בלי לצאת מהמסך, מנקה נתוני הדגמה בלחיצה אחת בלי לפגוע בנתונים אמיתיים, ורואה את "מצב השבוע" מתעדכן מיד אחרי כל שינוי
**Verified:** 2026-09-24
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | מנהל מוסיף ומוחק שיבוץ ישירות בתוך "בניית שבוע" — בלי ניווט למסך אחר ובלי צלילה לתפריט (INLINE-01) | ✓ VERIFIED | `src/components/supervisor/UnifiedBoard.jsx:70,127,158,176` — `onToggleAssignment` prop drilled `UnifiedBoard → DayColumn → BoardCard`, wired to `actions.toggleAssignment` at `WeekFlow.jsx:191` (`onToggleAssignment={actions.toggleAssignment}`) — the board step of "בניית שבוע" itself. Always-visible "x" on assigned avatars (`views.jsx:1732,1779`, `onRemove` + `e.stopPropagation()` at lines 1736-1737, 1783-1784) and a "+" button opening a short guard-picker Modal on open slots (`UnifiedBoard.jsx:304-343`, calls `onToggleAssignment(item.id, g.id)` at line 343) — both call through `toggleAssignment` (`useGuardian.js:589-630`), an existing optimistic action, with no navigation away from `WeekFlow.jsx`'s board step (`STEP_OF.board`). **Critically, the CR-01 finding (task cards silently corrupted via the same affordances) is fixed**: `UnifiedBoard.jsx:203-204,209` now gates `canRemove`/`canAdd` on `isShiftItem = !timeless && item.type !== "task"`, confirmed present in the current source, not just claimed in 11-REVIEW.md's "Fix Pass" note. |
| 2 | רשומת שיבוץ נושאת דגל `is_demo` (או שקול) שמבחין בבטחה בין נתוני הדגמה לנתונים אמיתיים (INLINE-02) | ✓ VERIFIED | Migration `supabase/migrations/0022_work_items_is_demo.sql:17-18` — `alter table gs_work_items add column if not exists is_demo boolean not null default false`. `src/lib/api.js:66` (`isDemo: Boolean(row.is_demo)`), `:95` (`is_demo: Boolean(shift.isDemo)`), `:217` (`SHIFT_SELECT` includes `is_demo`) — full round-trip mapping confirmed in code, not just SUMMARY claims. `demoData.js:173,397` set `is_demo: true` at exactly the two demo-seed insert points (`seedDemoTeam`, army position-plan-to-shift-row path); every other write path defaults to `false`. `scripts/verify-planning.mjs` INLINE-02 checks (6 assertions covering present/absent/round-trip/`shiftRowToWorkItem`) re-run clean via `npm test` in this verification pass. |
| 3 | "מחק נתוני הדגמה לשבוע זה" מוחק רק רשומות הדגמה של השבוע הפעיל — שיבוץ אמיתי באותו שבוע ושיבוץ הדגמה בשבוע אחר שורדים (INLINE-03) | ✓ VERIFIED | `src/lib/demoData.js:416-418` — pure `demoShiftIdsForWeek(shifts, weekDates)` filters `s.isDemo && weekSet.has(s.date)`, confirmed by 4 `verify-planning.mjs` unit checks (isolates demo-this-week from real-this-week and demo-other-week) re-run clean. `useGuardian.js:728-734` — `deleteDemoDataForWeek(weekDates)` computes the id set via `demoShiftIdsForWeek`, no-ops with zero writes when empty, otherwise reuses `api.deleteShifts` (existing RLS+row-count-checked endpoint) through `deferred()` (8s UndoBar, no `confirm()`). Button wired at `WeekFlow.jsx:165-173`, gated by `demoIds.length > 0` (line 103), calling `actions.deleteDemoDataForWeek(weekDates)` (line 170). 11-03-SUMMARY.md documents a live-browser stress test (14 seeded demo shifts + 1 manually-added real shift+assignment in the same week) where the real assignment survived intact, `gs_profiles` (demo guards) were untouched (15 rows before/after), and the button correctly disappeared once no demo data remained. |
| 4 | "מצב השבוע" משקף את המצב הנכון מיד אחרי כל אחת משלוש הפעולות — הוספה, מחיקה, ומחיקת הדגמה — ותרחיש השחזור של הבאג רץ מחדש ולא משחזר (INLINE-04) | ✓ VERIFIED | `src/lib/sequenceGuard.js` — pure `createSequenceGuard()` (`next()`/`isCurrent(token)`), confirmed by 4 `verify-planning.mjs` unit checks (monotonic tokens, current/superseded token resolution, out-of-order resolve simulation), re-run clean. Wired into the single `refresh()` choke point at `useGuardian.js:193-215`: a token is issued before `api.loadTeam()` (line 203) and checked on both the success branch (line 206) and the failure branch (line 212) before any `setData`/`setError` call — a stale response can never overwrite a fresher one regardless of resolve order, without touching any of the ~12 existing `refresh()` call sites or the realtime subscription. 11-01-SUMMARY.md and 11-03-SUMMARY.md both document live-browser reproduction attempts specifically targeting this race (rapid double-click add/remove; and a 3-operation stress sequence — add via board "+", add via board "+", delete-demo — run through the *new* 11-02 board affordances stacked with the *new* delete-demo action) with stepper/board/`ScheduleMgmt` counts staying consistent and matching direct SQL + post-reload checks each time. |

**Score:** 4/4 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0022_work_items_is_demo.sql` | `is_demo` column on `gs_work_items`, no new RLS policy needed | ✓ VERIFIED | Present, matches `ADD COLUMN IF NOT EXISTS ... DEFAULT` convention of `0021_fairness_window_setting.sql`. Applied to the live database per 11-01-SUMMARY.md's post-merge follow-up (confirmed via 11-02/11-03's live SQL-backed verification passes reading/writing `is_demo` successfully). |
| `src/lib/sequenceGuard.js` | Pure race-guard factory, no React/DOM dependency | ✓ VERIFIED | 41 lines, `createSequenceGuard()` exported, imported and wired in `useGuardian.js:38,121`. |
| `src/lib/api.js` — `is_demo`↔`isDemo` mapping | `SHIFT_SELECT`, `shiftFromRow`, `shiftToRow` all handle the column | ✓ VERIFIED | Lines 66, 95, 217 confirmed. |
| `src/lib/demoData.js` — `is_demo: true` at seed points + `demoShiftIdsForWeek` | Exactly the two demo-insert paths flagged; pure week-isolation helper | ✓ VERIFIED | Lines 173, 397 (`is_demo: true`), 416-418 (`demoShiftIdsForWeek`). |
| `src/hooks/useGuardian.js` — `refresh()` sequencing, `deleteDemoDataForWeek`, `deletePosition(id, weekDates)` | Race-guarded refresh, demo-cleanup action, FK-safe position delete | ✓ VERIFIED | Lines 193-215 (refresh sequencing), 728-734 (`deleteDemoDataForWeek`), 912-942 (`deletePosition` with CR-02 fix — see Key Link section). |
| `src/components/supervisor/UnifiedBoard.jsx` — inline "+"/"x" | Board-level add/remove affordances, scoped to genuine shifts | ✓ VERIFIED | Lines 203-209 (`isShiftItem`/`canRemove`/`canAdd`), 299 (onRemove wiring), 304-343 ("+" picker). |
| `src/components/supervisor/views.jsx` — `People`'s `onRemove` | Always-visible "x" on avatar chips, both qualified and blocked branches, with `stopPropagation` and non-overlapping z-index | ✓ VERIFIED | Lines 1701 (prop), 1719 (`hover:z-10 focus-within:z-10` — WR-01 fix), 1732-1737, 1779-1784 (both branches, `stopPropagation`). |
| `src/components/supervisor/WeekFlow.jsx` — demo-cleanup button | Visible only when `is_demo` shifts exist in displayed week, no `confirm()` | ✓ VERIFIED | Lines 102-103 (`demoIds` visibility gate), 165-173 (button, `UndoBar`-only). |
| `src/components/supervisor/RosterWizard.jsx` / `PositionsScreen.jsx` — `weekDates` passed to `deletePosition` | Army FK safety net activated from both delete surfaces | ✓ VERIFIED | Both call sites confirmed passing `weekDates` per 11-02-SUMMARY.md's structural checks and this verifier's `deletePosition` signature reading (`id, weekDates = []`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `UnifiedBoard.jsx` "x"/"+" | `useGuardian.js` `toggleAssignment` | `onToggleAssignment` prop → `actions.toggleAssignment` | ✓ WIRED | `WeekFlow.jsx:191`; not passed from `GuardApp.jsx` or `CalendarView.jsx` (grep confirms `onToggleAssignment` string absent from both — board stays read-only on those two surfaces exactly per the locked 11-CONTEXT.md decision). |
| `UnifiedBoard.jsx` `canRemove`/`canAdd` gate | `isShiftItem` (CR-01 fix) | `item.type !== "task" && !timeless` | ✓ WIRED | `UnifiedBoard.jsx:203-204,209` — confirmed present in current source (not merely claimed fixed in 11-REVIEW.md). Prevents the silent-corruption bug the review found: task-shaped board cards no longer expose the broken remove/add path. |
| `useGuardian.js` `deletePosition` inner `catch` (CR-02 fix) | `refresh()` + `setError()` | direct call instead of rethrow | ✓ WIRED | `useGuardian.js:926-939` — the inner `catch` around `api.deletePosition(id)` calls `await refresh()` and `setError(...)`, then `return`s instead of throwing, so `deferred`'s outer `flush()` catch never repaints the stale pre-operation snapshot over server state that `unmaterializePositionWeek` may have already committed. Matches the review's proposed fix exactly. |
| `WeekFlow.jsx` demo-cleanup button | `useGuardian.js` `deleteDemoDataForWeek` | `onClick={() => actions.deleteDemoDataForWeek(weekDates)}` | ✓ WIRED | `WeekFlow.jsx:170`; action defined `useGuardian.js:728-734`, reuses `api.deleteShifts` (existing RLS+row-count-checked endpoint). |
| `useGuardian.js` `refresh()` | `sequenceGuard` | token issued/checked around `api.loadTeam()` | ✓ WIRED | `useGuardian.js:203,206,212` — single choke point, all ~12 call sites + realtime subscription unmodified but protected transitively. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| INLINE-01 | 11-01 (backend), 11-02 (UI) | Manager adds/removes assignments inline in "בניית שבוע" | ✓ SATISFIED | Truth #1 above; `.planning/REQUIREMENTS.md:46` marked `[x]`; CR-01 gap closed and re-verified in code. |
| INLINE-02 | 11-01 | Assignment records carry `is_demo` flag distinguishing demo/real | ✓ SATISFIED | Truth #2 above; `.planning/REQUIREMENTS.md:47` marked `[x]`. |
| INLINE-03 | 11-01 (backend), 11-03 (UI) | One-click "delete demo data for this week", real data untouched | ✓ SATISFIED | Truth #3 above; `.planning/REQUIREMENTS.md:48` marked `[x]`. |
| INLINE-04 | 11-01 (fix), 11-03 (re-verification) | "מצב השבוע" reflects correctly and immediately after every change | ✓ SATISFIED | Truth #4 above; `.planning/REQUIREMENTS.md:49` marked `[x]`. |

No orphaned requirements found — `.planning/REQUIREMENTS.md:44-49`'s INLINE section maps exactly to these four IDs, all claimed and satisfied across the three plans.

### Anti-Patterns Found

None blocking. Scanned all Phase 11 key files (`UnifiedBoard.jsx`, `WeekFlow.jsx`, `useGuardian.js`, `api.js`, `sequenceGuard.js`, `demoData.js`, `views.jsx`, `RosterWizard.jsx`, `PositionsScreen.jsx`, migration `0022`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` — zero matches.

`11-REVIEW.md` (deep code review, 2026-09-24) found 2 Critical and 2 Warning findings, all independently re-verified fixed in this pass directly against current source (not taken on the review's "Fix Pass" note alone):
- **CR-01** (task-card metadata corruption via inline "x"/"+"): fixed — `isShiftItem` gate confirmed at `UnifiedBoard.jsx:203-204,209`.
- **CR-02** (non-atomic `deletePosition` fake-rollback data loss): fixed — inner `catch`/`refresh()`/`setError()` confirmed at `useGuardian.js:926-939`.
- **WR-01** (avatar remove-button z-index overlap): fixed — `hover:z-10 focus-within:z-10` confirmed at `views.jsx:1719`.
- **WR-02** (generic toast hides real-data blast radius): fixed — conditional label `"העמדה נמחקה — כולל המשמרות שהוקצו לה השבוע"` confirmed at `useGuardian.js:917-922`.
- **IN-01** (no explicit `team_code` filter in `unmaterializePositionWeek`, RLS-only defense): accepted as non-blocking by the reviewer — a consistency nit, not a bug (RLS `gs_work_items_write` already scopes correctly). Not a phase-goal blocker.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (engine-level; no UI runner exists in this project) | `npm test` | All `ok` lines including all INLINE-02/03/04 unit checks, `PASS` | ✓ PASS |
| Production build | `npm run build` | `✓ built in 25.39s`, 911 modules, no errors | ✓ PASS |
| `verify-planning.mjs` INLINE-specific unit checks | `node scripts/verify-planning.mjs` (via `npm test`) | 15 `ok` lines across INLINE-02 (6), INLINE-04 (4), INLINE-03 (4) round-trip/isolation/sequencing assertions | ✓ PASS |
| CR-01 fix present in source | `grep -n "isShiftItem" UnifiedBoard.jsx` | `isShiftItem = !timeless && item.type !== "task"` at line 203, used by both `canRemove`/`canAdd` | ✓ PASS |
| CR-02 fix present in source | `grep -n "deletePosition" -A15 useGuardian.js` | Inner `catch` calls `refresh()` + `setError()`, no rethrow | ✓ PASS |
| No debt markers in phase 11 files | `grep -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across 10 key files | Zero matches | ✓ PASS |
| Board read-only surfaces unaffected | `grep -n "onToggleAssignment" GuardApp.jsx CalendarView.jsx` | Zero matches (only `WeekFlow.jsx` passes the prop) | ✓ PASS |

This is a React UI + Supabase phase with no server/CLI entry point to curl or invoke standalone; the checks above (full test suite including new INLINE unit assertions, build, and targeted grep/source verification of both Critical fixes) are the applicable automated equivalents. Extensive live-browser verification against the real Supabase database was performed by the orchestrating session and is documented in 11-01/11-02/11-03-SUMMARY.md, including the specific stress-test scenario described in this verification's task brief (14 seeded demo shifts, 1 real shift+assignment added via the new board UI, rapid interleaved add/remove/delete-demo operations, confirmed via direct SQL that all demo data was removed, the real assignment survived, demo guards were not deleted, and UI/stepper/board stayed correct after reload) — treated as first-party attestation consistent with this project's declared browser-based verification methodology (no automated E2E exists for this stack, per CLAUDE.md's "אימות בדפדפן" principle).

### Human Verification Required

None outstanding. All human-check points across the three plans were performed live by the orchestrating session with direct dev-server + Supabase SQL access, not merely relayed or inferred:
- 11-01: rapid double-click add/remove race scenario, confirmed no stale-refresh divergence via SQL + reload.
- 11-02: "x" removal, "+" picker (including SQL-confirmed row creation), and army position-delete FK fix — all confirmed live with SQL cross-checks.
- 11-03: the full 7-point integration re-verification including the specific 3-operation stress test (board "+", board "+", delete-demo) stacking the new 11-02 and 11-03 surfaces together — the hardest realistic condition for INLINE-04's race fix — with matching stepper/board/`ScheduleMgmt` counts and SQL confirmation of exactly 1 surviving real row, 15 unchanged `gs_profiles` rows, and correct post-reload state.

The one gap the code review found beyond the plan's own live-testing scope (CR-01, task-card corruption — not exercised because the live tests used shift assignments, not task-typed board items) has been closed at the code level (gating fix confirmed present) and is structurally sound (task cards can no longer reach the broken path at all, verified by the `isShiftItem` check applying before `onRemove`/`+`-button ever renders) — this does not require a separate live re-test to trust, since the fix removes the affected code path from reachability entirely rather than changing its behavior.

### Gaps Summary

None. All 4 ROADMAP Phase 11 success criteria (INLINE-01 through INLINE-04) are structurally and behaviorally verified in the current `main` branch. `npm test` and `npm run build` both pass when re-run independently by this verifier. Both Critical code-review findings (CR-01 task-card corruption, CR-02 non-atomic deletePosition fake-rollback) and both Warning findings (WR-01 z-index overlap, WR-02 generic toast) are confirmed fixed in the current working tree by direct source inspection — not merely claimed fixed in `11-REVIEW.md`'s "Fix Pass" section. The one accepted Info-level finding (IN-01, RLS-only defense-in-depth nit) is explicitly non-blocking per the reviewer's own note and does not affect INLINE-01..04 as currently satisfied. `REQUIREMENTS.md` correctly marks all four INLINE requirements complete, and `ROADMAP.md` marks Phase 11 complete.

---

_Verified: 2026-09-24_
_Verifier: Claude (gsd-verifier)_
