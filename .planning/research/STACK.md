# Stack Research

**Domain:** Workforce shift/roster scheduling — qualifications model + recurring standing positions, on an existing Postgres/Supabase + React stack
**Researched:** 2026-08-21
**Confidence:** MEDIUM-HIGH (Postgres/RLS patterns are well-documented official guidance = HIGH; library-freshness claims verified against npm registry directly = MEDIUM)

## Framing

This is a **brownfield** milestone on a shipped app. The stack (React 18, Vite, Tailwind, Supabase, Recharts, Vercel) is fixed and out of scope — see `.planning/codebase/STACK.md`. The only open question is: **what, if anything, needs to be added** to build (1) a qualifications model, (2) unified task/shift hours in one engine, (3) auto-recurring standing positions.

The headline finding: **nothing needs to be added.** `package.json` currently carries exactly four runtime dependencies (`@supabase/supabase-js`, `react`, `react-dom`, `recharts`) and zero date/recurrence/ORM libraries — the codebase already hand-rolls all date math in `src/lib/dates.js` (`startOfWeek`, `weekFrom`, `shiftInterval`, `minutesOfTime`, etc.) and all relational logic in `src/lib/conflicts.js` using plain `Map`s over rows fetched through `api.js`. Every capability this milestone needs is a straight continuation of that existing pattern, not a new category of tool. Confidence: HIGH — this is read directly from the current repo, not inferred.

## Recommended Stack

### Core Technologies (unchanged — confirms no new core tech needed)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|------------------|
| Postgres (via Supabase) | current Supabase-managed version | Store qualifications, standing-position templates, and materialized instances | Already the system of record; RLS + `team_code` isolation pattern is proven and must not be forked for the new tables |
| `@supabase/supabase-js` | 2.101.0 (pinned, existing) | All reads/writes, funneled through `src/lib/api.js` | Already the single choke point (`api.js`) that maps DB rows to app objects; new tables plug into the same choke point, they don't need a new client |

