# Phase 11: עריכה אינטואיטיבית + ניקוי הדגמה + באג "מצב השבוע" - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning — decisions locked below
**Mode:** Codebase analysis (gsd-assumptions-analyzer) + AskUserQuestion round for the two genuine
grey areas. The findings/open_questions sections below are the raw investigation; <decisions> is
what the planner should treat as locked.

<decisions>
## Locked Decisions (2026-09-23, via AskUserQuestion)

- **INLINE-01 UI**: option (ב) — add affordances directly to the board itself. `UnifiedBoard.jsx`
  gains a "+" on empty slots and an "x" on assigned avatars, both routed through the existing
  `toggleAssignment` optimistic action (useGuardian.js:589-630) — no new backend, no new DB writes,
  just new UI wired to a proven action. This is the option most faithful to "מצב השבוע... מיד אחרי
  כל שינוי" (the bug itself implies the board is where things should change).
- **Army FK scope**: in scope for this phase. The position-delete path (RosterWizard/PositionsScreen
  → `deletePosition`) must handle unmaterializing/deleting the current week's `gs_work_items` rows
  tied to a position *before* the `gs_positions` DELETE, so INLINE-01's inline delete around army
  positions doesn't hit a live FK violation mid-flow.
- **is_demo placement** (not asked — adopting the analysis's own recommendation as a low-risk
  engineering default, not a product trade-off): `is_demo boolean not null default false` lives on
  `gs_work_items` only. "Demo assignment" is *derived*, not separately flagged — any assignment on a
  work_item with `is_demo=true` is a demo assignment by definition, and the existing `on delete
  cascade` FKs already clean up `gs_work_item_assignments`/`gs_availability`/`gs_swap_requests` for
  free when the demo work_item row is deleted. Demo guards (`gs_profiles`) are **not** deleted by
  "מחק נתוני הדגמה לשבוע זה" — they may already be "real" to the supervisor by the time they click
  delete, and INLINE-03's own success criterion (ROADMAP.md:205) only checks assignment survival, not
  guard survival; removing a guard stays a separate, existing action (`removeGuard` in TeamView).
  Demo positions (army `gs_positions`) are **not** deleted either — they are reusable templates, not
  week-scoped rows; only the current week's materialized `gs_work_items` instances are removed.
