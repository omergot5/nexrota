# Phase 4: עמדות קבועות - Research

**Researched:** 2026-08-26
**Domain:** Recurring-duty scheduling on top of an existing deterministic shift/task engine (Supabase/Postgres + pure JS engines)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** A standing position is one of two shapes, chosen per-position at definition time — not a single global model:
  - **"תבנית משמרת"** (template) — fixed recurring day/hour (e.g. "עמדת קבלה, א׳-ה׳ 08:00–16:00"), refilled to the same days/hours every week.
  - **"שבועית ללא שעות"** (weekly, no hours) — applies to the whole week with no specific start/end time (e.g. "כוננות השבוע").
  — Reversibility: **costly** — both shapes need a schema field that discriminates them and fill logic that branches on it; adding a third shape later requires a similar migration on both existing shapes.
- **D-02:** A "template" position is filled automatically by the engine from the qualified pool — the same mechanism that fills a regular shift (hard constraints ⟵ soft scoring ⟵ most-constrained-first). No manual manager choice. `checkHardConstraints`/`isQualified` are called unmodified.
- **D-03:** A "weekly, no hours" position is filled automatically by a fixed rotation: whoever has carried the position for the least time goes next. No manual manager choice here either — POS-01's "without touching anything" applies to both shapes equally. — Reversibility: **reversible** — the rotation base is pure logic swappable without a schema change, as long as the historical data (who carried the position when) is retained.
- **D-04:** Position qualification is the **same** `qualifiedCategories` list built in Phase 3 — not a separate qualification concept. A person associated with a position demonstrates that the position's category (or the position itself, subject to research — **resolved below: category**) is in the list of categories they're qualified for. `isQualified()` stays unchanged.
- **D-05:** Phase 4 builds only a **minimal** dedicated screen that satisfies POS-05 (who's qualified / who's working this week — two separate lists, marked differently). Phase 5 (BOARD-02) builds the polished forward-looking view inside the unified board. The unified board is explicitly out of scope here.

### Claude's Discretion

- **Base schema** — new table (`gs_positions` + weekly rows) vs. extending `gs_shifts` with a flag/field. Research decides per existing patterns (additive-only migrations, `api.js` as the sole column-name boundary).
- **Deterministic ID mechanism** — how a weekly row gets a stable identifier that doesn't change across runs/processes (POS-03/04). Possible pattern: hash of `position_id + week_start`, but this is a technical implementation decision, not a user-facing one.
- **Tie-break in rotation** — when several qualified people have carried the position for exactly the same amount of time, what fixed order breaks the tie (similar to the existing `tieBreak()` in `autoAssign.js`).

### Deferred Ideas (OUT OF SCOPE)

- **The polished "position schedule runs forward" view** (BOARD-02) — Phase 5 (D-05). Phase 4 stops at a minimal screen that satisfies POS-05 only.
- **The unified board itself** (BOARD-01, BOARD-03, BOARD-04) — all of Phase 5, not touched in this phase.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POS-01 | A manager defines a position that enters every week automatically | "Lazy, idempotent materialization" pattern below (Architecture Patterns §1) — triggered on week view, not a manual per-week button |
| POS-02 | Associating a person with a position declares qualification — it does not assign them | Resolved by D-04: qualification is derived from `qualifiedCategories` matching `position.category`; there is no separate "assign person to position" write at all (Architectural Responsibility Map, Pattern 2) |
| POS-03 | The position materializes into weekly rows with deterministic identifiers | "Deterministic identity without hashing" (Pitfall 1, Pattern 1) — natural key `(position_id, date)`, check-before-insert, never derived from wall clock |
| POS-04 | Re-running on the same week produces exactly the same rows, no duplicates | DB unique partial index as safety net + `upsert(..., { onConflict, ignoreDuplicates: true })` as the primary path (Pattern 1, Code Examples) |
| POS-05 | The manager sees "who's qualified" separately from "who's working this week" | Minimal screen design (Architecture Patterns §4) — two visually distinct lists computed from `qualifiedCategories` vs. `assignedGuards`/`assignees` on this week's realized rows |
</phase_requirements>

## Summary

This phase adds recurring "standing positions" on top of an engine that already knows how to fill shifts (constraint-first, most-constrained-first) and tasks (category-gated, hour-optional). The central research finding is that **almost nothing new needs to be built in the engine layer** — the two position shapes map cleanly onto the two entity types the codebase already has:

