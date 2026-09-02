# Phase 5: הלוח המאוחד - Research

**Researched:** 2026-09-02
**Domain:** React/Vite UI integration inside an existing codebase — no new external libraries; the work is reading, correcting, and extending existing pure modules (`dates.js`, `positions.js`) and existing screen-composition patterns (`WeekFlow.jsx`, `views.jsx`, `PositionsScreen.jsx`).
**Confidence:** HIGH — every claim below is grounded in files read this session, not training-data guesses about the codebase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**יחס למסכים הקיימים**
- **D-01:** הלוח המאוחד מחליף **לגמרי** את מסך "השבוע" (WeekCalendar) הקיים בצד המנהל — לא מצטרף לידו. — Reversibility: costly.
- **D-02:** הלוח המאוחד חל גם על המשתתף (GuardApp) — מאחדים את האפקט. `MySchedule` הקיים כבר ממזג משמרות ומשימות דרך `withEngineTasks()`, ולכן חלק מ-BOARD-01 בצד המשתתף כבר קיים בפועל; הפאזה צריכה לוודא עקביות ויזואלית/סימונית מול הצד המנהל (בעיקר BOARD-03), לא לבנות תשתית מיזוג חדשה שם.
- **D-03:** מסך "משימות" (TaskMgmt) הנפרד **נשאר נפרד** — ממשיך לשמש לניהול (יצירה/עריכה/סיום משימה). הלוח המאוחד הוא תצוגת קריאה, לא כלי ניהול.
- **D-04:** הלוח המאוחד יושב כ**שלב הראשון** בתוך מסך "השבוע" הקיים — מה שמנהל רואה ראשון כשנכנס הוא הלוח עצמו, לא שלב נוסף שצריך לחפש אותו.

> **CRITICAL CORRECTION to D-02's premise — see `<gap_investigation>` §1 below.** The claim "`MySchedule` הקיים כבר ממזג משמרות ומשימות דרך `withEngineTasks()`" is **factually wrong** as verified against the live source this session. `withEngineTasks()` is called in `GuardApp.jsx` **only** to feed `teamAverages()` for the fairness numbers — it is never used to build the visible duty list. The guard-facing screen shows **zero tasks**, anywhere, today. D-02's *decision* (unify the guard side too) still stands and is not being second-guessed here — but the planner must treat GuardApp's merge as **new work**, not verification of existing work. See the gap section for exact line citations.

**תצוגת עמדה קדימה (BOARD-02)**
- **D-05:** לוח העמדה מציג **4 שבועות קדימה**.
- **D-06:** תצוגה אחת משותפת לשתי צורות העמדה (תבנית / שבועית) — אין צורך בשתי תצוגות נפרדות עבור D-01/D-02 מפאזה 4.
- **D-07:** נגיעה בשורה עתידית של עמדת תבנית (לפני שהיא התממשה) פותחת **עריכה בלבד** — אין אפשרות לפעול (לשבץ/להשבית) על שורה שטרם קיימת.
- **D-08:** תצוגת העמדה היא **לקריאה בלבד** בשלב זה — אין פעולות (כמו שיבוץ ידני) מתוך התצוגה. — Reversibility: reversible.

**סימון חסימת כשירות מאוחד (BOARD-03)**
- **D-09:** משימה חסומה לאדם מסוים על הלוח המאוחד מקבלת **בדיוק** את הטיפול מ-QUAL-08 (04-03, Phase 3): disabled + תווית מוחלפת + סמל מנעול + טבעת ניטרלית (לא danger) — לא שפה ויזואלית חדשה. הקוד הקיים ב-`AssignView`/`supervisor/views.jsx` הוא מקור האמת לטיפול הזה.
- **D-10:** הלוח מציג חסימות **רק** על פריטים שכן מושצו ולכן חסומים — לא סורק ומציג פריטים שמעולם לא הוצעו לאדם הזה.
- **D-12:** לוח שמערבב משמרות ומשימות — **אין** אינדיקטור ויזואלי נפרד שמבדיל בין השניים (כמו צבע ייחודי למשימה). האסתטיקה זהה לגמרי; ההבדל היחיד שנשאר גלוי הוא תוכן הפריט עצמו.

**מבחן הכניסה (BOARD-04)**
- **D-13:** הבדיקה המעשית של "אדם שלא ראה את האפליקציה מעולם" היא: מנהל חדש מגדיר שבוע שלם על הלוח המאוחד לבד, בלי שאף אחד מסביר לו.
- **D-14:** הלוח **אינו** כולל onboarding/legend מפורש — הצפיפות והעיצוב עצמם צריכים להסביר, בלי עזר חיצוני נפרד.
- **D-15:** מצב שבו לאדם אין שום דבר בשבוע הנוכחי מקבל **מצב ריק מנוסח** (לא הודעת אזהרה/שגיאה).
- **D-16:** צפיפות של הרבה פריטים ביום אחד מטופלת כ**רשימה אנכית ממוינת לפי זמן** — לא קיבוץ לפי שעה/תקופה.

### Claude's Discretion

- **D-11 (חסימת כשירות במשימה מרובת-שיבוץ):** האם החסימה מוצגת ברמת האדם הבודד בתוך הרשימה, או ברמת הפריט כולו — התשובה בדיון עצמו הייתה לא חד-משמעית. ה-planner/researcher צריכים להכריע לפי הדפוס הקיים ב-`TaskMgmt`/`views.jsx` לטיפול במשימות מרובות-שיבוץ, לא להמציא דפוס חדש.
  → **Resolved by this research, HIGH confidence:** per-assignee-row, not per-item. See `<gap_investigation>` §3.

### Deferred Ideas (OUT OF SCOPE)

None — הדיון נשאר בגבולות הפאזה.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOARD-01 | לוח אחד מציג משמרות ומשימות יחד, ממוין ומסודר | `<gap_investigation>` §1–2 resolves the merge gap; `<architecture>` gives the concrete component/data plan for both manager and guard sides. |
| BOARD-02 | לכל עמדה יש תצוגה שבה רואים את הלוז שלה רץ קדימה | `<board02_positions>` confirms `positions.js` is sufficient as-is for 4 weeks, with one required extension (`missingRowsForWeek` reuse for "not yet realized" rows). |
| BOARD-03 | הלוח מסמן חסימת כשירות באותו אופן לשני סוגי הפריטים | `<gap_investigation>` §3 locates and quotes the exact QUAL-08 treatment to replicate; resolves D-11 (per-assignee-row). |
| BOARD-04 | אדם שלא ראה את האפליקציה מעולם מבין מה הלוח מראה, בלי הסבר | `<common_pitfalls>` and `<architecture>` density/empty-state guidance keyed to D-14/D-15/D-16. |

