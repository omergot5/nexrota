---
gsd_state_version: 1.0
current_phase: 03
current_phase_name: מודל כשירויות
status: planning
stopped_at: פאזה 2 הושלמה ואומתה בדפדפן בפועל — שלושת הגלים מוזגו, המיגרציה הורצה על ה-DB האמיתי, 02-VERIFICATION.md נכתב. פאזה 3 טרם תוכננה.
last_updated: "2026-08-26T00:00:00.000Z"
last_activity: 2026-08-26
last_activity_desc: Phase 02 complete and verified
state_head: 996793c
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-21)

**Core value:** אדם שמקבל את האפליקציה לידיו מסיים סידור שבועי מלא בלי שאף אחד יסביר לו כלום — ומה שהמערכת אומרת לו על עצמה הוא נכון.
**Current focus:** Phase 03 — מודל כשירויות

## Current Position

Phase: 02 (איחוד משימה ומשמרת) — COMPLETE
Plan: 3 of 3 complete
Status: Phase 02 complete — ready to plan Phase 03
Last activity: 2026-08-26 — Phase 02 אומתה בדפדפן: תג "מחוץ למנוע" על משימה קפואה בלבד, פיצול נספר/קפוא בדשבורד, נטל משימה (8 שעות) מופיע זהה בדשבורד ובדוחות. המיגרציה רצה על ה-DB האמיתי, 0 שורות מולאו לאחור.

Progress: [████░░░░░░] 40%

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

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- אין test runner בפרויקט. כל בדיקה חדשה חייבת להיות סקריפט Node עצמאי שמדפיס `ok`/`FAIL` ומחזיר קוד יציאה, מחובר ל-`npm test`.
- `conflicts.js` נטול כיסוי בדיקות היום (`codebase/CONCERNS.md`); Phase 2 נוגע בו ישירות.
- שתי טבלאות חדשות נכנסות במחזור הזה (Phase 3, Phase 4). RLS נכתבת באותה מיגרציה שיוצרת את הטבלה, לא אחריה.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-26
Stopped at: פאזה 2 הושלמה, אומתה בדפדפן ובמסד הנתונים החי, ו-02-VERIFICATION.md נכתב. פאזה 3 (מודל כשירויות) לא תוכננה עדיין.
Resume file: .planning/phases/02-task-shift-unification/02-VERIFICATION.md
