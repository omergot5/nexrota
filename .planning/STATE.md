---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: גימור להשקה
current_phase: 9
current_phase_name: לוח זמן מנוחה + כפתור הדגמה מפורש
status: planning
stopped_at: Phase 8 complete — verified 5/5, transitioned to Phase 9
last_updated: "2026-09-22T13:10:00.000Z"
last_activity: 2026-09-22
last_activity_desc: Phase 8 verified passed (5/5 success criteria); code review fixes applied and live-verified; transitioned to Phase 9
state_head: 4a390b679f1417293c249bf729ae116511bb1a80
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
  percent: 38
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17)

**Core value:** אדם שמקבל את האפליקציה לידיו מסיים סידור שבועי מלא בלי שאף אחד יסביר לו כלום — ומה שהמערכת אומרת לו על עצמה הוא נכון.
**Current focus:** Phase 07 — צבעים וסדר משמרות

## Current Position

Phase: 9 — לוח זמן מנוחה + כפתור הדגמה מפורש
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-22 — Phase 8 verified passed (5/5), transitioned to Phase 9

Progress: [████░░░░░░] 38% (v1.2)

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
- **[v1.2 Phase 8] ✓ הושלם ואומת (2026-09-22).** שלושת התוכניות מוזגו, code review עלה 3 אזהרות (WR-01/02/03) שתוקנו ואומתו לייב בדפדפן, ו-`gsd-verifier` אישר 5/5 קריטריוני הצלחה. `UnifiedBoard.jsx` נשאר באותו שם, רק זז לשלב אחרי `shifts`.
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

Last session: 2026-09-22T13:10:00.000Z
Stopped at: Phase 8 complete (verified 5/5); transitioned to Phase 9
Resume file: None

## Operator Next Steps

- Plan Phase 9 with `/gsd-plan-phase 9`
- Phase 9 carries a UI hint — consider `/gsd-ui-phase 9` first
- Phase 9 removes the "זמן מנוחה" board from the main Dashboard and moves it into "הכפופים לי"/"הצוות שלי", and replaces silent demo-data seeding with an explicit "הדגמה" button + parameter dialog (REST-01..04)