</phase_requirements>

## Summary

Phase 5 is not a "new technology" phase — it introduces no library, no new database table, no new npm dependency. It is a **UI-composition and pure-function-extension** phase inside a codebase whose architecture is already fully formed: `withEngineTasks`/`taskAsShiftShape`/`isTaskEngineEligible` (Phase 2) is the one merge path, `isQualified`/QUAL-08's visual treatment (Phase 3) is the one blocking convention, and `positions.js`'s `expectedDatesForWeek`/`plannedRowsForWeek` (Phase 4) is the one forward-projection engine. The entire research task was therefore to (1) verify these building blocks actually do what CONTEXT.md assumes, and (2) find the one genuine gap CONTEXT.md flagged explicitly: engine-ineligible items (multi-day tasks, hour-less/"frozen" tasks, weekly-shape standing positions) fall out of `withEngineTasks` silently.

Two findings should reshape planning:

1. **D-02's premise is wrong.** `GuardApp.jsx`'s `MySchedule` does **not** already merge tasks into the visible schedule — `withEngineTasks()` there feeds only the fairness numbers (`teamAverages`). The guard-facing "your upcoming duties" list and "הסידור המלא של הצוות" block both read straight from the raw `shifts` prop. Building the guard-side unified view is full scope for this phase, not verification work.
2. **The engine-eligibility gap has a concrete, minimal, already-precedented resolution.** `TaskMgmt`'s `TaskRow` already renders exactly this class of item today (label a task "מחוץ למנוע" with a neutral badge, show a date range via `rangeText()` instead of hours) — that is the display convention to carry onto the board, not invent. And Phase 4's `positions.js` already established the "identity date" idiom (`task.dueDate || task.startDate`) for anchoring a range-shaped or hour-less item to a single calendar slot. Combining both existing conventions gives the board a display-only (never engine-feeding) path for the items `withEngineTasks` drops.

**Primary recommendation:** Add one new pure function to `src/lib/dates.js` — a display-only sibling to `taskAsShiftShape`, not a replacement — that classifies every task into exactly one of three buckets (engine-eligible / frozen-single-day / multi-day-or-weekly-position) and anchors the latter two to `task.dueDate || task.startDate` for board placement, reusing `isTaskEngineEligible`/`isSingleDayTask` for the classification so the board can never disagree with the engine about what counts as "in the engine." Never feed a fabricated hour into `taskAsShiftShape` for these — that path is explicitly forbidden by the project's own Out-of-Scope table ("מילוי שעות למשימות ישנות" — REQUIREMENTS.md line 70).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Merge shifts+tasks into one time-sorted list (BOARD-01) | Frontend (pure lib: `src/lib/dates.js`) | — | Must stay a pure, cycle-free function alongside `withEngineTasks` so `autoAssign.js`/`conflicts.js` and the board consume identical merge logic — no second merge path (established constraint, Phase 2). |
| Render the merged list as the manager's Week-flow step 0 | Frontend (React component, `src/components/supervisor/`) | — | Presentation only; no new state beyond what `WeekFlow`/`SupervisorApp` already hold (`shifts`, `tasks`, `guards`, `weekDates`). |
| Render the guard's unified duty list | Frontend (React component, `src/components/GuardApp.jsx`) | — | Same merge function as the manager side, different container. |
| Forward 4-week position projection (BOARD-02) | Frontend (pure lib: `src/lib/positions.js`) | Frontend (React, `PositionsScreen.jsx`) | `positions.js` already computes deterministic per-week rows; the screen only needs to call it 4× with 4 different `sundayISO` values and merge with realized rows for "already happened" vs "planned" styling. |
| Qualification-blocked visual treatment (BOARD-03) | Frontend (React, shared render helper) | — | Pure display logic over `isQualified()` (Phase 3, `autoAssign.js`) — no new business rule, must not diverge from `checkQualification`'s wording. |
| Empty/dense states (BOARD-04) | Frontend (React) | — | No backend involvement; purely a rendering/copy concern. |

No capability in this phase touches the API/backend tier or the database — `api.js`'s row mappers already expose every field the board needs (`category`, `assignees`/`assignedGuards`, `startDate`/`dueDate`, `startTime`/`endTime`, `positionId`). Confirmed by reading `src/lib/api.js` lines 17–135 and 96–120 this session — no new column, no new migration required for Phase 5.

## Standard Stack

### Core

No new libraries. This phase's "stack" is the existing pure-function layer:

| Module | Role in this phase |
|--------|---------------------|
| `src/lib/dates.js` | `withEngineTasks`, `taskAsShiftShape`, `isTaskEngineEligible`, `isSingleDayTask` — the engine-eligible merge; extend with one new display-only adapter (see `<gap_investigation>`). |
| `src/lib/positions.js` | `expectedDatesForWeek`, `plannedRowsForWeek`, `qualifiedGuardsForPosition`, `workingGuardIdsForWeek` — forward projection, unchanged, called across 4 weeks. |
| `src/lib/autoAssign.js` | `isQualified(guard, category)` — the single qualification check; the board must call this, never re-derive it. |
| `src/lib/terms.js` | `t()` — new nav/empty-state copy must go through this, not a hardcoded string, per the existing `civil`/`army` mode split. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | ^3.4.1 (confirmed `package.json`) | Layout/spacing for the new board component | Already the only styling mechanism in the app — no CSS-in-JS, no new utility library. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built CSS-grid week board (existing `WeekCalendar.jsx` pattern) | `react-big-calendar` / `FullCalendar` | Rejected by the project itself already — `WeekCalendar.jsx`'s own header comment states both are weak in RTL, add ~hundreds of KB, and don't know the design tokens. No reason to reconsider for Phase 5; the unified board is a **vertical sorted list** per D-16, not a time-grid, so a calendar-grid library is doubly inapplicable here. |

**Installation:** none — no new packages.

**Version verification:** N/A — no packages added or upgraded this phase. Confirmed via `Read` of `package.json` this session: React 18.2.0, Vite 5.2.0, Tailwind 3.4.1, `@supabase/supabase-js` 2.101.0, Recharts 2.12.3, no test runner/linter (matches CLAUDE.md).

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** `npm test` continues to run the existing Node-script chain (`verify-scheduler.mjs`, `verify-planning.mjs`, `verify-positions.mjs`); any new pure-function test added by this phase follows that exact pattern (see `<validation_architecture>` below) and requires zero new dependencies.

<gap_investigation>
## Gap Investigation (the researcher's core task for this phase)

### §1 — D-02's premise is factually wrong: GuardApp shows zero tasks today

