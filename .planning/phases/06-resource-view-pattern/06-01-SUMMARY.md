---
phase: 06-resource-view-pattern
plan: 01
subsystem: ui
tags: [react, tailwind, resource-grid, supervisor]

# Dependency graph
requires: []
provides:
  - "ResourceGrid.jsx — רכיב תצוגה גנרי יחיד לדפוס קטגוריה×יום, קורא ResourceGrid({ rows, dates, guards, firstColLabel })"
  - "ResourceView.jsx צורך את ResourceGrid במקום לצייר טבלה משלו — אותו default export ואותם שלושה props (guards, shifts, tasks)"
  - "קטע RESVIEW-03 ב-scripts/verify-resource-view.mjs שמוכיח מספר פריטים דינמי בתא (1/2/3/5/12) וסדר כרונולוגי"
affects: [06-02-rosterwizard-panel, 06-03-calendarview-weekgrid, 06-04-single-source-audit]

actuals:
  tokens: 6393
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "רכיב תצוגה גנרי אחד לדפוס קטגוריה×יום — קורא מקבל rows מוכן (buildResourceRows), הרכיב עצמו לא מפבט נתונים ולא מכיר מקור-נתונים"
    - "תחום הפעילות (mode) נקרא בתוך רכיב תצוגה מ-useSyncExternalStore(subscribeTerms, termProfile, termProfile) ולא מתקבל כפרופ — מונע סחיפה בין מסכים שקוראים לאותו רכיב"
    - "חוזה pending (row.pending / item.pending) מוגדר ברכיב המשותף לפני שהצרכן הראשון (06-02) זקוק לו"

key-files:
  created:
    - src/components/supervisor/ResourceGrid.jsx
  modified:
    - src/components/supervisor/ResourceView.jsx
    - scripts/verify-resource-view.mjs

key-decisions:
  - "D-04/D-02 נשמרו: הפיבוט (buildResourceRows) נשאר בקורא; ResourceGrid לא מייבא מ-lib/resourceView.js בכלל"
  - "D-07: mode נקרא בתוך ResourceGrid מ-subscribeTerms/termProfile, לא מועבר כפרופ — ResourceView עדיין קורא mode בעצמו כי buildResourceRows זקוק לו"
  - "שם היום בכותרת העמודה נגזר מהתאריך עצמו (DAYS_HE_SHORT[fromISODate(date).getDay()]) ולא מהאינדקס במערך dates — דורש תמיכה בטווחי תאריכים שלא מתחילים בראשון, נדרש כבר עכשיו לקראת 06-02/06-03"
  - "תג חוסר-איוש {יש}/{צריך} הועתק מ-WeekTimeGrid.jsx (EventContent) אל תוך ResourceGrid — תוספת מכוונת שכתובה בפירוט באובייקטיב התוכנית, מונעת אובדן מידע כש-06-03 ימחק את WeekTimeGrid"

patterns-established:
  - "Pattern: רכיב-תצוגה-משותף (presentational-only component) שמקבל rows/dates/guards מוכנים ולא נוגע במקור הנתונים — מיושם כאן, יאומץ ב-06-02/06-03"

requirements-completed: [RESVIEW-03]

coverage:
  - id: D1
    description: "ResourceGrid.jsx קיים, מייצא default ResourceGrid, וחוזה ה-API (rows/dates/guards/firstColLabel, בלי mode) תואם למפורט בתוכנית"
    requirement: "RESVIEW-03"
    verification:
      - kind: unit
        ref: "node -e inline check — mode not a prop, useSyncExternalStore present, no item cap (see verify block in 06-01-PLAN.md Task 1)"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "ResourceView.jsx צורך את ResourceGrid ולא מכיל אלמנט <table> משלו; אותו default export ואותם 3 props; EmptyState עדיין מחוץ ל-Card"
    requirement: "RESVIEW-03"
    verification:
      - kind: unit
        ref: "node -e inline check — ResourceGrid imported, no <table> element (see verify block in 06-01-PLAN.md Task 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "מספר פריטים דינמי בתא (1/2/3/5/12) בלי תקרה, וסדר כרונולוגי בתוך תא — RESVIEW-03/D-05 מוכח בצד הנתונים"
    requirement: "RESVIEW-03"
    verification:
      - kind: unit
        ref: "scripts/verify-resource-view.mjs — קטע RESVIEW-03 (7 בדיקות: 1,2,3,5 פריטים, קבוצת {1,2,3,5}, 12 פריטים, סדר כרונולוגי)"
        status: pass
      - kind: unit
        ref: "npm test (כל סקריפטי הבדיקה, כולל verify-resource-view.mjs)"
        status: pass
    human_judgment: false
  - id: D4
    description: "מבט משאבים נראה ומתנהג כמו לפני הפאזה בדפדפן — עמודה נעוצה, נקודת-גוון, שעות, 'לא משובץ', ניווט שבוע — בלי רגרסיה חזותית, פרט לתג חוסר-האיוש החדש"
    verification: []
    human_judgment: true
    rationale: "אין כלי דפדפן זמין לסביבת הביצוע הזו (אין preview_start/browser tool ברשימת הכלים). האקוויוולנטיות החזותית מגובה בכך שכל מחלקות Tailwind, מבנה ה-DOM וההתנהגות הועתקו מילה-במילה מ-ResourceView.jsx המקורי אל ResourceGrid.jsx (ר' דיף), אבל בדיקה אנושית בדפדפן (כמפורט ב-human-check של התוכנית) לא בוצעה בפועל ונדרשת לפני שהתוצר נחשב מאומת-קצה-לקצה."