### Supporting Libraries — none to add

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| *(none)* | — | — | This milestone's data shapes (a qualification set, a weekly recurrence) are simple enough that hand-written code is both less risky and easier to keep pure than any library. See "What NOT to Use" below for the two libraries you'll be tempted to reach for and why each is wrong here. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm test` (existing `scripts/*.mjs`) | Verifies pure engines with plain Node, no browser, no test framework | Any new engine code (qualification eligibility check, standing-position expansion) must ship with a script in this same style — see Pattern 3 below |
| Supabase SQL editor / migration files (`supabase/migrations/`) | Schema changes and RLS policies | Follow the existing numbered-migration convention (`0002_*.sql` → `0005_*.sql` next) |

## Installation

```bash
# No new packages. This milestone adds zero lines to package.json.
```

## The three design questions, answered

### 1. Qualifications: many-to-many person↔category with RLS

**Recommendation: a join table `gs_qualifications (team_code, profile_id, category)`, not an array column, not a library.**

```sql
create table gs_qualifications (
  team_code   text not null references gs_teams(code),
  profile_id  uuid not null references gs_profiles(id) on delete cascade,
  category    text not null,
  created_at  timestamptz not null default now(),
  primary key (profile_id, category)
);

create index gs_qualifications_team_idx on gs_qualifications (team_code, profile_id);

alter table gs_qualifications enable row level security;

-- Supervisor: full CRUD within their own team_code
create policy "supervisor manages qualifications in own team"
  on gs_qualifications for all
  using (
    team_code in (
      select p.team_code from gs_profiles p
      where p.user_id = (select auth.uid()) and p.role = 'supervisor'
    )
  );

-- Guard: read-only, own team
create policy "team reads qualifications"
  on gs_qualifications for select
  using (
    team_code in (
      select p.team_code from gs_profiles p where p.user_id = (select auth.uid())
    )
  );
```

**Why a join table over a `text[]` array column on `gs_profiles`:**
- **RLS composability.** A join table gets its own row-level policy and its own index on `(team_code, profile_id)`. An array column forces every RLS-adjacent query that needs "is X qualified for Y" to unnest the array in application code or in a Postgres function — you lose the ability to index and to reason about it the same way you reason about every other `gs_*` table.
- **Consistency with the rest of the schema.** `gs_availability` and `gs_role_compatibility` are already composite-key join tables where **absence of a row is meaningful** (`חוסר שורה = unknown`, `היעדר שורה = מותר`). `gs_qualifications` should follow the identical shape: absence of *any* row for a person = eligible for everything (the PROJECT.md default), presence of rows = the allow-list narrows to exactly those categories. This is one convention across four tables instead of three tables doing it one way and a fourth doing it as an array.
- **Confidence: HIGH.** This is standard relational modeling, not a domain call; Postgres and Supabase RLS guidance converge on join-table-plus-index for exactly this shape (verified against Supabase's own RLS performance guidance, see Sources).

**Eligibility check semantics (write this exactly, it's the one subtle part):**
```sql
-- person is eligible for `category` if they have NO restriction rows at all
-- (default: everyone can do everything), OR they have an explicit row for
-- this exact category (the allow-list, once it exists, is exhaustive).
not exists (select 1 from gs_qualifications q where q.profile_id = :person)
or exists (
  select 1 from gs_qualifications q
  where q.profile_id = :person and q.category = :category
)
```
This is a flip-on-first-row pattern (not additive-grant RBAC) — call it out explicitly in the migration comment, because it reads unusually to anyone who's only seen "presence of a row = a grant" join tables.

**RLS performance, since this table is read on every scheduling run:**
- Wrap `auth.uid()` and any function call in the policy in `(select ...)` so Postgres caches it as an `initPlan` instead of re-evaluating per row — this is Supabase's documented #1 RLS performance fix and applies directly here since eligibility is checked per-person, per-slot.
- Index `(team_code, profile_id)` — the exact shape the eligibility check and the engine's data-loading query both filter on.
- Do **not** put the eligibility *logic* in RLS itself beyond team isolation. RLS answers "can this API caller see this row"; eligibility (can this person do this task) is a **scheduling constraint**, and per the project's hard-constraint rule it must be evaluated inside the pure `autoAssign.js` engine so it's deterministic and Node-testable, not inside a Postgres policy that only React ever calls. `api.js` fetches the full `gs_qualifications` rows for the team once per load (same pattern as `gs_role_compatibility` already does for `conflicts.js`) and hands them to the engine as a plain `Map<profileId, Set<category>|null>` (`null` = unrestricted). Confidence: HIGH — this directly mirrors the existing `compatIndex()` pattern in `conflicts.js`.

### 2. Recurrence: RRULE vs materialized rows vs generator

**Recommendation: materialize on read, hand-rolled weekly generator — not RRULE, not a Postgres RRULE extension, not `pg_cron`.**

Three real options exist in the ecosystem, in order of power and complexity:

| Approach | What it is | Verdict for NexRota |
|---|---|---|
| **RRULE (RFC 5545)** via `rrule.js` or a Postgres RRULE extension | Full iCalendar recurrence grammar — `FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10`, exceptions, timezones | **Reject.** The requirement is "recurs every week," full stop — no interval, no BYDAY exceptions, no end date in scope. RRULE is built for a much bigger problem (calendar apps with arbitrary user-authored recurrence). Pulling it in means carrying RFC 5545's full surface area (and its timezone-handling footguns) for a feature that needs one bit of state: "this standing position exists every week." It's also a dependency inside a codebase that currently has zero, and `rrule.js` cannot run inside the pure-engine constraint as a network-free concern — it *could* run there, but there's nothing for it to do that `dates.js`'s existing `weekFrom`/`startOfWeek` don't already do in ~5 lines. |
| **Materialized rows via `pg_cron`** | A scheduled Postgres job (Supabase's `pg_cron`/`pg_net` extension) runs weekly and inserts next week's instances server-side | **Reject for this milestone, note for later.** This is the right tool when recurrence must fire even if nobody opens the app (e.g., to drive a push notification at 6am Monday). But push notifications are explicitly out of scope this milestone (`Out of Scope` in PROJECT.md), and adding a cron-driven server job introduces a second place ("did the cron run?") the manager has to trust, which cuts against the project's core "sistema agrees with itself" objective. Revisit this the moment notifications ship. |
| **Materialize on read, hand-rolled generator** | A `gs_standing_positions` template table (`team_code`, `category`, `weekday`, `start_time`, `end_time`, `required_count`, `active`). A pure function expands a template into concrete rows for a given week using the *already-existing* `weekFrom(sundayISO)` and `minutesOfTime()` from `dates.js`. `api.js` upserts the expanded rows (idempotent on `(standing_position_id, week_start_date)`) the moment a manager opens/builds that week — the same moment "fill week from template" already fires today. | **Recommended.** Zero new dependencies, fully deterministic (same template + same week → same rows, matching Iron Principle #1), testable with a plain Node script exactly like `autoAssign.js` is today, and it extends a UI moment (opening a week) that already exists rather than inventing a new one (a cron job nobody watches). |

**Concretely, the expansion function is this shape** (illustrative, not final code — the discuss/plan phase will finalize the schema):
```js
// pure, no React, no network — goes in src/lib alongside dates.js/conflicts.js
export function expandStandingPositions(templates, weekStartISO) {
  const week = weekFrom(weekStartISO); // existing dates.js helper
  return templates
    .filter((t) => t.active)
    .map((t) => ({
      standingPositionId: t.id,
      date: week[t.weekday], // 0=Sunday..6=Saturday, matches existing DAYS_HE indexing
      startTime: t.startTime,
      endTime: t.endTime,
      category: t.category,
      requiredCount: t.requiredCount,
    }));
}
```

**Idempotent materialization at the DB layer** (so opening the same week twice, or two managers opening it at once, is a no-op the second time):
```sql
alter table gs_shifts add column standing_position_id uuid references gs_standing_positions(id);
create unique index gs_shifts_standing_week_idx
  on gs_shifts (standing_position_id, date)
  where standing_position_id is not null;
```
Then materialization is `insert ... on conflict (standing_position_id, date) do nothing` — the same idempotent-upsert shape Postgres/Supabase guides recommend for exactly this "generate-on-read" pattern (see Sources). Confidence: HIGH for the SQL pattern (standard Postgres upsert), HIGH for "don't add RRULE" (grounded in the codebase's own zero-dependency precedent), MEDIUM for "materialize on read vs pg_cron" — this is a product/ops tradeoff, not a technical fact, and should be confirmed with the user during phase discussion rather than treated as settled.

### 3. Unifying tasks and shifts into one engine

This is a schema/engine merge, not a new-library question, and research confirms there is no standard tool here beyond what's already in the repo. The relevant existing precedent:
- `taskWindow()` in `conflicts.js` already reduces a task to a `{from, to}` window; `shiftInterval()` in `dates.js` already reduces a shift to absolute start/end timestamps. Giving tasks a real `start_time`/`end_time` (instead of date-only) and running both through `shiftInterval()`-shaped logic is a matter of widening `dates.js`'s existing function, not adopting anything new.
- Do not reach for a scheduling/calendar library (e.g., `interval-tree` packages, `date-fns-tz`) to do the overlap math — `windowsOverlap()` in `conflicts.js` is already the correct, tested, dependency-free primitive; the unification work is making shifts and tasks emit the same `{start, end}` shape so one overlap/rest/load engine can consume both, not finding a smarter overlap algorithm.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Join table `gs_qualifications` | `text[]` array column on `gs_profiles` | Only if the team is small (single-digit categories, no RLS-filtered per-category queries ever needed) and you're willing to give up indexability — not recommended here since `gs_role_compatibility`/`gs_availability` already set the join-table convention |
| Hand-rolled weekly generator | `rrule.js` (2.8.1, stable but effectively unmaintained — no release since Nov 2023) | Only if a future milestone needs arbitrary recurrence (every 2nd Tuesday, biweekly, "except public holidays") — not needed for "recurs every week" |
| Materialize-on-read (client-triggered upsert) | `pg_cron` scheduled materialization | Once push/SMS notifications ship and recurrence must fire without anyone opening the app — tracked as a deferred item, not this milestone |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `rrule.js` / any RFC 5545 recurrence library | Solves a bigger problem (arbitrary calendar recurrence) than "every week"; last published Nov 2023 (2.8.1) — stable because the spec doesn't change, but that's also a sign nobody needs new features from it for a use case this simple; would be the first new runtime dependency in a codebase that currently has four | `expandStandingPositions()` — ~15 lines using existing `weekFrom`/`minutesOfTime` from `dates.js` |
| Prisma / Drizzle / any ORM | The project's explicit choke point is `api.js` — "the only place that knows column names." An ORM introduces a second place that knows the schema (its generated client/schema file), which is exactly the duplication the project has deliberately avoided so far (no ORM anywhere in `package.json`). It would also make the `.select()` footgun documented in PROJECT.md (RLS silently returning `error: null` + empty array) harder to see, not easier | Raw `supabase-js` `.from().select()` calls inside `api.js`, same as every existing table |
| `pg_cron`-driven materialization for standing positions, this milestone | Out of scope — notifications (the feature that would actually need "fires even if nobody opens the app") are explicitly deferred this milestone; adding server-cron infra now is speculative | Materialize on read, when a manager opens/builds the week (extends the existing "fill week from template" moment) |
| Doing eligibility checks only in Postgres RLS | RLS governs *visibility* (team isolation), not *scheduling legality*. A hard constraint like "unqualified people are never assigned" belongs in the pure, Node-testable `autoAssign.js`, per the project's own Iron Principle that engines are network-free and deterministic | Fetch `gs_qualifications` once via `api.js`, pass as a plain in-memory index into the engine, exactly like `gs_role_compatibility` already flows into `conflicts.js` |

## Stack Patterns by Variant

**If a future milestone needs recurrence beyond "every week"** (e.g. "every other week", "first Monday of the month"):
- Reassess `rrule.js` then, scoped narrowly (import only the `RRule` parser/iterator, not the natural-language layer)
- Because the complexity tradeoff flips once the domain genuinely needs RFC 5545-shaped rules — don't pre-adopt it now on spec

**If the team-size / qualification-category count grows large enough that per-row RLS on `gs_qualifications` becomes a measurable bottleneck** (unlikely at this product's scale — single-digit-to-low-hundreds people per team):
- Consider a `security definer` function wrapping the join, as Supabase's RLS performance guidance recommends for exactly this join-table-under-RLS shape
- Because moving the join inside a `security definer` function avoids Postgres re-planning the RLS subquery per row on very large tables — not needed at NexRota's current scale, worth knowing about if `gs_qualifications` ever gets slow

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@supabase/supabase-js@2.101.0` | Postgres RLS policies using `(select auth.uid())` wrapper pattern | No version-specific concern; this is a SQL-side pattern, not a client-library feature — works with the pinned client version already in use |
| New migrations (`0005_*.sql` onward) | Existing `supabase/migrations/0002`–`0004` | Follow identical structure: table + index + RLS policy + seed if applicable, in one numbered file, per existing convention |

## Sources

- Supabase RLS Performance and Best Practices (official docs) — verified the `(select auth.uid())` initPlan-caching pattern and the "index columns used in policies" guidance. Confidence: HIGH (official first-party docs).
- Supabase RLS many-to-many/junction-table guidance (community discussion + official troubleshooting doc, cross-checked) — verified join-table-over-array recommendation and the "move heavy joins into a security definer function at scale" escape hatch. Confidence: MEDIUM (community-sourced, cross-checked against official doc).
- npm registry direct fetch (`registry.npmjs.org/rrule/latest`) — verified `rrule` is at version 2.8.1, published November 2023 (no release since). Confidence: MEDIUM (primary registry data, single source).
- Postgres recurring-events pattern discussion (postgresql.org mailing list + thoughtbot writeup, cross-checked) — verified the three-way tradeoff between RRULE-on-the-fly, materialized-view-with-triggers, and generate-on-read/generator patterns. Confidence: MEDIUM (community sources, mutually consistent).
- Direct repo inspection: `package.json`, `src/lib/dates.js`, `src/lib/conflicts.js`, `docs/database/schema-and-rls.md` — verified current dependency set (four runtime packages, zero date/recurrence/ORM libraries) and existing conventions (join tables with "absent row = default" semantics, pure engines fed plain data by `api.js`). Confidence: HIGH (primary source, the codebase itself).

---
*Stack research for: NexRota qualifications + recurring standing positions milestone*
*Researched: 2026-08-21*
