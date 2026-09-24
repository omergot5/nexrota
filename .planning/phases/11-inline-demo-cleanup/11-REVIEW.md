---
phase: 11-inline-demo-cleanup
reviewed: 2026-09-24T06:35:17Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - src/components/supervisor/PositionsScreen.jsx
  - src/components/supervisor/RosterWizard.jsx
  - src/components/supervisor/UnifiedBoard.jsx
  - src/components/supervisor/WeekFlow.jsx
  - src/components/supervisor/views.jsx
  - src/hooks/useGuardian.js
  - src/lib/api.js
  - src/lib/demoData.js
  - src/lib/sequenceGuard.js
  - supabase/migrations/0022_work_items_is_demo.sql
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-09-24T06:35:17Z
**Depth:** deep (cross-file call-chain tracing between `UnifiedBoard.jsx` → `useGuardian.js` → `dates.js`/`api.js`)
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the full Phase 11 diff (`git diff 5e2370f HEAD -- src/ supabase/`) covering INLINE-01..04:
`is_demo` plumbing, the `sequenceGuard` race fix for `refresh()`, the army FK safety net
(`unmaterializePositionWeek`), `deleteDemoDataForWeek`, and the new inline "+"/"x" affordances on
`UnifiedBoard.jsx`. The `is_demo` round-trip mapping, the `sequenceGuard` token logic, and the demo
data isolation (`demoShiftIdsForWeek`) are all correct and match the locked decisions in
`11-CONTEXT.md`.

Two genuine correctness bugs were found by tracing the new `onToggleAssignment` wiring across module
boundaries — neither was covered by the live-verification pass described in the task (which exercised
shift assignments and rapid add/delete/delete-demo races, not task-typed board items or a mid-operation
`deletePosition` failure). Both are new code paths introduced by this phase, not pre-existing behavior.

## Critical Issues

### CR-01: Inline "x" (remove) on the board silently fails — and corrupts assignment metadata — for engine-eligible tasks

**File:** `src/components/supervisor/UnifiedBoard.jsx:197` (`canRemove`), `:292` (`onRemove` wiring)
**Also:** `src/hooks/useGuardian.js:609-650` (`toggleAssignment`), `src/lib/dates.js:249-250,278-296,388-394` (`isTaskEngineEligible`/`taskAsShiftShape`/`boardItemsForDates`)

**Issue:** `UnifiedBoard` renders one merged pool of "timed" cards built by `boardItemsForDates` →
`withEngineTasks`, which includes not only shifts but every **engine-eligible task** (a single-day task
with both `startTime` and `endTime` — a supported, common shape per `dates.js:249-296`). Such a task
card is *not* `timeless`, so it passes through exactly the same gate as a real shift:

```js
// UnifiedBoard.jsx:197
const canRemove = Boolean(onToggleAssignment) && !timeless;
...
// UnifiedBoard.jsx:292
onRemove={canRemove ? (guardId) => onToggleAssignment(item.id, guardId) : undefined}
```

`item.id` for a task-shaped board item is the **task's** id (`taskAsShiftShape`, `dates.js:281`: `id:
task.id`), not a shift id. `onToggleAssignment` is wired directly to `actions.toggleAssignment`
(`WeekFlow.jsx:191`), whose entire "is this person currently assigned?" computation only looks in
`dataRef.current.shifts`:

```js
// useGuardian.js:610-612
const shift = dataRef.current.shifts.find((s) => s.id === shiftId);
const guard = dataRef.current.guards.find((g) => g.id === guardId);
const assigned = Boolean(shift?.assignedGuards.includes(guardId));
```

When `shiftId` is actually a task id, `shift` is `undefined`, so `assigned` is **always `false`** —
regardless of whether the guard is actually assigned to that task. The function then always takes the
"not assigned" branch and calls `api.assignGuard` (an upsert), **never** `api.unassignGuard`:

```js
() => assigned
  ? api.unassignGuard({ shiftId, guardId })
  : api.assignGuard({ shiftId, guardId, source: "manual", overrideNote })