- **"מצב השבוע" definition** (not asked — the analysis's proposed definition is adopted as the
  phase's working definition, needed to write a concrete repro/fix, not a product choice): everything
  derived from `data.shifts`/`data.tasks` for the displayed week — the WeekFlow stepper (`meta`,
  counts, done-flags), the board (`UnifiedBoard`), and `ScheduleMgmt`'s publish counts. The fix
  (likely sequencing `refresh()` against the realtime subscription, per findings §4) must resolve all
  three surfaces together, not just one.

</decisions>

<domain>
## Phase Boundary

מנהל מוסיף ומוחק שיבוצים ישירות בתוך "בניית שבוע" (WeekFlow.jsx, ה-view שנקרא "week" ב-
SupervisorApp.jsx) בלי לצאת מהמסך ובלי לצלול לתפריט "עוד". רשומת שיבוץ נושאת דגל is_demo (או
שקול) שמבחין בבטחה נתוני הדגמה מנתונים אמיתיים. קיימת פעולת "מחק נתוני הדגמה לשבוע זה" שמוחקת רק
רשומות is_demo של השבוע הפעיל. ו"מצב השבוע" משתקף נכון ומיידית אחרי כל שינוי — תיקון באג קיים,
לא פיצ'ר חדש.

</domain>

<findings>
## 1. מבנה מסך "בניית שבוע" — מה כבר inline היום, ומה לא

**WeekFlow.jsx הוא כל מסך "בניית שבוע".** זהו wizard יחיד עם חמישה שלבים-טאבים (STEP_OF,
WeekFlow.jsx:43-52): shifts:0, board:1, availability:2, assign:3, schedule:4. מעבר בין שלבים הוא
setStep(i) מקומי — אין ניווט למסך אחר ואין טעינת route חדשה. זה קובע מראש שכל חמשת השלבים,
כולל "assign", כבר "בתוך בניית שבוע" במובן המילולי של INLINE-01.

**שלב 0 ("shifts") — כבר תומך הוספה/מחיקה inline של הגדרת משמרת/משימה:**
- מצב לא-army: ShiftMgmt (views.jsx:465-889). הוספה: כפתור "+ משמרת" (views.jsx:596-598) פותח
  WorkItemForm כמודל בתוך אותו מסך (views.jsx:603-616); לחיצה על יום ריק פותחת טופס ישירות
  (views.jsx:730-737). מחיקה: כפתור x צף על כל כרטיס משמרת קורא ל-actions.deleteShift(s.id)
  ישירות, בלי דיאלוג אישור (views.jsx:716-726); "מחק שבוע" מוחק את כל השבוע בבת אחת
  (views.jsx:526-533, 589-591).
- מצב army: RosterWizard.jsx (הוחלף ב-Phase 6). "הוסף משימה" (RosterWizard.jsx:430-436) יוצר
  seed טיוטה; removeItem (RosterWizard.jsx:279-288) קורא ל-actions.deletePosition(item.position.id)
  ישירות דרך כפתור פח-אשפה בפאנל העריכה (RosterWizard.jsx:499-501). אבל RosterWizard עורך
  עמדות (gs_positions, תבניות חוזרות) — לא שיבוץ אדם למשמרת בודדת.

**שלב 1 ("board") — UnifiedBoard.jsx — read-only מלבד גרירה:** לפי תיעוד הכותרת של הקובץ עצמו
(UnifiedBoard.jsx:1-27, "BOARD-05"), onMove הוא "היציאה היחידה מהחוזה read-only" — גרירת
אווטאר בין שני כרטיסי-משמרת קיימים (moveAssignment, UnifiedBoard.jsx:180-202). אין דרך
להוסיף שיבוץ חדש (לגרור שומר לא-משובץ לתוך משבצת ריקה) ואין דרך למחוק שיבוץ (לגרור/ללחוץ כדי
להסיר) — רק להעביר בין שתי משבצות קיימות. זה השלב שממוקם מיד אחרי "shifts" (מ-Phase 8,
WEEKBUILD-02) והוא הכי קרוב מבחינה מושגית ל"תמונת המצב" שהמנהל רואה ראשון.

**שלב 3 ("assign") — AssignView — כבר תומך הוספה/מחיקה של שיבוץ ספציפי בקליק אחד:**
לחיצה על אווטאר שומר מול משמרת קוראת ל-actions.toggleAssignment(shift.id, g.id)
(views.jsx:1246-1249) — מוסיפה אם לא משובץ, מסירה אם כבר משובץ. הכותרת אומרת זאת במפורש: "לחץ
על {חבר צוות} כדי לשבץ או להסיר" (views.jsx:1079). זו כבר "עריכה אינטואיטיבית" בדיוק כפי
שהדרישה מתארת — אבל היא יושבת בשלב 3 (assign), לא בשלב 1 (board) שבו המנהל רואה את "מצב השבוע".

**מסקנה מרכזית:** ברמה המילולית-טכנית (לא לצאת מהמסך, לא לצלול לתפריט), חלקים גדולים מ-INLINE-01
כבר ממומשים — דרך ShiftMgmt/RosterWizard (הגדרת עבודה) ו-AssignView (שיבוץ אדם). הפער
האמיתי הוא ב"board" (השלב שהכי קרוב ל"מצב השבוע") שנשאר read-only-חוץ-מגרירה. זו נקודת ההחלטה
המרכזית לתכנון (ר' open_questions למטה).

## 2. מסלול נתוני הדגמה — מה SeedDemoDialog/onSeedDemo באמת כותב

SeedDemoDialog (views.jsx:64-122, נבנה ב-Phase 9) הוא רק ה-UI של הדיאלוג — הכתיבה בפועל קורית
ב-actions.seedDemo(guardCount) (useGuardian.js:489-508), שמפצל לפי team.mode:

- seedDemoTeam (לא-army, demoData.js:141-227) כותב: (א) gs_profiles חדשים דרך
  ensureDemoGuards (demoData.js:98-135, insert ל-gs_profiles); (ב) gs_work_items חדשים
  (kind: shift, demoData.js:177-184); (ג) gs_availability upsert
  (demoData.js:215-219). לא כותב שום שורת gs_work_item_assignments — שיבוץ אדם-למשמרת
  בפועל קורה רק מאוחר יותר, כשהמנהל מריץ "תסדר לי" (applyPlan) או משבץ ידנית (toggleAssignment).
- seedArmyRoster (army, demoData.js:301-377) כותב באותו אופן: gs_profiles (משותף עם
  הפונקציה הכללית), gs_positions חדשות דרך ensureArmyPositions (demoData.js:260-293,
  insert ל-gs_positions), מימוש gs_work_items מהעמדות דרך upsert
  (demoData.js:326-337), ו-gs_availability (demoData.js:364-368). גם כאן: בלי
  gs_work_item_assignments.
- אימות ישיר: חיפוש "gs_work_item_assignments" בתוך src/lib/demoData.js לא מחזיר אף insert/upsert —
  רק אזכור בהערת-קוד (demoData.js:6).

השלכה ל-INLINE-02: דיאלוג ה-Seed עצמו מנסח את הפעולה כ"מוסיפה חברי צוות, משמרות ושיבוצים
לדוגמה" (views.jsx:111) — אבל בפועל אין שורת "שיבוץ" (assignment) שנוצרת ישירות על ידי ה-seed.
"שיבוץ הדגמה" הופך אמיתי רק כשהמנהל בעצמו משבץ מישהו למשמרת-הדגמה (ידנית או דרך שיבוץ חכם) —
ואז זו כתיבה דרך api.assignGuard/api.applyPlan הרגילים, לא דרך demoData.js. ר' open_questions
לגבי איפה בדיוק הדגל צריך לשבת.

## 3. סכמת בסיס הנתונים — מה is_demo צריך לגעת בו

docs/database/schema-and-rls.md מיושן — נשלף "20 באוגוסט 2026" (הכותרת שלו, שורה 3),
לפני שהושלם איחוד המשמרת/משימה (Phase 2, הושלם 2026-08-26 / migration 0017-0019). המסמך עדיין
מתאר gs_shifts/gs_assignments/gs_tasks כטבלאות נפרדות (שורות 45-96) — אלה לא הטבלאות
החיות. מקור האמת האמיתי הוא supabase/migrations/ + src/lib/api.js. שווה לתעד עדכון של המסמך
הזה כ-side effect של הפאזה, לא רק לכתוב עליו כאן.

הטבלה החיה: gs_work_items (מיגרציה 0017_work_items.sql:6-27) — מאחדת משמרות ומשימות
(kind in shift/task), נושאת start_date/due_date/team_code/position_id. זו הטבלה
שדמו-דאטה בפועל כותב אליה (עם kind:shift), וזו הטבלה בעלת "שבוע" (start_date) — לכן זה
המקום הטבעי ל-is_demo boolean not null default false.

gs_work_item_assignments (0017_work_items.sql:39-48) הוא ה-join table (work_item_id,
guard_id, source, score, reason) — בלי עמודת תאריך משלו; "שבוע" שלו נגזר רק דרך work_item_id.

FK-ים קיימים כבר עושים את רוב העבודה של INLINE-03 בחינם, דרך cascade:
- gs_work_item_assignments.work_item_id מצביע ל-gs_work_items(id) עם on delete cascade
  (0017_work_items.sql:40).
- gs_availability.shift_id מצביע ל-gs_work_items(id) עם on delete cascade
  (0019_repoint_availability_swaps_and_shift_team.sql:6-9).
- gs_swap_requests.shift_id מצביע ל-gs_work_items(id) עם on delete cascade
  (0019 שם, שורות 11-14).

כלומר: מחיקת שורת gs_work_items עם is_demo=true בשבוע הפעיל מוחקת אוטומטית גם את השיבוצים
(gs_work_item_assignments), הזמינות (gs_availability) וכל בקשת-החלפה שנוגעת בה — בלי לגעת
בטבלאות האלה ישירות ובלי is_demo נפרד עליהן.

RLS לא דורש מדיניות חדשה: gs_work_items_write (0017_work_items.sql:62-65) כבר "for all"
(select/insert/update/delete) עם using (team_code = gs_my_team() and gs_is_supervisor()) — מנהל
שכבר יכול למחוק כל שורת gs_work_items של הצוות שלו יכול למחוק גם שורות is_demo, בלי מדיניות
נוספת. המיגרציה הצפויה: ALTER TABLE gs_work_items ADD COLUMN IF NOT EXISTS is_demo boolean NOT
NULL DEFAULT false — בסגנון מדויק של מיגרציות דומות (0021_fairness_window_setting.sql:11-12,
"ADD COLUMN IF NOT EXISTS ... DEFAULT ...").

gs_positions (עמדות army) נשארות מחוץ ל-cascade הזה — הן תבניות חוזרות, לא שורות-שבוע. seed
army יוצר גם עמדות חדשות (ensureArmyPositions), שלא נמחקות כשמוחקים את שורות ה-gs_work_items
שהתממשו מהן (אין on delete cascade על position_id — ר' סעיף 5 למטה). ר' open_questions.

מיפוי הקריאה/כתיבה שיצטרך לגעת ב-is_demo (api.js):
- SHIFT_SELECT (api.js:207-210) צריך להוסיף is_demo לרשימת העמודות הנשלפות.
- shiftFromRow/shiftToRow (api.js:37-88) צריכים למפות isDemo אל is_demo ובחזרה.
- shiftRowToWorkItem (api.js:223-229) הוא נקודת המעבר היחידה בין shiftToRow'ה output
  ל-payload בפועל ל-gs_work_items — demoData.js כבר משתמש בה (demoData.js:13,180), כך
  שסימון is_demo:true בפאזה הזו יכול לעבור דרך אותה פונקציה בלי לשכפל מיפוי.
- createShifts/updateShift/materializeTemplateShifts (api.js) הם כל נקודות ה-INSERT/UPSERT
  ל-gs_work_items — כל אחת צריכה להחליט אם is_demo מועבר (ברירת מחדל false לכל דבר שלא בא
  מ-demoData.js).

## 4. באג "מצב השבוע" — חשודים קונקרטיים עם file:line

"מצב השבוע" כמונח UI מדויק לא קיים כמחרוזת בקוד (חיפוש "מצב השבוע" תחת src/ לא מחזיר כלום) —
זה כנראה מונח-מוצר גג שמתאר את מה שה-stepper של WeekFlow (meta, WeekFlow.jsx:100-131, כולל
דגלי done וספירות count על כל שלב) ו/או תוכן UnifiedBoard (nav.board = "השבוע במבט אחד"
בגנרי / "תמונת מצב שבועית" ב-army — terms.js:75,123) מציגים יחד.

נבדק ולא נמצא בו סטייליות מובהקת ברמת ה-useMemo: meta, boardCount, slots, submitted,
published כולם מחושבים ב-WeekFlow.jsx כ-useMemo/inline מ-shifts/guards/availability/tasks
שמגיעים כ-props מ-data (ה-state הגלובלי של useGuardian) — התלויות נראות שלמות, ואין
useState מקומי שמשכפל אותם. אותו דבר ב-UnifiedBoard.jsx וב-CalendarView.jsx (merged =
useMemo(() => boardItemsForDates(...), [shifts, tasks, dates]), CalendarView.jsx:77). זה לא
אומר שאין באג — אומר שהוא כנראה לא ברמת "התלות חסרה ב-useMemo" הרגילה שנתפסה ב-Phase 8 (WR-02).

חשוד עיקרי, עם ראיות קונקרטיות: מרוץ בין refresh() ל-subscription ה-realtime, בלי sequencing.

- refresh() (useGuardian.js:183-195) קורא api.loadTeam(teamCode) ואז setData(team) ללא
  תנאי — בלי מספר-סידורי/AbortController שמבטיח שרק התשובה העדכנית ביותר מנצחת.
- ה-subscription ל-realtime (useGuardian.js:220-234) מאזין ל-5 טבלאות (gs_work_items,
  gs_work_item_assignments, gs_availability, gs_profiles, gs_swap_requests) וקורא
  refresh() על כל אירוע postgres_changes — כלומר כל כתיבה שהמנהל עצמו עושה מייצרת
  refresh נוסף, עצמאי, מקביל לזה שהפעולה כבר קוראת לה ישירות (לדוגמה addShifts,
  useGuardian.js:510-514, כבר קוראת refresh() בעצמה בסוף — ועדיין תקבל עוד refresh() מה-
  subscription כשה-INSERT שלה עצמה מגיע חזרה על הערוץ).
- שתים-עשרה actions לפחות קוראות run(async...) שמסתיים ב-await refresh() בעצמן (למשל
  addShifts:510, updateShift:516, addGuard:712, addRoleCompatibility:734,
  removeRoleCompatibility:740, createSwap:786, createTask:823, createTasks:829,
  editTask:835, addPosition:856, updatePosition:862, ensurePositionsForWeek:882-896) — כל
  אחת מהן, בנוסף לרענון-העצמי שלה, מפעילה גם רענון-realtime עצמאי מאותה כתיבה.
- התרחיש הריאלי: שתי פעולות מהירות ברצף (בדיוק מה ש-INLINE-01 עומד להקל ולעודד — "הוסף, ואז
  מחק, בלי לצאת מהמסך") מייצרות שתי קריאות loadTeam() חופפות לפחות, לא מסונכרנות. fetch/await
  לא מובטחים לחזור בסדר שבו נשלחו; אם התשובה הישנה יותר (זו ששיקפה רק את הפעולה הראשונה)
  חוזרת אחרי התשובה החדשה (ששיקפה כבר את שתיהן), setData(team) הישן דורס את המצב הנכון —
  בלי שגיאה, בלי console.log — "מצב השבוע" סתם מציג מספר ישן עד לאירוע-רענון הבא (אם יגיע בכלל).
  זה בדיוק תואם את ההערה ב-ROADMAP.md:214 ("cache/state בצד לקוח, invalidation חסר אחרי
  mutation, או שאילתה שלא רצה מחדש").
- לא אומת עדיין בדפדפן חי (זו עבודת ה-phase, לא של קובץ ההקשר הזה) — זה חשוד מבוסס-קוד,
  לא אבחנה סגורה. תרחיש שחזור מוצע: פתח "בניית שבוע", לחץ במהירות "מחק" על משמרת ואז "+" להוספת
  משמרת אחרת (או ההפך) לפני שה-UI מפסיק להראות "שומר…", ובדוק אם הספירות בפס השלבים/בלוח מתייצבות
  על מספר לא-נכון.

חשוד משני, קשור אך לא זהה: gs_positions לא נמצא ברשימת הטבלאות שה-subscription מאזין להן
(useGuardian.js:225-227 — רק gs_work_items, gs_work_item_assignments, gs_availability,
gs_profiles, gs_swap_requests). שינוי עמדה (army) ממקור אחר (לשונית דפדפן אחרת, לדוגמה) לא
יגרום ל-refresh() אוטומטי בטאב הזה. פחות סביר כמקור לבאג שהתרחיש שלו הוא "מנהל בודד עושה
add/delete ורואה סטטוס לא-מעודכן באותו מסך", אבל שווה לרשום כפער תיעוד/RLS נפרד.

חשוד שלישי, ספציפי ל-army + מחיקת "משימה"/עמדה: gs_work_items.position_id מצביע ל-
gs_positions(id) בלי on delete cascade (0017_work_items.sql:25, ואותו דבר במקור ב-
0007_standing_positions.sql:65-67 לפני האיחוד). RosterWizard'ה removeItem (RosterWizard.jsx
:279-288) ו-PositionsScreen'ה מחיקה (PositionsScreen.jsx:138) שתיהן קוראות ל-
actions.deletePosition(id) שמפעיל DELETE ישיר על gs_positions (api.js:1040-1046) — אם
לעמדה הזו כבר יש שורות gs_work_items ממומשות (השבוע הנוכחי, למשל), ה-DELETE צפוי להיכשל על
הפרת מפתח-זר בפועל (Postgres NO ACTION כברירת מחדל), לא "להיעלם בשקט". זה לא "מצב השבוע לא
מתעדכן" במובן הצר, אבל זה תרחיש-כישלון אמיתי שסביר שהמתכנן ייתקל בו אם INLINE-01 יבנה מחיקת-
"משימה" inline סביב army עמדות שכבר מומשו לשבוע המוצג.

## 5. פעולות הוספה/מחיקה קיימות ב-useGuardian.js/api.js

| פעולה | קובץ:שורה | מנגנון | הערה |
|---|---|---|---|
| addShifts(shifts) | useGuardian.js:510-514 | run + refresh() מלא | הוספת משמרת/משמרות (לא-army) |
| updateShift(id, patch) | useGuardian.js:516-520 | run + refresh() | עריכת משמרת קיימת |
| deleteShift(id) | useGuardian.js:522-527 | deferred (UndoBar 8s) | מחיקה בודדת, בלי דיאלוג אישור |
| deleteShifts(ids, label) | useGuardian.js:533-538 | deferred | מחיקת אצווה (למשל "מחק שבוע") |
| replaceShifts(ids, rows, label) | useGuardian.js:553-575 | deferred | "מלא שבוע" — מחליף, לא מוסיף |
| toggleAssignment(shiftId, guardId, note) | useGuardian.js:589-630 | optimistic | זו פעולת ה-add/delete-שיבוץ הקיימת — קליק אחד מוסיף/מסיר אדם ממשמרת; בודקת רק כשירות (checkQualification), לא אילוצים קשיחים מלאים |
| moveAssignment(from, to, guardId) | useGuardian.js:638-670 | optimistic | גרירה בין שתי משמרות (הלוח, BOARD-05) — לא add/delete אמיתי, רק "שני toggle יחד" |
| applyPlan(shiftIds, assignments) | useGuardian.js:679-686 | run + refresh(), rethrow:true | תוצאת שיבוץ חכם |
| clearAssignments(shiftIds) | useGuardian.js:688-698 | deferred | ניקוי שיבוצי auto למשמרות נבחרות |
| addPosition/updatePosition (army) | useGuardian.js:856-866 | run + refresh() | עמדה (לא שיבוץ אדם) |
| deletePosition(id) (army) | useGuardian.js:868-873 | deferred | ר' חשוד מס' 3 לעיל — FK ללא cascade |

מסקנה ל-INLINE-01: toggleAssignment כבר הוא "הוסף/מחק שיבוץ inline בלחיצה אחת" — קיים,
עובד, ונבדק (AssignView). מה שחסר הוא לא לוגיקת ה-action אלא UI שקורא לו (או למקבילה שלו)
מתוך שלב ה-board, אם זה הכיוון שהפאזה תבחר (ר' שאלה פתוחה מס' 1 למטה). moveAssignment הוא תבנית
מוכנה להעתקה: כבר בונה "שני toggleAssignment כ-patch אחד" בתוך UnifiedBoard דרך גרירה —
add-in-place/delete-in-place על הלוח יכולים להישען על אותה תבנית optimistic() + checkQualification
בדיוק, בלי לגעת ב-DB layer.

</findings>

<open_questions>
## שאלות פתוחות שדורשות AskUserQuestion בתכנון (לא הוכרעו כאן)

1. מהו ה-UI המדויק ל-INLINE-01? שלוש אופציות עולות מהקוד הקיים, לא שקולות בהיקף עבודה:
   - (א) "לא לגעת" בשלב board — להסתמך על מה שכבר קיים. AssignView (שלב 3) כבר תומך
     קליק-להוסיף/להסיר, ו-ShiftMgmt/RosterWizard (שלב 0) כבר תומכים הוספה/מחיקה של הגדרת
     עבודה. אם זה מספיק כדי לעמוד ב-INLINE-01, הפאזה מצטמצמת בעיקר ל-INLINE-02/03/04.
   - (ב) להוסיף add/delete לשלב board עצמו (UnifiedBoard.jsx/BoardCard) — למשל: כפתור "+"
     על משבצת עם מקום פנוי שפותח בורר-שומר קצר, ולחיצה/X על אווטאר קיים שמסיר אותו. זה הכי קרוב
     למובן "בלי לנווט לשום מקום, ממש על תמונת המצב" — אבל רכיב חדש שלא קיים היום בשום צורה
     (UnifiedBoard.jsx היום read-only מלבד onMove).
   - (ג) קיצור-דרך מהלוח לשלב assign (למשל onRowClick/onCardClick שקופץ ישר לשלב 3 עם
     המשמרת הזו ממוקדת) — ביניים בין (א) ל-(ב), משתמש בתבנית ה-focused-row הקיימת מ-Phase 8
     (WEEKBUILD-05, RosterWizard.jsx focusedKey) בלי לבנות טופס-שיבוץ חדש בתוך הלוח.
   - ההמלצה שעולה מהראיות: (ב) הכי נאמנה לניסוח "מצב השבוע... מיד אחרי כל שינוי" (הבאג עצמו
     מרמז שה-board אמור להיות המקום שמשתנה), אבל (א)/(ג) הן פחות עבודה ופחות סיכון רגרסיה.

2. איפה בדיוק is_demo צריך לשבת — ומה בדיוק "מחק נתוני הדגמה" מוחק?
   - gs_work_items.is_demo מכסה משמרות/משימות-הדגמה, ומוריד cascade את השיבוצים/זמינות/
     בקשות-החלפה שלהן (ר' סעיף 3). אבל דמו לא יוצר שיבוצים ישירות — שיבוץ-הדגמה נוצר רק כשהמנהל
     בעצמו משבץ מישהו למשמרת-הדגמה. האם "שיבוץ הדגמה" = "שיבוץ שנוצר בכל דרך על משמרת עם
     is_demo=true" (נגזר, לא דגל עצמאי — התנהגות ה-cascade כבר נותנת את זה בחינם), או שצריך דגל
     is_demo נפרד גם על gs_work_item_assignments עצמה?
   - gs_profiles (שומרי הדגמה) — נשארים או נמחקים? ניסוח INLINE-03 הוא "לשבוע זה" — שומרים
     אינם ישות-שבועית, וקריטריון ההצלחה במפרש (ROADMAP.md:205) בודק רק "שיבוץ אמיתי"/"שיבוץ
     הדגמה", לא שומרים. ברירת המחדל הסבירה: שומרי-הדגמה נשארים (יכולים כבר להיות "אמיתיים"
     בעיני המנהל אחרי שראה את ה-demo), והסרתם (אם רצויה) נשארת דרך actions.removeGuard הקיים
     ב-TeamView — אבל זו הנחה שצריך לאשר, לא עובדה.
   - gs_positions (עמדות-הדגמה, army) — נשארות או נמחקות? אלה תבניות חוזרות, לא שורות-שבוע;
     "מחק לשבוע זה" לא אמור להיות "מחק את העמדה עצמה" (זה היה משפיע על שבועות עתידיים גם כן). כנראה
     שהעמדה עצמה נשארת, ורק ה-gs_work_items שהתממשו ממנה לשבוע הפעיל נמחקים — אבל, שוב, לא
     מוכרע כאן.

3. מה בדיוק "מצב השבוע" מתייחס אליו? אין מחרוזת UI כזו בקוד היום — זה או פס-השלבים
   (WeekFlow.jsx meta, ספירות+done) או תוכן ה-board (nav.board) או שניהם יחד. INLINE-04 דורש
   "לתקן את הבאג", אבל בלי הגדרה חד-משמעית של מה בדיוק "מצב השבוע" אומר על המסך, קשה לכתוב תרחיש
   שחזור מדויק. ההמלצה: להגדיר "מצב השבוע" = כל מה שנגזר מ-data.shifts/data.tasks על טווח השבוע
   המוצג (ה-stepper + הלוח + ScheduleMgmt'ה ספירות פרסום) — ולוודא שהתיקון (כנראה sequencing
   ל-refresh(), ר' סעיף 4) פותר את כולם יחד, לא רק אחד.

4. סיכון ה-FK על מחיקת עמדה army (gs_positions/gs_work_items.position_id, בלי cascade) —
   האם זה בסקופ של INLINE-01 (כי מחיקת "משימה" ב-RosterWizard היא בדיוק "מחיקת שיבוץ ב-בניית
   שבוע" מבחינת army), או שזו תקלה קיימת ונפרדת שמפורשות לא מתוקנת בפאזה הזו? אם המתכנן בונה
   מחיקה inline חדשה סביב עמדות שכבר מומשו לשבוע, הכישלון הזה צפוי לצוץ ולדרוש טיפול (למשל:
   deletePosition שגם מנקה/מבטל-מימוש את שורות ה-gs_work_items המקושרות לשבוע הנוכחי לפני
   המחיקה, או הופך למדיניות "אי אפשר למחוק עמדה עם שבוע ממומש").

</open_questions>

<code_context>
## Existing Code Insights

### Reusable Assets
- useGuardian.js:589-630 — toggleAssignment, פעולת ה-add/delete-שיבוץ הקיימת
  (optimistic, בודקת כשירות בלבד). המועמד הראשון להישען עליו מכל UI inline חדש.
- useGuardian.js:638-670 — moveAssignment, תבנית "שני toggle כ-patch אחד" — דגם
  מוכן לכל תוספת add/delete-בלוח שתרצה patch אטומי בלי הבהוב.
- src/components/supervisor/UnifiedBoard.jsx:126-270 — DayColumn/BoardCard, נקודת ההשקה
  הטבעית להוספת affordances חדשים (add/delete) אם התכנון בוחר באופציה (ב) בשאלה הפתוחה מס' 1.
  draggableHere/dragProps (שורות 180-202) הוא התבנית הקיימת היחידה לכתיבה מתוך הרכיב הזה.
- src/lib/api.js:207-210 — SHIFT_SELECT, המחרוזת שצריך להוסיף לה is_demo (וגם ב-demoData.js
  שמשתמש באותה קבועה, demoData.js:13).
- src/lib/api.js:223-229 — shiftRowToWorkItem, נקודת המעבר היחידה ל-payload בפועל — מקום טבעי
  להזרים is_demo:true מ-demoData.js בלי לשכפל מיפוי.
- supabase/migrations/0021_fairness_window_setting.sql — תבנית מיגרציה קרובה
  (ADD COLUMN IF NOT EXISTS ... DEFAULT ...) לחיקוי מדויק עבור gs_work_items.is_demo.

### Established Patterns
- optimistic(patch, work) / deferred(label, patch, work) (useGuardian.js:265-332) — שני
  המנגנונים היחידים לכתיבה מקומית; כל action חדש (add/delete inline, מחיקת הדגמה) אמור להשתמש
  באחד מהם, לא להמציא מנגנון שלישי.
- .select() אחרי כל DELETE/UPDATE ובדיקת ספירת-שורות — המוסכמה המתועדת נגד "RLS מסננת בשקט"
  (api.js:569-579, 1040-1046 ודומיהם). כל endpoint חדש ל-INLINE-03 (מחיקת הדגמה בבת-אחת) חייב
  לאמץ את אותה מוסכמה.
- FK "on delete cascade" בין gs_work_items לילדיו (gs_work_item_assignments, gs_availability,
  gs_swap_requests) — עקרון-עיצוב קיים ש-INLINE-03 יכול לרתום, לא לשכפל ידנית ב-JS.

### Integration Points
- src/hooks/useGuardian.js — actions (הוספת deleteDemoDataForWeek או שם דומה + עדכון refresh
  אם התיקון לבאג בסעיף 4 כולל sequencing).
- src/components/supervisor/UnifiedBoard.jsx / WeekFlow.jsx — כל UI חדש ל-INLINE-01 תלוי
  בהחלטה בשאלה הפתוחה מס' 1.
- src/lib/api.js — SHIFT_SELECT, shiftFromRow/shiftToRow/shiftRowToWorkItem,
  createShifts/updateShift/materializeTemplateShifts — כל נקודות הכתיבה/קריאה ל-gs_work_items
  שצריכות להכיר is_demo.
- src/lib/demoData.js — seedDemoTeam/seedArmyRoster, שתי נקודות ה-insert היחידות שצריכות
  לסמן is_demo:true על כל שורת gs_work_items שהן יוצרות.
- docs/database/schema-and-rls.md — מיושן (קודם ל-Phase 2); עדכון שלו הוא side-effect סביר של
  מיגרציית is_demo, לא רק תיעוד-קונטקסט.

</code_context>

<specifics>
## Specific Ideas

אין המלצות ספציפיות נעולות — זהו קובץ מבוסס-קוד בלבד (ר' Mode למעלה). כל "המלצה" שמופיעה
ב-open_questions מסומנת ככזו במפורש ואינה החלטה.

</specifics>

<deferred>
## Deferred Ideas

- עדכון docs/database/schema-and-rls.md המלא (לא רק is_demo) — מחוץ לסקופ הפורמלי של הפאזה,
  אבל התיעוד כבר מיושן משמעותית (טבלאות שלמות שכבר לא קיימות) ומומלץ לפחות לתקן את השורות הנוגעות
  ל-gs_work_items/gs_work_item_assignments כחלק מהעבודה כאן, כדי לא להוסיף is_demo למסמך
  שממילא שגוי.
- תיקון ה-FK-ללא-cascade על gs_work_items.position_id/gs_positions (חשוד מס' 3, סעיף 4) — אם
  המתכנן יחליט שזה מחוץ לסקופ INLINE-01, כדאי לפחות לתעד אותו כ-tech debt ידוע במקום להיתקל בו
  בלי הסבר באמצע העבודה.
- הוספת gs_positions לרשימת הטבלאות שה-realtime subscription מאזין להן (useGuardian.js:225-227)
  — נמצא כפער נלווה (חשוד משני, סעיף 4), לא חלק מהותי מהבאג המרכזי; אפשר לתקן כ-quick fix נפרד אם
  לא ייכנס לסקופ הפאזה.

</deferred>
