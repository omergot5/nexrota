---
phase: 10-more-menu-audit
plan: 01
subsystem: ui
tags: [react, dashboard, navigation]

# Dependency graph
requires:
  - phase: 09-rest-hours-and-demo-cleanup
    provides: SupDashboard in its post-Phase-9 layout (rest-hours card removed) — the audit surface MORE-02 targets
provides:
  - "כרטיס 'עומס' ב-SupDashboard מציג קישור 'לדוח המלא' שמנווט ל-analytics"
affects: [10-more-menu-audit (10-03 audit table depends on this shortcut existing), SupervisorApp.jsx dashboard]

# Actuals (#2632)
actuals:
  tokens: 290
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dashboard card CTA-link pattern: Btn variant=\"ghost\" size=\"sm\" icon=\"left\" + onClick={() => onNavigate(\"target\")}, right-aligned in a mt-4 flex justify-end wrapper below card content — matches the existing outline-variant pattern used for \"לבניית השבוע\"."

key-files:
  created: []
  modified:
    - src/components/supervisor/views.jsx

key-decisions:
  - "Link shown unconditionally (not gated on loadRows.length) — the full report exists even when there's no load data yet to preview."
  - "No positions shortcut added — locked decision in 10-CONTEXT.md MORE-02, reaffirmed by an automated grep gate."

patterns-established:
  - "Dashboard shortcut links use ghost-variant Btn (not outline) to read as secondary in-card actions, distinct from primary card-header CTAs."

requirements-completed: [MORE-02]

coverage:
  - id: D1
    description: "כרטיס 'עומס' ב-SupDashboard מציג קישור 'לדוח המלא' שקורא ל-onNavigate(\"analytics\")"
    requirement: "MORE-02"
    verification:
      - kind: unit
        ref: "inline node -e grep gate: SupDashboard body contains onNavigate(\"analytics\") and label 'לדוח המלא'"
        status: pass
      - kind: manual_procedural
        ref: "coordinator live-verified via guest-demo flow (7 guards, 14 shifts): link visible, click navigates to Analytics ('דוחות') screen"
        status: pass
    human_judgment: false
  - id: D2
    description: "שני קיצורי הדרך הקיימים (StatCard חילופים→swaps, StatCard משימות פתוחות→tasks) לא נפגעו"
    requirement: "MORE-02"
    verification:
      - kind: unit
        ref: "inline node -e grep gate: exactly one onNavigate(\"swaps\") and exactly one onNavigate(\"tasks\") in SupDashboard body"
        status: pass
      - kind: manual_procedural
        ref: "coordinator live-verified: both StatCards still navigate correctly"
        status: pass
    human_judgment: false
  - id: D3
    description: "לא נוסף קיצור-דרך ל-positions בשום מקום ב-SupDashboard (הוכרע נגד ב-10-CONTEXT.md)"
    requirement: "MORE-02"
    verification:
      - kind: unit
        ref: "inline node -e grep gate: onNavigate(\"positions\") absent from SupDashboard body"
        status: pass
      - kind: manual_procedural
        ref: "coordinator live-verified: no new positions shortcut appears anywhere on the Dashboard"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-09-22
status: complete
---

# Phase 10 Plan 01: קישור "לדוח המלא" מכרטיס "עומס" Summary

**כרטיס "עומס" ב-SupDashboard מקבל קישור "לדוח המלא" (Btn ghost, שורה נפרדת מתחת לרשימת השורות) שמנווט ל-`onNavigate("analytics")` — קיצור-הדרך היחיד שהוכרע עליו ב-10-CONTEXT.md MORE-02.**

## Performance

- **Duration:** ~15min
- **Started:** 2026-09-22T20:20:00Z (approx)
- **Completed:** 2026-09-22T20:38:42Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- הוסף קישור "לדוח המלא" (`Btn variant="ghost" size="sm" icon="left"`) בתוך כרטיס "עומס ה{חברים}" ב-`SupDashboard`, קורא ל-`onNavigate("analytics")`.
- הקישור מוצג ללא תנאי — לא תלוי ב-`loadRows.length` — עוטף ב-`div.mt-4.flex.justify-end` כדי לשבת כשורה נפרדת מתחת לרשימת השורות/הודעת מצב-ריק, לפני `</Card>`.
- שני ה-`StatCard`ים הקיימים (חילופים→swaps, משימות פתוחות→tasks) לא נערכו כלל.
- לא נוסף שום קיצור ל-`positions` — לא ב-`SupDashboard` ולא ב-`moreItems()`/`views` map ב-`SupervisorApp.jsx` (שלא נגעו בו כלל, כמתוכנן — זו תוכנית 10-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: קישור "לדוח המלא" מכרטיס "עומס" ← analytics (MORE-02)** - `53969d1` (feat)

_Note: single-task tracer plan — no TDD, no multi-commit split._

## Files Created/Modified
- `src/components/supervisor/views.jsx` - הוסף קישור ניווט חדש בכרטיס העומס של `SupDashboard`

## Decisions Made
- הקישור מוצג תמיד (לא מותנה ב-`loadRows.length`) כי הדוח המלא קיים גם כשאין עדיין נתוני עומס להציג בתצוגה המצומצמת.
- וריאנט `ghost` (לא `outline`) נבחר כדי לסמן שזה קישור משני בתוך תוכן כרטיס, לא CTA ראשי כמו "לבניית השבוע".

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. כל שלושת שערי ה-grep האוטומטיים, `npm test`, ו-`npm run build` עברו בריצה ראשונה.

## Tracer Feedback Gate

התוכנית הכילה משימה יחידה מסוג `tracer`. auto-advance לא היה פעיל (`workflow.auto_advance: false`), ולכן לאחר הקומיט הריצה נעצרה בצ'קפוינט `checkpoint:human-verify` לפני סגירת התוכנית, כנדרש בפרוטוקול. הרכז ביצע את האימות החי בדפדפן בעצמו (guest-demo, 7 כפופים, 14 משמרות) ואישר את כל חמש נקודות ה-`human-check`:

1. כרטיס "עומס" מציג את הקישור "לדוח המלא" ✓
2. לחיצה עליו מנווטת למסך הדוחות המלא ("דוחות") ✓
3. StatCard "חילופים" עדיין מנווט לניהול החלפות ✓
4. StatCard "משימות פתוחות" עדיין מנווט לניהול משימות ✓
5. אין קיצור חדש ל"עמדות קבועות" בשום מקום בדשבורד ✓

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- MORE-02 מתקיים: הקיצור היחיד שהומלץ ב-10-CONTEXT.md נוסף ומוביל בפועל ל-analytics (קריטריון הצלחה 2, Phase 10 ROADMAP).
- 10-03-PLAN.md (MORE-01, עיגון טבלת הביקורת) יכול להסתמך על הקיצור הזה כקיים ומאומת בעת כתיבת הטבלה.
- הקומיט `53969d1` כבר מוזג ל-`main` (fast-forward, בוצע ע"י הרכז), יחד עם ענף 10-02.

---
*Phase: 10-more-menu-audit*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: src/components/supervisor/views.jsx
- FOUND: 53969d1