```

Concretely: a manager sees a guard's avatar on a task-shaped board card (assigned earlier via
TaskMgmt/SmartAssign), clicks the new "x" that `INLINE-01` just added, and:
- The avatar **does not disappear** — the optimistic patch only touches `d.shifts` (`useGuardian.js:632-643`), which contains no matching row, so it's a no-op locally.
- The write is a **re-upsert of the same assignment row** (`onConflict: "work_item_id,guard_id"`,
  `api.js:637-643`), which silently overwrites `source`/`score`/`reason` to `manual`/`null`/`null` —
  destroying any `auto`-sourced scoring metadata the smart-assign engine had attached to that task
  assignment, with no error surfaced to the user.
- The guard is **never actually removed** from the task.

This is a newly-introduced call path: `views.jsx:1248` (`AssignView`, the only pre-existing caller of
`toggleAssignment`) always passes a genuine `shift.id` from a `shifts.map()` loop, so this class of bug
did not exist before `UnifiedBoard`'s `onToggleAssignment` wiring. `canAdd` happens not to be reachable
for the same tasks (`missingOfItem` returns `0` whenever `item.requiredGuards == null`, which is always
true for a task since `taskAsShiftShape` never sets it — `dates.js:278-296`), so only the remove path is
exposed in practice, but that's the one the button explicitly promises to do.

**Fix:** Scope the new inline affordances to genuine shift items, not just "timed" items:

```js
// UnifiedBoard.jsx
const isShiftItem = !timeless && item.type !== "task";
const canRemove = Boolean(onToggleAssignment) && isShiftItem;
const canAdd = Boolean(onToggleAssignment) && isShiftItem && missing > 0;
```

(Longer-term correct fix: make `toggleAssignment` resolve either a shift or a task by id and patch the
matching array, so board-driven add/remove works uniformly for both — but that's a larger change than
this phase's locked scope, and the tactical gate above is a one-line, zero-risk way to stop the silent
failure today.)

### CR-02: `deletePosition`'s two-step write is not atomic — a failure between the two awaited calls destroys this week's materialized data while the UI resurrects it as if nothing happened

**File:** `src/hooks/useGuardian.js:912-920`

```js
deletePosition: (id, weekDates = []) =>
  deferred(
    "העמדה נמחקה",
    (d) => ({ ...d, positions: d.positions.filter((p) => p.id !== id) }),
    async () => {
      if (weekDates.length) await api.unmaterializePositionWeek(id, weekDates);
      await api.deletePosition(id);
    }
  ),
