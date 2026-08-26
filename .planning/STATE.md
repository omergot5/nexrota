---
gsd_state_version: 1.0
current_phase: 03
current_phase_name: מודל כשירויות
status: executing
stopped_at: פאזה 3 באמצע ביצוע — גל 1 (03-01, מנוע), גל 2 (03-02, מיגרציה+שער שיבוץ ידני) וגל 3 (03-03, מסך שיבוץ + תיקון MySwaps) מוזגו ל-main. גל 4 (03-04, עורך כשירויות + שער בוחר משימה) עדיין לא נשלח.
last_updated: "2026-08-26T10:58:03.825Z"
last_activity: 2026-08-26
last_activity_desc: Phase 03 wave 3 (03-03) merged — assign grid qualification display, shift category field, GuardApp MySwaps fix
state_head: 219bb0f72475c873e2a5367421b0a17363e37b51
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 10
  completed_plans: 9
  percent: 45
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-21)

**Core value:** אדם שמקבל את האפליקציה לידיו מסיים סידור שבועי מלא בלי שאף אחד יסביר לו כלום — ומה שהמערכת אומרת לו על עצמה הוא נכון.
**Current focus:** Phase 03 — מודל כשירויות

## Current Position

Phase: 03 (מודל כשירויות) — EXECUTING
Plan: 3 of 4 complete, 4th not yet dispatched
Status: Executing Phase 03 — wave 3 (03-03) merged and verified, wave 4 (03-04) not yet dispatched
Last activity: 2026-08-26 — Phase 03 wave 3 (03-03) merged: shift category field, AssignView qualification display (QUAL-07/QUAL-08), GuardApp.jsx MySwaps bug fix (QUAL-04 route 4).

Progress: [█████████░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P01 | 30min | 3 tasks | 5 files |
| Phase 03 P03 | ~6min | 3 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: UNIF קודם ל-QUAL. `FEATURES.md` הראה ש-`SUMMARY.md` טעה — חסימת כשירות למשמרות בלבד, לפני איחוד הישויות, יוצרת נקודה עיוורת שנייה זהה לזו שהמחזור בא לסגור.
- [Phase 3]: כשירות = סט קטגוריות שטוח, ברירת מחדל "כשיר להכול", חסימה מוחלטת בלי עקיפה, אכיפה בצד לקוח בלבד (אכיפת שרת → QUAL-V2-03).
- [Phase 3]: `category` (סוג עבודה) הוא שדה חדש ונפרד מ-`type` (שעה ביום), על משמרת ועל משימה כאחת.
- [Phase 2]: משימות שנוצרו לפני המיגרציה קפואות מחוץ למנוע — אין מילוי שעות לאחור, לעולם.
- [Milestone]: PROJECT_MODE = mvp.
- [Phase 02]: D-07: task load weight is flat LOAD_WEIGHTS.default, not a night-multiplier inferred from clock hours
- [Phase 02]: D-09: task engine eligibility never reads task.status — a done task still blocks conflicting shifts
- [Phase 03]: categoryOptions(shifts, tasks) is the one shared taxonomy the shift form, task form and qualification editor all draw from — shortcut names in declared order, then in-use names sorted, never raw Set order (D-01).
- [Phase 03]: a blocked candidate in AssignView carries three redundant signals (disabled, replaced label, lock glyph) plus a neutral (not danger) ring, so 'unqualified' never collapses visually into 'unavailable' (QUAL-08).
- [Phase 03]: MySwaps (GuardApp.jsx) now resolves the real guard record before calling checkAssignment instead of a synthetic {id} object — closes QUAL-04's fourth route, matching SwapMgmt's refusal shape and wording exactly.

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- אין test runner בפרויקט. כל בדיקה חדשה חייבת להיות סקריפט Node עצמאי שמדפיס `ok`/`FAIL` ומחזיר קוד יציאה, מחובר ל-`npm test`.
- `conflicts.js` נטול כיסוי בדיקות היום (`codebase/CONCERNS.md`); Phase 2 נוגע בו ישירות.
- שתי טבלאות חדשות נכנסות במחזור הזה (Phase 3, Phase 4). RLS נכתבת באותה מיגרציה שיוצרת את הטבלה, לא אחריה.
- Wave 3's visual/interactive checks (locked-tile legibility, lock/fairness-badge non-overlap, two-device swap-legality comparison, unconfigured-team no-visible-change) were not live-verified in the browser by the executor — structurally proven only. Needs decisive live-browser verification alongside wave 4's UI before phase close.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-26
Stopped at: פאזה 3 באמצע /gsd-execute-phase 3 — 3 מתוך 4 גלים מוזגו (03-01, 03-02, 03-03), מיגרציית 0006 רצה על ה-DB האמיתי. הבא: npm test / npm run build על main אחרי המיזוג, ניקוי worktree, שליחת גל 4 (03-04, עורך כשירויות ברוסטר + שער בוחר מבצעי משימה), ואז אימות דפדפן חי לגלים 3+4 יחד (טרם בוצע לפאזה 3), כתיבת 03-VERIFICATION.md, וסגירת הפאזה.
Resume file: .planning/phases/03-eligibility-model/03-04-PLAN.md
