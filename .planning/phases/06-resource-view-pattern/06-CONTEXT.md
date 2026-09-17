# Phase 6: מבט משאבים כאב-טיפוס עיצובי - Context

**Gathered:** 2026-09-17
**Status:** Ready for planning
**Mode:** Smart discuss (batch grey-area proposals, all recommended answers accepted)

<domain>
## Phase Boundary

מנהל שעובר בין "מבט משאבים", "בניית שבוע" והמבט השבועי ביומן רואה את אותה שפה חזותית — שורת עמדה/קטגוריה → עמודות יום → פריטים (שעה + שמות) — ולא מרגיש שהוא עבר לאפליקציה אחרת. הפאזה קובעת את הדפוס; פאזות 7 ו-8 מאמצות אותו, לא ממציאות משלהן.

</domain>

<decisions>
## Implementation Decisions

### היקף ההחלפה ב"מבט שבועי" ביומן
- `WeekTimeGrid.jsx` (react-big-calendar, ציר-שעות אנכי, 194 שורות + 81 שורות CSS) מוחלף במבנה טבלה קטגוריה×יום כמו "מבט משאבים" — לא רק restyle.
- RBC נשאר בשימוש בתצוגות חודש/יום של `CalendarView.jsx` — רק תצוגת השבוע (`WeekTimeGrid` הנוכחי) מוחלפת.
- הבסיס: `src/lib/resourceView.js` (`buildResourceRows`) כבר פותר את הפיבוט קטגוריה↔תאריך על גבי `boardItemsForDates` (dates.js) — לא לבנות מיזוג נתונים חדש.

### מיקום התצוגה בתוך "בניית שבוע"
- הגריד החדש מתווסף כפאנל-תצוגה/preview חדש בתוך `RosterWizard.jsx`, **לצד** טופס עריכת העמדות הקיים — לא מחליף אותו.
- טופס העריכה נשאר כי עריכה inline בתוך הגריד עצמו היא Phase 11 (INLINE-01), לא הפאזה הזו.

### שיתוף קוד בין שלושת המסכים
- לחלץ קומפוננטת גריד גנרית אחת (position/category × day, עם תא שמציג רשימת פריטים ממוינת: שעה + שמות) שמשמשת את שלושתם: `ResourceView.jsx`, פאנל התצוגה ב-`RosterWizard.jsx`, ותצוגת-השבוע החדשה ב-`CalendarView.jsx`.
- לא לשכפל JSX/CSS דומה בשלושה מקומות — זו בדיוק הבעיה שהמחזור הזה סוגר.

### מספר משמרות דינמי (RESVIEW-03)
- הרכיב תומך במספר פריטים דינמי בכל תא (לא הרדקוד ל-3 או ל-4) — `buildResourceRows` כבר לא מניח מספר קבוע, זו כבר עובדה בקוד הקיים; הפאזה רק מוודאת שהקומפוננטה הגנרית החדשה יורשת את אותה גמישות ולא מציגה N עמודות-משמרת קבועות.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/resourceView.js` `buildResourceRows({shifts, tasks, weekDates, mode})` — מנוע טהור קיים, מחזיר `{category, icon, days: [{date, items}]}[]`, ממוין וקיבוץ מוכנים. לא נוגעים בו אלא אם צריך להרחיב אותו לצריכה גם מ-RosterWizard/CalendarView (כרגע הוא כבר גנרי מספיק לשניהם).
- `src/components/supervisor/ResourceView.jsx` — אב-הטיפוס החזותי המאושר: טבלה עם עמודה ראשונה נעוצה (`sticky right-0`), גלילה אופקית עצמאית, `categoryTone`/`TONE_CLASSES` מ-`src/design/categoryPalette.js` לצביעת רקע/מסגרת לפי קטגוריה, `data-numeric` על טווחי שעות.
- `src/components/supervisor/WeekTimeGrid.jsx` + `WeekTimeGrid.css` — הרכיב המוחלף (RBC). `CalendarView.jsx` טוען אותו lazy (שורה 14, `lazy(() => import(...))`) — שמור על אותו lazy-loading pattern ברכיב החדש.

### Established Patterns
- תחום הפעילות (civil/army/security) מוחל מ-`useGuardian`/`subscribeTerms`/`termProfile` (terms.js), לא מפרופ — `ResourceView` כבר עושה זאת נכון (שורות 18-23), הרכיב הגנרי החדש חייב לשמר את אותו מקור אמת.
- `categoryTone`/`TONE_CLASSES` (`src/design/categoryPalette.js`) הוא מנגנון הצביעה הקיים שנשאר כמו שהוא — **לא** מנגנון הצבעים החדש שנבנה ב-v1.2 Phase 7 (`categoryColor`/`positionColorKey` ב-`ui.jsx`, לתצוגת הפרסום/שיתוף). שני מנגנוני צבע נפרדים ומכוונים, לא לאחד אותם.
- Sticky first column + horizontal scroll (RTL: `sticky right-0`) הוא הדפוס הקיים לטבלאות רחבות באפליקציה.

### Integration Points
- `RosterWizard.jsx` — פאנל חדש מתווסף (component composition, לא מיזוג לוגיקה עם טופס העריכה הקיים).
- `CalendarView.jsx` שורה 14/176 — נקודת ההחלפה של `WeekTimeGrid` ברכיב הגנרי החדש.
- `ResourceView.jsx` — עובר לצרוך את הקומפוננטה הגנרית החדשה במקום לצייר טבלה ידנית משלו (extract-and-reuse, לא duplicate).

</code_context>

<specifics>
## Specific Ideas

אין דוגמאות ויזואליות נוספות מעבר למה שכבר קיים ב-`ResourceView.jsx` — הוא עצמו הדוגמה. שלוש כל-3 ה-grey-areas אושרו עם התשובה המומלצת, בלי שינוי.

</specifics>

<deferred>
## Deferred Ideas

- עריכה inline בתוך הגריד (הוספה/מחיקה) — שייכת ל-Phase 11 (INLINE-01), לא לפאזה הזו.
- צביעת תווית-עמדה בשחור אחיד וסדר כרונולוגי מפורש — שייכת ל-Phase 7 (COLOR-02/04), הפאזה הזו רק קובעת את המבנה (שורה/עמודה/תא), לא את הצבעים הסופיים.

</deferred>