```

**Issue:** `unmaterializePositionWeek` (`api.js:1075-1080`) permanently deletes this week's
`gs_work_items` rows for the position — which, via the existing `on delete cascade` FKs, also destroys
any real assignments, submitted availability, and pending swap requests tied to those rows
(0017/0019 migrations). If the **second** call, `api.deletePosition(id)`, then fails — e.g. because the
same position still has *other* weeks materialized (a very plausible case: `ensurePositionsForWeek` is
routinely called ahead for upcoming weeks, and the FK safety net is deliberately scoped to only the
currently-displayed week per the locked decision in `11-CONTEXT.md`), or a network drop between the two
`await`s — `deferred`'s `flush()` catches the rejection and calls `setData(p.snapshot)`
(`useGuardian.js:317-330`):

```js
run(async () => {
  try {
    await p.work();
  } catch (e) {
    if (mounted.current) setData(p.snapshot);
    throw e;
  }
});
```

`p.snapshot` is the **entire** `data` object captured before the deferred began — it restores
`d.positions` *and* `d.shifts` to their pre-delete shape, i.e. the UI goes back to showing this week's
shifts, their assignments and their availability exactly as before. But those rows are **already gone
on the server** (the first `await` committed). The user sees a failure toast and a board that looks
unchanged, with no indication that real data (assignments, availability submissions, swap requests) for
that week was just permanently deleted. This directly contradicts the project's own invariant for this
file (CLAUDE.md: "כל עדכון אופטימי חייב rollback" — a rollback that resurrects state no longer true on
the server is not a real rollback) and its stated core value ("מה שהמערכת אומרת לו על עצמה נכון").

**Fix:** Don't let a failure of the second step silently repaint stale state. Reconcile from the server
instead of trusting the pre-operation snapshot once any part of the operation has actually written:

```js
async () => {
  if (weekDates.length) await api.unmaterializePositionWeek(id, weekDates);
  try {
    await api.deletePosition(id);
  } catch (e) {
    await refresh(); // the unmaterialize step may have already committed — show the truth, not the old snapshot
    throw e;
  }
}
```

(A true fix — wrapping both deletes in a single Postgres function/transaction — would be the most
robust option, but the above is a minimal change that stops the silent data-loss-with-fake-rollback
behavior within this phase's footprint.)

## Warnings

### WR-01: Per-avatar remove button can be visually/physically covered by the next overlapping avatar in the stack

**File:** `src/components/supervisor/views.jsx:1710-1743`

`People` stacks avatars with a negative margin (`flex -space-x-1.5 space-x-reverse`, `views.jsx:1710`)
so later avatars overlap earlier ones — the standard "pile of coins" look. Each avatar's new remove
button is positioned `absolute -top-1 -left-1.5` (`views.jsx:1735`), i.e. it extends into exactly the
region the next avatar in the stack overlaps. With no explicit `z-index`, DOM order controls stacking,
so an avatar's remove button can end up underneath the next sibling avatar for any board slot with more
than one assigned guard (a routine case — e.g. any shift with `requiredGuards` ≥ 2). The buttons are
also only 18×18px, well under typical touch-target guidance, which compounds the overlap risk on
mobile. This wasn't exercised by the described live testing (which used single-avatar scenarios).

**Fix:** Give the remove button a `z-index` higher than the avatar stack (e.g. wrap avatars with
increasing `z-index` per index, or bump only `.relative` avatar wrappers on `:hover`/`:focus-within` to
the front), and/or increase the effective hit area independent of the visual glyph size.

### WR-02: Deleting a position (or its materialized week) silently destroys real submitted data for that week with no distinct warning

**File:** `src/hooks/useGuardian.js:912-920`, `src/lib/api.js:1075-1080`

The locked decision in `11-CONTEXT.md` scopes the FK safety net to unmaterializing only the *current*
week's rows before `gs_positions` DELETE — that mechanism itself is intentional and not in question
here. But `unmaterializePositionWeek` deletes **all** of that week's `gs_work_items` rows for the
position regardless of whether they carry real (non-demo) assignments, guard-submitted availability, or
pending swap requests — the cascade doesn't check `is_demo`. The only user-facing feedback is the
generic `"העמדה נמחקה"` toast (`useGuardian.js:914`), with no mention that this week's shift
assignments/availability/swap-requests for that position are also being removed. A manager deleting a
position mid-week (e.g. to fix a mistaken template) could unknowingly wipe a guard's already-published,
already-answered shift for the current week with a one-word toast and an 8s undo window that most people
won't read closely enough to catch the scope of what's being undone.

**Fix:** At minimum, surface a more specific toast/label when `weekDates.length &&` the position has
materialized rows for the current week (e.g. `"העמדה נמחקה — כולל המשמרות שהוקצו לה השבוע"`), so the
UndoBar communicates the real blast radius of the action it's offering to undo.

## Info

### IN-01: `unmaterializePositionWeek` relies solely on RLS for team scoping (no explicit `team_code` filter)

**File:** `src/lib/api.js:1075-1080`

```js
export async function unmaterializePositionWeek(positionId, dates) {
  if (!dates?.length) return;
  const { error } = await supabase
    .from("gs_work_items").delete().eq("position_id", positionId).in("start_date", dates);
  if (error) throw new Error(error.message);
}
```

This is safe today — `gs_work_items_write`'s RLS policy already restricts deletes to
`team_code = gs_my_team()` — and the function is only ever called with a `positionId` the caller already
owns (`deletePosition`'s optimistic patch already filters `d.positions` by the same team's data). Not a
bug, but every other destructive function in this file that takes an id from outside the RLS boundary
tends to double-scope explicitly for defense-in-depth; worth a one-line `.eq("team_code", teamCode)` if
`teamCode` is ever threaded through, purely for consistency with the rest of the file's convention.

---

## Fix Pass (2026-09-24)

- **CR-01 fixed**: `UnifiedBoard.jsx`'s `canRemove`/`canAdd` now also require `item.type !== "task"` (a field `taskAsShiftShape`/`dates.js` already sets), so the inline "+"/"x" affordances are scoped to genuine shifts only. Engine-eligible task cards on the board no longer expose the broken remove/add path; they remain read-only exactly as they were before this phase, until `toggleAssignment` itself is taught to resolve task ids too (flagged as a longer-term follow-up, out of this phase's locked scope).
- **CR-02 fixed**: `deletePosition`'s inner `catch` no longer rethrows after `unmaterializePositionWeek` may have already committed. It calls `refresh()` to repaint the true server state and sets the error banner directly via `setError()`, instead of letting the failure propagate to `flush()`'s outer `catch`, which would otherwise stomp the just-refreshed truth with the stale pre-operation snapshot (the exact "fake rollback" the finding described).
- **WR-01 fixed**: the avatar-stack wrapper in `People` (`views.jsx`) gained `hover:z-10 focus-within:z-10`, so a covered remove button rises above the next overlapping avatar on hover/focus without disturbing the normal stacking order otherwise.
- **WR-02 fixed**: `deletePosition` now checks `dataRef.current.shifts` for any row matching the position id within `weekDates` before choosing the deferred label — `"העמדה נמחקה — כולל המשמרות שהוקצו לה השבוע"` when the current week is materialized, the original `"העמדה נמחקה"` otherwise.
- **IN-01**: not fixed — accepted as non-blocking per the review's own note (RLS already scopes correctly; this was a consistency nit, not a bug).
- `npm test` and `npm run build` both re-run clean after the fixes. CR-01/WR-01 are UI-only changes not independently re-verified live in this pass (would require constructing a fresh engine-eligible task + multi-assignee slot scenario); the fixes are narrow, match existing codebase conventions (`item.type` check, `hover:z-10` idiom), and are covered by the existing automated suite passing unchanged.

---

_Reviewed: 2026-09-24T06:35:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
