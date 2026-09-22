# Phase 10: ביקורת תפריט "עוד" מול לוח הבקרה - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Codebase analysis (gsd-assumptions-analyzer) + smart discuss (1 grey area, recommended answer accepted).

<domain>
## Phase Boundary

זו משימת **ביקורת ותיעוד + הוספת קיצורים + הסרת כפילות שנמצאה** — לא שיפוץ תפריט. תפריט "עוד" מכיל היום בדיוק 5 פריטים (`src/components/SupervisorApp.jsx:41-47`): `swaps`, `tasks`, `positions`, `resources`, `analytics`. היקף הפאזה נשאר בגבולות מה שהביקורת בפועל מצאה — לא מרחיבים.

</domain>

<decisions>
## MORE-01 — טבלת הביקורת (סוכם סופית, לא נעול-לדיון אלא תוצר)

טבלת ביקורת מלאה, מבוססת קוד (לא השערה), הוכנה ע"י ניתוח קוד מקדים ומהווה את הבסיס ל-MORE-01:

| "עוד" item | מיקום נוכחי | כפול? | המלצה |
|---|---|---|---|
| **חילופים** (swaps → `SwapMgmt`) | "עוד"; **כבר** ב-Dashboard (`StatCard` "חילופים", `views.jsx:351-358`) | לא — יישום יחיד, קיצור כבר קיים | MORE-02 כבר מתקיים. לשמור את שתי נקודות הכניסה; לאמת בלחיצה. |
| **משימות** (tasks → `TaskMgmt`) | "עוד"; **כבר** ב-Dashboard (`StatCard` "משימות פתוחות", `views.jsx:359-366`) | לא — `WeekFlow` שלב 0 לעולם לא יוצר `kind="task"`; `TaskMgmt` הוא המסך היחיד | MORE-02 כבר מתקיים. לשמור; לאמת בלחיצה. |
| **עמדות קבועות** (positions → `PositionsScreen`) | "עוד" בלבד. CRUD נגיש גם דרך `RosterWizard` (מצב army בלבד, `actions.addPosition/updatePosition/deletePosition`) | חלקי — חפיפת CRUD רק במצב army, בכוונה מתועדת (`RosterWizard.jsx` header: "בדיוק כמו PositionsScreen... כדי שמפקד לא יצטרך לדעת ש'עמדות קבע' קיים בכלל"); רשימת-כשירות ותחזית-4-שבועות ב-`PositionsScreen` ייחודיות, לא כפולות | **לא מוסרים** (תוכן ייחודי שורד). **לא מוסיפים קיצור-דרך** — הוכרע (ר' למטה). |
| **מבט משאבים** (resources → `ResourceView`) | "עוד" בלבד. אותו `buildResourceRows`+`ResourceGrid` בדיוק גם ב-`CalendarView` (מצב "week", **ברירת המחדל** של "יומן" — פריט ניווט ראשי, לא בתוך "עוד") וגם ב-`RosterWizard` (army בלבד, שלב 0) | **כן — כפילות מלאה** מול `CalendarView` במצב השבועי שלו | **להסיר מ"עוד"** (MORE-03). "יומן" כבר מכסה את זה זהה, בלחיצה אחת מהניווט הראשי, ובנוסף עם זום יום/חודש ש-`ResourceView` לא מציע. אין אובדן פונקציונליות. |
| **דוחות/ניתוח** (analytics → `AnalyticsDash`) | "עוד" בלבד. כרטיס "עומס" ב-Dashboard (`views.jsx:402-443`) מציג תת-קבוצה קלה מאותו מקור-נתונים (`loadTable`/`loadWindow`), בלי קישור הלאה | לא — ל-Analytics יש גרפים/טבלה/תגי-הוגנות ייחודיים; כרטיס ה-Dashboard הוא "טיזר" בלי המשך | **להוסיף קיצור-דרך** (MORE-02) — קישור "לדוח המלא" על כרטיס "עומס" הקיים ← `onNavigate("analytics")`. משאירים גם ב"עוד" (המיקום היחיד לדוח המלא). |

**המסקנה התפעולית מהטבלה:**
- **MORE-03 (הסרה)**: פעולה אחת בלבד — הסרת `resources` מ-`moreItems()` (`SupervisorApp.jsx:41-47`) ומ-`views` map (`SupervisorApp.jsx:283`). `ResourceView.jsx` הופך לקוד מת בעקבות זאת (`ResourceGrid.jsx`/`buildResourceRows` עצמם ממשיכים לשמש את `CalendarView`/`RosterWizard` — לא נוגעים בהם).
- **MORE-02 (הוספה)**: קיצור-דרך חדש אחד בלבד — `analytics`, כקישור על כרטיס "עומס" הקיים. `swaps`/`tasks` כבר יש להם קיצורים קיימים — רק לאמת שהם עדיין עובדים, לא לבנות מחדש.

## MORE-02 — קיצור-דרך ל"עמדות קבועות"? (הוכרע)

- **החלטה:** **לא** מוסיפים קיצור-דרך ל-`positions` בלוח הבקרה.
- הנימוק: זה הפריט היחיד בלי אף קיצור-דרך היום, אבל `PositionsScreen.jsx:125` עצמו אומר במפורש שעמדות מוגדרות פעם אחת וחוזרות לבד — מסך שימוש-נמוך ולא-יומיומי בכוונה. הוספת קיצור הייתה מנוגדת לתבנית השימוש המתועדת של המסך עצמו.
- זה **לא** משנה את סטטוס-הכפילות של positions (עדיין "חלקי, לא מוסר" למעלה) — רק קובע שאין הוספת UI חדש עבורו ב-Dashboard.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/SupervisorApp.jsx:41-47` — `moreItems()`, מקור האמת לתפריט "עוד" (5 פריטים).
- `src/components/SupervisorApp.jsx:223-283` — מפת `views`, מחבר כל `id` לקומפוננטה. שורה 283 (`resources` → `ResourceView`) היא היעד למחיקה ב-MORE-03.
- `src/components/supervisor/views.jsx:402-443` — כרטיס "עומס" ב-`SupDashboard`, היעד של קישור ה-`analytics` החדש (MORE-02).
- `src/components/supervisor/views.jsx:351-366` — שני ה-`StatCard`ים הקיימים (`swaps`/`tasks`) שכבר עובדים — MORE-02 מאמת אותם, לא בונה אותם מחדש.
- `src/components/supervisor/CalendarView.jsx` — היעד ה"תחליפי" ל-`resources`, כבר ברירת מחדל במצב "week" (שורות ~60-63, הערה מתעדת את ההחלטה).

### Established Patterns
- `onNavigate(id)` / `StatCard` עם `onClick` הוא דפוס הניווט הקיים מה-Dashboard לשאר המסכים — לא צריך תבנית חדשה עבור קיצור ה-analytics.

### Integration Points
- `src/components/SupervisorApp.jsx` — `moreItems()` (הסרת `resources`), מפת `views` (הסרת `resources`), `go(id)`/`onNavigate` (ללא שינוי — כבר תומך בכל ה-id-ים).
- `src/components/supervisor/views.jsx` — `SupDashboard`'s "עומס" card מקבל קישור חדש ל-`analytics`.
- `src/components/supervisor/ResourceView.jsx` — הופך לקוד מת; שיקול נפרד (לא חובה בפאזה זו) האם למחוק את הקובץ עצמו או להשאיר לצורך מעקב.

</code_context>

<specifics>
## Specific Ideas

אין רעיונות ספציפיים נוספים מעבר להחלטות למעלה — טבלת הביקורת עצמה *היא* המפרט.

</specifics>

<deferred>
## Deferred Ideas

- הוספת קיצור-דרך ל-`positions` — נדחה במפורש (ר' החלטה למעלה).
- מחיקת קובץ `ResourceView.jsx` עצמו (בניגוד להסרתו מהניווט) — לא חובה בפאזה זו; אפשר להשאיר כקוד לא-מנווט-אליו אם המתכנן מעדיף לצמצם את שטח השינוי, ולתעד כ-tech-debt קל.

</deferred>
