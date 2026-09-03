# Phase 03: User Setup Required

**Generated:** 2026-08-26
**Phase:** 03-eligibility-model
**Status:** Complete — applied 2026-08-26 via Supabase MCP (`apply_migration`, project `biauxcgphdhwewszupsq`)

`gs_profiles.qualified_categories` (jsonb) and `gs_shifts.category` (text) confirmed live: both nullable, no default, and `select count(*) from gs_profiles where qualified_categories is not null` / the equivalent on `gs_shifts.category` both returned `0` — no pre-existing row was backfilled.

The two app-level checks below (manual-assignment refusal once 03-04 ships the editor) were not re-verified in this pass — they need the qualification editor UI, which lands in wave 4.

## Dashboard Configuration

- [ ] **Apply `supabase/migrations/0006_qualification.sql`**
  - Location: Supabase Dashboard → SQL Editor (project `biauxcgphdhwewszupsq`, "Guardian Shifts")
  - Run the file's contents exactly as committed:
    ```sql
    alter table gs_profiles add column if not exists qualified_categories jsonb;
    alter table gs_shifts add column if not exists category text;
    ```
  - This mirrors how `0002`–`0005` were applied — this project has no automated migration runner.

## Verification

After applying the migration, run in the SQL Editor:

```sql
-- 1. Both new columns present, nullable, no default
select table_name, column_name, is_nullable, column_default, data_type
  from information_schema.columns
 where (table_name = 'gs_profiles' and column_name = 'qualified_categories')
    or (table_name = 'gs_shifts' and column_name = 'category');

-- 2. No pre-existing row was backfilled (QUAL-02) — both must return 0
select count(*) from gs_profiles where qualified_categories is not null;
select count(*) from gs_shifts where category is not null;
```

Expected results:
- Query 1 returns two rows: `gs_profiles.qualified_categories` (`jsonb`, `is_nullable = 'YES'`, empty default) and `gs_shifts.category` (`text`, `is_nullable = 'YES'`, empty default).
- Both counts in query 2 return `0`.

Then, in the app itself (already deployed against this project — no local env
override needed), once plan 03-04 ships the qualification editor:
- Narrow one person's qualifications away from a category, give one shift that
  category, and confirm the manual assignment grid refuses to add that person
  with a Hebrew reason, while everyone else can still be assigned exactly as
  before.
- Confirm removing someone from any shift still works unconditionally.

Until 03-04 ships the editor, the negative half of this can be verified now:
with nobody's qualifications ever edited, every existing manual-assignment
click and reload should behave exactly as it did before this phase (nothing
blocked by a feature nobody configured, per QUAL-02's default-allow rule).

---

**Once all items complete:** Mark status as "Complete" at top of file.
