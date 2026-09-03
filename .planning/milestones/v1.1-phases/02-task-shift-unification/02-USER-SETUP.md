# Phase 02: User Setup Required

**Generated:** 2026-08-24
**Phase:** 02-task-shift-unification
**Status:** Complete — applied 2026-08-25 via Supabase MCP (`apply_migration`, project `biauxcgphdhwewszupsq`)

`gs_tasks.start_time`/`end_time` confirmed live: both nullable, no default, and `select count(*) from gs_tasks where start_time is not null or end_time is not null` returned `0` — no pre-existing row was backfilled. `gs_shifts.start_time`/`end_time` confirmed `time without time zone`, matching the new columns exactly (Assumption A1 resolved, no type mismatch).

The two in-app browser checks below (create/reload/widen-date) were not re-verified in this pass — they need a live browser session against the deployed app, not just the database.

Complete this item so `gs_tasks.start_time`/`end_time` exist on the live database. Claude attempted automation first (checked for a Supabase MCP server — none configured in this session; checked for a linked `supabase` CLI — not installed; confirmed the project is network-reachable via a direct HTTPS request, but the anon key cannot run DDL or read `information_schema`). None of the three routes named in the plan's precondition (MCP, CLI) were available, so this is the "operator with SQL-editor access" fallback the plan itself anticipates.

## Dashboard Configuration

- [ ] **Apply `supabase/migrations/0005_task_hours.sql`**
  - Location: Supabase Dashboard → SQL Editor (project `biauxcgphdhwewszupsq`, "Guardian Shifts")
  - Run the file's contents exactly as committed:
    ```sql
    alter table gs_tasks add column if not exists start_time time;
    alter table gs_tasks add column if not exists end_time   time;
    ```
  - This mirrors how `0002`, `0003` and `0004` were applied — this project has no automated migration runner.

- [ ] **Confirm the column type matches `gs_shifts`** (Assumption A1 from `02-RESEARCH.md`, still open)
  - In the SQL Editor, run:
    ```sql
    select column_name, data_type, is_nullable
      from information_schema.columns
     where table_name = 'gs_shifts' and column_name in ('start_time', 'end_time');
    ```
  - If `data_type` is anything other than `time without time zone`, the new `gs_tasks.start_time`/`end_time` columns should be altered to match (`hhmm()` in `src/lib/api.js` will still work either way — it truncates to 5 characters regardless of exact type — but two columns meaning the same thing should not carry two different types).

## Verification

After applying the migration, run in the SQL Editor:

```sql
-- 1. Both new columns present, nullable, no default
select column_name, is_nullable, column_default
  from information_schema.columns
 where table_name = 'gs_tasks' and column_name in ('start_time', 'end_time');

-- 2. No pre-existing row was backfilled (UNIF-04) — must return 0
select count(*) from gs_tasks where start_time is not null or end_time is not null;
```

Expected results:
- Query 1 returns two rows, both `is_nullable = 'YES'` and `column_default` empty/null.
- Query 2 returns `0`.

Then, in the app itself (already deployed against this project — no local env override needed):
- Open the tasks screen as a supervisor, create a task with the same start/due date, fill both hour fields, save, and reload — the hours should persist.
- Widen the due date by a day on that same task and save — the hour fields should disappear and the saved hours should be cleared.

---

**Once all items complete:** Mark status as "Complete" at top of file.
