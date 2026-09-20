# Phase 7: צבעים וסדר משמרות - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning
**Mode:** Smart discuss (batch grey-area proposals, all recommended answers accepted)

<domain>
## Phase Boundary

מנהל ששולח את הסידור לצוות שולח משהו קריא — תווית עמדה שחורה בולטת, צבע אישי לכל כפוף, ומשמרות בסדר כרונולוגי — והמסך והתמונה אומרים בדיוק את אותו דבר. הפאזה נוגעת רק בשתי חזיתות ה"שיתוף": הלוח המפורסם (`ScheduleMgmt`) ותמונת ה-WhatsApp (`shareImage.js`). היא לא נוגעת ב"מבט משאבים"/"בניית שבוע"/מבט שבועי-יומן (`ResourceGrid.jsx`, Phase 6) — אלה משתמשים במנגנון `categoryTone` הנפרד והנעול.

</domain>

<decisions>
## היקף "שחור אחיד" (COLOR-02/COLOR-03)
- חל רק על שני מקומות: `ScheduleMgmt` ב-`src/components/supervisor/views.jsx` (התווית סביב שורה ~1422, `catColor = categoryColor(positionColorKey(s.label, s.category))`) ו-`src/lib/shareImage.js` (התווית סביב שורות 218-240, אותו `catColor`).
- `ResourceGrid.jsx` (Phase 6) **לא** נוגע — הוא ממשיך להשתמש ב-`categoryTone`/`TONE_CLASSES` מ-`src/design/categoryPalette.js`, מנגנון נפרד ונעול לגמרי.
- `categoryColor`/`positionColorKey` (ב-`src/components/ui.jsx` ובעותק המשוכפל ב-`shareImage.js`) מפסיקים לשמש לצביעת תווית-עמדה בשני המקומות האלה — אבל אל תמחק את הפונקציות עצמן בלי לבדוק שאין להן צרכן אחר קודם.
- `guardColor` (צבע אישי לכפוף) נשאר **בלי שינוי** בשני המקומות — רק תווית העמדה/משימה משתנה לשחור.

## תיקון חדות תמונת השיתוף (COLOR-01)
- Canvas ב-`shareImage.js` (`renderWeekCanvas`, שורות 160-169) מוגדר כרגע ל-`canvas.width/height` לוגי בלי הכפלה — אין `devicePixelRatio` ואין `ctx.scale()`. זה שורש הטשטוש.
- הפתרון: פקטור-סקייל **קבוע ×2**, לא תלוי ב-`devicePixelRatio` של מכשיר היצוא (התמונה נוצרת במכשיר אחד ונצפית במכשיר אחר — לרוב טלפון של כפוף).
- להכפיל את `canvas.width`/`canvas.height` בפקטור, ולהפעיל `ctx.scale(factor, factor)` מיד אחרי יצירת ה-context — כל שאר קוד הציור (קואורדינטות, מידות פונט) נשאר ללא שינוי ביחידות לוגיות.

## מקור צבע השחור (עקרון tokens.css)
- `tokens.css` לא מכיל שחור טהור (`--text` הוא `#1C3B37` באור, הופך לקרם בחושך). התווית הזו היא **תמיד-שחורה במתכוון**, לא עוקבת ערכת-נושא (וגם ה-canvas לא מכיר CSS variables בכלל).
- החלטה: ערך ספרותי מפורש (`#000` או קרוב, כמו `#111` לניגודיות מעט רכה יותר אם צריך) — לא token מ-`tokens.css`. זו סטייה מודעת ומתועדת מהעיקרון "צבע שלא יושב בלוגו לא נכנס", כי הכוונה כאן היא בדיוק ליציבות בין-ערכות-נושא, לא לפלטת מותג.
- הטקסט על גבי הרקע השחור חייב עמידה ב-WCAG AA (4.5:1) — עם רקע שחור כמעט טהור, טקסט לבן/קרוב-ללבן עומד בקלות; `readableInk("#000")` הקיים כבר יחזיר משהו בהיר מספיק, אבל שווה לוודא במפורש עם ניגודיות ממוספרת, לא רק להניח.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `readableInk()`, `INK_DARK`, `ratio()`/`luminance()`/`toLinear()` — קיימים כבר גם ב-`ui.jsx` וגם משוכפלים ב-`shareImage.js` (אותה מתודולוגיית WCAG). להשתמש בהם לבחירת צבע הטקסט על גבי השחור, לא להמציא לוגיקה חדשה.
- `categoryColor`/`positionColorKey`/`guardColor` — נשארים קיימים בקוד (לא נמחקים), רק מפסיקים לשמש בשתי הנקודות האלה.

### Established Patterns
- `shareImage.js` משכפל במכוון פונקציות צבע מ-`ui.jsx` כי canvas לא יכול לצרוך `rgb(var(--x))` — מוסכמה קיימת בפרויקט, ממשיכים אותה (אם צריך ערך שחור חדש, הוא נכנס כקבוע נפרד בשני המקומות, לא import חוצה-מודול).
- `s.color` ב-`ScheduleMgmt` (רקע הכרטיס, לפי `shiftTone`/זמן-ביום) הוא ערוץ מידע **נפרד** מ"זהות העמדה" — לא נוגעים בו. רק ה-badge הפנימי (`catColor`) הופך לשחור.

### Integration Points
- `src/components/supervisor/views.jsx` שורות ~1417-1435 (`ScheduleMgmt`, לולאת `dayShifts.map`) — כאן חסר `.sort()` לפי `startTime` (COLOR-04 — ראו למטה), וכאן התווית הופכת לשחור.
- `src/lib/shareImage.js` שורות ~144 (מיון כבר קיים!), ~160-281 (`renderWeekCanvas`, כולל התווית וה-DPR fix).

</code_context>

<specifics>
## Specific Ideas — COLOR-04 (סדר כרונולוגי)

**ממצא קונקרטי מהקוד, לא הנחה:** `shareImage.js` שורה 144 **כבר** ממיין `.sort((a, b) => a.startTime.localeCompare(b.startTime))` — תמונת השיתוף כבר כרונולוגית. `ResourceGrid`/`buildResourceRows` (Phase 6) גם כבר ממיינים לפי `startTime`. **הפער האמיתי היחיד הוא ב-`ScheduleMgmt`** (`views.jsx`): `dayShifts = weekShifts.filter(...)` בלי `.sort()` לפני ה-`.map()` שמרנדר את הכרטיסים — סדר התצוגה שם הוא כרגע סדר-הכנסה/DB, לא כרונולוגי. להוסיף `.sort((a, b) => a.startTime.localeCompare(b.startTime))` שם.

</specifics>

<deferred>
## Deferred Ideas

- WEEKBUILD-01..05 (Phase 8) ממשיכים מהדפוס של Phase 6 — לא חלק מהפאזה הזו.
- ניקוי `categoryColor`/`positionColorKey` אם יתברר שאין להן עוד צרכן אחרי הפאזה הזו — לא במפורש בסקופ (סקריפט 07-04 יכול לבדוק ולתעד, לא למחוק ביוזמתו בלי אישור אם יש עוד שימוש).

</deferred>
