# Phase 2: איחוד משימה ומשמרת — Research

**Researched:** 2026-08-23
**Domain:** Internal — pure JS constraint engine (`autoAssign.js`), pure JS conflict matrix (`conflicts.js`), Supabase/Postgres schema migration, React form UI. No external library or framework research needed; this phase is a structural unification of two data models that already exist in the same codebase.
**Confidence:** HIGH — every claim below is grounded in a `Read` of the actual file (with line numbers), not training-data guesses. The two places confidence drops to MEDIUM/LOW are called out explicitly (DB column type for the new `gs_tasks` columns, and one genuinely open design question the discuss-phase didn't cover).

## Summary

Today `checkHardConstraints` (`src/lib/autoAssign.js:171`) only ever sees shifts, and `findConflicts` (`src/lib/conflicts.js:67`) only ever sees tasks — two engines, two data models, zero awareness of each other. A person can be assigned a full-day kitchen task and a night shift on the same day and neither engine notices. Phase 2 closes this by giving a **single-day** task an optional start/end time (UNIF-01), folding hour-bearing tasks into the same load-bookkeeping the shift engine already uses for rest/consecutive/weekly-cap/fairness (UNIF-02), replacing the two independent overlap checks (`autoAssign.js`'s inline ms-comparison and `conflicts.js`'s local date-string `windowsOverlap`) with one function that both engines import (UNIF-03), leaving every pre-migration and multi-day task exactly as-is with zero backfill (UNIF-04), showing the supervisor which tasks are frozen (UNIF-05), and proving the category-pair matrix (`compatIndex`/`pairRule`) is completely untouched by any of this (UNIF-06).

The central engineering fact this research establishes, by reading both files line-by-line: **`compatIndex`/`pairRule` (the category-pair matrix) never touch a date or a millisecond — they operate purely on the `a`/`b` category strings.** `findConflicts` is the only place that combines them with time-window overlap, via a plain `&&`. This means UNIF-03's change to the overlap function and UNIF-06's "no regression" requirement are independent by construction, not just by intent — there is no code path where fixing one could silently break the other.

The second central fact: **normalizing a date-only window to `{00:00:00.000 local, 23:59:59.999 local}` and then applying the same strict `<` overlap test that `autoAssign.js` already uses for shifts (`iv.start < candidate.end && candidate.start < iv.end`) produces byte-identical results to the current inclusive date-string comparison** (`x.from <= y.to && y.from <= x.to`) for every case that matters — same-day tasks still overlap, adjacent-day tasks still don't. This is proven by construction in the "Unified `windowsOverlap`" section below, not asserted. It is what makes ONE function safe for both resolutions.

**Primary recommendation:** Add `isTaskEngineEligible`, `taskInterval`, `windowsOverlap`, and `taskAsShiftShape` to `src/lib/dates.js` (a currently-zero-import, pure leaf module already imported by both `autoAssign.js` and `conflicts.js` — adding exports there creates no import cycle). Have `conflicts.js`'s `taskWindow()` branch on `isTaskEngineEligible` to return ms precision for hour-bearing single-day tasks and the existing date-only shape for everything else. Have `autoAssign.js`'s internal `overlaps()` delegate to the shared `windowsOverlap`. Feed engine-eligible tasks into `autoAssign()`/`checkAssignment()`'s load-seeding and into every `teamAverages`/`loadTable`/`fairnessPlan` call site via the `taskAsShiftShape` adapter — enumerated exhaustively below, because missing even one call site reopens the exact "two formulas for one number" bug Phase 1 just closed, this time for tasks instead of fairness weights.

## User Constraints (from CONTEXT.md)

### Locked Decisions

| # | הכרעה | נימוק |
|---|---|---|
| 1 | רק משימה **חד-יומית** יכולה לשאת שעות ולהיכנס למנוע | משימה רב-יומית (למשל "משפחה צעירה" לשבוע) לא מתאימה לסמנטיקה של שעת-התחלה/שעת-סיום יומית |
| 2 | פונקציית חפיפה **אחת** (`windowsOverlap`), לא שתיים | מקבלת גם מיליסניות (משמרת/משימה עם שעות) וגם תאריך-בלבד (משימה רב-יומית קפואה); תאריך-בלבד מנורמל ל-00:00–23:59 לצורך ההשוואה |
| 3 | תג "קפואה" מופיע **רק על משימות קפואות**, לא על משימות פעילות | הוגנות (=פעילה, נספרת) היא המצב הנפוץ; תג על כל דבר הוא רעש. משימה פעילה נראית כמו משמרת רגילה |
| 4 | תג "קפואה" מופיע **בכל מקום** שהמשימה מוצגת (רשימה, כרטיס לוח שנה, דשבורד) | לא רק ברשימה הראשית — המנהל צריך לדעת את זה גם כשהוא רואה כרטיס בודד |
| 5 | שדות שעה בטופס משימה חדשה נפתחים **ריקים**, בלי ברירת מחדל | משימה בלי שעות = לא נכנסת למנוע ולא נספרת בהוגנות — עדיף מנהל שמזין שעות במפורש מהנחה שגויה שנכנסת בטעות |
| 6 | `gs_task_templates` **לא** מקבלת שדות שעת-ברירת-מחדל במחזור הזה | שינוי סכמה מעבר למינימום הנדרש; להשאיר לתבנית עתידית אם יתברר שצריך |

### Claude's Discretion

Not explicitly separated in `02-CONTEXT.md` from Locked Decisions — the 4 grey areas discussed (multi-day task hours, frozen badge placement, form defaults, task_templates hour fields) were all resolved to firm decisions above, no open discretion areas remain from discuss-phase. One genuinely new discretion point surfaced during this research (not raised in discuss-phase): **how a task's hours should be weighted in `shiftLoad()`** — see Open Questions below.

### Deferred Ideas (OUT OF SCOPE)

- לא מוסיפים שעות למשימה רב-יומית — היא נשארת קפואה ומחוץ למנוע.
- לא נוגעים ב-`gs_task_templates` (שדות שעה) או ב-`gs_role_compatibility` (מטריצת ההתנגשויות עצמה) מעבר לוודא ש-UNIF-06 לא נסוג.
- לא בונים מילוי שעות לאחור למשימות ישנות — UNIF-04 אוסר את זה במפורש.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UNIF-01 | משימה חדשה נושאת שעת התחלה ושעת סיום, ולא רק טווח תאריכים | New nullable `gs_tasks.start_time`/`end_time` columns (draft SQL below); `taskColumns`/`taskFromRow` mapper changes in `api.js`; form fields in `TaskMgmt` (`views.jsx:1794-1801`), gated to single-day tasks per Decision 1 |
| UNIF-02 | משימה עם שעות נספרת במנוחה, ברצף, בתקרה השבועית ובנטל — בדיוק כמו משמרת | `taskAsShiftShape` adapter reuses `addToLoad`/`shiftInterval`/`shiftHours`/`shiftLoad` unmodified; `autoAssign()`/`checkAssignment()` gain a `tasks` param to seed `load` before constraint checks; every `teamAverages`/`loadTable`/`fairnessPlan` call site enumerated below must merge in engine-eligible tasks |
| UNIF-03 | פונקציית חפיפה אחת משרתת משמרות ומשימות; ההשוואה ברמת מילישניות בשני המקרים | Unified `windowsOverlap(a, b)` in `dates.js`, proven behavior-preserving for both ms and date-only inputs — full derivation below |
| UNIF-04 | משימה שנוצרה לפני המיגרציה נשארת מחוץ למנוע וממשיכה לעבוד בדיוק כמו היום | Frozen state is **derived**, not stored: `NULL start_time`/`end_time` (the only possible state for any pre-migration row, since the columns don't exist yet) already means "not engine-eligible" — zero backfill, zero new flag column needed |
| UNIF-05 | המנהל רואה בבירור אילו משימות נספרות במנוע ואילו קפואות מחוץ לו | `Badge` component (`ui.jsx:198`) with `tone="neutral" icon="lock"`, reused per Decisions 3+4; exhaustive list of current task-rendering surfaces below (fewer than the decision implies — no calendar card exists yet) |
| UNIF-06 | מטריצת ההתנגשויות ממשיכה לחסום זוגות סותרים אחרי האיחוד, ללא נסיגה | `compatIndex`/`pairRule` (`conflicts.js:32-49`) never read a date or time field — proven structurally separable from the `taskWindow`/`windowsOverlap` change; existing `verify-planning.mjs` assertions (lines 33-88) must all continue to pass unchanged |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Task start/end time capture (UNIF-01) | Browser/Client (React form, `TaskMgmt`) | Database/Storage (`gs_tasks` columns) | Field lives in the modal form; persisted through `api.js`'s single column-name chokepoint |
| Constraint checking incl. tasks (UNIF-02) | Browser/Client (pure engine, `autoAssign.js`) | — | This app has no custom backend server — Supabase is BaaS only. All constraint logic runs client-side, same as today; no new server tier is introduced |
| Overlap function (UNIF-03) | Browser/Client (pure engine, `dates.js`) | — | Shared pure utility, zero network/DB involvement, importable by both `autoAssign.js` and `conflicts.js` without a cycle |
| Frozen-state derivation (UNIF-04) | Database/Storage (`NULL` = frozen) | Browser/Client (`isTaskEngineEligible` reads it) | Frozen is a read-time derivation from column nullability, never a written flag |
| Frozen badge display (UNIF-05) | Browser/Client (React components) | — | Pure UI/display logic, no data model change beyond reading `isTaskEngineEligible` |
| Conflict matrix (UNIF-06) | Browser/Client (pure engine, `conflicts.js`) | Database/Storage (`gs_role_compatibility` rows) | Rules are data (team-editable), evaluated client-side — unchanged by this phase |

## Standard Stack

No new libraries. This phase is a schema + pure-function + form change inside the existing stack (React 18.2.0, Supabase JS 2.101.0, Vite 5.2.0 — confirmed via `package.json`, unchanged from project baseline `[VERIFIED: package.json]`).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| *(none new)* | — | — | — |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none new)* | — | — | — |

### Alternatives Considered

Not applicable — no library decision in this phase.

**Installation:** None required.

## Package Legitimacy Audit

**Not applicable.** This phase installs no new npm packages. No `package-legitimacy` check was run because there is nothing to check — `src/lib/dates.js`, `src/lib/autoAssign.js`, `src/lib/conflicts.js`, and `src/lib/api.js` are all first-party files already in the repository, and the only new dependency surface is two nullable Postgres columns on an existing table.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── Browser (React) ───────────────────────────┐
│                                                                         │
│  TaskMgmt form (views.jsx)                                            │
│    startTime/endTime fields (new, empty by default — Decision 5)      │
│    only rendered when startDate === dueDate (single-day, Decision 1)  │
│         │                                                              │
│         ▼                                                              │
│  useGuardian actions: createTask / editTask ──────► api.js            │
│                                                        │ taskColumns() │
│                                                        │ (camelCase    │
│                                                        │  → snake_case)│
│                                                        ▼                │
│                                            gs_tasks (Postgres)         │
│                                            start_time/end_time NULL    │
│                                            by default — frozen         │
│                                                        │                │
│                                                        │ taskFromRow() │
│                                                        ▼                │
│  useGuardian.data.tasks (camelCase, startTime/endTime nullable)       │
│         │                                                              │
│         ├──────────────► conflicts.js                                 │
│         │                  taskWindow(task)                           │
│         │                    ├─ isTaskEngineEligible? → ms {start,end}│
│         │                    └─ else (frozen/multi-day) → date {from,to}│
│         │                  windowsOverlap(a, b)  ◄── dates.js (shared) │
│         │                  compatIndex/pairRule  (category strings    │
│         │                    only — never touches a date, UNIF-06)    │
│         │                  findConflicts() ──► conflict list ──► UI    │
│         │                                                              │
│         └──────────────► autoAssign.js / fairness.js / loadTable.js   │
│                            taskAsShiftShape(task)  ◄── dates.js        │
│                              (engine-eligible tasks only)              │
│                            addToLoad(guardLoad, taskAsShiftShape(t))   │
│                              seeds rest/consecutive/weekly-cap/load    │
│                              BEFORE checkHardConstraints runs          │
│                            teamAverages/loadTable/fairnessPlan         │
│                              merge tasks in at every call site         │
│                                                        │                │
│                                                        ▼                │
│                              Frozen badge (UNIF-05): !isTaskEngineEligible│
│                              rendered in TaskRow (views.jsx) — the only│
│                              place an individual task renders today   │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new files needed. Changes land in existing modules:
```
src/lib/
├── dates.js         # + isTaskEngineEligible, taskInterval, windowsOverlap, taskAsShiftShape
├── autoAssign.js     # overlaps() delegates to windowsOverlap; autoAssign()/checkAssignment() gain `tasks` param
├── conflicts.js       # taskWindow() branches on isTaskEngineEligible; local windowsOverlap removed, imported instead
├── fairness.js         # tally() unchanged in signature — callers merge tasks into the `shifts` array they pass in
├── loadTable.js         # unchanged in signature — same merge-at-call-site pattern
└── api.js                # taskColumns()/taskFromRow() gain start_time/end_time; asTaskError() regex extended

src/components/supervisor/
└── views.jsx              # TaskMgmt form fields, TaskRow frozen badge, SupDashboard (no per-item change needed — see UNIF-05 findings)

src/components/
└── GuardApp.jsx            # teamAverages() call site (line 142) must merge tasks in for FAIR-05 consistency

supabase/migrations/
└── 0005_task_hours.sql       # new additive migration, draft below

scripts/
├── verify-scheduler.mjs        # new UNIF-02 assertions (task hours feed rest/consecutive/weekly-cap/load)
└── verify-planning.mjs           # new UNIF-01/03/04/06 assertions (taskWindow ms branch, windowsOverlap unification, frozen derivation, matrix non-regression)
```

### Pattern 1: Reuse the load-bookkeeping shape instead of adding a second code path

**What:** `addToLoad(l, shift)` (`autoAssign.js:625-633`) is already generic — it only ever reads `shift.date`, `shift.startTime`, `shift.endTime`, `shift.type`, and (via `shiftInterval`) nothing else. It does not know or care whether the object came from `gs_shifts` or was synthesized. The same is true of `teamAverages()` (`autoAssign.js:823-850`) and `tally()` (`fairness.js:46-64`), which both only read `s.date`, `s.assignedGuards`, `s.type`, and call `shiftHours(s)`/`shiftLoad(s)`.

**When to use:** Any time an engine-eligible task needs to participate in load/constraint calculations. Do NOT write a second `checkTaskHardConstraints` or `taskLoad()` — the existing functions already accept anything shaped like a shift.

**Example — the adapter that makes reuse possible:**
```javascript
// Source: derived from src/lib/autoAssign.js:80-86 (shiftLoad), :625-633 (addToLoad),
// and src/lib/dates.js:125-136 (shiftInterval) — read in full this session.
// Proposed addition to src/lib/dates.js.

/** A task counts in the engine only if it resolves to exactly one calendar
 *  day AND carries both a start and end time (Decision 1). Anything else —
 *  including every task that existed before this migration, since the
 *  columns did not exist for it to have hours in — is frozen by definition.
 */
export const isTaskEngineEligible = (task) =>
  Boolean(task?.dueDate) &&
  (!task.startDate || task.startDate === task.dueDate) &&
  Boolean(task?.startTime) &&
  Boolean(task?.endTime);

/** Same overnight-wrap semantics as shiftInterval: an end time at or before
 *  the start time is treated as crossing midnight, not as an error. */
export const taskInterval = (task) => {
  const day = task.dueDate || task.startDate;
  const base = fromISODate(day).setHours(0, 0, 0, 0);
  const start = base + minutesOfTime(task.startTime) * 60000;
  let end = base + minutesOfTime(task.endTime) * 60000;
  if (end <= start) end += 24 * 3600 * 1000;
  return { start, end };
};

/** The single adapter every consumer (autoAssign.js, fairness.js,
 *  loadTable.js, GuardApp.jsx, Analytics.jsx, SupDashboard) uses to fold an
 *  engine-eligible task into the exact same shape a shift already has.
 *  `assignedGuards` — not `assignees` — because every downstream consumer
 *  (teamAverages, tally, addToLoad via l.dates/l.count/l.hours/l.load)
 *  reads that field name.
 */
export const taskAsShiftShape = (task) =>
  isTaskEngineEligible(task)
    ? {
        id: task.id,
        date: task.dueDate,
        startTime: task.startTime,
        endTime: task.endTime,
        type: "task", // falls to LOAD_WEIGHTS.default (1×) in shiftLoad — see Open Questions
        label: task.title,
        assignedGuards: task.assignees || [],
      }
    : null;
```

### Pattern 2: One overlap function, two input shapes, normalized inside

**What:** `windowsOverlap(a, b)` accepts either `{start, end}` (absolute ms, the shape `shiftInterval`/`taskInterval` already produce) or `{from, to}` (ISO date strings, the shape `taskWindow` already produces for frozen/multi-day tasks). It normalizes date-only inputs to a full calendar day before comparing, then applies the exact same strict-`<` test `autoAssign.js` already uses for shift-vs-shift overlap.

**When to use:** Every place that currently does its own ms-interval overlap test (`autoAssign.js`'s `overlaps()`) or date-string overlap test (`conflicts.js`'s local `windowsOverlap`) should call this instead.

**Why the semantics survive unification (worked proof, not assertion):**

Current `autoAssign.js` shift-overlap test (`autoAssign.js:162-164`):
```javascript
function overlaps(intervals, candidate) {
  return intervals.some((iv) => iv.start < candidate.end && candidate.start < iv.end);
}
```
Strict `<` — two shifts that touch end-to-start (07:00–15:00 then 15:00–23:00) do **not** count as overlapping. This is intentional (comment at `autoAssign.js:129`: "Shifts that touch end-to-start... count as one continuous stretch," handled separately by `blockHoursAround`, not by `overlaps`).

Current `conflicts.js` date-window overlap test (`conflicts.js:59`):
```javascript
const windowsOverlap = (x, y) => !!x && !!y && x.from <= y.to && y.from <= x.to;
```
Inclusive `<=` — because at date-string granularity there is no way to express "these two single-day windows touch but don't overlap"; two tasks on the same day (`from === to === same date` for both) **must** register as overlapping.

**Proposed unified function**, normalizing `{from, to}` to `{start: 00:00:00.000, end: 23:59:59.999}` (local time) and reusing the strict-`<` test:
```javascript
// Source: proposed addition to src/lib/dates.js, replacing the two local
// implementations at src/lib/autoAssign.js:162-164 (read this session) and
// src/lib/conflicts.js:59 (read this session).
export function windowsOverlap(a, b) {
  const wa = toMsWindow(a);
  const wb = toMsWindow(b);
  if (!wa || !wb) return false;
  return wa.start < wb.end && wb.start < wa.end;
}

function toMsWindow(w) {
  if (!w) return null;
  if (Number.isFinite(w.start) && Number.isFinite(w.end)) return w; // already ms
  if (w.from && w.to) {
    const start = fromISODate(w.from).setHours(0, 0, 0, 0);
    const end = fromISODate(w.to).setHours(23, 59, 59, 999);
    return { start, end };
  }
  return null;
}
```

**Verification that this preserves every existing `verify-planning.mjs` assertion** (worked by hand against the two boundary cases that matter):
- *Same-day task vs. same-day task* (e.g. `existing[0]` and `candidate` in `verify-planning.mjs:59-65`, both spanning `mon`–`wed`): old test `mon <= wed && mon <= wed` → `true`. New test, normalized: `wa.start(mon 00:00) < wb.end(wed 23:59:59.999)` and `wb.start(mon 00:00) < wa.end(wed 23:59:59.999)` → both `true`. **Same result.**
- *Adjacent-day tasks* (task A `dueDate = mon`, task B `startDate = tue`, disjoint per the old inclusive check: `mon <= tue && tue <= mon` → `true && false` → `false`): New test: `wa.start(mon 00:00) < wb.end(tue 23:59:59.999)` → `true`; `wb.start(tue 00:00) < wa.end(mon 23:59:59.999)` → `false` (tue 00:00 is after mon 23:59:59.999). Combined → `false`. **Same result.**
- *Shift-touching-shift* (07:00–15:00 then 15:00–23:00, both ms already): `iv.start(15:00) < candidate.end(23:00)` → true; `candidate.start(15:00) < iv.end(15:00)` → **false**. Not overlapping. **Same result as today's `overlaps()`.**

No case in the existing `verify-planning.mjs` fixture set (`existing`, `t1`–`t4`, `candidate`) changes outcome under the unified function — the 8 conflict-matrix assertions at `verify-planning.mjs:33-88` should require **zero** changes to their expected values, only to how `taskWindow`/`windowsOverlap` are wired internally.

### Anti-Patterns to Avoid

- **A second `checkTaskHardConstraints` function:** Every hard-constraint rule (`autoAssign.js:171-231`) already generalizes over anything shaped like a shift. Writing a parallel task-specific version doubles the maintenance surface and is exactly the kind of "two formulas, one number" bug Phase 1 (FAIR-01..06) was built to eliminate — for tasks instead of fairness weights this time.
- **Storing a `frozen` boolean column:** UNIF-04 is satisfied for free by `start_time`/`end_time` being `NULL` on every row that predates the migration (they cannot be otherwise — the columns didn't exist). A stored flag would need to be kept in sync with the nullable columns by hand, introducing a state that can drift from the data it's supposed to describe.
- **Treating `windowsOverlap` inputs as interchangeable without normalizing first:** comparing a raw `{from, to}` date-string pair against a raw `{start, end}` ms pair (e.g. `x.from <= y.end`) is comparing a string to a number — always `false` or a coercion bug. The `toMsWindow()` normalization step is mandatory, not optional, for every call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Task overlap detection | A second interval-overlap algorithm inside `conflicts.js` | The unified `windowsOverlap` in `dates.js`, imported by both engines | UNIF-03 explicitly requires exactly one function; a second implementation (even a "temporary" one) is the exact anti-pattern the requirement rules out |
| Task load accounting | A parallel `taskLoad()`/`tally()`-for-tasks function | `taskAsShiftShape()` + the existing `addToLoad`/`teamAverages`/`tally` | These functions are already generic over the shift shape (see Pattern 1); a parallel implementation is guaranteed to drift from the shift version over time |
| Frozen-state tracking | A migration-timestamp comparison, a boolean column, or a "migrated_at" marker | `isTaskEngineEligible(task)`, a pure read of two nullable columns | Simpler, no write-path to keep in sync, and matches the "no backfill, ever" requirement (UNIF-04) exactly — there is nothing to migrate |

**Key insight:** every piece of new logic in this phase is deliberately an *adapter*, not a new engine. The engines (`autoAssign.js`, `conflicts.js`) were already written generically enough (both confirmed by reading every function they export) that the entire phase is "shape a task like a shift, then call the existing function" — never "teach the existing function about tasks."

## Common Pitfalls

### Pitfall 1: Missing a `teamAverages`/`loadTable`/`fairnessPlan` call site

**What goes wrong:** A guard's participant-facing fairness number (FAIR-05: "the number the participant sees in their fairness row is the exact number the engine divided by") stops matching what the engine actually enforces, because task hours were folded into the engine's constraint checks but not into every place fairness is *reported*.

**Why it happens:** These three functions are called from 4 separate UI files, not one. Reading is easier than exhaustively grepping every call site.

**How to avoid:** every one of these must merge engine-eligible tasks into whatever `shifts`/`history`/`planned` array it passes:
- `src/components/GuardApp.jsx:142` — `teamAverages(guards, publishedAll)` (participant's own fairness row — **the exact FAIR-05 number**)
- `src/components/supervisor/Analytics.jsx:44` — `loadTable(guards, shifts)` (reports screen table, Phase 1 Plan 01-03)
- `src/components/supervisor/views.jsx:100` — `loadTable(guards, shifts)` inside `SupDashboard` (dashboard's own load card, Phase 1 Plan 01-03)
- `src/components/supervisor/views.jsx:884` — `fairnessPlan({ guards, history, planned, ... })` inside `AssignView` (the "who needs more" recommendation shown during manual assignment)

**Warning signs:** `npm test` alone will NOT catch this — none of these are pure-engine call sites reachable from `scripts/verify-*.mjs`; they are React components. This must be caught by the plan's verification steps (browser check) or a new pure-function test on the merge logic itself, not by the existing test scripts.

### Pitfall 2: Missing a `checkAssignment` call site

**What goes wrong:** A supervisor approves a swap, or a guard self-serves a swap, that the auto-assign engine would never have produced — because `checkAssignment` (used for exactly this "would the engine allow this?" question, per its own doc comment at `autoAssign.js:750-759`) wasn't given the guard's existing task load.

**Where:** `checkAssignment` is called from exactly two places (confirmed via grep, not assumed):
- `src/components/GuardApp.jsx:566` — guard accepting an incoming swap (`MySwaps`)
- `src/components/supervisor/views.jsx:1241` — supervisor approving a swap request (`SwapMgmt`)

Both need a `tasks` parameter threaded through, mirroring how `shifts` is already threaded through.

### Pitfall 3: Backfilling hours onto pre-migration or multi-day tasks

**What goes wrong:** Exactly the failure mode `PROJECT.md`/`STATE.md`/`REQUIREMENTS.md` all call out explicitly ("Out of Scope: מילוי שעות למשימות ישנות") — injecting hours nobody entered poisons the fairness window and triggers constraints that were never meant to see task data. UNIF-04 forbids this outright, in both directions (never for old tasks, never for multi-day tasks).

**How to avoid:** `isTaskEngineEligible` is a pure read (`Boolean(task.startTime) && Boolean(task.endTime) && single-day`) — never write default/inferred values into `start_time`/`end_time` anywhere, including the migration itself (the draft SQL below adds the columns with no `update` statement at all — contrast with `0002_task_folders.sql`, which *does* backfill `assignees` from `assigned_to`; that backfill is safe because it doesn't change engine behavior, whereas backfilling hours would).

### Pitfall 4: Forgetting the `asTaskError` migration-hint regex

**What goes wrong:** `api.js:526-533`'s `asTaskError()` currently only recognizes `column .*(category|assignees|start_date)` as "migration not run yet" and rewrites it to a friendly Hebrew message (`MIGRATION_HINT`, `api.js:508-509`). If a team runs the app against a database that hasn't had `0005_task_hours.sql` applied and a task save touches `start_time`/`end_time`, the regex won't match and the raw Postgres "column does not exist" error will leak to the UI instead of the friendly hint.

**How to avoid:** extend the regex to `/column .*(category|assignees|start_date|start_time|end_time)/i` and update `MIGRATION_HINT`'s wording to mention the new migration file.

### Pitfall 5: Leaving `windowsOverlap` as two functions with the same name

**What goes wrong:** Cosmetic unification — renaming both local functions to `windowsOverlap` without actually sharing one implementation — satisfies nothing. UNIF-03 requires ONE function; the roadmap's own risk list calls this out by name ("השארת `windowsOverlap` ו-`overlaps` כשתי פונקציות נפרדות, כלומר איחוד קוסמטי במקום מבני").

**How to avoid:** both `autoAssign.js`'s `overlaps()` and `conflicts.js`'s local overlap check must literally `import { windowsOverlap } from "./dates.js"` — verifiable by grep for a single definition site.

### Pitfall 6: Doubling the balance-pass workload silently

**What goes wrong:** The roadmap's risk list flags this directly: "הכפלת מספר הפריטים שהמנוע בוחן במעבר האיזון" (doubling the item count the engine examines in the balance pass). `balanceWorkload()` (`autoAssign.js:526-612`) iterates `assignments` (shift fills) — it does **not** iterate tasks, and this research's design keeps it that way: engine-eligible tasks feed `load` (for constraint-checking and fairness *reporting*) but are never added to `assignments`/`byShift`, because tasks are never auto-assigned or auto-balanced by this engine — they stay manually assigned via `TaskMgmt`. The balance pass's iteration count is therefore unaffected by this phase. Confirm this stays true in the plan: `balanceWorkload` must never be handed the task-seeded portion of `load` as something it can move.

### Pitfall 7: Assuming a calendar card exists for tasks

**What goes wrong:** Decision 4 says the frozen badge must appear "in every place a task is displayed (list, calendar card, dashboard)." Reading the actual rendering surfaces (`Grep` across `src/components` for task usage, confirmed only 2 files touch `tasks`) shows this today:
- **List:** `TaskRow` inside `TaskMgmt` (`views.jsx:1520-1581`) — the only place an *individual* task with its own details renders.
- **Dashboard:** `SupDashboard`'s `StatCard` (`views.jsx:177`) — an **aggregate count** (`openTasks`, `views.jsx:78`), not a per-task display. There is no individual task rendered here to badge.
- **Calendar card:** `WeekCalendar.jsx` and `CalendarView.jsx` — grepped for `task`/`Task` (case-insensitive), **zero matches in either file.** No calendar card for tasks exists in the codebase today.

**How to avoid:** don't plan a "calendar card" UI change that doesn't have a target to modify. Either (a) the frozen badge ships only on `TaskRow` — the one surface that actually exists — and the dashboard/calendar parts of Decision 4 are satisfied vacuously (nothing to badge because nothing individual renders there), or (b) the plan explicitly scopes in building a task calendar card as new UI work, which is a bigger addition than "add a badge" and should be called out as such rather than assumed. This is flagged as an Open Question below for the planner to resolve explicitly rather than silently picking one.

## Code Examples

### `checkHardConstraints` — the function UNIF-02 must feed without a second code path

```javascript
// Source: src/lib/autoAssign.js:171-231 (read in full this session — verbatim)
function checkHardConstraints({ guard, shift, load, availability, rules }) {
  const status = availStatus(availability, guard.id, shift.id);
  const candidate = shiftInterval(shift);
  // ... unavailable / maybe-blocked / no-availability / already checks ...
  if (overlaps(load.shifts, candidate)) {
    return { ok: false, code: "overlap", reason: "חופף למשמרת אחרת שכבר שובצה" };
  }
  const block = blockHoursAround(load.shifts, candidate);
  if (block > rules.maxConsecutiveHours) { /* ... */ }
  const gap = smallestRestGap(load.shifts, candidate);
  const touching = load.shifts.some((iv) => iv.end === candidate.start || iv.start === candidate.end);
  if (!touching && gap < rules.minRestHours) { /* ... */ }
  if (load.count >= rules.maxShiftsPerWeek) { /* ... */ }
  if (shift.type === "night" && load.nights >= rules.maxNightsPerWeek) { /* ... */ }
  return { ok: true, gap, block, status };
}
```
Everything this function reads (`load.shifts`, `load.count`, `load.nights`) comes from `load`, which is built entirely by `addToLoad`/`addAssignment`. Seeding `load` with `taskAsShiftShape(task)` objects **before** the shift-filling loop runs (mirroring the existing `keepExisting` seeding pattern at `autoAssign.js:387-396`) is sufficient — this function needs zero changes.

### `taskWindow` — today's implementation, and the proposed branch

```javascript
// Source: src/lib/conflicts.js:52-57 (read in full this session — verbatim, current state)
export function taskWindow(task) {
  const from = task?.startDate || task?.dueDate || null;
  const to = task?.dueDate || task?.startDate || null;
  if (!from || !to) return null;
  return from <= to ? { from, to } : { from: to, to: from };
}
```
Proposed change — branch to ms precision when eligible, otherwise fall through unchanged:
```javascript
import { isTaskEngineEligible, taskInterval, windowsOverlap } from "./dates.js";

export function taskWindow(task) {
  if (isTaskEngineEligible(task)) return taskInterval(task); // {start, end} ms
  const from = task?.startDate || task?.dueDate || null;
  const to = task?.dueDate || task?.startDate || null;
  if (!from || !to) return null;
  return from <= to ? { from, to } : { from: to, to: from };
}
```
`findConflicts` (`conflicts.js:67-89`) already calls `windowsOverlap(win, taskWindow(task))` generically — no change needed there beyond importing the shared `windowsOverlap` instead of the local one.

### `taskColumns`/`taskFromRow` — exact current mapper, and the delta

```javascript
// Source: src/lib/api.js:76-93 (taskFromRow) and :511-524 (taskColumns) — read in full this session, verbatim
export const taskFromRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  category: row.category || "",
  assignees: Array.isArray(row.assignees) ? row.assignees : row.assigned_to ? [row.assigned_to] : [],
  status: row.status,
  priority: row.priority,
  startDate: row.start_date || null,
  dueDate: row.due_date,
  overrideNote: row.override_note || "",
});

const taskColumns = (task) => ({
  title: task.title,
  description: task.description || null,
  category: task.category || null,
  assignees: task.assignees || [],
  assigned_to: (task.assignees || [])[0] || null,
  priority: task.priority || "medium",
  start_date: task.startDate || null,
  due_date: task.dueDate || null,
  override_note: task.overrideNote || null,
});
```
Delta (both directions, matching the existing `hhmm()` truncation-to-5-chars helper already defined at `api.js:15` for shift times):
```javascript
// taskFromRow — add:
  startTime: row.start_time ? hhmm(row.start_time) : null,
  endTime: row.end_time ? hhmm(row.end_time) : null,

// taskColumns — add:
  start_time: task.startTime || null,
  end_time: task.endTime || null,
```

### Draft migration — `supabase/migrations/0005_task_hours.sql`

```sql
-- ============================================================
-- שעות למשימה חד-יומית.
--
-- שתי עמודות בלבד, שתיהן nullable ובלי ברירת מחדל — ולכן ההרצה בטוחה
-- על טבלה מלאה ולא נוגעת בשורה קיימת אחת. אין כאן update, בכוונה:
-- UNIF-04 אוסר מילוי שעות לאחור. כל משימה שקיימת כרגע תישאר עם
-- start_time/end_time ריקים אחרי ההרצה — וזה בדיוק מה שהופך אותה
-- ל"קפואה" מבלי שנדרש דגל נפרד: קפוא = חסר שעות, לא ערך מיוחד.
--
--   start_time / end_time   שעת התחלה/סיום, מאותו טיפוס עמודה כמו
--                            gs_shifts.start_time/end_time (זמן בלבד,
--                            בלי תאריך — התאריך כבר קיים ב-due_date).
-- ============================================================

alter table gs_tasks add column if not exists start_time time;
alter table gs_tasks add column if not exists end_time   time;
```

**Confidence on column type:** `[ASSUMED — MEDIUM]`. `docs/database/schema-and-rls.md` documents `gs_shifts.start_time`/`end_time` without an explicit Postgres type (the base schema predates the migrations folder — no `0001_*.sql` exists in the repo, confirmed via `Glob`). The `time` type is inferred from `api.js:15`'s `hhmm()` helper (`String(t || "").slice(0, 5)`), which only makes sense as a truncation of a `time`-typed value serialized as `"HH:MM:SS"` — the same pattern gs_shifts already uses. **The planner should verify the actual `gs_shifts.start_time` column type against the live Supabase schema (e.g. via the Supabase MCP/dashboard) before running this migration**, and use the identical type for `gs_tasks.start_time`/`end_time`. If it turns out to be `text`, adjust the SQL accordingly — the nullable/no-default/no-backfill shape is correct regardless of exact type.

### New test fixture pattern — extending `verify-scheduler.mjs` for UNIF-02

```javascript
// Following the existing day()/night() fixture pattern at scripts/verify-scheduler.mjs:33-41
const task = (date, assignee, start, end) => ({
  id: `tk-${date}-${assignee}`, title: "משימה", category: "מטבח",
  startDate: date, dueDate: date, startTime: start, endTime: end, assignees: [assignee],
});

// Example assertion shape (illustrative — planner fills in the exact expected values):
// A guard already on a 06:00–14:00 task should be rejected for a night shift
// starting the same evening if the rest gap is under minRestHours, with the
// SAME "rest" code and reason format checkHardConstraints already produces
// for shift-vs-shift rest violations.
```

### New test fixture pattern — extending `verify-planning.mjs` for UNIF-01/03/04/06

```javascript
// Following the existing `existing`/`candidate` fixture pattern at
// scripts/verify-planning.mjs:58-65
const engineTask = { id: "et1", category: "מטבח", startDate: mon, dueDate: mon,
  startTime: "06:00", endTime: "14:00", assignees: ["g1"] };
const frozenTask = { id: "ft1", category: "מטבח", startDate: mon, dueDate: mon,
  assignees: ["g1"] }; // no startTime/endTime — pre-migration shape

check("משימה עם שעות היא engine-eligible", isTaskEngineEligible(engineTask) === true);
check("משימה בלי שעות היא קפואה", isTaskEngineEligible(frozenTask) === false);
check("taskWindow על משימה עם שעות מחזיר מיליסניות", Number.isFinite(taskWindow(engineTask)?.start));
check("taskWindow על משימה קפואה מחזיר תאריכים כמו היום", taskWindow(frozenTask)?.from === mon);
// Re-run all 8 existing conflict-matrix checks (verify-planning.mjs:33-88) unchanged —
// they must all still print "ok" after taskWindow/windowsOverlap are rewired.
```

## State of the Art

Not applicable in the usual sense (no external ecosystem to track) — the only "old approach → current approach" shift is internal:

| Old Approach | Current (Proposed) Approach | When Changed | Impact |
|--------------|------------------------------|---------------|--------|
| Two independent overlap functions (`autoAssign.js` ms-based, `conflicts.js` date-string-based) | One `windowsOverlap` in `dates.js`, resolution-agnostic | Phase 2 | UNIF-03; also removes a class of "which one did I mean to change" bugs |
| `checkHardConstraints`/`teamAverages`/`tally` see only shifts | Same functions, unmodified, fed a merged shift+task-shape array by their callers | Phase 2 | UNIF-02; zero new engine code, only new call-site wiring |
| Task engine-eligibility undefined (tasks never entered the engine) | Derived from column nullability (`isTaskEngineEligible`) | Phase 2 | UNIF-04/05; no stored flag, no migration write |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gs_tasks.start_time`/`end_time` should be Postgres `time` type, matching the (undocumented-in-migrations) `gs_shifts.start_time`/`end_time` columns | Draft migration | If the live schema uses `text` for `gs_shifts` times, the new columns should match that instead — mismatched types between the two "same concept" columns would be a design wart, not a correctness bug (both directions still round-trip through `hhmm()`), but should be verified before running the migration |
| A2 | A task's `shiftLoad()` weight should use `LOAD_WEIGHTS.default` (1×, plus the existing weekend multiplier which is date/time-derived and applies automatically) rather than inferring a night multiplier from the task's actual clock hours | Open Questions | If wrong, task hours worked at night would under-count toward fairness/load relative to an equivalent night shift — a plausible-but-undiscussed product question, not a code defect either way |
| A3 | Decision 4's "calendar card" surface for the frozen badge does not exist yet in the codebase (confirmed via grep — zero task-rendering code in `WeekCalendar.jsx`/`CalendarView.jsx`), so the badge requirement is satisfiable in full by badging `TaskRow` alone unless the plan explicitly scopes in building new calendar UI | Pitfall 7 | If the user intended a literal new calendar-card surface, scoping it out silently would under-deliver UNIF-05; this should be confirmed with the user or explicitly scoped by the planner, not assumed either way |

## Open Questions

1. **How should a task's hours be weighted in `shiftLoad()` — flat (`LOAD_WEIGHTS.default` = 1×) or inferred from time-of-day like a shift's `night` multiplier?**
   - What we know: `shiftLoad()` (`autoAssign.js:80-86`) multiplies hours by `LOAD_WEIGHTS[shift.type]`, and `type` is an explicit categorical field shifts declare (`morning`/`night`/etc.), never inferred from clock time. `isWeekendShift()` (which the weekend multiplier depends on) *is* date/time-derived and would apply to tasks automatically with zero extra work.
   - What's unclear: UNIF-02 says a task's hours count "בדיוק כמו משמרת" (exactly like a shift) — this wasn't tested against the night-multiplier case specifically in discuss-phase, and tasks have no `type` field to declare a night designation explicitly.
   - Recommendation: default to `LOAD_WEIGHTS.default` (flat 1× plus the automatic weekend multiplier) via `taskAsShiftShape`'s `type: "task"`. This is the minimal, literal reading of UNIF-02 (same load *pipeline*, not a new time-of-day inference the shift side doesn't have either) and avoids inventing product logic the discuss-phase never touched. Flag for user confirmation only if the planner judges the fairness-magnitude difference significant enough to matter for a typical team's task mix.

2. **Does UNIF-05's "calendar card" surface need to be built, or does it not exist and therefore doesn't need a badge?**
   - What we know: no task-rendering code exists in `WeekCalendar.jsx` or `CalendarView.jsx` today (verified via `Grep`, zero matches).
   - What's unclear: whether Decision 4 ("בכל מקום שמשימה קפואה מוצגת... גם בכרטיסי לוח השנה") anticipated this surface already existing (it doesn't) or was scoping ahead for Phase 5's unified board (`BOARD-01`: "לוח אחד מציג משמרות ומשימות יחד").
   - Recommendation: treat Decision 4 as satisfied by badging every surface that exists today (`TaskRow`), and explicitly note in the plan that no calendar card exists to badge — leave building one to Phase 5 (`BOARD-01`) unless the user says otherwise. This is a scope question for the planner to make explicit, not silently resolve.

## Environment Availability

Not applicable — no external tool, service, or runtime dependency is introduced by this phase. `npm test` and `npm run build` (both already working per `STATE.md`) are sufficient to verify the pure-function changes; the Supabase migration requires a manual `psql`/dashboard run against the live project, same as `0002`–`0004` were run (per `docs/database/schema-and-rls.md`'s "מיגרציות" table — all three were "הורצה ידנית," i.e. no CI/automated migration runner exists in this project).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (project convention: standalone Node scripts, `[VERIFIED: CLAUDE.md, package.json]`) |
| Config file | none |
| Quick run command | `node scripts/verify-scheduler.mjs` (autoAssign/fairness/loadTable) or `node scripts/verify-planning.mjs` (conflicts/fairness) |
| Full suite command | `npm test` (runs both scripts in sequence, `package.json:11`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UNIF-01 | New task requires start/end time to be engine-eligible; multi-day tasks never get them | unit (pure fn) | `node scripts/verify-planning.mjs` (`isTaskEngineEligible` assertions) | ✅ (extend existing file) |
| UNIF-02 | Task hours block a conflicting shift via rest/consecutive/weekly-cap; task load appears in `teamAverages` | unit (pure fn) | `node scripts/verify-scheduler.mjs` (`checkHardConstraints`/`teamAverages` with seeded task) | ✅ (extend existing file) |
| UNIF-03 | `windowsOverlap` gives identical results for ms and date-only inputs on the boundary cases proven above | unit (pure fn) | `node scripts/verify-planning.mjs` | ✅ (extend existing file) |
| UNIF-04 | Pre-migration/frozen task's `isTaskEngineEligible` is false; contributes zero load; still passes today's `findConflicts` date-only path | unit (pure fn) | `node scripts/verify-planning.mjs` | ✅ (extend existing file) |
| UNIF-05 | Frozen badge renders on `TaskRow` for a frozen task and not for an engine-eligible one | manual-only (React UI, no test harness in project) | browser check, per `gsd-verify-work` | N/A — no component test infra exists (`[VERIFIED: package.json — no @testing-library/react or similar]`) |
| UNIF-06 | All 8 existing `verify-planning.mjs` conflict-matrix assertions (lines 33-88) still print `ok` unchanged | regression | `npm test` | ✅ (existing file, no new tests needed — non-regression only) |

### Sampling Rate
- **Per task commit:** `node scripts/verify-planning.mjs` and/or `node scripts/verify-scheduler.mjs`, whichever module changed
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green before `/gsd-verify-work`, plus a manual browser check of the frozen badge (UNIF-05 has no automated coverage — flagged above)

### Wave 0 Gaps

None — both `scripts/verify-scheduler.mjs` and `scripts/verify-planning.mjs` already exist, already import the exact modules this phase touches (`autoAssign.js`, `conflicts.js`, `fairness.js`, `dates.js`), and already follow the fixture patterns (`day()`/`night()` shift builders, `existing`/`candidate` task builders) that new UNIF assertions should extend. No new test file, framework install, or shared fixture module is needed.

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`[VERIFIED: .planning/config.json]`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — Supabase Auth, no new auth surface in this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No (unchanged, not newly at risk) | Existing RLS already scopes all `gs_tasks` reads/writes to `team_code` (per `docs/database/schema-and-rls.md`'s blanket RLS statement); two new nullable columns on an existing table inherit the existing row-level policy automatically — no new policy needed |
| V5 Input Validation | Yes | `startTime`/`endTime` are free-text-adjacent (`<input type="time">` in practice, matching the existing shift form pattern) — no new validation logic needed beyond what shifts already lack: `taskInterval` reuses `shiftInterval`'s overnight-wrap semantics, so a reversed start/end is not an error state, consistent with existing shift behavior. No SQL injection surface — all writes go through Supabase's parameterized client (`supabase.from(...).insert(...)`), unchanged pattern |
| V6 Cryptography | No | Not touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-team data leakage via missing `.select()` after write (CLAUDE.md's own documented failure mode: "עדכון בלי `.select()` הוא באג") | Information Disclosure (silent) | `taskColumns`/`taskFromRow` changes must preserve the existing `.select()` calls in `createTask`/`updateTask`/`createTasks` (`api.js:535-570`) — no change needed here since the pattern is already followed, just don't break it while editing `taskColumns` |
| RLS bypass via new column added without policy review | Elevation of Privilege | Not applicable here — no new table, no new policy needed (see V4 above); a reviewer should still confirm no `gs_tasks` policy hard-codes a column allowlist that would need the new columns added (none found — RLS policies scope by `team_code`/`role`, not by column, per every existing migration's policy shape) |

## Sources

### Primary (HIGH confidence — all read in full this session via `Read`)
- `src/lib/autoAssign.js` (851 lines) — `shiftInterval` usage, `checkHardConstraints`, `addToLoad`/`removeFromLoad`, `shiftLoad`, `teamAverages`, `checkAssignment`, `balanceWorkload`
- `src/lib/conflicts.js` (97 lines) — `taskWindow`, `windowsOverlap`, `compatIndex`, `pairRule`, `findConflicts`
- `src/lib/dates.js` (137 lines) — `shiftInterval`, `shiftHours`, `fromISODate`, `minutesOfTime` (confirmed zero internal imports — safe cycle-free home for new shared exports)
- `src/lib/fairness.js` (160 lines) — `tally`, `rollingLoad`, `fairnessPlan`, `meanShiftLoad`
- `src/lib/api.js` (lines 1-140, 230-330, 500-576) — `taskFromRow`, `taskColumns`, `asTaskError`, `shiftFromRow`/`shiftToRow`, `loadTeam`
- `src/components/supervisor/views.jsx` (lines 1-30, 74-180, 830-900, 1220-1260, 1335-1900) — `TaskMgmt`, `TaskRow`, `SupDashboard`, `SwapMgmt`, `AssignView`
- `src/components/SupervisorApp.jsx` (lines 1-260) — routing, `SupDashboard`/`TaskMgmt` prop wiring
- `src/components/GuardApp.jsx` (lines 130-155, 550-575) — `teamAverages` call site, `checkAssignment` call site, confirmed zero task rendering
- `src/components/supervisor/WeekCalendar.jsx`, `src/components/supervisor/CalendarView.jsx` — grepped for task references, zero matches
- `src/components/ui.jsx` (lines 190-220) — `Badge` component, tone/icon system
- `src/components/icons.jsx` (line 30) — confirmed `lock` icon available
- `supabase/migrations/0002_task_folders.sql`, `0004_task_templates_and_compatibility.sql` — additive migration pattern, RLS pattern, idempotent seed pattern
- `docs/database/schema-and-rls.md` — full current `gs_tasks`/`gs_shifts` column inventory, RLS summary
- `scripts/verify-planning.mjs` (461 lines), `scripts/verify-scheduler.mjs` (60+ lines read) — existing test fixture/assertion patterns
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/config.json` — phase scope, requirement wording, workflow flags
- `.planning/phases/02-task-shift-unification/02-CONTEXT.md`, `02-DISCUSSION-LOG.md` — locked decisions
- `CLAUDE.md`, `.claude/CLAUDE.md` — iron constraints (determinism, pure engines, `api.js` chokepoint, WCAG AA, RTL)
- `package.json` — confirmed no test framework, `npm test` script composition, no new dependencies needed

### Secondary (MEDIUM confidence)
- None — no external documentation lookups were needed for this phase (pure internal refactor/unification, no new library or API).

### Tertiary (LOW confidence)
- A1 (Assumptions Log): `gs_tasks.start_time`/`end_time` column type inferred from `hhmm()` truncation pattern, not confirmed against the live Supabase schema (no base-schema SQL file exists in the repo to read directly).

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new libraries this phase
- Architecture (windowsOverlap unification, load-adapter reuse): HIGH — derived by reading every function involved end-to-end and proving behavior-preservation by hand for the boundary cases
- Pitfalls: HIGH — every call site enumerated was found via `Grep`, not recalled from memory
- DB column type: MEDIUM — inferred from a naming/truncation convention, not read from the live schema (flagged as A1)

**Research date:** 2026-08-23
**Valid until:** Stable — this is an internal-codebase research pass with no external dependency drift risk. Re-research only if the codebase files cited above change materially before planning executes.