- A **template** position (fixed weekday/hour) realizes as ordinary `gs_shifts` rows tagged with a new `position_id` column. It is filled by the *existing* `autoAssign()` the moment the supervisor runs Smart Assign for that week — no new fill logic, because a tagged shift is structurally identical to any other shift.
- A **weekly, no-hours** position realizes as an ordinary `gs_tasks` row (Phase 2 already made task hours optional) tagged with the same new `position_id` column, with its single `assignees` slot pre-filled at materialization time by a small new pure rotation function — because unlike a shift, nothing in the existing task flow fills tasks automatically today.

The two entities' shared `category` column is also the sole qualification surface (D-04): a position's `category` is checked against a guard's `qualifiedCategories` with the *unmodified* `isQualified()`. This means POS-02 ("associating a person declares qualification, not assignment") requires **no new write path at all** — the "qualified" list on the POS-05 screen is a pure read-side computation over data that already exists from Phase 3.

The one genuinely new piece of engineering is **idempotent, deterministic weekly materialization**: turning "this position is due to exist for week W" into "exactly one row per (position, calendar date) exists, forever, regardless of how many times or in what order this runs." The research below resolves this without inventing a hash-based ID scheme — a natural composite key `(position_id, date)` enforced by a partial unique index, combined with a check-before-insert / `upsert(..., ignoreDuplicates: true)` write path, is sufficient and matches an existing precedent already in this codebase (`gs_profiles_one_name_per_team`).

