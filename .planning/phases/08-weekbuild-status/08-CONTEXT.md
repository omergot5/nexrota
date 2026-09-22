# Phase 8: בניית שבוע (שינוי שם) + תמונת מצב שבועית - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Mode:** Smart discuss (batch grey-area proposals, all recommended answers accepted). Corrects and supersedes the 2026-09-17 decision about WEEKBUILD-02 — see ROADMAP.md Phase 8 section for the architectural discovery that changed it.

<domain>
## Phase Boundary

מנהל במצב army קורא למסך באותו שם שהמצב הגנרי קורא לו, ויש לו גישה למה שקורה בכל עמדה לאורך השבוע — במבט כללי או בצלילה לעמדה אחת — **בתוך אותה זרימת "בניית שבוע" הקיימת** (`WeekFlow.jsx`), לא במסך נפרד חדש.

</domain>

<decisions>
## WEEKBUILD-01 — שינוי שם
- שינוי שורה אחת ב-`terms.js`: override army של `nav.shifts` — `"בניית סד\"כ"` → `"בניית שבוע"`.
- **רק ה-override הצבאי משתנה.** הערך הגנרי (`"בניית השבוע"`, עם ה' הידיעה) **נשאר כמו שהוא** — המפרט לא ביקש לגעת בפרופיל civil/security, וזו הרחבת-סקופ לא-מבוקשת.

## WEEKBUILD-02 — "תמונת מצב שבועית" = הזזת שלב, לא מסך חדש
- **גילוי אדריכלי (2026-09-22):** `UnifiedBoard.jsx` הוא שלב 0 בתוך `WeekFlow.jsx` (`STEP_OF`: `board:0, shifts:1, availability:2, assign:3, schedule:4`), לא מסך עצמאי בניווט. כבר נקרא `"תמונת מצב שבועית"` במצב army (`nav.board`).
- **ההחלטה:** להזיז את שלב `board` להיות **אחרי** `shifts`, לא לפניו. סדר חדש: `shifts → board → availability → assign → schedule`.
- לעדכן ב-`WeekFlow.jsx`: מפת `STEP_OF`, סדר המערכים `meta`/`body`/`action` (לא רק אינדקסים — יש טקסט תלוי-סדר כמו `goBuildLabel` ופעולת ה-CTA של כל שלב), וכל מקום שמפנה לשלב לפי מספר קבוע.
- **לא** לבנות רכיב/מסך חדש. **לא** לשנות את השם של `UnifiedBoard.jsx` — הוא ממשיך להיקרא "תמונת מצב שבועית" בדיוק כמו היום.
- בדוק את ההשפעה על מצבים לא-army: שם ה-board הגנרי הוא `"השבוע במבט אחד"` — אם הסדר החדש חל על כל הפרופילים (סביר, כי זו זרימה אחת גנרית ב-`WeekFlow.jsx` לא מפוצלת לפי מצב), ודא שההיגיון של "השלב הראשון שרואים בכניסה הוא הלוח" (Phase 5, D-04) לא נשבר בטעות באופן לא-מכוון — המפרט מבקש את הסדר החדש, אבל v1.1 Phase 5 קיבע במפורש "לוח קודם" מסיבה מתועדת (G-05-1). לתעד את השינוי בהיגיון הזה, לא רק להזיז.

## WEEKBUILD-03 — ניווט בין שבועות בחצים
- **כבר קיים ברמת האפליקציה.** `WeekNav` (חצים + `weekOffset`/`setWeekOffset`) כבר מוצג ב-header כל עוד `isWeek === true` (`SupervisorApp.jsx` שורות ~400-424) — חל על כל שלבי `WeekFlow`, כולל שלב ה-board אחרי ההזזה.
- הפאזה רק צריכה **לאמת** (לא לבנות) שזה עדיין עובד נכון אחרי הזזת השלב, כולל שהמידע בשלב ה-board מתעדכן בהתאם ל-`weekDates` שמגיע מלמעלה.

## WEEKBUILD-04 — "מה שיש עד עכשיו"
- ממומש כ**טוגל בפאנל התצוגה של `RosterWizard.jsx`** (שלב `shifts`, Phase 6/06-02), לא בשלב ה-board.
- `RosterWizard` כבר מבחין `rows` (עמדות ממומשות/אמיתיות) מול `pendingRows` (טיוטה בעריכה, "שורה מקווקוות" — ר' `06-02-SUMMARY.md`). הכפתור מסתיר את `pendingRows` ומציג רק `rows` — "מה שבאמת שמור" לעומת "כולל מה שאני עורך עכשיו".
- לא נוגעים בשלב ה-board — אין שם מושג "טיוטה" להסתיר, הכפתור שם מיותר.

## WEEKBUILD-05 — תצוגה ממוקדת לעמדה בודדת
- רכיב **חדש לגמרי** — לא קיים היום בשום צורה.
- אינטראקציה: **לחיצה על שורה** בגריד המשותף (`ResourceGrid`, Phase 6) פותחת תצוגה ממוקדת לעמדה הזו על פני השבוע — לא בורר/dropdown נפרד.
- חייב לאמץ את דפוס Phase 6 (`ResourceGrid.jsx`/`buildResourceRows`) — לא להמציא פריסה חדשה. "תצוגה ממוקדת" = כנראה אותו גריד אבל עם שורה אחת בלבד (העמדה שנבחרה), עדיין row=עמדה/col=יום, לא מעבר לציר-שעות.
- נפרדת מהתצוגה הכללית — צריך דרך לחזור ("סגור"/"חזרה לכל העמדות").

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/supervisor/WeekFlow.jsx` — הבעלים של סדר השלבים (`STEP_OF`, `meta`, `body`, `action`). כל השינוי של WEEKBUILD-01/02 קורה כאן + `terms.js`.
- `src/components/SupervisorApp.jsx` שורות ~58-68 (`WeekNav`), ~105 (`weekDates`/`weekOffset`), ~400-424 (מיקום התצוגה) — התשתית ל-WEEKBUILD-03 כבר שם.
- `src/components/supervisor/RosterWizard.jsx` שורות ~325 (`pendingRows`), ~363 (`allRows`) — נקודת ההשקה של WEEKBUILD-04.
- `src/components/supervisor/ResourceGrid.jsx` (Phase 6) — הבסיס ל-WEEKBUILD-05: רכיב חדש שמציג שורה בודדת דרכו, או מסנן `rows` לפני העברה אליו.

### Established Patterns
- שינוי `terms.js` הוא ה-single-source לניסוח תלוי-מצב — לא string קשיח ברכיב.
- `WeekFlow.jsx` עצמו כבר מתעד (בהערת הכותרת) שהשלבים "עוטפים" רכיבים קיימים בלי לשכתב אותם — עקרון שממשיך לחול גם כשמזיזים שלב.

### Integration Points
- `terms.js` שורה ~105 (army `nav.shifts`).
- `WeekFlow.jsx` (`STEP_OF`, `meta`, `body`, `action` arrays).
- `RosterWizard.jsx` (טוגל rows/pendingRows).
- `ResourceGrid.jsx`/רכיב-אב חדש בתוך `RosterWizard.jsx` או קובץ נפרד (WEEKBUILD-05).

</code_context>

<specifics>
## Specific Ideas

אין. שלושת האזורים האפורים אושרו עם התשובה המומלצת, בלי שינוי.

</specifics>

<deferred>
## Deferred Ideas

- שינוי הערך הגנרי `nav.shifts` (בלי ה' הידיעה) — נדחה במפורש, לא בסקופ הפאזה הזו.
- הוספת מנגנון סינון "אמיתי/טיוטה" לשלב ה-board — נדחה, אין שם צורך.

</deferred>
