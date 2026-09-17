---
phase: 06-resource-view-pattern
plan: 03
subsystem: ui
tags: [react, tailwind, resource-grid, supervisor, calendar]

# Dependency graph
requires:
  - phase: 06-01
    provides: "ResourceGrid.jsx — רכיב תצוגה גנרי יחיד לדפוס קטגוריה×יום, קורא ResourceGrid({ rows, dates, guards, firstColLabel })"
provides:
  - "CalendarView.jsx — תצוגת השבוע ('שבוע') מרונדרת דרך <ResourceGrid rows={weekRows} dates={dates} guards={guards} />, לא דרך react-big-calendar"
  - "WeekTimeGrid.jsx ו-WeekTimeGrid.css נמחקו מהעץ; react-big-calendar אינו מיובא בשום קובץ UI (src/components, src/design)"
  - "lazy()/Suspense/Spinner הוסרו לגמרי מ-CalendarView.jsx — אין עוד גבול טעינה מדומה מעל תצוגת השבוע"
affects: [06-04-single-source-audit]

actuals:
  tokens: 6121
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "תצוגת השבוע ביומן היא עכשיו הצרכן השלישי (אחרי ResourceView ו-RosterWizard) של דפוס ResourceGrid, לא מסלול רינדור נפרד משלה"

key-files:
  created: []
  modified:
    - src/components/supervisor/CalendarView.jsx
    - src/components/supervisor/UnifiedBoard.jsx
    - src/design/categoryPalette.js
    - src/components/supervisor/ResourceGrid.jsx

key-decisions:
  - "J-1 (מהתוכנית): lazy()/Suspense ירדו לגמרי במקום להישמר סביב ResourceGrid — אחרי ההחלפה react-big-calendar לא נטען בכלל, כך שהמטרה המקורית של ה-lazy (לא להעמיס 190KB gzip על מי שלא מגיע לשבוע) מושגת בצורה חזקה יותר; ResourceGrid הוא רכיב קטן בלי תלויות חיצוניות שכבר טעון בחבילה הראשית דרך ResourceView, אז Suspense עליו רק היה מהבהב ספינר על מודול קיים"
  - "J-4 (מהתוכנית): calendarEvents.js, verify-calendar-events.mjs, ותלויות react-big-calendar/dayjs ב-package.json נשארים בכוונה — Phase 8 (WEEKBUILD-05) היא נקודת ההכרעה להסרתם, לא הפאזה הזו"
  - "חריגה מתועדת מ-D-04: שני קטעי הערה ב-ResourceGrid.jsx (שורות 6, 123 — נכתבו ב-06-01 בהתייחסות צופה-פני-עתיד ל-06-03) הוזזו מהמחרוזת המילולית 'WeekTimeGrid.jsx' לניסוח שאינו תלוי בקובץ שנמחק. ראו 'סטיות מהתוכנית' למטה — רק תוכן ההערה שונה, אפס שינוי JSX/לוגיקה."

patterns-established:
  - "Pattern: רכיב-תצוגה-משותף (ResourceGrid, מ-06-01) הוא כעת נקודת המפגש היחידה של שלושה מסכים (ResourceView, RosterWizard, CalendarView) — כל שינוי עתידי לדפוס קטגוריה×יום קורה במקום אחד"

requirements-completed: [RESVIEW-02, RESVIEW-03]

coverage:
  - id: D1
    description: "CalendarView.jsx מרנדר <ResourceGrid rows={weekRows} dates={dates} guards={guards} /> בענף mode === 'week'; weekRows נבנה מ-buildResourceRows({ shifts, tasks, weekDates: dates, mode: teamMode })"
    requirement: "RESVIEW-02"
    verification:
      - kind: unit
        ref: "node -e inline check — ResourceGrid rendered, no lazy(/Suspense/Spinner, MonthGrid/DayList/coverageOf/TONE_VARS intact, weekDates wired to dates (06-03-PLAN.md Task 1 verify block)"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "אימות חי בדפדפן: תצוגת שבוע נראית כמו מבט-משאבים (טבלה, עמודה נעוצה, כותרות יום, תג {יש}/{צריך} על משמרת חסרת-איוש); ניווט הקודם/הבא מעדכן את הטבלה; תצוגות חודש ויום ממשיכות לעבוד; אין הבהוב ספינר"
    requirement: "RESVIEW-02"
    verification:
      - kind: automated_ui
        ref: "gstack /browse (headless $B), דמו-team מקומי http://localhost:3000 — screenshot בשם 'week-with-data' (שבוע 20–26/9, 14 משמרות, 3 שורות ליום, תג 0/1 אדום + 'לא משובץ'), 'month-view' (רשת 7×6, 17/9 מסומן כהיום), 'day-view-data2' (רשימת 2 פריטים ל-20/9 עם 'חסרים 1' ו-'פורסם')"
        status: pass
    human_judgment: false
  - id: D3
    description: "אין מצב-ריק כפול בענף השבוע — ה-EmptyState היחיד הוא זה שבתחתית הרכיב (shown.length === 0 && mode !== 'day')"
    requirement: "RESVIEW-02"
    verification:
      - kind: automated_ui
        ref: "screenshot 'week-view.jpg' (שבוע 13–19/9, 0 משמרות) — הוצג EmptyState אחד בלבד, בלי תוכן ריק כפול בתוך ה-Card"
        status: pass
    human_judgment: false
  - id: D4
    description: "WeekTimeGrid.jsx/.css נמחקו; git grep על src ו-scripts נקי לגמרי מ-'WeekTimeGrid', כולל הערות; אין ייבוא react-big-calendar בשכבת ה-UI"
    requirement: "RESVIEW-03"
    verification:
      - kind: unit
        ref: "git grep -n WeekTimeGrid -- src scripts (exit 1, אפס תוצאות); git grep -l react-big-calendar -- src/components src/design (exit 1, אפס תוצאות)"
        status: pass
      - kind: unit
        ref: "npm test (428 בדיקות ok, exit 0)"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D5
    description: "categoryPalette.js: TONE_VARS/TONE_CLASSES/categoryTone זהים ביט-בביט להתנהגות הקודמת — רק ההערה מעל TONE_VARS שונתה (D-06)"
    requirement: "RESVIEW-03"
    verification:
      - kind: unit
        ref: "node -e inline check — TONE_VARS/TONE_CLASSES/categoryTone/cat-red/faint כולם קיימים (06-03-PLAN.md Task 2 verify block); git diff מציג רק שינוי הערה"
        status: pass
    human_judgment: false