**Primary recommendation:** New table `gs_positions` holding position *definitions* only; weekly *realization* rows are plain `gs_shifts`/`gs_tasks` rows carrying a new nullable `position_id` FK, deduplicated by a partial unique index on `(position_id, date)`, materialized lazily and idempotently whenever a week is viewed — never by hashing an ID, never on a manual "generate" click.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Position definition (title, shape, category, weekdays/hours) | API / Backend (Supabase table + RLS) | Browser (form UI) | Definitions are team-scoped persistent config, same tier as `gs_shifts`/`gs_tasks` rows today |
| Weekly materialization (turn a position into this week's rows) | API / Backend (Postgres write via idempotent upsert) | Browser (triggers the check on week view) | Must be idempotent and race-safe (two tabs) — the DB unique index is the tier of record; the browser only *decides when* to ask |
| Template-shape fill (who works it) | Browser/pure engine (`autoAssign.js`, already exists) | — | Reuses the existing constraint-first fill unmodified (D-02) — no new tier |
| Weekly-shape fill (rotation pick) | Browser/pure engine (new small pure function) | API / Backend (persists the pick) | Decision must be pure + testable in Node (`npm test`); persistence is a thin write once, at materialization time |
| Qualification ("who's qualified") | Browser/pure engine (`isQualified`, already exists) | — | Pure derived read over `qualifiedCategories` vs. `position.category` — no new state, no new tier |
| POS-05 minimal screen | Browser / Client (React component) | — | Presentation only; all data it needs already exists from the above tiers |
| Database / Storage | Database / Storage (new `gs_positions` table + 2 nullable columns) | — | Additive-only migration, RLS written in the same file that creates the table |

## Standard Stack

### Core

No new runtime dependencies. This phase is implemented entirely with the stack already in `package.json` [VERIFIED: package.json:14-19,20-26]:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.101.0 | Postgres access, RLS-scoped reads/writes, `upsert(..., ignoreDuplicates)` for idempotent materialization | Already the project's sole data-access dependency [VERIFIED: package.json:15] |
| React 18.2.0 | ^18.2.0 | POS-05 screen, position definition form | Already the project's UI framework [VERIFIED: package.json:16] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No new supporting libraries needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic composite key `(position_id, date)` + DB unique index | Deterministic UUID (e.g. UUIDv5-style hash of `position_id + date`) as the literal primary key value | Rejected: requires either a crypto dependency in the browser or a Postgres extension (`uuid-ossp`) not currently enabled [ASSUMED — extension list not verified this session]; the composite-key + upsert approach needs neither and mirrors an existing verified pattern in this codebase (`gs_profiles_one_name_per_team`, [VERIFIED: supabase/2026-08-18-fix-duplicates-and-preferences.sql:80-82]) |
| A new `gs_positions` table for definitions | Extend `gs_shifts` with a `is_position_template` flag and a `recurrence` jsonb column | Rejected: a "weekly, no hours" position has no meaningful `start_time`/`end_time`, which `gs_shifts` likely requires (columns are always populated by `shiftToRow`, [VERIFIED: src/lib/api.js:38-54] — nullability of the underlying DB columns is not directly verified this session, see Assumptions Log A1); a dedicated table also keeps the "definition" (recurs forever) cleanly separate from "realization" (one row per week), which is exactly the distinction POS-02 needs on screen |
| A Postgres RPC function to materialize + rotate in one transactional round-trip (mirrors `gs_create_team`/`gs_join_team`) | Keep rotation-pick logic in pure JS, use the DB only for idempotent persistence | Chosen: pure JS keeps the rotation decision testable via `npm test` with no DB, matching this codebase's "pure engines, thin data layer" convention (`autoAssign.js`/`fairness.js` are pure; `api.js` is the only column-aware layer) [VERIFIED: src/lib/autoAssign.js:1-16, src/lib/api.js:1-8] |

**Installation:** none — no new packages.

**Version verification:** not applicable — this phase introduces no new npm/pip/cargo dependencies. No `Package Legitimacy Audit` findings apply; see below.

## Package Legitimacy Audit

**Not applicable.** This phase adds zero new external packages. All work is implemented with the existing `@supabase/supabase-js` client and plain JS/SQL already in the project.

**Packages removed due to [SLOP] verdict:** none — no packages were evaluated because none are being added.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (SupervisorApp.jsx)                                         │
│                                                                        │
│  WeekFlow / new PositionsScreen                                       │
│   │  weekOffset changes ──► actions.ensurePositionsForWeek(weekStart) │
│   │                                                                    │
│   ▼                                                                    │
│  useGuardian actions (thin: read active positions, decide, write)     │
│   │                                                                    │
│   ├─ template shape ─► insert unfilled gs_shifts row(s)               │
│   │                    (position_id, date, start/end, category)       │
│   │                    → later filled by EXISTING autoAssign() when   │
│   │                      supervisor runs Smart Assign (unchanged)     │
│   │                                                                    │
│   └─ weekly shape ───► nextRotationGuard(position, guards, history)   │
│                        (new pure fn, isQualified()+tieBreak() reused) │
│                        → insert ONE gs_tasks row, assignees=[picked]  │
│                                                                        │
└───────────────┬────────────────────────────────────────────────────┘
                │  supabase-js: .upsert(rows, {onConflict:"position_id,date",
                │                              ignoreDuplicates:true})
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Supabase / Postgres                                                  │
│                                                                        │
│  gs_positions (definitions, RLS: team-scoped, supervisor-write)       │
│      │ position_id FK (nullable, on delete set null)                  │
│      ▼                                    ▼                           │
│  gs_shifts (+ position_id)          gs_tasks (+ position_id)          │
│   unique(position_id,date)           unique(position_id,due_date)     │
│   WHERE position_id IS NOT NULL      WHERE position_id IS NOT NULL    │
│                                                                        │
│  ← existing RLS on gs_shifts/gs_tasks applies unchanged;               │
│    only gs_positions is a genuinely new RLS surface                   │
└─────────────────────────────────────────────────────────────────────┘

  Read side (POS-05 screen):
    qualifiedCategories (guard) × position.category  ──► "מי כשיר"  (pure, no new state)
    this week's realized row(s).assignedGuards/assignees ──► "מי עובד השבוע"
```

### Recommended Project Structure

```
supabase/migrations/
└── 0007_standing_positions.sql   # new table + 2 nullable FK columns + partial unique indexes + RLS

src/lib/
├── positions.js                  # NEW pure module: nextRotationGuard(), weekdaysForPosition(),
│                                  #   expectedDatesForWeek() — no React, no Supabase, Node-testable
├── api.js                        # + positionFromRow/positionToRow, createPosition/updatePosition/
│                                  #   deletePosition, materializePositionsForWeek()
└── autoAssign.js / fairness.js   # UNCHANGED — reused as-is (D-02)

src/hooks/
└── useGuardian.js                # + actions.addPosition/updatePosition/deletePosition/
                                   #   ensurePositionsForWeek (thin: calls api.js, then refresh())

src/components/supervisor/
└── PositionsScreen.jsx           # NEW minimal screen (POS-05): definition form + two lists

scripts/
└── verify-positions.mjs          # NEW standalone Node test, wired into npm test (see Validation Architecture)
```

### Pattern 1: Idempotent, deterministic weekly materialization — no hashing required

**What:** POS-03 asks for "deterministic identifiers"; POS-04 asks for "no duplicates on repeat runs." Read together with the roadmap's own risk note — *"non-determinism entering through the implementation: wall clock in row identity, or a DB read without `.order()`"* [VERIFIED: .planning/phases/04-standing-positions/04-CONTEXT.md — Risks flagged in roadmap, phase-description block] — the actual failure mode being guarded against is an implementation detail, not a missing cryptographic identifier. The DB's own auto-generated `uuid` primary key (`gen_random_uuid()`, already the convention for every table in this schema [VERIFIED: supabase/migrations/0004_task_templates_and_compatibility.sql:16,70]) is perfectly fine as the literal row PK, **as long as it is only ever assigned once**. Determinism is achieved one level up, at the *business identity* of a row: the pair `(position_id, date)`.

**When to use:** Any time a position's weekly row needs to be created or looked up.

**Example:**
```sql
-- Source: supabase/migrations/0004_task_templates_and_compatibility.sql:69-81 pattern,
-- adapted — this repo's own precedent for "natural key as a partial unique index"
-- (see also gs_profiles_one_name_per_team, 2026-08-18-fix-duplicates-and-preferences.sql:80-82)
alter table gs_shifts add column if not exists position_id uuid
  references gs_positions(id) on delete set null;

create unique index if not exists gs_shifts_position_date_idx
  on gs_shifts (position_id, date)
  where position_id is not null;
```
```js
// src/lib/api.js — the ONLY write path for materialized rows.
// ignoreDuplicates makes a second call for the same week a safe no-op —
// the row that already exists keeps its original, never-reassigned id.
// Source: https://supabase.com/docs/reference/javascript/upsert
export async function materializeTemplateShifts(rows, teamCode) {
  const { error } = await supabase
    .from("gs_shifts")
    .upsert(
      rows.map((r) => shiftToRow(r, teamCode)),
      { onConflict: "position_id,date", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}
```
Never compute a row's business identity from `new Date()`/`Date.now()`; always compute it from the *target week's* Sunday (`startOfWeek`/`weekByOffset`, already the codebase's one definition of "week", [VERIFIED: src/lib/dates.js:90,96]) and the position's own id.

### Pattern 2: Qualification is a pure read, not a write (D-04, POS-02)

**What:** There is no "assign guard to position" API call anywhere in this design. A guard is "qualified" for a position purely because `position.category` is absent from, or present in, their `qualifiedCategories` — exactly the same rule `isQualified()` already enforces for shifts and tasks.

**When to use:** Computing the "מי כשיר" list on the POS-05 screen, and gating the rotation pool for weekly-shape positions.

**Example:**
```js
// Source: src/lib/autoAssign.js:124-129 — UNCHANGED, called as-is per D-02/D-04
export function isQualified(guard, category) {
  if (!category) return true;
  const list = guard?.qualifiedCategories;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(category);
}

// POS-05 "מי כשיר" list — pure derivation, no new state:
const qualifiedGuards = guards.filter((g) => isQualified(g, position.category));
```
This resolves the D-04 parenthetical ("הקטגוריה... או העמדה עצמה, כפוף למחקר") in favour of **category**: two positions that intentionally share a category (e.g. two physical posts both requiring "שמירות") will show the same qualified pool — which is the existing, already-understood behaviour of the shared category taxonomy, not a new concept. A manager who wants two positions to have *different* qualified pools already has the tool for that today: give them different category strings, exactly as they would for two shifts.

### Pattern 3: Fill timing differs by shape — reuse the existing entry point where one exists, decide once at materialization where none does

**What:** For **template** shape, the realized `gs_shifts` row is inserted *unfilled* (`assignedGuards: []`). It is picked up automatically the next time the supervisor runs Smart Assign for that week — `autoAssign()` already iterates every open shift in the week, so a position-tagged shift needs no special-casing there. For **weekly** shape, there is no equivalent "run Smart Assign for tasks" step anywhere in the product today (tasks are hand-assigned per Phase 2/3) — so the rotation decision must be made **once, at materialization time**, and written immediately as the task's `assignees`.

**When to use:** Deciding where the "who fills it" logic lives for each shape.

**Example:**
```js
// src/lib/positions.js — NEW pure module, mirrors tieBreak()/isQualified() conventions.
// Source of tieBreak convention: src/lib/autoAssign.js:169
import { isQualified } from "./autoAssign.js";

/**
 * מי הבא בתור לעמדה השבועית — מי שנשא אותה הכי מעט תורות עד כה (D-03).
 * כל תור שווה בדיוק שבוע אחד, ולכן "הכי מעט זמן" ו"הכי מעט תורות" הם
 * אותו דבר במדויק כאן — אין צורך במשקל שעות כמו shiftLoad().
 *
 * @param {object} position   {id, category}
 * @param {Array}  guards     כל אנשי הצוות
 * @param {Array}  history    כל שורות gs_tasks הקודמות עם position_id זה,
 *                             כל אחת {assignees: [guardId]}
 * @returns {object|null} השומר/ת הבא/ה בתור, או null אם אין כשירים
 */
export function nextRotationGuard({ position, guards, history }) {
  const qualified = guards.filter((g) => isQualified(g, position.category));
  if (!qualified.length) return null;

  const turns = Object.fromEntries(qualified.map((g) => [g.id, 0]));
  for (const row of history) {
    for (const gid of row.assignees || []) {
      if (gid in turns) turns[gid] += 1;
    }
  }

  return [...qualified].sort((a, b) => {
    const diff = turns[a.id] - turns[b.id];
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id)); // same tie-break convention as tieBreak()
  })[0];
}
```

### Anti-Patterns to Avoid

- **Re-running the rotation picker on every page load without gating it behind "does this week's row already exist":** `nextRotationGuard()` itself is deterministic for a *given* history, but if it's called again after the qualified pool or history has shifted (e.g. someone else's qualification changed between two loads), a second un-gated call could silently swap who is on duty this week — a direct violation of POS-04's "exactly the same rows" even though the pure function itself never changed. Always check-then-insert; never recompute-then-upsert for an already-materialized week.
- **Cascading the delete:** `position_id ... on delete cascade` would delete a position's entire schedule history the moment a manager deletes the position definition — destroying data the rotation function needs and the fairness picture depends on. Use `on delete set null` (Pattern 1) so historical shifts/tasks survive as ordinary (now unlabeled) rows.
- **Threading a hash-based deterministic UUID through the browser:** adds a crypto dependency and a second identity scheme to reconcile with the DB's own `gen_random_uuid()` convention, for no benefit the composite unique key doesn't already provide (see Alternatives Considered).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Who is allowed to work this position" | A new `gs_position_qualifications` join table | `isQualified(guard, position.category)` — already exists, unmodified | D-04 explicitly reuses Phase 3's mechanism; a second qualification table would immediately create the "two meters of fairness" problem this whole milestone exists to close |
| "Who fills a template-shape position this week" | A parallel scheduling loop just for positions | `autoAssign()` on the union of regular + position-tagged shifts | The existing engine's contract (hard constraints → soft scoring → most-constrained-first) already produces exactly this if the position's row is a plain `gs_shifts` row |
| Idempotent weekly row creation | Hand-rolled "does this exist" SELECT + application-level lock/mutex | Postgres partial unique index + `upsert(..., ignoreDuplicates:true)` | The database is the only actor that can make two concurrent tab loads race-safe; app-level checking alone cannot |

**Key insight:** every piece of this phase that looks new is actually a materialization/timing problem sitting on top of two engines (`autoAssign.js`, qualification) that already do the substantive work. The only genuinely new logic is ~15 lines of rotation pick and a handful of migration lines.

## Common Pitfalls

### Pitfall 1: Non-determinism smuggled in through row identity or read ordering

**What goes wrong:** A weekly materialization pass produces a different row (or a different fill) each time it runs on the same week, even though no business data changed.
**Why it happens:** Using `Date.now()`/`new Date()` as part of an identity check instead of the target week's Sunday; reading history rows without `.order()` and then relying on array order for a tie-break that should instead be explicit (`tieBreak()`-style lexicographic comparison, never insertion order).
**How to avoid:** Identity = `(position_id, date)` only, computed from `weekByOffset`/`startOfWeek`. All comparisons that must be stable across runs use an explicit comparator (guard id lexicographic), never rely on the order rows happen to arrive from Postgres.
**Warning signs:** `npm test` for this phase (Success Criterion 3) passes on one input order but fails when the same guards/history are fed in shuffled order.

### Pitfall 2: "Qualified" collapsing into "assigned" on screen

**What goes wrong:** The POS-05 screen shows one list, or two lists styled so similarly that a viewer reads "she's in the qualified list" as "she's working this week."
**Why it happens:** Reusing the same list-item component for both lists without a structurally different visual treatment — exactly the entrance-test failure named in Success Criterion 4.
**How to avoid:** Follow the codebase's own established multi-channel-distinction convention already used for the equivalent problem in Phase 3 (a blocked candidate carries *three* redundant signals — disabled state, replaced label, lock glyph — plus a neutral, not danger, ring, "so 'unqualified' never collapses visually into 'unavailable'") [VERIFIED: .planning/STATE.md:79, quoting the Phase 3 decision log verbatim: "a blocked candidate in AssignView carries three redundant signals (disabled, replaced label, lock glyph) plus a neutral (not danger) ring, so 'unqualified' never collapses visually into 'unavailable' (QUAL-08)"]. Apply the same discipline here: distinct heading + distinct icon + distinct color token for "כשיר" vs. "עובד השבוע," never color alone (WCAG requirement already in CLAUDE.md).
**Warning signs:** A design/code review where covering the heading text still lets a reviewer tell the two lists apart — if not, the distinction relies on a single channel.

### Pitfall 3: New table shipped without RLS in the same migration

**What goes wrong:** `gs_positions` is created readable/writable by anyone with a valid session, regardless of team.
**Why it happens:** Splitting "create table" and "add RLS" into two migration files, with real time between them (or a paused deploy) where the table is wide open.
**How to avoid:** Write `enable row level security` and both policies in the *same* migration file that runs `create table gs_positions`, following the exact structure already used for `gs_task_templates`/`gs_role_compatibility` [VERIFIED: supabase/migrations/0004_task_templates_and_compatibility.sql:31-47,83-99].
**Warning signs:** A migration file that creates a table but has no `create policy` statement anywhere in it.

### Pitfall 4: Assuming `gs_shifts`/`gs_tasks` column nullability instead of checking it

**What goes wrong:** A "weekly, no hours" position's realized row is written into `gs_shifts` (which likely requires `start_time`/`end_time`), forcing a fake time value that then corrupts `shiftLoad()`/fairness math for that "shift."
**Why it happens:** `gs_shifts`'s base table isn't in any migration file in this repo — it predates migration tracking — so its exact column constraints were not directly read this session.
**How to avoid:** This research already routes weekly-shape positions to `gs_tasks` (which is confirmed to support nullable `start_time`/`end_time` since Phase 2, [VERIFIED: supabase/migrations/0005_task_hours.sql:15-16]), not `gs_shifts` — so this pitfall shouldn't be reachable if Pattern 1/3 above are followed. Still, before writing the migration, confirm `gs_shifts.start_time`/`end_time` nullability directly against the live schema (Supabase dashboard or `information_schema.columns`) rather than assuming from `shiftToRow`'s always-populated write path.
**Warning signs:** A weekly-shape position accidentally showing up in load/fairness charts with an invented time window.

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (new table, new columns), not a rename/refactor/migration phase.

## Code Examples

### Position definition table + realization columns (full migration sketch)

```sql
-- Source: pattern adapted from supabase/migrations/0004_task_templates_and_compatibility.sql
-- (gs_task_templates/gs_role_compatibility table+RLS shape) and
-- supabase/migrations/0006_qualification.sql (additive-only, nullable-first philosophy)

create table if not exists gs_positions (
  id             uuid primary key default gen_random_uuid(),
  team_code      text not null references gs_teams(code) on delete cascade,
  shape          text not null check (shape in ('template','weekly')),
  title          text not null,
  category       text not null,
  weekdays       jsonb,        -- template only: array of 0-6 ints, Date.getDay() convention
  start_time     time,         -- template only
  end_time       time,         -- template only
  required_guards int not null default 1,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table gs_positions enable row level security;

create policy gs_positions_read on gs_positions
  for select using (
    team_code in (select team_code from gs_profiles where user_id = auth.uid())
  );

create policy gs_positions_write on gs_positions
  for all using (
    team_code in (
      select team_code from gs_profiles
       where user_id = auth.uid() and role = 'supervisor'
    )
  );

alter table gs_shifts add column if not exists position_id uuid
  references gs_positions(id) on delete set null;
alter table gs_tasks  add column if not exists position_id uuid
  references gs_positions(id) on delete set null;

create unique index if not exists gs_shifts_position_date_idx
  on gs_shifts (position_id, date) where position_id is not null;
create unique index if not exists gs_tasks_position_date_idx
  on gs_tasks (position_id, due_date) where position_id is not null;
```

### Deriving the calendar dates a template position occupies this week

```js
// src/lib/positions.js
// Source of weekday convention: src/lib/dates.js:98 (dayName reads Date.getDay()),
// src/lib/autoAssign.js:78-80 (isWeekendShift also reads getDay() directly)
import { fromISODate, weekFrom } from "./dates.js";

export function expectedDatesForWeek(position, sundayISO) {
  if (position.shape !== "template") return [sundayISO]; // weekly shape: one row, keyed to the Sunday itself
  const days = new Set(position.weekdays || []);
  return weekFrom(sundayISO).filter((d) => days.has(fromISODate(d).getDay()));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Every schedulable item is either a shift (hour-bound) or a task (Phase 2 made hours optional) | A position is a *recurring definition* that mints ordinary shift/task rows every week | This phase | The engine layer needs zero new code; only the materialization/timing layer is new |

**Deprecated/outdated:** nothing in this phase deprecates existing behaviour — it is purely additive, consistent with every migration so far in this project [VERIFIED: supabase/migrations/0002 through 0006, all additive-only per .planning/STATE.md:69 decision log].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gs_shifts.start_time`/`end_time` are `NOT NULL` (or otherwise unsuited to a value-less "weekly" position) | Standard Stack (Alternatives Considered), Pitfall 4 | If actually nullable, weekly-shape positions *could* live in `gs_shifts` too — the recommendation to route them to `gs_tasks` would still be valid (keeps them out of `autoAssign()`'s hour-bearing fill by construction, which D-03 requires anyway) but the "unsuited" framing would be overstated. Low risk either way since the recommendation doesn't depend on the answer. |
| A2 | Supabase's Postgres instance for this project does not have `uuid-ossp` (or another deterministic-UUID-generation extension) enabled | Standard Stack (Alternatives Considered) | If it *is* enabled, a hash-based deterministic UUID becomes technically easier — but the composite-key recommendation is still simpler and has an in-repo precedent, so this doesn't change the recommendation, only the "why not" framing. |
| A3 | "מי שנשא את העמדה הכי מעט זמן" (D-03) is best modeled as a flat count of past turns, since every turn is exactly one calendar week | Architecture Patterns §3 (`nextRotationGuard`) | If the intended meaning is a genuinely time-weighted metric (e.g. weighting a turn taken 6 months ago less than one taken last month), the simple count model under- or over-corrects. Should be confirmed with the user/planner before implementation, since CONTEXT.md's "Claude's Discretion" list covers the tie-break but not this weighting question explicitly. |
| A4 | Rotation history should be read as an unbounded all-time tally per position, not a rolling window (unlike `fairness.js`'s 14-day rolling window for shift load) | Architecture Patterns §3 | If a rolling window was actually intended, a person who carried the position many times long ago would incorrectly keep skipping their turn forever under the all-time model. Low-probability risk since a duty roster ("who's next") more naturally wants full history than shift-fairness does, but not verified against user intent. |

## Open Questions

1. **Does a "template" position need to support `required_guards > 1`?**
   - What we know: the example given ("עמדת קבלה, א׳-ה׳ 08:00–16:00") reads as a single-person post; `gs_shifts.required_guards` already supports >1 for regular shifts.
   - What's unclear: whether standing positions should inherit that flexibility or are always exactly one person.
   - Recommendation: default `required_guards` to 1 on `gs_positions`, expose the same field as a shift already does — this costs nothing extra and doesn't block MVP if the manager never changes it from 1.

2. **Does an inactive/deleted position's already-materialized future rows (e.g. next week, already generated) get cleaned up, or do they just sit there once the position is deactivated?**
   - What we know: `on delete set null` (Pattern 1's anti-pattern note) preserves history but doesn't retroactively remove rows for weeks that haven't happened yet.
   - What's unclear: whether "deactivate" should also delete not-yet-published future-week rows that were already materialized before deactivation.
   - Recommendation: scope this to "materialization only looks forward from `active` positions" — an already-materialized but not-yet-filled future shift for a now-inactive position is harmless (it simply shows up as an ordinary unassigned shift the supervisor can delete like any other), and this avoids needing extra deletion logic in the MVP slice.

## Environment Availability

Skipped — no new external tool/service dependency. Supabase (already relied upon by the whole app) is the only external dependency, and its availability is already a precondition for every other phase in this project.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (standalone Node scripts) — `npm test` runs `scripts/verify-scheduler.mjs && scripts/verify-planning.mjs` [VERIFIED: package.json:11] |
| Config file | none — see Wave 0 |
| Quick run command | `node scripts/verify-positions.mjs` (new file, see below) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POS-02 | `isQualified(guard, position.category)` correctly derives the qualified pool, unmodified from Phase 3 | unit | `node scripts/verify-positions.mjs` | ❌ Wave 0 |
| POS-03 | `expectedDatesForWeek()` returns the same dates for a template position regardless of call order/repetition | unit | `node scripts/verify-positions.mjs` | ❌ Wave 0 |
| POS-04 | `nextRotationGuard()` returns the same pick given the same guards/history in shuffled input order (determinism); tally excludes guards outside the qualified pool | unit | `node scripts/verify-positions.mjs` | ❌ Wave 0 |
| POS-04 | Materialization is idempotent: calling it twice for the same week does not change or duplicate the realized rows | integration (requires `npm run test:backend`-style real Supabase round trip, OR a pure-JS simulation of the upsert decision) | `node scripts/verify-positions.mjs` (pure simulation) + manual/backend check before phase close | ❌ Wave 0 |
| POS-05 | The two lists ("qualified" / "working this week") never derive from the same underlying field | unit (pure data-shape assertion, not a DOM test — this project has no component test runner) | `node scripts/verify-positions.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/verify-positions.mjs`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green, plus one live-browser check per CLAUDE.md's "אימות בדפדפן" rule — a position must actually appear un-touched next week, and a second view of the same week must not duplicate or reshuffle it.

### Wave 0 Gaps
- [ ] `scripts/verify-positions.mjs` — new standalone Node test file, wired into `package.json`'s `"test"` script (append `&& node scripts/verify-positions.mjs`), covering POS-02 through POS-05 exactly as this codebase already does for `conflicts.js`/`fairness.js` in `verify-planning.mjs`.
- [ ] Framework install: none — reuses the existing zero-dependency Node-script convention.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface introduced |
| V3 Session Management | no | No new session surface introduced |
| V4 Access Control | yes | Row Level Security on `gs_positions` (team-scoped read, supervisor-only write), following the exact policy shape already used for `gs_task_templates`/`gs_role_compatibility` [VERIFIED: supabase/migrations/0004_task_templates_and_compatibility.sql:31-47] |
| V5 Input Validation | yes | `shape` constrained by a `check` constraint to the two known values; `weekdays` validated client-side to integers 0-6 before insert; `category`/`title` treated as free text exactly like existing shift/task categories (no new validation surface beyond what already exists) |
| V6 Cryptography | no | No cryptographic operation is introduced — deliberately avoided per Pattern 1/Alternatives Considered (no hash-based ID scheme) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A non-supervisor account writing/deleting position definitions for their own team | Elevation of Privilege | RLS write policy restricted to `role = 'supervisor'` (mirrors every other write policy in this schema) |
| Cross-team read of another team's positions via a guessed/enumerated `position_id` | Information Disclosure | RLS read policy scoped to `team_code in (... where user_id = auth.uid())`, identical to the existing pattern on every other team-scoped table |
| Client-side-only qualification enforcement bypassed via direct API/RPC call | Tampering | Already an accepted, documented v1 tradeoff carried over unchanged from Phase 3 (`QUAL-04`/`QUAL-05` are enforced client-side; server-side enforcement is explicitly deferred to `QUAL-V2-03` [VERIFIED: .planning/REQUIREMENTS.md:60]) — this phase inherits that tradeoff, it does not introduce a new one |

## Sources

### Primary (HIGH confidence)
- `src/lib/autoAssign.js` (full read) — hard-constraint/soft-scoring/most-constrained-first contract, `isQualified`/`checkQualification`, `tieBreak()` convention
- `src/lib/fairness.js` (full read) — rolling-load tally pattern, `meanShiftLoad`
- `src/lib/dates.js` (full read) — week/date conventions (`startOfWeek`, `weekByOffset`, `weekFrom`, `Date.getDay()` weekday convention), task/shift unification (`isTaskEngineEligible`, `taskAsShiftShape`)
- `src/lib/api.js` (full read) — row↔app mapper convention, `.select()`-after-write RLS-blindness guard, `upsert(..., onConflict)` usage precedent (`assignGuard`, `setAvailability`)
- `src/hooks/useGuardian.js` (full read) — `optimistic`/`deferred`/`run` action plumbing, stable `actions` reference requirement
- `supabase/migrations/0002_task_folders.sql` through `0006_qualification.sql` (all read) — additive-only migration convention, RLS-in-same-file convention, nullable-first schema evolution
- `supabase/2026-08-18-fix-duplicates-and-preferences.sql` (full read) — the in-repo precedent for "natural key as partial unique index" (`gs_profiles_one_name_per_team`)
- `.planning/phases/04-standing-positions/04-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — locked decisions, requirement text, Phase 3 decision log quoted verbatim for the QUAL-08 pattern precedent

### Secondary (MEDIUM confidence)
- [supabase.com/docs/reference/javascript/upsert](https://supabase.com/docs/reference/javascript/upsert) — confirms `.upsert(rows, { onConflict, ignoreDuplicates: true })` is the documented mechanism for "insert if new, silently skip if a duplicate under this constraint"

### Tertiary (LOW confidence)
- None — no findings in this research rest solely on an unverified web search.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all recommendations reuse code read directly this session
- Architecture: HIGH — every proposed pattern is grounded in an existing, read, in-repo precedent (RLS shape, upsert idempotency, pure-engine convention)
- Pitfalls: HIGH — sourced from the roadmap's own stated risks plus a directly-quoted Phase 3 decision-log precedent for the qualified-vs-assigned confusion risk

**Research date:** 2026-08-26
**Valid until:** 2026-09-25 (30 days — stable internal architecture, no fast-moving external dependency)
