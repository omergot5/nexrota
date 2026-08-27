---
gsd_state_version: 1.0
current_phase: 04
current_phase_name: עמדות קבועות
status: awaiting_discussion
stopped_at: Phase 04 context gathered
last_updated: "2026-08-27T06:55:54.372Z"
last_activity: 2026-08-26
last_activity_desc: Phase 03 closed — verified live in browser against real backend, ROADMAP/STATE updated, ready for Phase 4 discuss-phase
state_head: 4c4aac02b7793ed90480fcef186b1463ead3c52f
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 12
  completed_plans: 10
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-21)

**Core value:** אדם שמקבל את האפליקציה לידיו מסיים סידור שבועי מלא בלי שאף אחד יסביר לו כלום — ומה שהמערכת אומרת לו על עצמה הוא נכון.
**Current focus:** Phase 04 — עמדות קבועות

## Current Position

Phase: 04 (עמדות קבועות) — READY TO EXECUTE
Status: discuss-phase complete — 04-CONTEXT.md and 04-DISCUSSION-LOG.md written and committed. Ready for `/gsd-plan-phase 4`.
Last activity: 2026-08-26 — Discussed Phase 4: two position shapes (fixed-schedule "template" vs whole-week "no-hours"), both filled fully automatically by the engine (template via auto-assign-style constraint solving, no-hours via load-based rotation), qualification reuses Phase 3's qualifiedCategories unchanged, minimal dedicated screen here with the polished forward-looking board deferred to Phase 5.

Progress: [████████████░░░░░░░░] 60% (Phase 3 done, Phase 4 context ready)

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
| Phase 03-eligibility-model P04 | 35min | 2 tasks | 2 files |

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
- [Phase 03]: D-03 implemented at the UI edge: qualification editor normalises a complete or unchanged selection to null (unrestricted), never a materialised full list — confirmed live in both directions against the real backend.
- [Phase 03]: P-03 closed: the task assignee picker is now a hard, non-overridable qualification gate (qualBlocked), structurally separate from the existing overridable conflict boolean (blocked) — confirmed live.
- [Phase 03]: deliberate accepted consequence — a pre-existing task whose assignees were selected before anyone was narrowed can become un-savable once a supervisor narrows one of those assignees away from the task's category; no override, by design.
- [Phase 03]: Phase closed 2026-08-26 with 3 honestly-flagged gaps left to unit-test-only coverage (fresh-team zero-config first run; auto-assign/balance/swap-approval routes' live refusal; engine-level explainUnfilled label) — see 03-VERIFICATION.md "Outstanding, honestly unverified". None block phase closure.
- [Phase 04]: D-01: a standing position is one of two shapes chosen per-position at definition time — fixed day/hour ("template") or whole-week no-hours ("weekly") — not a single global model.
- [Phase 04]: D-02/D-03: both position shapes are filled fully automatically by the engine every week, no manager selection step — template positions via the same constraint-first fill autoAssign already uses, weekly positions via a fixed load-based rotation (whoever carried it least).
- [Phase 04]: D-04: position qualification reuses Phase 3's qualifiedCategories unchanged — not a separate qualification concept.
- [Phase 04]: D-05: Phase 4 builds only a minimal dedicated screen for POS-05 (who's qualified vs who's working this week); the polished forward-looking board view is explicitly Phase 5's BOARD-02.

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- אין test runner בפרויקט. כל בדיקה חדשה חייבת להיות סקריפט Node עצמאי שמדפיס `ok`/`FAIL` ומחזיר קוד יציאה, מחובר ל-`npm test`.
- `conflicts.js` נטול כיסוי בדיקות היום (`codebase/CONCERNS.md`); Phase 2 נוגע בו ישירות.
- טבלה חדשה נכנסת ב-Phase 4 (עמדות קבועות). RLS נכתבת באותה מיגרציה שיוצרת את הטבלה, לא אחריה.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-26T12:18:20.864Z
Stopped at: Phase 04 context gathered
Resume file: C:/Users/omerg/OneDrive - Ariel University/Desktop/claude projects/shd/.planning/phases/04-standing-positions/04-CONTEXT.md