---

# Phase 06 Plan 03: תצוגת השבוע ביומן עוברת ל-ResourceGrid — Summary

**תצוגת השבוע ב-`CalendarView.jsx` עברה מ-`WeekTimeGrid.jsx` (עטיפת react-big-calendar עם ציר שעות) ל-`ResourceGrid` המשותף (מ-06-01) — אותה טבלת קטגוריה×יום שכבר קיימת ב"מבט משאבים"; הרכיב שהוחלף וגיליון הסגנונות שלו נמחקו, וה-`lazy()`/`Suspense` ירדו לגמרי כי react-big-calendar כבר לא נטען בכלל.**

## Performance

- **Duration:** כ-1 שעה 45 דקות (כולל הפסקת-ביניים בין המשימות עקב rate-limit של הסשן; הביצוע עצמו רציף)
- **Tasks:** 2/2
- **Files modified:** 5 (CalendarView.jsx, UnifiedBoard.jsx, categoryPalette.js, ResourceGrid.jsx, ומחיקת שני קבצים — WeekTimeGrid.jsx/.css)

## Accomplishments
- תצוגת השבוע ביומן מציגה עכשיו את אותה טבלת עמדה/קטגוריה × יום כמו "מבט משאבים" — עמודה נעוצה מימין, כותרות יום עם תאריך, תא-פריט עם תג חוסר-איוש
- `WeekTimeGrid.jsx` (194 שורות) ו-`WeekTimeGrid.css` (81 שורות) נמחקו; react-big-calendar לא נטען יותר בכלל, לא רק ב-lazy
- שני מצבי-ריק מתחרים נמנעו במפורש: ענף השבוע לא בונה EmptyState משלו, רק ה-EmptyState הקיים בתחתית הרכיב
- תצוגות חודש ויום (MonthGrid/DayList) לא נגעו — אומת חי בדפדפן

## Task Commits

1. **Task 1: תצוגת השבוע ביומן עוברת ל-ResourceGrid** — `cafffa6` (feat)
2. **Task 2: מחיקת הרכיב שהוחלף וניקוי ההפניות שנותרו** — `e0c95d0` (feat)

**Plan metadata:** commit יבוצע בסוף (docs) — ראו STATE.md/ROADMAP.md שמתעדכנים על ידי התזמור המרכזי