duration: ~15min
completed: 2026-09-17
status: complete
---

# Phase 06 Plan 01: ResourceGrid extraction Summary

**חילוץ דפוס "קטגוריה×יום" מ-ResourceView.jsx לרכיב תצוגה גנרי `ResourceGrid.jsx`, ResourceView צורך אותו במקום לצייר טבלה משלו, ו-RESVIEW-03 (מספר פריטים דינמי בתא, בלי תקרה) מוכח בקטע בדיקות חדש שרץ בכל `npm test`.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-17
- **Tasks:** 2/2
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments
- `src/components/supervisor/ResourceGrid.jsx` — רכיב תצוגה גנרי יחיד לדפוס קטגוריה×יום, בלי fetching ובלי חישוב פיבוט משלו; חוזה ה-API סופי: `ResourceGrid({ rows = [], dates = [], guards = [], firstColLabel = "עמדה / קטגוריה" })` — **אין** prop בשם `mode`
- `ResourceView.jsx` הוחלף לצרוך את `ResourceGrid` — אין יותר `<table>` בקובץ; אותו default export ואותם שלושה props (`guards`, `shifts`, `tasks`) נשמרו במלואם
- קטע `RESVIEW-03` חדש ב-`scripts/verify-resource-view.mjs` מוכיח: ספירות 1/2/3/5 פריטים בתא (ארבע קטגוריות נפרדות), קבוצת הספירות `{1,2,3,5}` (אין יישור לתקרה משותפת), 12 משמרות בתא אחד מחזירות 12, וסדר כרונולוגי בתוך תא נגזר מהנתונים (לא מסדר ההזנה)

## Task Commits

1. **Task 1: חילוץ ResourceGrid.jsx והעברת ResourceView.jsx לצרוך אותו** - `e67bb02` (feat)
2. **Task 2: הוכחת RESVIEW-03 במנוע — קטע "מספר פריטים דינמי בתא"** - `48fe055` (test)

**Plan metadata:** (קומיט זה)

## Files Created/Modified
- `src/components/supervisor/ResourceGrid.jsx` — חדש. רכיב תצוגה גנרי: כותרת עמודות (שם יום נגזר מהתאריך, לא מהאינדקס), עמודה ראשונה נעוצה, נקודת-גוון+אייקון+שם קטגוריה, תג `בעריכה` כש-`row.pending`, תא-פריט עם שורת שעות/תג חוסר-איוש/שורת שמות, ומסלול `item.pending` נפרד (בלי tone/שמות/תג)
- `src/components/supervisor/ResourceView.jsx` — הטבלה הידנית (72 שורות) ו-`nameOf` הוסרו; מחזיק כעת רק PageHeader, ניווט שבוע (offset), `useMemo` על `buildResourceRows`, ומצב-ריק (`EmptyState`); קורא `<ResourceGrid rows={rows} dates={weekDates} guards={guards} />` בתוך אותו `Card className="p-0 overflow-hidden"`
- `scripts/verify-resource-view.mjs` — קטע RESVIEW-03 חדש (7 בדיקות חדשות) + תיקון הערה שהפנתה ל-`WeekTimeGrid` (עומד להימחק ב-06-03) לכיוון `calendarEvents.js`

## Decisions Made
- **חוזה ה-API של `ResourceGrid` תואם במדויק את המתואר בתוכנית**: `rows`, `dates`, `guards`, `firstColLabel` — ללא `mode`. תוכניות 06-02/06-03 יכולות לצרוך אותו כמו שהוא, בלי לערוך את הקובץ.
- **`row.pending` ו-`item.pending` מומשו כמתוכנן**: תג "בעריכה" ליד שם הקטגוריה (`row.pending`), ומסלול רינדור נפרד לפריט-בעריכה (`item.pending`) — בלי tone, בלי שמות, בלי תג חוסר-איוש, כי פריט כזה עדיין לא נשמר.
- ראו גם `key-decisions` בפרונטמאטר: שם-יום נגזר מהתאריך (לא מהאינדקס), ותג חוסר-האיוש הועתק מ-`WeekTimeGrid.jsx` כמניעת-רגרסיה לקראת 06-03.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. שני הרישומים האוטומטיים (`npm run build`, `npm test`) עברו בירוק בכל שלב, כולל אחרי כל שינוי.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-02 (פאנל-תצוגה ב-`RosterWizard.jsx`) ו-06-03 (`CalendarView.jsx` מחליף את `WeekTimeGrid.jsx`) יכולים לצרוך את `ResourceGrid.jsx` כמו שהוא — חוזה ה-API סופי ומתועד, כולל תמיכת `pending`.
- **פער ידוע לפני שהפאזה נסגרת**: אימות חזותי-חי בדפדפן ("מבט משאבים נראה זהה לקודם, פרט לתג חוסר-האיוש") **לא בוצע בפועל** בסביבת הביצוע הזו — אין כלי דפדפן זמין כאן. הקוד ב-`ResourceGrid.jsx` הוא העתקה מילה-במילה של המחלקות/המבנה מ-`ResourceView.jsx` המקורי (ר' דיף הקומיט `e67bb02`), אבל צעד ה-`human-check` המפורש בתוכנית עדיין פתוח וצריך שמישהו יריץ `npm run dev` ויבדוק עין מול המסך הקודם לפני ש-06-04 (ביקורת מקור-יחיד) נסגרת.
- `src/lib/resourceView.js` לא שונה כלל (D-02) — מאומת בדיף.

---
*Phase: 06-resource-view-pattern*
*Completed: 2026-09-17*