Read `src/components/GuardApp.jsx` in full this session (grepped every `task`-matching line, then read the surrounding context).

- `MySchedule` (`GuardApp.jsx:130`) destructures `tasks = []` but the **only** use of it is:
  ```js
  // GuardApp.jsx:146-153
  const withTasks = useMemo(
    () => withEngineTasks(publishedAll, tasks),
    [publishedAll, tasks]
  );
  const { perGuard, avg } = useMemo(
    () => teamAverages(guards, withTasks),
    [guards, withTasks]
  );
  const mine_ = perGuard[user.id];
  ```
  `mine_` feeds only `<FairnessLine mine={mine_} avg={avg} />` — three numbers (shift count, night count, load), never a rendered duty.
- The visible "next duty" and "upcoming" list is built at `GuardApp.jsx:132-136` from **raw `shifts`**:
  ```js
  const mine = shifts
    .filter((s) => s.published && s.assignedGuards.includes(user.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  ```
  No `tasks` anywhere in this expression.
- The team-wide "הסידור המלא של הצוות" block (`GuardApp.jsx:260-330`) also maps `publishedAll` — again shifts only.
- `grep -i task GuardApp.jsx` (run this session) returns exactly 8 lines total, all inside the `withTasks`/`teamAverages` fairness path or unrelated (`MySwaps`'s `tasks` prop pass-through to `checkAssignment`, which is a conflict check, not a display).

**Conclusion:** CONTEXT.md's Code Context section states "MySchedule הקיים כבר ממזג משמרות ומשימות דרך `withEngineTasks()`" — this is true only for the *fairness computation*, not for anything the guard actually sees. The planner should **not** scope the guard-side task as "verify consistency" (as CONTEXT.md's D-02 implementation note suggests) — it must be scoped as **build the merge into the visible list**, reusing the exact same merge function BOARD-01 builds for the manager side. `[VERIFIED: src/components/GuardApp.jsx:130-329]`

### §2 — Exactly which data shapes fall outside `withEngineTasks`, and why

Read `src/lib/dates.js:199-270` and `src/lib/api.js:96-135` and `src/lib/positions.js:42-72` this session.

`isTaskEngineEligible` (`dates.js:210-211`):
```js
export const isTaskEngineEligible = (task) =>
  isSingleDayTask(task) && Boolean(task?.startTime) && Boolean(task?.endTime);
```
`isSingleDayTask` (`dates.js:200-201`):
```js
export const isSingleDayTask = (task) =>
  Boolean(task?.dueDate) && (!task.startDate || task.startDate === task.dueDate);
```

A task fails eligibility for exactly one of two independent reasons — and a given task can fail for **both** at once:

