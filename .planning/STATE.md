---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: גימור להשקה
current_phase: 8
current_phase_name: בניית שבוע (שינוי שם) + תמונת מצב שבועית
status: planning
stopped_at: Completed 08-01, 08-02, 08-03 PLAN.md (all Wave 1 plans executed and merged; 08-03's browser human-check not performed, no browser tooling in that executor's environment)
last_updated: "2026-09-22T12:38:27.207Z"
last_activity: 2026-09-22
last_activity_desc: Phase 8 all three plans executed and merged; ready for code review
state_head: b436d295099f217c84b7622309e2faa05eaff1e1
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17)

**Core value:** אדם שמקבל את האפליקציה לידיו מסיים סידור שבועי מלא בלי שאף אחד יסביר לו כלום — ומה שהמערכת אומרת לו על עצמה הוא נכון.
**Current focus:** Phase 07 — צבעים וסדר משמרות

## Current Position

Phase: 8 — בניית שבוע (שינוי שם) + תמונת מצב שבועית
Plan: 3/3 executed, code review pending
Status: Executing
Last activity: 2026-09-22 — Phase 8 all three Wave-1 plans executed and merged

Progress: [███░░░░░░░] 25% (v1.2)

## Performance Metrics

**Velocity:**

- Total plans completed: 13 (tracked)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 04 | 2 | - | - |
| 05 | 5 | - | - |
| 06 | 4 | - | - |
| 07 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 06 P01 | 15min | 2 tasks | 3 files |
| Phase 08 P01 | 15min | 1 tasks | 1 files |
| Phase 08 P02 | 55min | 2 tasks | 1 files |
| Phase 08 P03 | unknown | 2 tasks | 2 files |

## Accumulated Context

### Decisions

- [v1.2 roadmap]: סדר הפאזות 6→13 מוכתב ע"י המפרט החיצוני (`shift-app-spec-for-claude-code.md`) ולא נגזר מחדש. Phase 6 קובעת דפוס עיצוב ש-7 ו-8 מאמצות; Phase 11 מייצרת את הפעולות ההרסניות ש-12 מחברת לאישור.
- [v1.2 roadmap]: 8 פאזות למרות `granularity: standard` (4-6) — איחוד היה שובר את ההתאמה 1:1 בין פאזה לנושא במפרט, ואת הנחיית ה-commit-per-topic שבו.
- v1.1 decision log: PROJECT.md Key Decisions + `.planning/milestones/v1.1-ROADMAP.md`.
- [Phase 6]: 06-01: ResourceGrid.jsx חולץ כרכיב תצוגה גנרי יחיד (D-04); mode נקרא בתוך הרכיב מ-subscribeTerms/termProfile, לא כפרופ (D-07); חוזה row.pending/item.pending קיים לפני 06-02
- [Phase 8]: 08-01: רק PROFILE_TERMS.army["nav.shifts"] שונה ל-"בניית שבוע"; BASE["nav.shifts"] (עם ה' הידיעה) נשאר ללא שינוי כפי שנעול ב-08-CONTEXT.md.
- [Phase 8]: 08-02: הלוח (UnifiedBoard) יושב עכשיו בשלב 1 (מיד אחרי בניית שבוע), לא שלב 0 — הזזה שכללה גם רילוקציה של gate ה-hasShifts ושכתוב מצב-הריק של הלוח שכבר לא קורא בשם כפתור, ואומת חי בדפדפן ולא רק בקוד
- [Phase 8]: 08-03: onRowClick אופציונלי נוסף ל-ResourceGrid.jsx (ResourceView.jsx/CalendarView.jsx נשארים ללא שינוי, לא מעבירים אותו); RosterWizard.jsx מוסיף תצוגה ממוקדת לעמדה בודדת + טוגל "מה שיש עד עכשיו" — שני הפיצ'רים לא נוגעים בשלב ה-board כלל

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- **[v1.2 Phase 12] סתירה לעקרון ברזל קיים.** `CLAUDE.md` עקרון 3 קובע "ביטול במקום אישור — בלי `confirm()`"; בעל המוצר הפך זאת במפורש לפעולות הרסניות. Phase 12 חייבת להכריע אילו פעולות עוברות לאישור-מראש ואילו נשארות ב-`UndoBar`, ולעדכן את `CLAUDE.md` + `PROJECT.md` בהתאם.
- **[v1.2 Phase 8] ✓ הוכרע מחדש (2026-09-22).** `UnifiedBoard.jsx` אינו מסך נפרד — הוא שלב 0 בתוך `WeekFlow.jsx` עצמה (`STEP_OF`: board→shifts→availability→assign→schedule). ההחלטה: להזיז את שלב `board` להיות **אחרי** `shifts`, לא לפניו — לא לבנות מסך/רכיב חדש ולא לשנות שם ל-UnifiedBoard. ר' ROADMAP.md Phase 8 לפירוט.
- **[v1.2 Phase 12→13] CONFIRM-04 מחברת פעולה שבורה.** "ביטול הפצה" עדיין באג בזמן Phase 12; Phase 13 חייבת לאמת מחדש דרך הדיאלוג, לא במעקף שלו.
- אין test runner בפרויקט. כל בדיקה חדשה חייבת להיות סקריפט Node עצמאי שמדפיס `ok`/`FAIL` ומחזיר קוד יציאה, מחובר ל-`npm test`. רלוונטי ישירות ל-BUG-04.
- ⚠️ [v1.1] Phases 1-3's VERIFICATION.md files predate the current `status:` frontmatter contract — GSD tooling reports them "missing" on format alone; carried forward as a known override (see MILESTONES.md v1.1 entry). Consider backfilling frontmatter early in this milestone.
- ⚠️ [v1.1] Pre-existing NUL-byte separator in `conflicts.js`'s `pairKey` — acknowledged tech debt, no observed impact (see Deferred Items below).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260903-wx1 | Add a real center dividing line to the AuthPage split layout | 2026-09-03 | (pending) | [260903-wx1-add-a-real-center-dividing-line-to-the-a](./quick/260903-wx1-add-a-real-center-dividing-line-to-the-a/) |
| 260904-bal | Fix balanceWorkload oscillation bug + misleading "16 · כולל 40 העברות" KPI copy | 2026-09-04 | (pending) | — (direct fix, no quick-task dir; see commit for detail) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| deferred_items | 02/deferred-items.md: Pre-existing NUL bytes in conflicts.js pairKey (no observed impact; would touch byte-identical UNIF-06 verification bytes) | acknowledged | 2026-09-03 | v1.1 |

## Session Continuity

Last session: 2026-09-22T12:38:27.207Z
Stopped at: Completed 08-01, 08-02, 08-03 PLAN.md (all Wave 1 plans executed, ready for code review)
Resume file: None

## Operator Next Steps

- Plan the first phase with `/gsd-plan-phase 6`
- Phase 6 carries a UI hint — consider `/gsd-ui-phase 6` first (it establishes the design pattern Phases 7 and 8 inherit)
