# Phase 3: מודל כשירויות — Research

**Researched:** 2026-08-26
**Domain:** Internal — pure JS constraint engine (`autoAssign.js`), React state hook (`useGuardian.js`), Supabase/Postgres schema migration, React form/list UI (`views.jsx`, `GuardApp.jsx`). No external library or framework research needed; this phase adds one new concept (per-person category allow-list) to a codebase that already has three closely related precedents to imitate (`deadline_exempt` on `gs_profiles`, `gs_role_compatibility`'s "absence = allowed" convention, `gs_tasks.category` as free-text folder).
**Confidence:** HIGH — every claim below is grounded in a `Read` of the actual file (with line numbers), not training-data guesses. The two places confidence drops to MEDIUM are called out explicitly: the manual-assignment enforcement design (open gap 1, a genuine product-behaviour decision) and the exact jsonb-vs-text[] column type choice (a defensible-either-way implementation detail).

## Summary

Today nothing in NexRota knows "who is allowed to do what kind of work." `checkHardConstraints` (`src/lib/autoAssign.js:183-243`) checks availability, rest, consecutive-hours and weekly/night caps — but not category. `gs_shifts` has no `category` column at all; `gs_tasks.category` exists only as a free-text folder label used for display grouping and for the unrelated `gs_role_compatibility` conflict matrix (which governs whether two *categories* clash on the *same person*, not whether a person may *ever* do a category). Phase 3 adds a person-level qualification list, gives shifts a `category` column so the concept applies uniformly to both entity types unified in Phase 2, and threads a single new hard-constraint check through every place a person can end up on a shift.

Two engineering facts make this phase small. First, `checkHardConstraints` is already the **single choke point** for three of the four routes named in QUAL-04: the greedy fill loop (`autoAssign.js:499`) and the balance pass (`autoAssign.js:616`) both call it directly, and `checkAssignment` (`autoAssign.js:803-827`, used by both `SwapMgmt` and `GuardApp`'s `MySwaps` for swap-request legality) delegates to it at line 826. Inserting one new check at the top of `checkHardConstraints` — before `unavailable`, per `03-CONTEXT.md`'s own suggestion — therefore closes routes 1 (auto-assign), 2 (balance pass) and 4 (swap approval) in a single, already-tested code path. Second, the fourth route — manual assignment, `toggleAssignment` in `src/hooks/useGuardian.js:518-540` — enforces **no** hard constraint today, not just no qualification check; it is a bare optimistic toggle. This is a real, separately-scoped gap that this research resolves below (see "Open Gap 1").

A second, less obvious finding from reading `GuardApp.jsx` line-by-line: `MySwaps`' own legality check (`GuardApp.jsx:575`) calls `checkAssignment({ guard: { id: r.toGuard }, ... })` — a synthetic guard object carrying **only an id**, not the full profile. Once qualification data lives on the guard object, this call site will silently treat every guard as "qualified for everything" (because the default-allow rule reads an absent/undefined `qualifiedCategories` the same as an empty one) regardless of what their real profile says. `GuardApp.jsx` already receives the full `guards` array as a prop — the fix is a one-line lookup, not a redesign, but it is easy to miss because the file compiles and every existing test still passes without it.

**Primary recommendation:** Add `gs_profiles.qualified_categories` (nullable jsonb array, no default — absence/`null`/`[]` all mean "qualified for everything," mirroring `gs_role_compatibility`'s existing "no row = allowed" convention) and `gs_shifts.category` (nullable text, no default — mirrors `gs_tasks.category`). Add one pure, load-free helper `isQualified(guard, category)` exported from `autoAssign.js` next to `availStatus`. Call it as the *first* check inside `checkHardConstraints`, returning `{ ok: false, code: "unqualified", reason: … }` — this closes routes 1, 2 and 4 for free. For route 3 (manual assignment), extract a narrow `checkQualification({ guard, shift })` wrapper (same function, no load/availability params needed) and call it directly from `toggleAssignment` before the optimistic paint, on the assign direction only — this closes QUAL-04 without silently turning on rest/consecutive/weekly-cap enforcement in a place that has never had it and where enabling that is a separate, unscoped product decision. Reuse the existing `FOLDERS` shortcut-list pattern (`views.jsx:1369-1376`) as the one shared taxonomy for shift-category, task-category and the new qualification editor — no new lookup table.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Qualification data storage (QUAL-01, QUAL-02) | Database/Storage (`gs_profiles.qualified_categories`) | — | Per-person attribute, persisted like every other profile field |
| Category on shift/task (QUAL-03) | Database/Storage (`gs_shifts.category`, `gs_tasks.category`) | — | Attribute of the work item, read by the engine and the UI |
| Qualification hard-constraint check (QUAL-04, QUAL-05, QUAL-06) | Browser/Client (pure engine, `autoAssign.js`) | — | No backend server exists (Supabase is BaaS only); all constraint logic already runs client-side, unchanged tier from every other hard constraint |
| Manual-assignment enforcement (QUAL-04 route 3) | Browser/Client (`useGuardian.js` action layer) | Browser/Client (pure engine, called from the action) | The action layer is where writes are issued; it must consult the pure engine before writing, exactly like `SwapMgmt`/`MySwaps` already do for swap legality |
| Qualification display during manual assignment (QUAL-07) | Browser/Client (React, `AssignView`) | — | Pure UI read of data already loaded into `useGuardian`'s `data.guards` |
| Qualification editing (Decision 4) | Browser/Client (React, `TeamView`) | Database/Storage (write path via `api.js`) | Same tier split as the existing `deadlineExempt` toggle |

## Standard Stack

No new libraries. This phase is a schema + pure-function + form change inside the existing stack (React 18.2.0, Supabase JS 2.101.0, Vite 5.2.0 — confirmed via `package.json` `[VERIFIED: package.json:15-25]`, unchanged from project baseline).

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

**Not applicable.** This phase installs no new npm packages. `src/lib/autoAssign.js`, `src/hooks/useGuardian.js`, `src/lib/api.js`, `src/components/supervisor/views.jsx` and `src/components/GuardApp.jsx` are all first-party files already in the repository. The only new dependency surface is two nullable Postgres columns on two existing tables — no new table, no RLS change (existing supervisor/guard policies on `gs_profiles` and `gs_shifts` already cover full-row read/write within `team_code`, confirmed via `docs/database/schema-and-rls.md:96-99` `[CITED: docs/database/schema-and-rls.md]`, and no per-column RLS exists anywhere in this schema).

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────── Browser (React) ─────────────────────────────────┐
│                                                                                     │
│  AssignView (views.jsx:884)              TeamView (views.jsx, guard list ~2264)   │
│    per-candidate button grid               per-guard qualification editor (new)   │
│    reads g.qualifiedCategories              writes via actions.setGuardQualified  │
│    + shift.category to render lock            Categories(id, list)                │
│    state (QUAL-07, QUAL-08 display)                    │                          │
│         │                                               ▼                         │
│         │ click → actions.toggleAssignment    useGuardian actions ──► api.js      │
│         ▼                                        (single choke point for          │
│  useGuardian.actions.toggleAssignment              gs_profiles column names)      │
│    NEW: checkQualification({guard,shift})              │                          │
│    before optimistic paint (QUAL-04 route 3)            ▼                         │
│         │                                        Supabase (gs_profiles,           │
│         ▼                                         gs_shifts)                      │
│  api.assignGuard / api.unassignGuard                                              │
│                                                                                     │
│  ── pure engine, no React/network ──                                              │
│  autoAssign.js                                                                     │
│    isQualified(guard, category)   ◄── NEW, exported next to availStatus           │
│    checkHardConstraints()         ◄── NEW: qualification check inserted FIRST     │
│      ├─ greedy fill loop (line 499)        ─┐ routes 1+2 covered by one insertion │
│      └─ balanceWorkload() (line 616)        ─┘                                    │
│    checkAssignment()              ◄── delegates to checkHardConstraints (line 826)│
│      ├─ SwapMgmt legality (views.jsx:1269)  ─┐ route 4 covered — BUT MySwaps      │
│      └─ MySwaps legality (GuardApp.jsx:575) ─┘ (GuardApp) passes a synthetic      │
│                                                  guard object missing              │
│                                                  qualifiedCategories — must fix    │
│                                                  to pass the real guard record     │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new files needed. All changes land inside existing modules:

```
src/lib/
├── autoAssign.js       # + isQualified(), + checkQualification() wrapper,
│                        #   + qualification check inserted first in checkHardConstraints
├── api.js               # + qualified_categories <-> qualifiedCategories mapper (gs_profiles)
│                        # + category <-> category mapper (gs_shifts, new column)
├── terms.js              # + 2-3 new vocabulary keys (unqualified label, categories nav label)
supabase/migrations/
└── 0006_qualification.sql   # additive, nullable, no backfill — same pattern as 0002/0005
src/hooks/
└── useGuardian.js        # toggleAssignment gains a pre-write qualification gate;
│                          # + setGuardQualifications action (mirrors setGuardExempt)
src/components/
├── supervisor/views.jsx  # AssignView candidate grid (lock state);
│                          # TeamView guard row (qualification editor);
│                          # ShiftMgmt form (+ category field, reuses FOLDERS)
└── GuardApp.jsx           # MySwaps legality check: pass full guard object, not {id}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A second "who can do X" table | A `gs_qualifications` join table (person × category rows) | One nullable jsonb array column on `gs_profiles` | The list is small (a handful of categories per team), edited as a whole per person (Decision 4 — narrow-only, no per-row add/remove UI), and a join table buys nothing `gs_role_compatibility`-style pair semantics don't already prove is unnecessary for this shape of data. `gs_tasks.assignees` already uses the same jsonb-array-on-parent-row pattern in this codebase (`0002_task_folders.sql:16`) |
| A formal category taxonomy | A `gs_categories` lookup table with FK constraints from `gs_shifts.category`/`gs_tasks.category`/`gs_profiles.qualified_categories` | Continue as free text, with `FOLDERS` (`views.jsx:1369-1376`) as a UI shortcut list, exactly like `gs_tasks.category` already works today | `docs/database/schema-and-rls.md:81-83` states this explicitly for tasks: "תיקייה היא טקסט חופשי בעמודת category, לא טבלה... תווית שמנהל ממציא תוך כדי עבודה, לא ישות שמישהו מתחזק" `[CITED: docs/database/schema-and-rls.md:81-83]`. A qualification list that must be checked against an FK-constrained category table would also block a supervisor from typing a brand-new category on a shift until someone edits a second screen first — directly contradicting the roadmap's anti-setup-gate requirement |
| A dedicated qualification-check module | `src/lib/qualifications.js` | `isQualified`/`checkQualification` exported from `autoAssign.js`, next to `availStatus`/`checkAssignment` | `views.jsx` and `GuardApp.jsx` already import `availStatus`/`checkAssignment` from `autoAssign.js` (`views.jsx:13`, `GuardApp.jsx:12`) — adding two more named exports to an already-imported module is a smaller diff than introducing a new import in five files for two ~5-line functions |

**Key insight:** every "don't hand-roll" item above resolves the same way: reuse a convention this codebase has already proven at least twice (`gs_role_compatibility`'s absence-means-allowed, `gs_tasks.category`'s free-text-with-shortcuts, `gs_tasks.assignees`' jsonb-array-on-parent-row). Phase 3 introduces zero new architectural patterns — only a new instance of patterns already load-bearing elsewhere in the same file.

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. No existing string, ID, or key is being renamed; two brand-new nullable columns are being added to existing tables with no backfill.

## Common Pitfalls

### Pitfall 1: Default-deny instead of default-allow (roadmap Pitfall 1)
**What goes wrong:** A new team, or a person added to an existing team, ends up unable to do anything because the qualification list is read as an allow-list starting empty/restrictive instead of "everything."
**Why it happens:** The natural implementation of "a list of what a person can do" is to treat an empty list as "can do nothing" — which is the opposite of what QUAL-02 and Decision 3 require.
**How to avoid:** `isQualified` must treat `null`, `undefined`, and `[]` identically as "no restriction" — `if (!Array.isArray(list) || list.length === 0) return true;` — never `if (!list.includes(category)) return false;` alone. Cover this with an explicit test asserting a brand-new guard with no `qualifiedCategories` field at all passes `isQualified` for every category, including ones the team has never used before.
**Warning signs:** `npm test` regression on the very first `autoAssign` fixture in `verify-scheduler.mjs` (guards have no qualification data at all in that fixture — see Validation Architecture below) would immediately surface this if it broke.

### Pitfall 2: Enforcement on one route only (roadmap Pitfall 2)
**What goes wrong:** Qualification blocks auto-assign but not manual assignment (or blocks manual assignment but the balance pass, running afterward, moves an unqualified person onto the shift anyway).
**Why it happens:** `checkHardConstraints` is the single choke point for routes 1/2/4, but route 3 (`toggleAssignment`) does not call it at all today (confirmed by reading `useGuardian.js:518-540` in full — it directly manipulates `assignedGuards` and calls `api.assignGuard`/`api.unassignGuard`, with zero constraint check of any kind).
**How to avoid:** Explicitly wire a qualification check into `toggleAssignment` — see "Open Gap 1" below for the exact design. Do not assume that because three of four routes are covered by one insertion, the fourth is covered "by extension."
**Warning signs:** A candidate button in `AssignView` that is visually dimmed/locked (QUAL-07 UI) but still clickable and still writes an assignment on click.

### Pitfall 3: `checkAssignment` called with a synthetic/partial guard object
**What goes wrong:** A guard-initiated swap acceptance in `MySwaps` (`GuardApp.jsx:575`) is evaluated against a guard object that carries only `{ id: r.toGuard }` — no `qualifiedCategories` field. Because the default-allow rule treats a missing field as "qualified for everything" (Pitfall 1's own fix), this specific call site will always report the swap as legal regardless of the real guard's actual qualification list.
**Why it happens:** `checkAssignment`'s `guard` parameter was written when only `guard.id` was ever read inside `checkHardConstraints` (for interval bookkeeping) — nothing there needed the rest of the profile until now.
**How to avoid:** Change `GuardApp.jsx:575` to resolve the full guard record from the `guards` prop already passed into `MySwaps` (`GuardApp.jsx:568`) before calling `checkAssignment`: `guard: guards.find((g) => g.id === r.toGuard) || { id: r.toGuard }`. `SwapMgmt` (`views.jsx:1265`) already does this correctly — `const guard = guards.find((g) => g.id === r.toGuard);` — use it as the template.
**Warning signs:** A guard can accept a swap into a shift/category they are explicitly unqualified for, from their own device, while the supervisor's `SwapMgmt` screen (which does resolve the full guard object) correctly blocks the identical swap from the manager's side. Divergent behaviour between the two screens for the same swap request is the tell.

### Pitfall 4: `gs_role_compatibility` and person-level qualification get conflated
**What goes wrong:** Code or a migration accidentally reads/writes the qualification list into `gs_role_compatibility`, or a new hard-constraint check mistakenly calls `pairRule`/`compatIndex` to decide qualification.
**Why it happens:** Both mechanisms now key off the same string vocabulary (task/shift category names), and both implement an "absence = allowed" convention — surface similarity invites confusion.
**How to avoid:** Keep them structurally separate, as `03-CONTEXT.md` explicitly instructs: `gs_role_compatibility` answers "can this person do category A **and** category B in the same window" (a pair-of-categories-on-one-person question, evaluated by `findConflicts` in `conflicts.js`, and it is overridable with a note — `gs_tasks.override_note`). Qualification answers "can this person ever do category A at all" (a single-category-on-one-person question, evaluated by the new `isQualified` in `autoAssign.js`, and per QUAL-05 it is **never** overridable). Do not let the new check call into `conflicts.js`, and do not let `findConflicts` gain a qualification parameter.
**Warning signs:** `verify-planning.mjs`'s existing `gs_role_compatibility` assertions (lines 40-102) regress, or a new qualification test needs to import `compatIndex`/`pairRule` to pass.

### Pitfall 5: `shift.category` treated as required, breaking the no-setup-gate guarantee
**What goes wrong:** A shift or task created without a category — which is every shift ever created before this phase ships, and every shift a supervisor creates without bothering to pick one afterward — gets silently blocked or defaults to some restrictive value, contradicting "a team created a moment ago gets a full weekly schedule on first run" (Phase 3 roadmap success criterion 1).
**Why it happens:** It's tempting to make `isQualified` treat a missing `shift.category` the same as `category: ""` and check it against the list anyway.
**How to avoid:** `isQualified`'s first line must be `if (!category) return true;` — a work item with no category is unrestricted for everyone, symmetric with an empty qualification list being unrestricted. This is what makes the migration a true no-op for every existing shift/task on the day it ships: `gs_shifts.category` is added with no default and no backfill, so every existing row reads as `null`, and `null` category means nobody is ever blocked from it.
**Warning signs:** Existing published shifts (pre-migration) suddenly show "אין כשירים" (QUAL-08's unqualified-empty-slot message) for candidates who were assignable yesterday.

### Pitfall 6: `activeGuards` filtered before the candidate loop, muting the blocker report
**What goes wrong:** (roadmap Pitfall 9) If a future change filters `guards`/`activeGuards` down to "qualified people only" before the greedy-fill loop runs (e.g. as a performance shortcut), `checkHardConstraints` never sees the unqualified guards, `roundBlockers` never records a `code: "unqualified"` entry for them, and `explainUnfilled` (`autoAssign.js:840-860`) falls back to its generic "אין שומרים זמינים בצוות" — which is exactly the QUAL-08 regression (indistinguishable from "nobody submitted availability").
**Why it happens:** Pre-filtering candidates looks like a harmless optimisation ("why score someone who can never win") but it silently deletes the information the UI needs to explain *why* the slot is empty.
**How to avoid:** Let every active guard reach `checkHardConstraints` for every shift, exactly as today — qualification, like every other hard constraint, must be evaluated per-candidate so it can be reported per-candidate. Do not add a pre-loop `.filter(g => isQualified(g, shift.category))` anywhere in `autoAssign()`.
**Warning signs:** `unfilled[].blockers` for a shift where every candidate is unqualified comes back empty or with the wrong code.

### Pitfall 7: `explainUnfilled`'s label map not extended
**What goes wrong:** QUAL-08 requires "אין כשירים" to read differently from "אין זמינים," but `explainUnfilled`'s `labels` object (`autoAssign.js:846-855`) is a fixed map from `code` to Hebrew label — a `code: "unqualified"` blocker with no matching key falls through to `labels[code] || code`, printing the raw string `"unqualified"` on screen.
**Why it happens:** Easy to add the `code` to `checkHardConstraints` and forget the display-side map it feeds.
**How to avoid:** Add `unqualified: "לא כשירים"` (or similar) to the `labels` map in the same change that adds the `"unqualified"` code. Cover with a `verify-scheduler.mjs`/`verify-planning.mjs` assertion that `explainUnfilled` on an all-unqualified blocker set never contains the literal substring `"unqualified"`.
**Warning signs:** English text leaking into an otherwise all-Hebrew UI — grep the built output for `unqualified` after the change lands.

### Pitfall 8: Non-determinism via unordered category-list storage
**What goes wrong:** If `qualifiedCategories` round-trips through a `Set` or an unordered comparison anywhere (e.g. equality checks in tests, or a UI that re-serializes the array before saving), two runs of the same test on logically-identical data could diverge in array order, and a naive `JSON.stringify` determinism check (the pattern already used in `verify-planning.mjs`, e.g. lines 405-406, 410) would falsely fail.
**Why it happens:** jsonb arrays preserve insertion order in Postgres, but any client-side code that builds the array via `Array.from(new Set(...))` or similar is order-sensitive to iteration order, which is itself insertion-order-dependent but easy to get subtly wrong across two different code paths (e.g. the qualification editor UI building the array one way, a test fixture building it another way).
**How to avoid:** Always build/compare `qualifiedCategories` from the canonical `FOLDERS`-then-custom ordering already established by the `folders`/`known`/`custom` pattern in `TaskMgmt` (`views.jsx:1541-1550`), never from raw `Set` iteration order. `isQualified` itself is order-independent (`Array.includes`), so this only matters for UI round-trips and any future determinism assertion on the raw array, not for the engine's blocking decision.
**Warning signs:** A `npm test` flake that only reproduces sometimes — the classic non-determinism signature this project's `check("...run twice, identical output...")` pattern is specifically designed to catch (see `verify-planning.mjs:405-406`).

## Code Examples

Verified patterns from the actual codebase, not invented:

### The exact insertion point in `checkHardConstraints`
```javascript
// Source: src/lib/autoAssign.js:183-243 (current), showing where the new
// check goes — first, before the existing `unavailable` check, per
// 03-CONTEXT.md's own suggestion and confirmed sound: no other check in
// this function needs the qualification check to have run first, and
// qualification needs nothing from any check that would otherwise precede it.
function checkHardConstraints({ guard, shift, load, availability, rules }) {
  const status = availStatus(availability, guard.id, shift.id);
  const candidate = shiftInterval(shift);

  // NEW — first check, per 03-CONTEXT.md: "כשירות צריכה להיכנס כבדיקה
  // קשיחה רגילה" and QUAL-05 (no override, ever, not even by the supervisor).
  const qualCheck = checkQualification({ guard, shift });
  if (!qualCheck.ok) return qualCheck;

  if (status === "unavailable") {
    // ...unchanged...
```

### `isQualified` and `checkQualification` — new exports, same shape as every other check
```javascript
// Source: pattern matches checkHardConstraints's own {ok, code, reason}
// contract (autoAssign.js:180-182 JSDoc) and gs_role_compatibility's
// absence-means-allowed convention (conflicts.js:46 "ברירת המחדל היא כן").

/** True unless the guard carries an explicit, non-empty allow-list that
 * excludes this category. A work item with no category, or a guard with
 * no restriction list, is always qualified — this is what makes a brand
 * new team need zero setup (QUAL-02) and makes every pre-migration shift
 * (category = null) unrestricted for everyone (Pitfall 5). */
export function isQualified(guard, category) {
  if (!category) return true;
  const list = guard?.qualifiedCategories;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(category);
}

/** @returns {{ok: true} | {ok: false, code: "unqualified", reason: string}} */
export function checkQualification({ guard, shift }) {
  if (isQualified(guard, shift?.category)) return { ok: true };
  return {
    ok: false,
    code: "unqualified",
    reason: `לא מוגדר/ת כשיר/ה לקטגוריית "${shift.category}"`,
  };
}
```

### Manual assignment gate — `toggleAssignment` in `useGuardian.js`
```javascript
// Source: src/hooks/useGuardian.js:518-540 (current shape), showing the
// minimal addition for Open Gap 1's recommended narrow fix. Only the
// assign direction is gated — removing someone is never blocked, matching
// every other hard-constraint check in this codebase (they all gate the
// action of adding a shift, never the action of removing one).
toggleAssignment: (shiftId, guardId) => {
  const shift = dataRef.current.shifts.find((s) => s.id === shiftId);
  const guard = dataRef.current.guards.find((g) => g.id === guardId);
  const assigned = Boolean(shift?.assignedGuards.includes(guardId));

  // NEW — QUAL-04 route 3, QUAL-05 (no override), QUAL-06 (same {code,reason}
  // shape every other constraint uses, surfaced through the existing error
  // channel `run()` already provides to every action in this file).
  if (!assigned) {
    const check = checkQualification({ guard, shift });
    if (!check.ok) {
      return run(async () => {
        throw new Error(check.reason);
      });
    }
  }

  return optimistic(
    (d) => ({ /* ...unchanged... */ }),
    () =>
      assigned
        ? api.unassignGuard({ shiftId, guardId })
        : api.assignGuard({ shiftId, guardId, source: "manual" })
  );
},
```

### `GuardApp.jsx`'s `MySwaps` legality fix (Pitfall 3)
```javascript
// Source: src/components/GuardApp.jsx:568-576 (current), diff shown.
// SwapMgmt (views.jsx:1263-1270) already does this correctly — copy its pattern.
const legality = (r) => {
  const shift = shifts.find((x) => x.id === r.shiftId);
- if (!shift) return { ok: false, reason: "המשמרת כבר לא קיימת" };
- return checkAssignment({ guard: { id: r.toGuard }, shift, shifts, availability, tasks });
+ const guard = guards.find((g) => g.id === r.toGuard);
+ if (!shift || !guard) return { ok: false, reason: "המשמרת או השומר כבר לא קיימים" };
+ return checkAssignment({ guard, shift, shifts, availability, tasks });
};
```

## State of the Art

Not applicable in the usual sense — this is a small internal feature addition, not a library/framework upgrade. The one relevant "before/after" is internal to the product's own history:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| No qualification concept anywhere; `gs_role_compatibility` is the only category-aware constraint, and it governs pairs, not individual eligibility | Person-level flat category allow-list, checked as a genuine hard constraint (no override) | Phase 3 (this phase) | `checkHardConstraints` grows a fifth check family; `gs_role_compatibility` is untouched and remains the *only* mechanism that is overridable with a note |

**Deprecated/outdated:** Nothing in this codebase is deprecated by this phase — it is purely additive.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gs_profiles.qualified_categories` should be `jsonb` (array), not Postgres `text[]` | Standard Stack / migration draft | Low — both are valid, additive, nullable column types; `jsonb` was chosen for consistency with `gs_tasks.assignees` (`0002_task_folders.sql:16`, also a person-id array) and `gs_task_templates.positions` (`0004…sql:22`), both already `jsonb`. If the planner or a DBA prefers `text[]` for a plain string array, the migration and mapper both need a one-line type change — no downstream logic changes, since `isQualified` only calls `Array.isArray`/`.includes` |
| A2 | Manual assignment (`toggleAssignment`) should gain **only** a qualification check, not the full `checkAssignment`/`checkHardConstraints` battery (rest/consecutive/weekly-cap/availability) | Open Gap 1 resolution | Medium — this is a genuine, debatable product-UX decision, not a fact derivable purely from code. If the product actually wants manual assignment to enforce every hard constraint (closing a real, separately-tracked gap), the narrow fix recommended here under-delivers and a follow-up phase/decision is needed. The opposite risk — routing manual assignment through full `checkAssignment` in this phase — is a larger, unscoped behaviour change that could silently reject assignments a supervisor has always been able to make by hand (e.g. covering a gap that breaks the 8h rest rule because nobody else is available), with no product conversation about that trade-off. Recommend surfacing this explicitly in `/gsd-discuss-phase` or to the user before planning locks it in, since `03-CONTEXT.md` explicitly left it open rather than deciding it |
| A3 | The task-assignee picker in `TaskMgmt` (`views.jsx:1917-1945`) is **not** one of the four QUAL-04 routes and is therefore out of this phase's mandatory scope, even though `gs_tasks.category` is now literally the qualification field for tasks | Open Questions | Medium — leaving this picker unfiltered means a supervisor can assign an unqualified person to a task by category, through a form that has zero relationship to `autoAssign.js`/`checkHardConstraints` today (confirmed by reading `views.jsx:1408-1945` — task assignee selection is a plain checkbox-style toggle with no engine call at all, only the pre-existing, overridable `findConflicts` warning). This directly undercuts the premise of Decision 2 (`gs_tasks.category` *becomes* the qualification field) for the task half of the unified model. Recommend the planner decide whether to extend the same `isQualified` filter/warning here too — low implementation cost (the `guards` array and `form.category` are both already in scope in that component) but it is additional surface not named in QUAL-04's four routes or in `03-CONTEXT.md` |

## Open Questions

### Open Gap 1 — Manual assignment enforcement (resolved above, flagged as A2)

**What we know:** `toggleAssignment` enforces zero hard constraints today (verified by reading `useGuardian.js:518-540` in full). `checkAssignment`/`checkHardConstraints` already exist, are pure, deterministic, and already power the swap-legality checks in both `SwapMgmt` and `MySwaps`.
**What's unclear:** Whether "manual assignment should also respect rest/consecutive/weekly-cap for the first time ever" is in scope for this phase, or a separate future decision.
**Recommendation:** Extract a **narrow** `checkQualification({ guard, shift })` (no `load`/`availability` params — qualification needs neither) and call only that from `toggleAssignment`, on the assign direction, before the optimistic paint. This satisfies QUAL-04 exactly as worded ("אדם שאינו כשיר לא ישובץ") without changing any other manual-assignment behaviour. Full `checkAssignment` reuse remains available as a documented alternative (see code example above's comment) if the product later decides manual assignment should enforce everything — that is a bigger, separately-reviewable diff and a real UX conversation (a supervisor who has always been able to force an assignment by hand would suddenly be refused for reasons unrelated to qualification), not something this phase should smuggle in as a side effect of the qualification work.

### Open Gap 2 — QUAL-07 UI (resolved above with a concrete design; open question is only the exact visual token choice)

**What we know:** `AssignView`'s candidate grid (`views.jsx:1016-1080`) already has a precedent for a non-color-only status signal: the fairness hint badge (`hintOf(g.id)`, rendered as a numeric corner badge at `views.jsx:1048-1069`) and the availability ring/background treatment (`views.jsx:1029-1041`) both pair a color change with a text/icon change, never color alone. `TeamView`'s `deadlineExempt` toggle (`views.jsx:2296-2306`) is the closest precedent for a per-guard boolean-ish attribute with its own icon button and `Badge` display.
**What's unclear:** The exact Tailwind utility classes/tokens to use for the "locked/unqualified" visual state — this is a design-system detail best resolved by whichever agent owns visual polish (`ui-styling`/`ui-ux-pro-max` skills, or the `UI-SPEC.md` if this phase gets a `ui_hint: yes` treatment per the roadmap).
**Recommendation:** Disable the button (`disabled={busy || !qualified}`), replace the bottom label text unconditionally when unqualified (`!qualified ? "לא כשיר" : assigned ? "משובץ" : meta.label` — text changes regardless of color, satisfying the project's own "וי ולא רק צבע" rule already stated as a comment elsewhere in this same file at `views.jsx:1939`), add a `lock` icon badge in the same corner position pattern the fairness hint already uses, and set a `title` tooltip explaining the category, mirroring the existing `comment` title pattern at `views.jsx:1042`. Do not reuse the `ring-danger` treatment already used for `unavailable` — QUAL-08 requires "no one qualified" to read as distinguishable from "no one available," and reusing the identical visual treatment for both undermines that at the single-candidate level too, not just at the empty-slot level.

### Open Question 3 — Where does the qualification editor read its category list from?

**What we know:** `FOLDERS` (`views.jsx:1369-1376`) is a 6-item shortcut list; `TaskMgmt` already computes a fuller list by unioning `FOLDERS` with whatever custom category strings currently appear in `tasks` (`views.jsx:1541-1550`, the `known`/`custom` pattern).
**What's unclear:** Whether the qualification editor in `TeamView` should offer only the 6 `FOLDERS` shortcuts, or the fuller union of `FOLDERS` + every category string actually in use across `shifts` and `tasks` for that team (so a supervisor can narrow against a custom category like "מחסן" that a task already uses but isn't in the shortcut list).
**Recommendation:** Reuse the exact `known`/`custom` union pattern from `views.jsx:1541-1550`, extended to scan **both** `shifts` (once `category` exists there) and `tasks`, not just `tasks`. This keeps "one shared taxonomy" (Decision 1) literally true — the qualification editor, the task-category input, and the new shift-category input all derive their suggestion list from the same union logic, just fed different source arrays.

## Environment Availability

Not applicable — no new external tool, service, or CLI dependency. Supabase (already required by the whole app) and Node (already required for `npm test`) are the only runtime dependencies, both already verified present in every prior phase of this project.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — standalone Node scripts printing `ok`/`FAIL`, `[VERIFIED: package.json:11]` (`"test": "node scripts/verify-scheduler.mjs && node scripts/verify-planning.mjs"`) |
| Config file | none |
| Quick run command | `npm test` (both scripts run in under a few seconds — no network, no DB) |
| Full suite command | `npm test` (there is no separate "full" suite for pure-function engine code; `npm run test:backend` is explicitly excluded from `npm test` because it mutates the real Supabase project — not relevant to this phase's pure-function changes) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | `isQualified`/mapper round-trip a person's category list correctly | unit | `node scripts/verify-planning.mjs` (new `check(...)` block) | ✅ extend existing file |
| QUAL-02 | A guard with no `qualifiedCategories` field passes `isQualified` for every category | unit | `node scripts/verify-planning.mjs` or `node scripts/verify-scheduler.mjs` | ✅ extend existing file |
| QUAL-03 | `shiftToRow`/`shiftFromRow` and `taskColumns`/`taskFromRow` carry `category` correctly (both directions, `null` preserved) | unit | `node scripts/verify-planning.mjs` (mirrors the existing Test V/W/X pattern at lines 682-725 for task hours) | ❌ Wave 0 — new assertions needed |
| QUAL-04 | `checkHardConstraints`/`autoAssign`/`balanceWorkload` never place an unqualified guard on a categorized shift, across a full generated week | integration (full-engine fixture) | `node scripts/verify-scheduler.mjs` (extend the existing `--- assertions ---` block the same way the rest/consecutive checks already work, at lines 92-115) | ❌ Wave 0 — new assertions needed |
| QUAL-04 (route 3) | `toggleAssignment` refuses to assign an unqualified guard | manual / UAT | Not automatable without a DOM harness this project doesn't have — verify via `/gsd-verify-work` conversational UAT | manual-only (justified: `useGuardian.js` is a React hook, no component test infra exists in this project) |
| QUAL-05 | No code path exists that accepts an override for `code: "unqualified"` | unit (negative) | `node scripts/verify-planning.mjs` — assert `checkQualification` has no parameter that changes its answer for the same `(guard, shift)` pair (e.g. no `overrideNote`/`force` param accepted) | ❌ Wave 0 — new assertion needed |
| QUAL-06 | `checkQualification`'s return shape matches `{ok, code, reason}` exactly like every other hard-constraint branch | unit | `node scripts/verify-planning.mjs` | ❌ Wave 0 — new assertion needed |
| QUAL-07 | Qualification is visible during manual assignment without navigation | manual / UAT | `/gsd-verify-work` conversational UAT (visual/UI requirement, not unit-testable) | manual-only (justified: visual/UX requirement) |
| QUAL-08 | `explainUnfilled` produces a distinguishable message for an all-`unqualified`-blockers shift vs. an all-`unavailable`-blockers shift | unit | `node scripts/verify-scheduler.mjs` or `verify-planning.mjs` | ❌ Wave 0 — new assertion needed |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` green (both scripts, `ok` on every line) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-scheduler.mjs` — add a fixture where at least one guard carries an explicit `qualifiedCategories` list and at least one shift carries a `category` not in that list; assert (a) that guard is never in `result.assignments` for that shift, (b) the corresponding `unfilled[].blockers` entry carries `code: "unqualified"`, (c) `explainUnfilled` on that entry does not contain the literal string `"unqualified"` (Pitfall 7) — covers QUAL-04 (routes 1+2) and QUAL-08
- [ ] `scripts/verify-planning.mjs` — add `isQualified`/`checkQualification` unit assertions: default-allow on missing/null/empty list (QUAL-02, Pitfall 1), explicit exclusion blocks (QUAL-01), no-category shift/task is always unrestricted (Pitfall 5), `{ok, code, reason}` shape matches the rest of the module's contract (QUAL-06), no parameter accepted that changes the answer (QUAL-05 negative test)
- [ ] `scripts/verify-planning.mjs` — extend the existing `api.js` round-trip block (mirroring Test V/W/X, lines 682-725) with `qualified_categories`/`qualifiedCategories` on `profileFromRow`, and `category`/`category` on `shiftFromRow`/`shiftToRow`
- No new test framework or fixture file needed — both target scripts already exist and already cover the exact two engine modules this phase touches

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged by this phase |
| V3 Session Management | No | Unchanged by this phase |
| V4 Access Control | Yes, with an explicit, already-approved gap | Qualification is enforced **client-side only** in this phase — this is not an oversight but a locked decision carried over from `.planning/STATE.md`'s recorded decision log ("אכיפה בצד לקוח בלבד, אכיפת שרת → QUAL-V2-03") `[VERIFIED: .planning/STATE.md:71]`. A person with direct Supabase API/RLS access (not just the UI) could still write an assignment the UI would refuse. Server-side enforcement (RLS policy or trigger on `gs_assignments`) is explicitly deferred to `QUAL-V2-03` in `REQUIREMENTS.md:60` `[VERIFIED: .planning/REQUIREMENTS.md:60]` — this phase must not attempt to close that gap, and should not claim to in its verification |
| V5 Input Validation | Yes | Category is free text (matching `gs_tasks.category`'s existing pattern) — no new validation beyond what already exists for `gs_tasks.category` (none: it's an unconstrained `text` column, `0002_task_folders.sql:15`). No SQL injection surface: all writes go through Supabase's parameterised client (`supabase.from(...).update(...)`), never raw SQL string interpolation, consistent with every other write in `api.js` |
| V6 Cryptography | No | Not touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client bypasses the UI qualification check by calling the Supabase REST/JS client directly | Elevation of Privilege | Explicitly accepted risk for this milestone (see V4 above) — RLS-level enforcement deferred to `QUAL-V2-03`. Document this residual risk in the phase's `VERIFICATION.md`, do not silently under-scope it |
| A malicious/careless category string (e.g. containing `<script>`) stored in `qualified_categories`/`shift.category` and rendered unescaped | Tampering / XSS | React's default JSX text rendering already escapes all string content (no `dangerouslySetInnerHTML` anywhere near category display, confirmed by the render code read in `AssignView`/`TaskMgmt`/`TeamView` above) — no new mitigation needed, but do not introduce `dangerouslySetInnerHTML` when building the qualification editor |

## Sources

### Primary (HIGH confidence — direct `Read` of the actual file this session)
- `src/lib/autoAssign.js` (full file, 900 lines) — `checkHardConstraints` (183-243), greedy fill loop (489-533), `balanceWorkload` (566-652), `checkAssignment` (803-827), `explainUnfilled` (840-860)
- `src/lib/api.js` (full file, 595 lines) — `profileFromRow`/`shiftFromRow`/`shiftToRow`/`taskFromRow`/`taskColumns`, `loadTeam`, `updateShift`/`createShifts`
- `src/lib/conflicts.js` (full file, 103 lines) — `compatIndex`, `pairRule`, `findConflicts`
- `src/lib/dates.js` (full file, 264 lines) — `taskAsShiftShape`, `windowsOverlap`, `isTaskEngineEligible`
- `src/lib/terms.js` (full file, 144 lines) — vocabulary structure, no existing "qualified"/"category" terms
- `src/hooks/useGuardian.js` (full file, 673 lines) — `toggleAssignment` (518-540), `actions` object, `setGuardExempt` (591-599)
- `src/components/supervisor/views.jsx` — `AssignView` (884-1090), `SwapMgmt` (1254-1300+), `FOLDERS`/`TaskMgmt` (1369-1560, 1408-1945), `TeamView` guard list (2247-2320), `ShiftMgmt` form (272-390)
- `src/components/GuardApp.jsx` — `MySwaps` (568-620), import list (1-13)
- `src/components/icons.jsx` (first 100 lines) — confirmed `lock` icon exists (line 30)
- `scripts/verify-planning.mjs` (full file, 737 lines) and `scripts/verify-scheduler.mjs` (first 120 lines) — assertion pattern, existing coverage
- `supabase/migrations/0002_task_folders.sql`, `0004_task_templates_and_compatibility.sql`, `0005_task_hours.sql` (all full files) — additive/nullable/no-backfill migration pattern, RLS policy pattern
- `docs/database/schema-and-rls.md` (full file) — current schema, explicit "category is free text, not a table" rationale
- `.planning/config.json` — `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`
- `package.json` — confirmed no new dependencies needed, existing versions

### Secondary (MEDIUM confidence)
- None — no WebSearch/Context7 lookups were needed for this phase; it is entirely internal codebase work with no external library decision

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, versions confirmed from `package.json`
- Architecture: HIGH — every claim traced to a specific file and line range read this session
- Pitfalls: HIGH for pitfalls 1-7 (derived directly from reading the exact code paths involved); MEDIUM for pitfall 8 (a hypothetical failure mode, not something observed in the current code, included because the project's own test suite pattern would need to catch it if introduced)
- Open Gap 1 (manual assignment enforcement scope): MEDIUM — a genuine product-behaviour judgment call, flagged in the Assumptions Log for explicit confirmation before/during planning

**Research date:** 2026-08-26
**Valid until:** No external dependency to go stale — valid until the underlying code this research is grounded in changes (i.e., until Phase 3 itself ships, at which point this document is historical)
