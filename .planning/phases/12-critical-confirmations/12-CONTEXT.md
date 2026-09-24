# Phase 12: אישורי פעולות קריטיות - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning -- decisions locked below
**Mode:** Codebase analysis (gsd-assumptions-analyzer-style deep dive) + a standing-instruction
default-resolution pass for the two genuine grey areas (the user declined an interactive
AskUserQuestion round and asked to continue with defaults). `<decisions>` below is what the
planner should treat as locked; `<findings>`/`<open_questions>` remain as the raw investigation
trail.

<decisions>
## Locked Decisions (2026-09-24)

- **Architectural resolution (open_questions #1)**: pre-confirm REPLACES the UndoBar for the four
  named actions (publish/unpublish, delete-week, delete-demo-data), not stacked on top of it.
  `deleteShifts`/`deleteDemoDataForWeek`, when invoked through the new `ConfirmDialog`, drop
  `deferred()` and switch to immediate `run()+refresh()` writes (same pattern as `addShifts`).
  `publish`/`unpublish` need no mechanism change — they're already `optimistic()` with no UndoBar,
  so the dialog is a pure UI gate in front of the existing call. Rationale: the plan-checker's own
  planner note in ROADMAP.md already calls stacking both mechanisms "an insult to the user" — two
  confirmation layers on one action is friction, not safety.
- **CONFIRM-05 scope (open_questions #2)**: adopt the inventory already gathered in `<findings>` §1
  as the closed review list — no separate broader code-review sweep beyond `useGuardian.js`/`api.js`
  in this phase. For each of the 9 `deferred()` actions plus `removeRoleCompatibility`, the plan
  must explicitly record one of: in-scope-for-pre-confirm / stays-UndoBar / left-unprotected-on-
  purpose (documented reason required for the last option — "no reason given" is not acceptable per
  this project's transparency-first core value). `removeRoleCompatibility` (currently NEITHER
  UndoBar NOR confirm — a real protection gap found during this investigation) must receive at least
  UndoBar-level protection as part of this phase, since leaving a destructive action with zero safety
  net contradicts the project's baseline pattern regardless of how CONFIRM-05's stricter bar shakes
  out for it.
- Open questions #3 (exact per-item promote/keep decision) is resolved by applying #2's process
  during planning, not decided item-by-item here — the planner should use the evidence already in
  `<findings>` §1 (e.g. `decideSwap`'s own code comment arguing FOR UndoBar) as the starting bias per
  item, and only escalate to `AskUserQuestion` if a specific item is genuinely ambiguous after that.
- Open question #4 (CONFIRM-06 cancel semantics) is confirmed as analyzed: no true "revert" is
  needed for any of the four named actions as currently coded, since none paints an optimistic patch
  before confirmation — "cancel" simply means "don't call the action." This holds under the locked
  answer to #1 (immediate-write, no UndoBar stacking).
- Open question #5 (UI placement/copy per dialog) is left to the planner's implementation judgment,
  informed by `<findings>` §5's specific guidance (the day-toggle button's dual-purpose text must be
  derived from state at click time, not a fixed label; reuse the existing `deferred` labels' phrasing
  for consistency) — not a product decision requiring further user input.

</decisions>

<domain>
## Phase Boundary

אף פעולה הרסנית באפליקציה לא מתבצעת בלי שהמנהל אמר "כן" -- דרך אותה קומפוננטת אישור אחת, בכל מסך.
בהיקף מפורש: הפצה/פרסום, ביטול הפצה, מחיקת שבוע, מחיקת נתוני הדגמה (CONFIRM-02..04) -- ועוד כל
פעולה הרסנית שסקירת קוד מגלה (CONFIRM-05). "בטל" בדיאלוג חוזר בדיוק למצב הקודם (CONFIRM-06).

הפאזה הזו סותרת חזיתית עקרון ברזל קיים (CLAUDE.md #3: "ביטול במקום אישור... בלי confirm()").
ROADMAP.md מגדיר את זה כהפיכה מכוונת של בעל המוצר, בהיקף מוגבל (הפעולות הנקובות ב-CONFIRM-02..04),
לא ביטול גורף של העיקרון עבור כל פעולה הרסנית באפליקציה. חלק מהעבודה הזו הוא תיעוד: לעדכן
CLAUDE.md + PROJECT.md כדי שלא יסתרו את הקוד.

</domain>

<findings>
## 1. מלאי מלא של פעולות deferred() (UndoBar) ב-useGuardian.js

תשע קריאות deferred( בקובץ (grep מדויק). לכל אחת: תווית ה-UndoBar, קריאת ה-API מתחתיה, ומיקום ה-UI
שקורא לה. טור אחרון מסמן אם היא בהיקף המפורש של CONFIRM-02..04 או מועמדת פוטנציאלית ל-CONFIRM-05.

| פעולה | useGuardian.js | תווית UndoBar | UI קורא | היקף |
|---|---|---|---|---|
| deleteShift(id) | 542-547 | "המשמרת נמחקה" | כפתור-x צף על כרטיס משמרת בודד, views.jsx:716-726 (מתועד ב-11-CONTEXT.md סעיף 1, לא נבדק ישירות בסבב הזה) | לא נקוב -- מועמד CONFIRM-05 |
| deleteShifts(ids, label) | 553-558 | ברירת מחדל "המשמרות נמחקו", דורס ל-"${n} משמרות נמחקו" | clearWeek() ("מחק שבוע"), views.jsx:526-533 | CONFIRM-03 (מחיקת שבוע) -- נקוב במפורש |
| replaceShifts(ids, rows, label) | 573-595 | "השבוע הוחלף" / "השבוע נבנה מחדש -- ${n} משמרות" | fillWeek() ("מלא שבוע"), views.jsx:506-524 | לא נקוב -- דריסה מלאה של תוכן השבוע, מועמד חזק ל-CONFIRM-05 (הדרישה עצמה מזכירה "דריסות" כדוגמה) |
| clearAssignments(shiftIds) | 708-718 | "השיבוץ נוקה" | ניקוי שיבוצי-auto (לא אותר UI call site בסבב הזה) | לא נקוב -- מועמד CONFIRM-05 |
| deleteDemoDataForWeek(weekDates) | 728-736 | "נתוני ההדגמה נמחקו" | כפתור "מחק נתוני הדגמה לשבוע זה", WeekFlow.jsx:165-176 | CONFIRM-03 (מחיקת נתוני הדגמה) -- נקוב במפורש |
| removeGuard(id) | 756-761 | "האדם הוסר מהצוות" | TeamView (לא נבדק ישירות בסבב הזה) | לא נקוב -- מועמד חזק ל-CONFIRM-05 (מוחק אדם מהצוות; cascade לשיבוצים/זמינות/החלפות שלו) |
| decideSwap(swap, status) | 838-859 | "בקשת ההחלפה אושרה/נדחתה" | מסך בקשות החלפה (לא נבדק ישירות) | לא נקוב -- הערת הקוד עצמה (שורות 830-837) כבר דנה במפורש ב"ביטול במקום אישור" עבור הפעולה הזו וקבעה ש-UndoBar מספיק; מועמד חלש ל-CONFIRM-05 |
| deleteTask(id) | 885-890 | "המשימה נמחקה" | TaskBoard (לא נבדק ישירות) | לא נקוב -- מועמד CONFIRM-05 |
| deletePosition(id, weekDates) | 912-947 | "העמדה נמחקה" / "...כולל המשמרות שהוקצו לה השבוע" | RosterWizard.jsx:279-288, PositionsScreen.jsx:138 (מתועד ב-11-CONTEXT.md) | לא נקוב -- מועמד חזק ל-CONFIRM-05 (הקוד עצמו כבר מכיר בחומרה שלה -- תווית מיוחדת כשיש cascade) |

ממצא נוסף, לא ב-deferred() בכלל -- פער אמיתי: removeRoleCompatibility(id)
(useGuardian.js:778-782) הוא run() + refresh() רגיל -- בלי deferred() ובלי confirm(): לחיצה
על כפתור הפח (views.jsx:2396-2403, "הסר את החסימה בין X ל-Y") מוחקת כלל-התנגשות בין קטגוריות
מיידית, בלי שום רשת ביטחון -- לא UndoBar, לא דיאלוג. זה כנראה החור הכי ברור ל-CONFIRM-05.

## 2. זרימת פרסום/ביטול-הפצה -- לא deferred() בכלל, אלא optimistic()

actions.publish(shiftIds, published) (useGuardian.js:597-604) היא הפעולה היחידה גם לפרסום
וגם לביטול-הפצה -- אותה פונקציה, רק published הוא true/false. היא optimistic(), לא
deferred(): צביעה מיידית של המסך + כתיבה לשרת, עם rollback רק אם הכתיבה נכשלת. אין UndoBar
ואין דיאלוג אישור על הפעולה הזו היום בשום צורה -- כפתור רגיל, onClick ישיר.

ארבע נקודות-UI קוראות ל-actions.publish היום (לא אחת -- המתכנן צריך לחווט את כולן):

1. views.jsx:1414 -- ScheduleMgmt, כפתור "פרסם הכל"/"הפץ הכל" (action.publishAll) -- publish(allIds, true)
2. views.jsx:1419 -- ScheduleMgmt, כפתור "בטל פרסום"/"בטל הפצה" (action.unpublish) -- publish(allIds, false)
3. views.jsx:1460 -- ScheduleMgmt, כפתור טוגל ליום בודד (action.publishDay/action.unpublishShort) -- publish(dayShifts, !allPub) -- אותו כפתור עצמו הוא גם "פרסם" וגם "בטל" תלוי מצב, מה שמסבך דיאלוג גנרי: הטקסט/כותרת חייבים להיגזר מ-allPub בזמן הקליק, לא מהתווית הקבועה של הכפתור
4. WeekFlow.jsx:292 -- כפתור ה-CTA התחתון של שלב "schedule" בוויזארד (t("action.publish") = "שלח לצוות"/"הפץ סדכ") -- publish(weekShifts, true), כפילות ל-#1 (אותה פעולה, נקודת כניסה שנייה כי ScheduleMgmt מוטמע כשלב 4 ב-WeekFlow וגם ה-CTA-bar הכללי של הוויזארד קורא לאותה פעולה)

מונחים (terms.js): civil "שלח לצוות"/"בטל פרסום"/"פרסם יום"/"בטל"; army "הפץ סדכ"/"בטל הפצה"/
"הפץ יום"/"בטל" (שורות 62-66, 117-120).

באג "ביטול הפצה" (STATE.md, Phase 12->13): api.setPublished (api.js:611-626) כבר עושה
.select("id") + בדיקת ספירה נכונה (BUG-02 ב-REQUIREMENTS.md כבר מציין את זה במפורש) -- כלומר שכבת
ה-DB תקינה. החשד עובר לזרימת ה-UI/state שמעליה. לא אותר שורש הבאג בסבב הזה (זה Phase 13, לא
Phase 12) -- אבל נקודה קריטית לחיווט CONFIRM-04: מכיוון ש-publish הוא optimistic() ולא
deferred(), גם היום, בלי שום דיאלוג, אין מצב-ביניים לנקות -- "ביטול" בדיאלוג פשוט לא קורא
ל-actions.publish בכלל, לא צריך לבטל שום patch שכבר צויר. חיווט הדיאלוג סביב הבאג הקיים לא אמור
"לתקן" כלום -- רק לעצור לפני הקריאה הקיימת (המבוגגת) ל-api.setPublished(ids, false).

## 3. מחיקת שבוע ומחיקת נתוני הדגמה -- היום deferred(), CONFIRM-03 דורש פרה-אישור

"מחק שבוע" -- views.jsx:526-533, פונקציה clearWeek(). הערת הקוד הקיימת אומרת זאת במפורש,
views.jsx:526: "מחיקת השבוע כולו. deleteShifts נותן UndoBar, ולכן אין דיאלוג אישור."
-- ההערה הזו עצמה תהיה שגויה אחרי הפאזה וצריכה עדכון/מחיקה כחלק מהעבודה, לא רק הקוד תחתיה.
כפתור: views.jsx:588-591, variant="ghost" icon="trash", "מחק שבוע".

"מחק נתוני הדגמה לשבוע זה" -- WeekFlow.jsx:165-176. הערת קוד מקבילה ומפורשת עוד יותר,
WeekFlow.jsx:162-164, מפנה במפורש למילים "עקרון ברזל 3" ואומרת "בלי דיאלוג אישור, UndoBar בלבד" --
עוד עדות תיעודית-בקוד שצריכה עדכון.

הממצא האדריכלי המרכזי (הכי חשוב לתכנון): שתי הפעולות האלה הן deferred() היום -- כלומר
כבר יש להן UndoBar. CONFIRM-03 דורש "פרה-אישור" (confirm-before) במקום. אם המתכנן פשוט עוטף את
הכפתור הקיים בדיאלוג-אישור ומשאיר את actions.deleteShifts/actions.deleteDemoDataForWeek כפי
שהן (עדיין deferred()), התוצאה היא שני המנגנונים גם יחד על אותה פעולה -- בדיוק מה ש-ROADMAP.md
(הערת המתכנן ל-Phase 12) קורא לו "עלבון למשתמש". חייבת להיות החלטה מפורשת: הפעולות הנקובות
(פרסום/ביטול-פרסום, מחיקת-שבוע, מחיקת-הדגמה) מחליפות UndoBar בפרה-אישור -- לא מוסיפות עליו.
המשמעות המעשית ל-useGuardian.js: deleteShifts/deleteDemoDataForWeek, כשהן נקראות דרך הדיאלוג
החדש, צריכות לכתוב מיד בלי חלון-ביטול (בדומה לדפוס run()+refresh() שכבר קיים לפעולות אחרות
כמו addShifts/updateShift) -- לא להמשיך לעטוף ב-deferred(). publish/unpublish לא צריכות שינוי
דומה כי הן כבר optimistic() בלי UndoBar (סעיף 2 לעיל) -- שם החיווט נקי-הוספתי בלבד.

שים לב: deleteShifts היא גם ה-primitive מאחורי deleteDemoDataForWeek (useGuardian.js:734,
קוראת ל-api.deleteShifts(ids) -- אותו endpoint, לא actions.deleteShifts), אבל שתיהן משתמשות
בעטיפת deferred() משלהן בנפרד ב-actions layer -- אז שינוי המנגנון חייב לגעת בשתי הקריאות, לא רק
באחת.

## 4. תשתית Modal קיימת -- בסיס טוב ל-ConfirmDialog גנרי

Modal (src/components/ui.jsx:591-644) כבר תומך בדיוק במה שצריך: open/onClose, title,
subtitle אופציונלי, children (גוף חופשי), footer (שורת כפתורים), Escape-to-close, focus על
פתיחה, wide (רוחב אופציונלי). בשימוש היום ב-SeedDemoDialog (Phase 9) וב-guard-picker של
UnifiedBoard.jsx:325-357 (Phase 11).

SeedDemoDialog (views.jsx:64-122) הוא כבר כמעט בדיוק התבנית שדיאלוג-אישור גנרי צריך:
title קבוע, גוף עם טקסט הסבר דינמי, footer עם כפתור-פעולה ראשי (Btn רגיל, loading={busy ||
pending}) וכפתור "ביטול" (variant="secondary"), state מקומי pending שחוסם סגירה
(closeUnlessPending) בזמן שהכתיבה בתהליך -- כדי ש-Escape/קליק-רקע/X באמצע כתיבה לא ייצרו מצב
"נראה שנסגר אבל הפעולה עדיין רצה ברקע" (זו בדיוק תקלה שתוקנה ב-Phase 9 code review לפי ההערה
בקוד, ותהיה רלוונטית שוב לכל ConfirmDialog גנרי). Btn כבר תומך ב-variant="danger"
(ui.jsx:154) לכפתור-אישור על פעולה הרסנית -- לא צריך טוקן צבע חדש.

מה חסר/צריך הכללה: SeedDemoDialog הוא קומפוננטה ספציפית עם title/body/segmented קבועים.
ConfirmDialog גנרי (CONFIRM-01) צריך params דינמיים: כותרת, גוף-טקסט (או node), טקסט כפתור-אישור,
טקסט כפתור-ביטול, onConfirm אסינכרוני, tone/variant (danger לרוב, אבל לא תמיד -- פרסום הוא
"הרסני" רק במובן "בלתי-הפיך בקלות", לא מוחק נתונים). ה-pending/busy-blocking pattern מ-
SeedDemoDialog צריך לעבור לרכיב הגנרי, לא להישאר מקומי לכל קורא.

## 5. היקף עדכון התיעוד -- CLAUDE.md (שני קבצים) + PROJECT.md

שלושה מיקומים מדויקים, לא שניים כפי שאפשר להניח מראש:

1. CLAUDE.md (root), שורה 26, טבלת "עקרונות ברזל", עיקרון #3: "ביטול במקום אישור --
   הפעולה מתבצעת מיד, עם UndoBar של 8 שניות. בלי confirm()." -- זה הניסוח הכי חד-משמעי בפרויקט
   שהפאזה סותרת. צריך להתעדכן לתאר את שני המסלולים גם יחד (UndoBar כברירת מחדל לרוב הפעולות
   ההרסניות; פרה-אישור לרשימה סגורה ומפורשת: פרסום/ביטול-פרסום, מחיקת שבוע, מחיקת נתוני הדגמה,
   ועוד כל מה ש-CONFIRM-05 יוסיף לרשימה).

2. .claude/CLAUDE.md, שורה 91, סעיף "Dependency Patterns" (לא "Constraints" כפי שאפשר
   להניח מהשם -- נבדק ישירות: סעיף ה-Constraints בפועל, שורות 15-24, לא מזכיר את העיקרון בכלל,
   רק Tech stack/דטרמיניזם/נגישות/עיצוב/RTL/api.js): "Undo pattern: delay write 8 seconds,
   allow cancel without reverting" -- תיאור גנרי של מנגנון deferred(), לא טוען "תמיד, בלי יוצא
   מן הכלל". דורש הרחבה קצרה שמזכירה שקבוצת פעולות מוגדרת עוברת פרה-אישור במקום זה, לא ניסוח-מחדש
   מלא. יש גם אזכור נלווה בשורה 169 (Architectural Constraints, "Offline-read only") ל-
   optimistic()/deferred() כשני מנגנוני הכתיבה היחידים -- אחרי הפאזה הזו זה כבר לא מדויק (יתווסף
   מסלול כתיבה-מיידית-אחרי-אישור, ר' סעיף 3 לעיל) ושווה בדיקה נוספת בזמן התכנון אם השורה הזו גם
   צריכה מגע.

3. .planning/PROJECT.md, שורה 48, סעיף "Validated": "ביטול פעולה במקום דיאלוג אישור, RTL
   מלא, מצב בהיר/כהה/מערכת -- existing" -- שלושה נושאים שונים בשורה אחת (ביטול-במקום-אישור, RTL,
   מצב-תצוגה). המתכנן צריך לפצל/לערוך רק את החלק הראשון, בלי לגעת ב-RTL/מצב-תצוגה שנשארים נכונים
   כפי שהם. שורה 66 באותו קובץ ("קומפוננטת אישור לכל פעולה הרסנית -- Phase 12") כבר ברשימת
   Active -- לא דורשת שינוי, רק מעבר ל-Validated בסגירת הפאזה (תבנית רגילה).

docs/architecture/system-overview.md ו-docs/product/CONTEXT_PACK.md לא נבדקו בסבב הזה לאזכורים
דומים -- ייתכן שיש עוד עותקים של אותו ניסוח שם; שווה גרף נוסף בזמן התכנון אם רוצים לתפוס את כולם.

</findings>

<open_questions>
## שאלות פתוחות שדורשות AskUserQuestion בתכנון (לא הוכרעו כאן)

1. ההכרעה האדריכלית המרכזית (סעיף 3 לעיל): כש-CONFIRM-03 עוטפת "מחק שבוע"/"מחק נתוני הדגמה"
   בדיאלוג-אישור, האם deleteShifts/deleteDemoDataForWeek מפסיקות להשתמש ב-deferred()
   (עוברות לכתיבה מיידית, בלי חלון-ביטול-8-שניות) -- או שנשארות deferred() וה-UndoBar פשוט מוצג
   אחרי האישור כשכבה שנייה? הראיות בקוד (ROADMAP.md הערת המתכנן: "שתי המכניקות יחד... עלבון
   למשתמש") מצביעות חזק על האופציה הראשונה, אבל זו עדיין החלטת מוצר שצריך לאשר במפורש, לא להניח.
   זה גם קובע אם 8 השניות של "יש עוד רגע להתחרט אחרי שלחצת בפועל מחק" נעלמות לגמרי מהזרימה הזו,
   מה שהוא שינוי UX אמיתי (לא רק טכני).

2. היקף CONFIRM-05 (כמבוקש במפורש במשימה): הסקירה הזו כבר מספקת מלאי ראשוני -- 9 פעולות
   deferred() (סעיף 1) שאינן נקובות ב-CONFIRM-02..04, ועוד פעולה הרסנית אחת (removeRoleCompatibility)
   שאין לה שום הגנה בכלל היום. השאלה: האם התכנון מאמץ את המלאי הזה כרשימה סגורה-לביקורת (ולתעד
   "בסקופ"/"נשאר UndoBar"/"נשאר בלי הגנה בכוונה" לכל שורה), או שצריך סבב-סקירת-קוד נפרד ורחב יותר
   (חיפוש גם מחוץ ל-useGuardian.js, למשל TeamView/PositionsScreen/GuardApp ישירות, למקרה
   שיש כתיבות הרסניות שלא עוברות דרך ה-actions layer בכלל)? ROADMAP.md עצמו קורא לזה "יחידת עבודה
   בפני עצמה" -- לא ברור אם זה אומר "עוד סבב סקירה" או "כבר יש לך את המלאי, תחליט לגבי כל פריט".

3. סף ה"הרסני": מבין תשעת ה-deferred() ו-removeRoleCompatibility, אילו בכלל ראויות
   לפרה-אישור לעומת UndoBar? יש ראיה בקוד נגד המרה גורפת: ההערה ב-decideSwap
   (useGuardian.js:830-837) כבר דנה במפורש ב"ביטול במקום אישור" עבור אישור/דחיית-החלפה וקבעה
   שזה המקום הנכון (לא confirm()) -- כלומר לא כל "מחיקה" באפליקציה היא מועמדת אוטומטית ל-CONFIRM-05,
   ויש כבר תקדים-קוד של שיקול-דעת מודע נגד. replaceShifts ("מלא שבוע") ו-deletePosition נראות
   כמועמדות החזקות ביותר מבין השאר (דריסה מלאה / cascade על שיבוצי-שבוע), אבל זו הערכה מהקוד, לא
   קביעה.

4. CONFIRM-06 -- כן, ההנחה מאומתת, אבל בתנאי: "ביטול" בדיאלוג לא צריך revert אמיתי לאף אחת
   מארבע הפעולות הנקובות כפי שהן פועלות היום, כי אף אחת מהן לא מציירת patch אופטימי לפני
   שהאישור נלחץ -- publish (optimistic()) והפעולות ה-deferred() (אם יעברו לכתיבה מיידית לפי
   שאלה 1) שתיהן רק מתחילות לפעול אחרי קריאה בפועל ל-actions.X(), וזו הקריאה שדיאלוג-אישור
   פשוט לא מבצע כשלוחצים "ביטול". אבל זה תלוי בתשובה לשאלה 1: אם ההחלטה היא "משאירים
   deferred() כמו שהוא ומוסיפים פרה-אישור מעליו", אז "ביטול" בדיאלוג הוא עדיין ניקוי-פשוט (לא
   קוראים בכלל), אבל המשתמש עדיין מקבל UndoBar אחרי שהוא כבר אמר "כן" -- לא בעיית revert, אבל כן
   בעיית UX-כפילות שכבר סומנה בשאלה 1.

5. UI placement/ניסוח מדויק לכל אחד מארבעת הדיאלוגים (כמבוקש במפורש): לא נבדק/הוכרע כאן.
   נקודות שצריך התייחסות בתכנון: (א) כפתור-הטוגל היחיד ליום בודד ב-ScheduleMgmt
   (views.jsx:1457-1463) הוא גם "פרסם" וגם "בטל" תלוי מצב -- טקסט הדיאלוג חייב להיגזר מ-allPub
   בזמן הלחיצה, לא מתווית קבועה; (ב) יש ארבע נקודות-UI נפרדות שקוראות ל-publish (סעיף 2) -- האם
   כולן מקבלות את אותו רכיב-עטיפה (למשל hook/helper משותף confirmPublish(ids, published))
   כדי לא לשכפל את לוגיקת-הפתיחה ארבע פעמים; (ג) טקסט ברירת-מחדל טבעי לשאוב מהתוויות ה-deferred
   הקיימות (${n} משמרות נמחקו וכו') כדי לשמור עקביות ניסוח בין המסך-הישן-UndoBar (לפעולות שנשארות
   שם) לדיאלוג-החדש (לפעולות שעוברות).

</open_questions>

<code_context>
## Existing Code Insights

### Reusable Assets
- src/components/ui.jsx:591-644 -- Modal, הבסיס הגנרי הקיים (open/onClose/title/subtitle/
  children/footer, Escape+focus). מתאים כבסיס ל-ConfirmDialog בלי שינוי מבני.
- src/components/supervisor/views.jsx:64-122 -- SeedDemoDialog, הדוגמה החיה הכי קרובה לדפוס
  שצריך: title/body/footer עם כפתור-ראשי+ביטול, pending state שחוסם סגירה בזמן כתיבה. הצעד
  הבא הוא להפוך אותו (או לחלץ ממנו) לגנרי עם props דינמיים במקום title/body קבועים.
- src/components/ui.jsx:154 -- Btn variant danger כבר קיים, מוכן לכפתור-אישור על פעולה הרסנית.
- src/hooks/useGuardian.js:342-352 -- deferred(), המנגנון שהפעולות הנקובות (מחיקת-שבוע,
  מחיקת-הדגמה) צריכות "לצאת ממנו" (ר' open_questions #1) בזמן שהן עוברות לפרה-אישור.
- src/hooks/useGuardian.js:285-298 -- optimistic(), המנגנון ש-publish/unpublish כבר
  משתמשות בו -- לא צריך שינוי, רק גייטינג-UI לפני הקריאה.

### Established Patterns
- run()+refresh() בלי deferred()/optimistic() (למשל addShifts, useGuardian.js:530-534)
  -- הדפוס הקיים לכתיבה-מיידית-בלי-חלון-ביטול, הדגם הטבעי אם deleteShifts/deleteDemoDataForWeek
  עוברות לכתיבה מיידית אחרי אישור.
- .select() + בדיקת-ספירת-שורות אחרי כל DELETE/UPDATE (api.js:611-626 ל-setPublished,
  ודומיו) -- מוסכמה קיימת ש-CONFIRM-05 לא אמורה לגעת בה; זה שכבת-נכונות נפרדת מ-UI-אישור.
- הערות-קוד שמפנות במפורש לעיקרון ברזל #3 ויהפכו שגויות (views.jsx:526, WeekFlow.jsx:162-164,
  useGuardian.js:830-837) -- חיפוש טקסט "עקרון ברזל"/"UndoBar"/"בלי דיאלוג אישור" בזמן התכנון
  ימצא את כולן ביחד; חלקן (deleteShifts/deleteDemoDataForWeek) דורשות עדכון, אחת (decideSwap)
  כנראה נשארת נכונה כפי שהיא (ר' open_questions #3).

### Integration Points
- src/components/supervisor/views.jsx -- ScheduleMgmt (פרסום, שלוש נקודות publish),
  ShiftMgmt/clearWeek (מחיקת שבוע), RosterWizard.jsx/PositionsScreen.jsx (deletePosition,
  אם CONFIRM-05 יבחר לכלול אותה).
- src/components/supervisor/WeekFlow.jsx -- נקודת publish רביעית (CTA-bar), וכפתור מחיקת-הדגמה.
- src/hooks/useGuardian.js -- deleteShifts/deleteDemoDataForWeek (שינוי מנגנון אפשרי, שאלה 1),
  publish (בלי שינוי מנגנון, רק gate ב-UI).
- src/components/ui.jsx -- מיקום טבעי לרכיב ConfirmDialog חדש, לצד Modal הקיים.
- CLAUDE.md (root), .claude/CLAUDE.md, .planning/PROJECT.md -- שלושת מיקומי התיעוד (סעיף 5
  ב-findings) שצריכים עדכון כחלק מהפאזה, לא side effect לא-מתועד.

</code_context>

<specifics>
## Specific Ideas

אין המלצות ספציפיות נעולות -- זהו קובץ מבוסס-קוד בלבד, ללא סבב AskUserQuestion. כל "המלצה"/"נראה
שמצביע ל-X" שמופיעה למעלה מסומנת ככזו במפורש ואינה החלטה.

</specifics>

<deferred>
## Deferred Ideas

- חיפוש-גרף רחב יותר ב-docs/architecture/system-overview.md ו-docs/product/CONTEXT_PACK.md
  לעותקים נוספים של ניסוח "ביטול במקום אישור" שלא נבדקו בסבב הזה (findings סעיף 5, הערה אחרונה).
- בדיקה אם שורה 169 ב-.claude/CLAUDE.md ("Offline-read only", מזכירה optimistic()/deferred()
  כשני מנגנוני הכתיבה היחידים) צריכה גם היא עדכון אם מתווסף מסלול-כתיבה-שלישי (פרה-אישור+מיידי).
- סקירה נרחבת יותר של קריאות-מחיקה מחוץ ל-useGuardian.js/api.js (אם CONFIRM-05 נלקח בהיקף
  רחב יותר לפי open_questions #2) -- לא בוצעה בסבב הזה, שהתמקד ב-actions layer.
- שורש הבאג "ביטול הפצה לא עובד" (Phase 13, BUG-01..04) -- לא נחקר לעומק כאן בכוונה (מחוץ להיקף
  Phase 12); ר' findings סעיף 2 לגבי מה שכן רלוונטי לחיווט Phase 12 (שכבת ה-API כבר תקינה,
  optimistic() בלי מצב-ביניים לנקות).

</deferred>