1. **Multi-day span** — `task.startDate !== task.dueDate` (both are non-null, real dates from `taskFromRow`, `api.js:110-111`: `startDate: row.start_date || null`, `dueDate: row.due_date`). Any task a manager creates through `TaskMgmt`'s form with different start/end dates falls here, *regardless of whether hours are filled* — the form itself only shows the hour fields when `isSingleDayTask(form)` is true (`views.jsx:1633`, `showHours = isSingleDayTask(form)`), and forcibly blanks them on save if the range isn't single-day (`views.jsx:1647-1649`).
2. **Missing hours ("frozen")** — `!task.startTime || !task.endTime`, independent of span. This covers: (a) genuinely pre-migration rows (the columns didn't exist for them to have hours in, per `dates.js`'s file-header comment), and (b) any **new** single-day task a manager deliberately saves without hours — the task form allows this by design (Phase 2 D-05, quoted in `TaskMgmt`'s `blank` object comment at `views.jsx:1567-1569`: "ריקות בכוונה, בלי ברירת מחדל... שעה שמישהו לא הקליד בעצמו לא נכנסת למנוע בשקט"). So "frozen" is **not** only a legacy-data phenomenon — it is an ongoing, intentional first-class state a manager can put a brand-new task into today. `[VERIFIED: src/lib/dates.js:199-211, src/components/supervisor/views.jsx:1567-1569,1633-1649]`

**Weekly-shape standing positions** (Phase 4) are a *third* named case in CONTEXT.md's Specifics, but mechanically they are just an instance of case 1: `plannedRowsForWeek`'s `weekly` branch (`positions.js:45-58`) realizes to a `gs_tasks` row with `startDate: sundayISO, dueDate: addDays(sundayISO, 6), startTime: null, endTime: null` — a 7-day span with no hours, i.e., it fails **both** conditions simultaneously. No fourth shape exists: every row in `gs_tasks` (whether hand-created, pre-migration, or position-realized) is fully described by these two booleans (`isSingleDayTask`, `Boolean(startTime && endTime)`), so the classification below (§4) is exhaustive over the *existing* schema — confirmed by reading every `taskFromRow` field (`api.js:96-120`), there is no other nullable field that would create a fifth shape. `[VERIFIED: src/lib/positions.js:42-58, src/lib/api.js:96-120]`

### §3 — Existing UI precedent for these items, and the QUAL-08 source of truth

Two precedents exist today, and this phase must reuse both rather than invent a third:

**(a) `TaskMgmt`'s `TaskRow`** (`views.jsx:1721-1812`) already renders exactly the ineligible-item case, today, for the separate task list (D-03 keeps this screen alive unchanged):
```js
// views.jsx:1728-1798 (verbatim, condensed to the load-bearing parts)
const eligible = isTaskEngineEligible(task);
...
{!eligible && (
  <span title="המשימה לא נושאת שעות, או פרושה על יותר מיום אחד — ולכן היא לא נכנסת למנוע: ...">
    <Badge tone="neutral" icon="lock">מחוץ למנוע</Badge>
  </span>
)}
...
{eligible && (
  <span className="flex items-center gap-1">
    <Icon name="clock" size={11} />
    {task.startTime}–{task.endTime}
  </span>
)}
```
and a separate `rangeText()` helper (`views.jsx:1526-1531`) formats the date span as a sentence (`"12 בספטמבר – 14 בספטמבר"`) whenever `startDate !== dueDate`, with no time component. This is the exact convention (badge + range text, no fabricated hour) the board should carry forward for these items, not a new one. `[VERIFIED: src/components/supervisor/views.jsx:1526-1531,1721-1798]`

**(b) `positions.js`'s "identity date" idiom** for hour-less/range items — Phase 4 already solved "what single calendar slot does an hour-less, week-spanning row belong to" by anchoring to `dueDate`:
```js
// positions.js:106-118 — workingGuardIdsForWeek
const fromTasks = (tasks || [])
  .filter((t) => t.positionId === position.id && week.has(t.dueDate || t.startDate))
  .flatMap((t) => t.assignees || []);
```
and `PositionsScreen.jsx:286` repeats the identical fallback expression `task.dueDate || task.startDate` for per-guard date grouping. This `dueDate || startDate` idiom appears independently in three files (`dates.js:220` inside `taskInterval`, `positions.js:114`, `PositionsScreen.jsx:286`) — it is the codebase's established convention for "the one date that represents this item when it must occupy exactly one slot," and the board should reuse it rather than invent a different anchor (e.g. `startDate`, or "show on every day of the span"). Note precisely what this precedent does **not** establish: none of these three call sites *expand* a multi-day item across every date it spans — each treats it as occupying a single date. There is no existing precedent anywhere in the codebase for "render a multi-day item once per day of its range"; that would be new UI behavior this phase would be inventing, not reusing. `[VERIFIED: src/lib/positions.js:106-118, src/components/supervisor/PositionsScreen.jsx:286, src/lib/dates.js:220]`

**QUAL-08 source of truth**, per D-09 — read `src/components/supervisor/views.jsx:1073-1189` (the `AssignView` per-guard-button treatment) and `views.jsx:2083-2124` (the `TaskMgmt` per-assignee-chip treatment inside the task form). Both apply the **identical four-part signal** to one blocked person (not to the whole shift/task):
```js
// AssignView, views.jsx:1094-1170 (condensed)
disabled={busy || !qualified}
className={... !qualified ? "ring-hairline-strong bg-surface-sunken" : ...}  // neutral ring, not danger
...
{!qualified && (
  <span className="... bg-surface text-muted"><Icon name="lock" size={11} /></span>
)}
...
{!qualified ? "לא כשיר/ה" : (assigned && <Icon name="check" ... />)}
```
```js
// TaskMgmt assignee chip, views.jsx:2089-2119 (condensed)
disabled={!qualified}
className={... !qualified ? "ring-hairline-strong bg-surface-sunken text-muted" : ...}
{!qualified ? (
  <span className="flex items-center gap-1 text-[11px]"><Icon name="lock" size={13} /> לא כשיר/ה</span>
) : ( on && <Icon name="check" ... /> )}
```
Four signals, present in both: (1) `disabled`, (2) replaced label text ("לא כשיר/ה"), (3) lock glyph, (4) neutral (`ring-hairline-strong`/`bg-surface-sunken`), never `ring-danger`. This is the literal STATE.md-logged QUAL-08 description ("a blocked candidate ... carries three redundant signals (disabled, replaced label, lock glyph) plus a neutral (not danger) ring") — confirmed against the live source, not just the log entry. `[VERIFIED: src/components/supervisor/views.jsx:1073-1189,2083-2124]`

**Resolving D-11 from this evidence:** both existing multi-assignee treatments (`AssignView`'s guard grid, `TaskMgmt`'s assignee-chip picker) apply QUAL-08 **per person**, never as a single item-level badge covering the whole shift/task. There is no code anywhere in the app that collapses "this task has an unqualified assignee" into one item-wide flag — the closest thing, `qualBlocked` in `TaskMgmt`'s form (`views.jsx:1627`), is a save-gate boolean, not a display convention, and even it is explained to the manager by naming the specific blocked people (`views.jsx:2135`: `{unqualifiedAssignees.map((g) => g.name).join(", ")}`). **Recommendation: apply QUAL-08's four-part treatment per assignee row/chip within a multi-assignee task on the board, not as a single ring around the whole card.** This is the only choice consistent with 100% of existing precedent; there is zero precedent for the per-item alternative. `[VERIFIED: src/components/supervisor/views.jsx:1627,2129-2142]`

**D-10's scope, clarified:** "רק על פריטים שכן מושצו" means: only flag a person who is *already in that item's `assignedGuards`/`assignees` array* and for whom `isQualified()` now returns `false` — this is the retroactive-narrowing state Phase 3 explicitly left possible and unresolved ("a pre-existing task whose assignees were selected before anyone was narrowed can become un-savable once a supervisor narrows one of those assignees away from the task's category; no override, by design" — STATE.md, Phase 03 decisions). The board must **not** proactively compute "would guard X be blocked from task Y" for every guard against every item — only render the lock for people who are literally already assigned there. `[VERIFIED: .planning/STATE.md line 83]`

### §4 — Concrete, minimal recommendation for BOARD-01's merge

Add one new function to `src/lib/dates.js`, next to `taskAsShiftShape` (not replacing it — `taskAsShiftShape` stays engine-only and untouched, per UNIF-04 and the Out-of-Scope "מילוי שעות למשימות ישנות" row):

```js
// Proposed shape — NOT yet in the codebase; illustrative for the planner,
// not a `[VERIFIED]` code example.
export function boardShapeOf(task) {
  if (isTaskEngineEligible(task)) return null; // already covered by taskAsShiftShape
  const day = task.dueDate || task.startDate;   // reuses the established identity-date idiom
  if (!day) return null;                        // no date at all — cannot place on any board
  return {
    id: task.id,
    date: day,                 // single anchor date — no range expansion (no precedent for that)
    timeless: true,            // board renders this before/without a clock time, never fabricates one
    label: task.title || "משימה",
    assignedGuards: task.assignees || [],
    category: task.category || "",
    rangeText: task.startDate !== task.dueDate ? /* reuse existing rangeText() */ null : null,
  };
}
```
Board build order per day: `withEngineTasks(shifts, tasks)` items for that date, sorted by `startTime` (existing `AssignView`/`WeekCalendar` convention), **preceded by** `boardShapeOf` items for that date (no clock time to sort by — placing them first, like an all-day-event convention, is this researcher's recommendation, not an existing pattern — flag `[ASSUMED]`, see Assumptions Log). Do not merge the two into one array sorted by a synthetic time value — keep them as two clearly-ordered groups within the same vertical per-day list so D-16's "one time-sorted vertical list, no grouping by hour" is satisfied while the timeless items still read as "no fixed time" rather than silently sorting to a fake midnight.

This satisfies the phase's own constraint ("reuse `withEngineTasks`/`taskAsShiftShape`/`isTaskEngineEligible` patterns where possible, not invent a new data-model concept") because: the classification predicate is literally `isTaskEngineEligible` (unchanged), the anchor date is the already-three-times-used `dueDate || startDate` idiom, and the visual vocabulary (badge, no time, range text) is copied from `TaskMgmt.TaskRow`, not invented.

</gap_investigation>

<board02_positions>
## BOARD-02 Forward Position Board — sufficiency check

Read `src/lib/positions.js` in full and `src/components/supervisor/PositionsScreen.jsx` in full this session.

`expectedDatesForWeek(position, sundayISO)` (`positions.js:32-36`) and `plannedRowsForWeek(position, sundayISO)` (`positions.js:42-72`) are **pure functions of `(position, sundayISO)` only** — no dependency on "this week" being the current week, no `Date.now()`/`new Date()` call anywhere in the module (confirmed by the module's own header comment, `positions.js:6-9`, and by reading every line). This means:

- **Sufficient as-is for 4 weeks of both shapes.** Calling `plannedRowsForWeek(position, addDays(startOfWeek(), n * 7))` for `n = 0..3` produces the 4 forward weeks for a `template` position (rows shaped like `gs_shifts`) or a `weekly` position (single row shaped like `gs_tasks`) with **no extension needed** to `positions.js` itself. `[VERIFIED: src/lib/positions.js:1-72]`
- **What BOARD-02 must add itself (screen-level, not lib-level):** `PositionsScreen.jsx` today only computes **the current week's** realized rows (`qualifiedGuardsForPosition`, `workingGuardIdsForWeek`, both called with a single `sundayISO = weekDates[0]`, `PositionsScreen.jsx:269-296`) — there is no existing "4 weeks forward" call site anywhere, and no existing UI for "planned but not yet realized" rows (D-05's own screen boundary comment confirms this explicitly: `PositionsScreen.jsx:1-10`, "מסך זה עוצר במכוון בגבול שנקבע ב-D-05 ... שום תצוגת לוז שרץ קדימה על פני שבועות — זו תחום פאזה 5, לא כאן"). This is expected, planned work for this phase, not a gap in the library.
- **`missingRowsForWeek(position, sundayISO, realized)`** (`positions.js:80-88`) already computes exactly "planned rows not yet realized" for a single week — the natural building block for distinguishing "already happened / already scheduled" rows (read from `shifts`/`tasks` props, i.e., realized rows) from "will happen automatically, not created yet" rows (from `plannedRowsForWeek` directly) across all 4 weeks. Per **D-07**, only the latter (not-yet-realized) rows should route a click to edit-only; realized rows are ordinary shifts/tasks the board already knows how to click into (or, per **D-08**, nothing at all — read-only in this phase).

**No extension to `positions.js` is required.** The forward board is new screen-level composition over existing pure functions, called 4× with different `sundayISO` values. `[VERIFIED: src/lib/positions.js:80-88, src/components/supervisor/PositionsScreen.jsx:1-10,268-296]`

</board02_positions>

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────── SupervisorApp.jsx (state owner: useGuardian) ───────────────────────────────┐
│                                                                                                              │
│  WeekFlow.jsx  (nav id "week", DEFAULT view on load)                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ step 0 (NEW, D-04): UnifiedBoard   step 1: ShiftMgmt   step 2: AvailView   step 3: Assign  step 4: Pub │  │
│  │        ▲                                                                                                │  │
│  │        │ reads: shifts, tasks, guards, weekDates, positions (via props already passed to WeekFlow)     │  │
│  │        │ merges via: withEngineTasks(shifts,tasks) ⊕ boardShapeOf(task) for ineligible tasks (NEW fn)  │  │
│  │        │ per-item qualification check: isQualified(guard, item.category) — SAME fn AssignView uses     │  │
│  └──────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                              │
│  "calendar" nav tab today: Segmented(week=WeekCalendar.jsx | month=CalendarView.jsx)                        │
│    → D-01 replaces WeekCalendar's role. Planner must decide: does the "calendar" tab's week toggle          │
│      disappear (only month remains, unified board lives solely in WeekFlow step 0), or does the tab's       │
│      week mode also render the same UnifiedBoard component? Not decided in CONTEXT.md — flag for planning.  │
│                                                                                                              │
│  PositionsScreen.jsx (nav id "positions", under "עוד")                                                      │
│    existing: per-position card, "who's qualified" + "who's working THIS week" (POS-05, unchanged)           │
│    NEW (BOARD-02): forward strip/list per position, 4× plannedRowsForWeek(position, weekN), read-only,      │
│      not-yet-realized rows open edit-only (D-07)                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────── GuardApp.jsx (state: same useGuardian data, guard's own id) ──────────────┐
│  MySchedule                                                                                                 │
│    TODAY: NextDuty (shifts only) + FairnessLine (already merges tasks, unchanged) + "rest" list (shifts only)│
│    NEW (BOARD-01 guard side): replace the shifts-only `mine`/`rest`/team-schedule builds with the SAME      │
│      merge (withEngineTasks ⊕ boardShapeOf) the manager board uses — same fn, imported once, two containers │
│    NEW (BOARD-03 guard side): a guard only ever sees items already assigned to them, so per D-10 no scan    │
│      is needed — but if D-09's retroactive-narrowing state exists, apply the identical QUAL-08 treatment    │
│      here too, so a guard whose qualification was since narrowed sees the same "לא כשיר/ה" signal as the    │
│      manager does, not a silent duty they can no longer explain.                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new top-level folders. New files, following the existing one-concern-per-file convention:

```
src/
├── lib/
│   └── dates.js              # extend: add boardShapeOf() (or similarly named) beside taskAsShiftShape
├── components/
│   └── supervisor/
│       ├── UnifiedBoard.jsx  # NEW — manager-side board, mounted as WeekFlow step 0
│       └── WeekFlow.jsx      # extend: insert new step 0, shift existing step indices by one
│                              #   (STEP_OF map in WeekFlow.jsx:28-36 must be updated in lockstep —
│                              #    every existing `go("shifts")`/`go("assignment")` call site elsewhere
│                              #    in the app relies on this map staying correct)
│   └── GuardApp.jsx          # extend: MySchedule's mine/rest/team-schedule builders switch to the
│                              #   shared merge fn; no new file needed, this is an edit to existing fn
│   └── supervisor/PositionsScreen.jsx  # extend: PositionCard gets a 3rd list/strip for BOARD-02
├── lib/terms.js               # extend: add nav/empty-state copy keys for both civil/army profiles
scripts/
└── verify-board.mjs           # NEW, if boardShapeOf's classification logic is nontrivial enough to
                                #   warrant its own pure-function test (see Validation Architecture)
```

### Pattern 1: Single merge function, two containers

**What:** One function (`withEngineTasks` + new `boardShapeOf`) is imported by both `UnifiedBoard.jsx` (manager) and `GuardApp.jsx`'s `MySchedule` (guard). Neither component recomputes eligibility or ordering itself.
**When to use:** Any time the board needs "what does this person/team have this week" — this is the established Phase 2 constraint ("אסור ליצור נתיב מיזוג שני").
**Example (existing precedent, not new code):**
```js
// src/components/supervisor/views.jsx:940 (AssignView, existing) — the pattern to replicate
const merged = withEngineTasks(shifts, tasks);
const history = merged.filter((s) => s.date < weekStart);
const planned = merged.filter((s) => s.date >= weekStart && s.date <= weekEnd);
```
`[VERIFIED: src/components/supervisor/views.jsx:940-942]`

### Pattern 2: Per-person qualification check at render time, never re-derived

**What:** Every place that needs to know "is this person blocked from this item" calls `isQualified(guard, item.category)` directly — never a cached/stored boolean.
**When to use:** BOARD-03's blocking indicator, on both manager and guard views.
**Example:**
```js
// src/lib/autoAssign.js:124-129 — the one function to call
export function isQualified(guard, category) {
  if (!category) return true;
  const list = guard?.qualifiedCategories;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(category);
}
```
`[VERIFIED: src/lib/autoAssign.js:124-129]`

### Anti-Patterns to Avoid

- **Feeding a fabricated `startTime`/`endTime` into `taskAsShiftShape` for a frozen/multi-day task so it "just works" through `withEngineTasks`.** Explicitly forbidden — corrupts fairness/conflict calculations that were never designed to see this data, and directly contradicts a locked Out-of-Scope decision (REQUIREMENTS.md: "מילוי שעות למשימות ישנות ... מרעילה את חישוב הנטל"). `[VERIFIED: .planning/REQUIREMENTS.md line 70]`
- **A second merge function that duplicates `withEngineTasks`'s logic instead of composing with it.** Breaks the single-merge-path constraint from Phase 2 (UNIF-02/D-02) that CONTEXT.md itself calls out as an "Established Pattern."
- **Item-level (not per-assignee) qualification-block styling on a multi-assignee task.** No precedent for it anywhere in the codebase (see `<gap_investigation>` §3) — would be a new visual language the moment it shipped, contradicting D-09's "בדיוק את הטיפול מ-QUAL-08."
- **A distinct color/badge/icon that marks "this is a task, not a shift."** D-12 explicitly forbids this. The existing `shiftTone(undefined, "task")` already falls back to `SHIFT_TONES.custom` — the same tone an uncategorized shift gets — so simply *not adding* a task-specific color keeps this constraint satisfied for free. `[VERIFIED: src/design/shiftPalette.js:18-24,42-46]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sorting a mixed shift+task list by time | A custom comparator that fabricates a sort key for hour-less items | `withEngineTasks` for eligible items (already sorted by callers via `.sort((a,b)=>a.date.localeCompare(b.date)\|\|a.startTime.localeCompare(b.startTime))`, e.g. `GuardApp.jsx:134`) + a separate "timeless" bucket rendered without a fake time | A fabricated sort time (e.g. `"00:00"`) would visually claim the item has a start time it doesn't — exactly the kind of "system tells a wrong truth" the milestone's core value forbids. |
| Determining who's blocked from an item | Re-deriving qualification from `guard.qualifiedCategories` inline | `isQualified(guard, category)` (`autoAssign.js:124`) | Single source of truth already used by the engine, `AssignView`, and `TaskMgmt`'s form — a fourth inline copy is a fourth place to drift. |
| Computing 4 weeks of position rows | A new loop reimplementing `expectedDatesForWeek`'s weekday/weekly-shape branching | `plannedRowsForWeek(position, sundayISO)` called 4× with `addDays(startOfWeek(), n*7)` | Already deterministic, already tested (`scripts/verify-positions.mjs`), and the *only* place the two position shapes' branching logic should live per D-04 (Phase 4). |

**Key insight:** every piece this phase needs already exists as a pure function except the "how do I represent an item the engine doesn't accept" adapter — and even that adapter's two design choices (which predicate classifies it, which date anchors it) are already established elsewhere in the codebase. The risk in this phase is not "what do I build" but "did I accidentally build a second version of something that already exists."

## Common Pitfalls

### Pitfall 1: Treating D-02 as already-done and skipping guard-side merge work

**What goes wrong:** Planner reads CONTEXT.md's Code Context section literally, assumes `MySchedule` already shows tasks, and scopes only "consistency check" work for the guard side — then BOARD-04's acceptance test fails because a guard's task duties are invisible.
**Why it happens:** CONTEXT.md's claim was written from a hypothesis, not a `Read` of the live file; the fairness-only use of `withEngineTasks` looks superficially like "the merge already happened" if you only grep for the function name.
**How to avoid:** Scope guard-side merge as new implementation work identical in shape to the manager-side work, sharing the same merge function.
**Warning signs:** A plan task that says "verify GuardApp's task display is consistent" without a task that says "build GuardApp's task display."

### Pitfall 2: Silent item loss re-appearing through a new code path

**What goes wrong:** The new `boardShapeOf`-style adapter is written but never actually called from the board component — engine-eligible tasks show correctly (via `withEngineTasks`), but frozen/multi-day/weekly-position items silently vanish again, exactly reproducing the bug BOARD-01 exists to fix, just one layer up.
**Why it happens:** `withEngineTasks(shifts, tasks).filter(Boolean)` already silently drops nulls (`dates.js:269`) — it's easy to call *only* that function for the board (since it's the familiar, already-imported one) and forget the second bucket entirely.
**How to avoid:** The board's data-build step should assert (in a dev-time console warning, or in the verify script) that `mergedEligible.length + mergedTimeless.length === tasks.length + shifts.length` for the week in view — a hard total, not a spot check.
**Warning signs:** A demo team seeded with `seedDemo()` shows fewer total items on the board than `tasks.length + shifts.length` for the visible week.

### Pitfall 3: `STEP_OF` map drift when inserting the new WeekFlow step

**What goes wrong:** `WeekFlow.jsx`'s `STEP_OF` constant (lines 28-36) maps legacy nav ids (`"shifts"`, `"availability"`, `"smart"`, `"assignment"`, `"assign"`, `"schedule"`, `"publish"`) to numeric step indices, and multiple call sites elsewhere in the app (`SupervisorApp.jsx`'s `go()`, `startDemo()` calling `go("smart")`) depend on these numbers. Inserting the unified board as step 0 shifts every existing index by one; missing one of the scattered `go("...")` call sites silently lands the user on the wrong step.
**Why it happens:** The mapping is a single object literal but its *consumers* are spread across at least two files (`WeekFlow.jsx` itself, `SupervisorApp.jsx:170`).
**How to avoid:** Grep the whole `src/` tree for `go("` and `STEP_OF` before touching the numbers, not just `WeekFlow.jsx`.
**Warning signs:** "בנה לי הדגמה" (seed demo) button lands on the shift-building step instead of the smart-assign step after the change.

### Pitfall 4: Density that satisfies "shows everything" but fails BOARD-04's comprehension test

**What goes wrong:** A board that lists shifts, engine-eligible tasks, and timeless items all with equal visual weight, on a day with many items, reads as a wall of text a brand-new manager can't parse without explanation — violating D-14 (no legend allowed to compensate).
**Why it happens:** D-16 mandates a single vertical time-sorted list (no grouping) specifically to avoid the *complexity* of a time-grid, but a long flat list has its own density failure mode if every row looks identical.
**How to avoid:** Reuse `WeekCalendar`'s and `TaskMgmt`'s existing "redundant channel" instinct (icon + text + non-color signal) for the *one* thing that must stay scannable at a glance: whether an item is timeless. A `clock`-icon-absent row already reads differently from a timed row without adding a task/shift distinction (which D-12 forbids) — lean on that, not on new color coding.
**Warning signs:** A live UAT tester (per BOARD-04's actual test — D-13) hesitates or asks what an item is, rather than immediately explaining it.

## Code Examples

Verified patterns from the actual source (all read this session, not reconstructed from memory):

### Merging shifts and engine-eligible tasks (existing, reuse as-is)
```js
// src/lib/dates.js:266-270
export function withEngineTasks(shifts = [], tasks = []) {
  const safeShifts = Array.isArray(shifts) ? shifts : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  return [...safeShifts, ...safeTasks.map(taskAsShiftShape).filter(Boolean)];
}
```

### Per-guard qualification lock, exact QUAL-08 visual contract (reuse for BOARD-03)
```js
// src/components/supervisor/views.jsx:1142-1150 (AssignView, condensed)
{!qualified && (
  <span
    className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1
      rounded-full flex items-center justify-center
      ring-2 ring-surface bg-surface text-muted"
  >
    <Icon name="lock" size={11} strokeWidth={2.5} />
  </span>
)}
```

### Forward position projection, 4 weeks (compose existing fn, no new lib code)
```js
// Illustrative composition over verified positions.js functions — NOT existing code.
import { addDays, startOfWeek } from "../../lib/dates.js";
import { plannedRowsForWeek } from "../../lib/positions.js";

const forwardWeeks = Array.from({ length: 4 }, (_, n) =>
  plannedRowsForWeek(position, addDays(startOfWeek(), n * 7))
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Five separate nav items for shift building (shifts/availability/smart/assign/publish) | One `WeekFlow` with numbered steps | Pre-Phase-4 (per `WeekFlow.jsx`'s own header comment) | This phase inserts into that same pattern rather than creating a sixth standalone screen — confirms D-04's approach is consistent with the app's existing UX philosophy, not a new one. |
| `WeekCalendar.jsx` living under the separate "calendar" nav tab | To be replaced per D-01 | This phase | See the open question flagged in the architecture diagram above — CONTEXT.md does not resolve whether the "calendar" tab's week-mode toggle survives Phase 5 in some form. |

**Deprecated/outdated:** None yet — `WeekCalendar.jsx` is being replaced by this phase but has not been removed as of this research session (confirmed: file still exists and is still mounted in `SupervisorApp.jsx:190-195`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Timeless (frozen/multi-day/weekly-position) items should sort **before** timed items within a day, like an all-day-event convention. | `<gap_investigation>` §4 | Low-medium — a plausible alternative (sort after) is equally defensible and equally easy to change; no data-model risk either way, purely a display-order choice. Should be confirmed with the user or left as an explicit planner/executor call, not silently baked in as "the" answer. |
| A2 | The "calendar" nav tab's week-mode (`WeekCalendar.jsx`) should be either removed or repointed at the same unified board component, rather than kept as a third, inconsistent shift-only view. | Architecture Diagram | Medium — if left un-decided, the app could end up with two different "week" views (one merged, one shift-only) which directly undermines BOARD-01's "no two screens to cross-reference" success criterion. This should be raised explicitly during planning, not left implicit. |
| A3 | A guard whose qualification has been retroactively narrowed below an already-assigned task's category (the Phase 3 "un-savable but not force-removed" edge case) should see the QUAL-08 treatment on their own board, not just the manager's. | Architecture Diagram (GuardApp box) | Low — D-09 only explicitly names "the unified board," which CONTEXT.md's D-02 treats as covering both manager and guard views; if the user intended manager-only, this over-implements by one small, harmless detail (the guard already knows they're on the task; the treatment only makes the reason legible instead of mysterious). |

**If this table is empty:** N/A — see above; three low/medium-risk display-order and scope-boundary assumptions remain, none touching the data model or the engine's contracts.

## Open Questions (RESOLVED)

1. **Does the "calendar" nav tab keep a week-mode at all after Phase 5?** — **RESOLVED** by the planner in `05-04-PLAN.md` (Task 1, `checkpoint:decision`): the "calendar" tab's week toggle is repointed to render the same unified-board component (not deleted, not left on the old `WeekCalendar.jsx`), and `WeekCalendar.jsx` itself is retired once the repoint lands. Gated behind an explicit decision checkpoint because D-01 rates this `costly` reversibility.
   - What we know: `SupervisorApp.jsx:180-198` currently offers a `Segmented` toggle between `WeekCalendar.jsx` (week) and `CalendarView.jsx` (month) under the "calendar" nav item, entirely separate from `WeekFlow`. D-01 says the unified board "completely replaces" `WeekCalendar` — CONTEXT.md's Integration Points section says this replacement happens "inside SupervisorApp.jsx's 'building the week' first step," i.e., inside `WeekFlow`, not inside the "calendar" tab.
   - What's unclear: whether the "calendar" tab's week toggle should be deleted (leaving only month view there), or repointed to render the same new unified-board component, or left rendering the old shift-only `WeekCalendar.jsx` untouched (which would contradict D-01's "completely replaces" and BOARD-04's single-source-of-truth spirit).
   - Recommendation: planner should make an explicit, stated choice here rather than leaving it implicit — this is exactly the kind of "two screens that need cross-referencing" BOARD-01 exists to eliminate.

2. **Should `boardShapeOf`'s timeless bucket get its own small pure-function test file (`scripts/verify-board.mjs`)?** — **RESOLVED** by the planner in `05-01-PLAN.md` (Task 1, the phase's tracer): yes — `scripts/verify-board.mjs` is created in the tracer task alongside the functions it tests, and wired into `npm test` in the same task.
   - What we know: every other pure module introduced by a phase (`fairness.js`/`conflicts.js` Phase 1-2, `positions.js` Phase 4) got a dedicated `scripts/verify-*.mjs` wired into `npm test`.
   - What's unclear: whether the new function is complex enough to warrant its own script versus a few assertions added to an existing one (`verify-planning.mjs` already covers `withEngineTasks`-adjacent logic).
   - Recommendation: given this phase's own gap gets its own named function with nontrivial classification logic (3-way branch: eligible / frozen-single-day / multi-day-or-weekly), it should get its own small test file, consistent with the one-pure-module-one-verify-script precedent.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — standalone Node ES-module scripts, `console.log("  ok ...")`/`"  FAIL ..."`, non-zero exit on failure. Confirmed by reading `scripts/verify-positions.mjs` in full this session. |
| Config file | none — `package.json`'s `"test"` script is the config: `node scripts/verify-scheduler.mjs && node scripts/verify-planning.mjs && node scripts/verify-positions.mjs` |
| Quick run command | `node scripts/verify-board.mjs` (new file, if added — see Open Question 2) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOARD-01 | Merge of eligible + timeless items totals `shifts.length + tasks.length` for a fixture week, no silent drop | unit (pure fn) | `node scripts/verify-board.mjs` | ❌ Wave 0 |
| BOARD-01 | Timeless items anchor to `dueDate \|\| startDate`, never fabricate a time | unit (pure fn) | `node scripts/verify-board.mjs` | ❌ Wave 0 |
| BOARD-02 | `plannedRowsForWeek` called across 4 consecutive `sundayISO` values produces 4 distinct, deterministic row sets for both position shapes | unit (pure fn, already covered) | `node scripts/verify-positions.mjs` (extend, don't duplicate) | ✅ exists — extend |
| BOARD-03 | `isQualified()`-driven per-assignee lock state is derivable from existing engine data, no divergence from `checkQualification` | unit (pure fn, already covered) | `node scripts/verify-scheduler.mjs` / `node scripts/verify-planning.mjs` | ✅ exists |
| BOARD-04 | Comprehension test | manual-only | UAT per D-13 ("מנהל חדש מגדיר שבוע שלם על הלוח המאוחד לבד") | N/A — cannot be automated; this is explicitly a human-observation acceptance test per the phase's own success criteria. |

### Sampling Rate

- **Per task commit:** `node scripts/verify-board.mjs` (if created) or the closest existing script touched
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`, **plus** the live BOARD-04 UAT walkthrough (D-13) — this phase cannot be considered done on automated tests alone, by its own acceptance criteria.

### Wave 0 Gaps

- [ ] `scripts/verify-board.mjs` — covers BOARD-01's merge-completeness and timeless-anchoring behavior (new pure function's contract)
- [ ] No new fixtures/conftest-equivalent needed — this codebase has no shared fixture file; each `verify-*.mjs` script is self-contained with inline literals (confirmed pattern in `verify-positions.mjs`).

*(BOARD-02 and BOARD-03 gaps: none — existing `verify-positions.mjs`/`verify-scheduler.mjs`/`verify-planning.mjs` infrastructure already covers the underlying pure functions this phase composes over.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — Supabase Auth, not touched by this phase. |
| V3 Session Management | No | Unchanged. |
| V4 Access Control | Yes | This phase is purely a **read/display** surface (D-03, D-08) — it must not introduce any new write path. RLS policies already governing `gs_shifts`/`gs_tasks`/`gs_positions` reads are unchanged; confirm the board reads through the same `useGuardian`-supplied `shifts`/`tasks`/`positions` arrays already scoped by existing RLS (`team_code`-based), not a new direct Supabase query. |
| V5 Input Validation | No new input | No new form/input surface introduced — D-08 makes BOARD-02 explicitly read-only, D-03 keeps all task/shift editing in the existing forms. |
| V6 Cryptography | No | Not applicable. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A read-only board component accidentally rendering a write action (e.g. a stray `onClick` calling `actions.toggleAssignment` copy-pasted from `AssignView`) | Elevation of Privilege (client-side only — QUAL-V2-03 server-side enforcement is explicitly v2/out of scope) | Code review: the new board component must not import or call any `actions.*` mutation method; D-08 and D-03 make this an explicit design constraint, not just a security nicety. |
| Displaying a blocked person's qualification reason exposes no more information than `AssignView`/`TaskMgmt` already do today (both already show `qualifiedCategories`-derived refusal text to the manager) | Information Disclosure | None needed beyond existing behavior — this phase does not increase the information already visible to a supervisor; a guard's own board should show the same wording pattern only for their own items (D-10 already scopes this to "own assigned items only," which is also the correct privacy boundary). |

## Sources

### Primary (HIGH confidence — all read via `Read`/`Grep` this session)
- `.planning/phases/05-unified-board/05-CONTEXT.md` — locked decisions D-01 through D-16
- `.planning/REQUIREMENTS.md` — BOARD-01..04, Out-of-Scope table
- `.planning/STATE.md` — Phase 3/4 decision log
- `src/lib/dates.js` — full file
- `src/lib/positions.js` — full file
- `src/lib/api.js` — lines 1-140 (row mappers)
- `src/lib/autoAssign.js` — `isQualified`, `checkQualification`, `checkAssignment` signatures
- `src/design/shiftPalette.js` — full file
- `src/components/supervisor/WeekCalendar.jsx` — full file
- `src/components/supervisor/WeekFlow.jsx` — full file
- `src/components/supervisor/views.jsx` — `SupDashboard`, `ShiftMgmt`, `AvailView`, `AssignView`, `TaskMgmt`, `categoryOptions`, `People` (read in full across two passes)
- `src/components/supervisor/PositionsScreen.jsx` — full file
- `src/components/GuardApp.jsx` — lines 1-330 (`MySchedule` and surrounding), plus full-file grep for `task`
- `src/components/SupervisorApp.jsx` — lines 1-220
- `src/lib/terms.js` — nav/positions/unit term keys
- `package.json` — dependency/version confirmation
- `scripts/verify-positions.mjs` — test-script convention

### Secondary (MEDIUM confidence)
None — this phase required no external documentation lookup; every question was answerable from the live codebase.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new stack, fully confirmed against `package.json`.
- Architecture: HIGH — every integration point (WeekFlow's `STEP_OF`, GuardApp's `MySchedule`, PositionsScreen's card structure) read directly, not inferred.
- Gap resolution (the phase's central open question): HIGH — resolved via direct source reading with exact line citations for every claim, including the one correction to CONTEXT.md's own premise (D-02).
- Pitfalls: HIGH — each pitfall traced to a specific, cited line range that would actually cause the failure described.

**Research date:** 2026-09-02
**Valid until:** Effectively indefinite for the architectural claims (they describe code structure, not a fast-moving external API) — but re-verify immediately if any other phase touches `WeekFlow.jsx`, `GuardApp.jsx`, or `dates.js` before this phase is planned, since this research is a snapshot of those files as of this session.
