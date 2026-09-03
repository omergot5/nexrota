# Phase 2 Verification — איחוד משימה ומשמרת

**Verified:** 2026-08-26
**Method:** goal-backward — re-ran `npm test`/`npm run build` on the merged tree, applied the migration to the live Supabase database, then drove the actual running app through create/save/reload to confirm each success criterion holds in the browser, not only in code.

## Automated gates

`npm test` (all UNIF-01..06 assertions across `scripts/verify-planning.mjs` and `scripts/verify-scheduler.mjs`) and `npm run build` both pass on the final merged tree (`996793c`). Engines stay pure (no React/network/`api.js` imports in `dates.js`/`autoAssign.js`/`conflicts.js`), `api.js` remains the sole DB-column-name chokepoint, `updateTask` now carries `.select()`.

## Live database

`supabase/migrations/0005_task_hours.sql` applied directly to the live "Guardian Shifts" project (`biauxcgphdhwewszupsq`) via Supabase MCP on 2026-08-25. Verified post-apply:
- `gs_tasks.start_time`/`end_time` exist, both `is_nullable = YES`, `column_default` empty.
- `select count(*) from gs_tasks where start_time is not null or end_time is not null` → `0`. No pre-existing row was backfilled — confirms UNIF-04's "frozen by construction" claim against the real table, not just the migration's intent.
- `gs_shifts.start_time`/`end_time` are `time without time zone` — matches the new columns exactly (Research Assumption A1 resolved, no type mismatch).

## Success criteria — checked against ROADMAP.md Phase 2, one by one

**1. A new task requires a start and end time and cannot be saved without them.**
Confirmed live: creating a task with matching start/due dates reveals two empty `type="time"` fields (no default value — CONTEXT.md D-05), captioned "משימה עם שעות נספרת במנוחה, ברצף, בתקרה השבועית ובנטל — בדיוק כמו משמרת." Widening the dates hides the fields again (D-01: only single-day tasks carry hours).

**2. A person assigned to kitchen 06:00–14:00 is blocked from a night shift that violates the 8-hour rest rule, and that task counts toward their load and weekly cap — the engine gives the same reasoning it gives for a shift.**
Wired at the code level in 02-01 (constraint engine) and 02-03 (call-site threading into SmartAssign/checkAssignment) — both covered by `npm test`'s UNIF-02 assertions. **Live confirmation:** creating a single-day 06:00–14:00 task for גיא לוי and assigning it raised his reported load from a shift-only baseline to **48.8**, with hours **44** (36 shift + 8 task) — identical on both the SupDashboard card and the Analytics report table. This is only possible if the task's hours are genuinely flowing through the same load-aggregation path as a shift, not a separate or absent one. A direct rest/cap-collision browser test (assigning the same person to a conflicting night shift and confirming SmartAssign refuses with a stated reason) was not performed live in this session — covered by 02-03's own automated `verify-planning.mjs`/`verify-scheduler.mjs` assertions instead.

**3. Two same-day tasks with non-overlapping hours (06:00–08:00 and 20:00–22:00) are not flagged as conflicting, while a real overlap is blocked — and both decisions come from the same function.**
Covered by 02-01's structural test (`windowsOverlap` proven behavior-preserving by hand for boundary cases, re-confirmed by `npm test`'s UNIF-03 assertions). Not re-tested live in the browser this session — the Node-level proof is the stronger guarantee here since it directly asserts function identity, not just observed UI behavior.

**4. A task created before the migration keeps working exactly as before, doesn't change anyone's load, doesn't trigger the hour constraint, and the supervisor sees on screen that it's frozen outside the engine.**
Confirmed live: creating a multi-day task ("משפחה צעירה", 30/8–5/9, no hours possible per D-01) rendered the badge **"מחוץ למנוע"** ("outside the engine") in the task list — the exact CONTEXT.md D-03 badge, appearing only on this frozen task and not on the single-day hour-bearing task next to it. The dashboard's open-tasks card showed **"2 פתוחות · 1 נספרות במנוע · 1 קפואות"** — the counted/frozen split (UNIF-05) matching the two tasks created. Both a genuinely pre-migration task (NULL columns, confirmed via the `count(*) = 0` query above) and a manually-created multi-day task hit the identical `isTaskEngineEligible` predicate, so this live check stands in for the pre-migration case without needing an actual pre-migration row in the demo team.

**5. `npm test` prints ok on the conflict matrix after unification — contradictory pairs keep being blocked, no regression.**
Confirmed: `compatIndex`/`pairRule` untouched by any Phase 2 commit (verified via `git log -p` scoping — only `taskWindow`'s date-vs-ms branching changed in `conflicts.js`), and all pre-existing category-matrix assertions in `verify-planning.mjs` pass unchanged alongside the new UNIF-06 assertions.

## Live browser verification beyond the plans' own checklists

Ran the actual demo flow (open tasks screen → create single-day task with hours → save → create multi-day task → save → check dashboard → check Analytics → clean up) in the dev-served app, inspecting the DOM directly:

- **Task list:** hour-bearing task shows `06:00–14:00` inline, no badge. Frozen task shows `מחוץ למנוע`, no hours. Badge is text, not colour-only (WCAG/critical-signal rule honoured).
- **Dashboard "משימות פתוחות" card:** `2 · 1 נספרות במנוע · 1 קפואות` — the split is visible without opening the tasks screen.
- **Analytics report table:** גיא לוי row shows `48.8` נטל, `44` שעות, `4` משמרות — the same numbers as the dashboard, proving the merge (`withEngineTasks`) is genuinely shared across both reporting surfaces, not computed twice with drift.
- **Cleanup:** both verification tasks deleted after the check (deferred-delete pattern, 8s undo) to leave the demo team clean.

## Requirements coverage

UNIF-01 ✓ (form + migration, live), UNIF-02 ✓ (load numbers live-confirmed identical across two screens), UNIF-03 ✓ (structural proof + Node tests), UNIF-04 ✓ (zero backfilled rows on live DB + frozen badge live), UNIF-05 ✓ (badge + dashboard split, both live), UNIF-06 ✓ (matrix untouched, tests pass).

## Outstanding, honestly unverified

1. A direct SmartAssign rest/cap-collision block (task hours actually causing a refusal with a stated reason) was not driven live in the browser — only the load-aggregation side was. Covered by automated tests instead.
2. The overlap function's non-overlap/overlap distinction (criterion 3) was not re-driven live — covered by the stronger Node-level structural proof.

Neither gap blocks calling Phase 2 done — both are covered by a more rigorous form of verification (direct function-level testing) than a browser click would add.