## Files Created/Modified
- `src/components/supervisor/CalendarView.jsx` — ענף `mode === "week"` מרנדר `ResourceGrid`; `weekRows` מחושב מ-`buildResourceRows`; `lazy`/`Suspense`/`Spinner` הוסרו; `overflow-hidden` נוסף ל-Card; הערת WeekStrip עודכנה
- `src/components/supervisor/WeekTimeGrid.jsx` — **נמחק** (194 שורות)
- `src/components/supervisor/WeekTimeGrid.css` — **נמחק** (81 שורות)
- `src/components/supervisor/UnifiedBoard.jsx` — רק הערה שונתה (שורה ~171), אפס שינוי קוד
- `src/design/categoryPalette.js` — רק הערת התיעוד מעל `TONE_VARS` שונתה, `TONE_VARS`/`TONE_CLASSES`/`categoryTone` זהים
- `src/components/supervisor/ResourceGrid.jsx` — שני קטעי הערה שונו (ר' "סטיות מהתוכנית"); ה-JSX/לוגיקה של הרכיב לא נגעו

## Decisions Made
- **J-1 (lazy יורד):** תועד בפירוט בתוכנית ואומת: react-big-calendar לא נטען כלל אחרי ההחלפה (אין chunk נפרד בפלט `npm run build` — היה `WeekTimeGrid` chunk נפרד לפני, נעלם אחרי Task 1). ה-`lazy()`/`Suspense`/`Spinner` הוסרו לגמרי, לא נשמרו סביב `ResourceGrid`.
- **J-4 (לא בסקופ):** `src/lib/calendarEvents.js`, `scripts/verify-calendar-events.mjs`, ו-`react-big-calendar`/`dayjs` ב-`package.json` נשארים בעץ ללא צרכן — מועמדים להכרעה ב-Phase 8 (WEEKBUILD-05), לא נמחקו כאן.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking, ניסוח-הערה בלבד] עדכון שני קטעי הערה ב-`ResourceGrid.jsx` שאינם ברשימת הקבצים של התוכנית**
- **Found during:** Task 2, בזמן הרצת שער האימות האוטומטי `git grep -n WeekTimeGrid -- src scripts`
- **הבעיה:** `ResourceGrid.jsx` (נוצר ב-06-01, לא ברשימת `files_modified` של 06-03, ותחת D-04 "אסור לערוך את ResourceGrid.jsx") מכיל שני קטעי הערה שכותבים את השם `WeekTimeGrid.jsx` במפורש — נכתבו ב-06-01 כתיעוד צופה-פני-עתיד להחלפה הזו. שער האימות של Task 2 (`git grep` על `src`+`scripts`, "כולל הערות" לפי קריטריון הקבלה) חוסם השלמה כל עוד המחרוזת קיימת בכל קובץ בעץ, כולל זה.
- **הכרעה:** D-04 חל במפורש על JSX/לוגיקה ("אסור לשכפל JSX ואסור לערוך"), לא על ניסוח פרוזה בהערה שמתייחסת לקובץ שהתוכנית הזו עצמה מוחקת. קריטריון הקבלה של Task 2 ("git grep... כולל הערות") גובר במפורש על השארת הפניה משקרת בהערה. תוקן במינימום: שתי מחרוזות "WeekTimeGrid.jsx" הוחלפו בניסוח שאינו תלוי בשם קובץ ("הרכיב הישן מבוסס-הספרייה-החיצונית", "הרכיב הישן שהוחלף") — אפס שינוי ב-JSX, ב-props, בלוגיקה, או בהתנהגות הרכיב.
- **Files modified:** `src/components/supervisor/ResourceGrid.jsx` (שורות 6, 123 — הערות בלבד)
- **Verification:** `git grep -n WeekTimeGrid -- src scripts` מחזיר אפס תוצאות (exit 1); `git diff` על הקובץ מציג רק שינויי הערה; `npm run build` ו-`npm test` עוברים אחרי השינוי
- **Committed in:** `e0c95d0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, ניסוח-הערה בלבד, ללא שינוי JSX/לוגיקה)
**Impact on plan:** מזערי — תיקון טקסט הערה בקובץ שאסור לערוך ברמת ה-JSX/לוגיקה שלו, נדרש כדי לספק את קריטריון הקבלה המפורש של Task 2 עצמה. אין סטייה אדריכלית, אין שכפול, אין שינוי התנהגות.

## Issues Encountered
- **RLS ב-`gs_work_item_assignments` בזמן אימות חי:** בזמן הפעלת דמו לצורך בדיקה חזותית, הרצת "החל את השיבוץ הזה" (auto-assign apply) נכשלה עם `new row violates row-level security policy for table "gs_work_item_assignments"` — לא קשור לשינויי התוכנית הזו (RLS/הרשאות Supabase של סביבת הדמו). לא נגע בקוד המוצר; נעקף על ידי אימות ישירות מול נתוני משמרות שכבר נוצרו (14 משמרות לשבוע 20–26/9) בלי לעבור דרך שלב ה"החל".
- שגיאות רשת `429`/`401` בקונסול הדפדפן בזמן האימות החי — קשורות ל-rate-limiting/auth של מופע Supabase האמיתי שהאימות רץ מולו, לא לשינויי הקוד. לא נדרשה פעולה.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- שלושה מסכים (ResourceView, RosterWizard מ-06-02, CalendarView) צורכים כעת את אותו `ResourceGrid` — 06-04 (ביקורת מקור-אחד) יכולה לאמת שלושתם יחד
- `react-big-calendar`/`dayjs` ו-`calendarEvents.js` נשארים כמועמדים מתועדים להכרעה ב-Phase 8; אין חסם על התקדמות
- אין בעיות פתוחות שחוסמות את 06-04

---
*Phase: 06-resource-view-pattern*
*Completed: 2026-09-17*

## Self-Check: PASSED

- FOUND: `src/components/supervisor/CalendarView.jsx`
- FOUND: `src/components/supervisor/WeekTimeGrid.jsx` deleted (not present in worktree)
- FOUND: `src/components/supervisor/WeekTimeGrid.css` deleted (not present in worktree)
- FOUND: `src/components/supervisor/UnifiedBoard.jsx`
- FOUND: `src/design/categoryPalette.js`
- FOUND: `src/components/supervisor/ResourceGrid.jsx`
- FOUND: commit `cafffa6` (Task 1)
- FOUND: commit `e0c95d0` (Task 2)
- `npm run build`: pass
- `npm test`: pass (428 ok, exit 0)
