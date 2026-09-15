-- Backfill gs_work_items + gs_work_item_assignments from gs_shifts/gs_tasks/
-- gs_assignments. Full history, no date cutoff — nothing here ever expires;
-- the only existing auto-deletion in this project is the 48h demo-team
-- cleanup (0013_cleanup_demo_teams.sql), which cascades on team_code and
-- therefore already reaches gs_work_items via its own FK — no separate
-- retention job needed or added.
--
-- Original ids are kept 1:1 so gs_availability.shift_id / gs_swap_requests
-- .shift_id keep pointing at valid uuids without a mapping table. Guarded
-- with NOT EXISTS so this is safe to re-run (it was, twice — real
-- production writes landed in gs_shifts while this migration was being
-- developed, and the NOT EXISTS guard is what made the second pass safe).

insert into gs_work_items (
  id, team_code, kind, title, description, category,
  start_date, due_date, start_time, end_time, location,
  required_guards, type, color, published, status, priority,
  override_note, position_id, created_at
)
select
  s.id, s.team_code, 'shift', s.label, null, s.category,
  s.date, s.date, s.start_time, s.end_time, s.location,
  s.required_guards, s.type, s.color, s.published, null, null,
  null, s.position_id, s.created_at
from gs_shifts s
where not exists (select 1 from gs_work_items w where w.id = s.id);

insert into gs_work_items (
  id, team_code, kind, title, description, category,
  start_date, due_date, start_time, end_time, location,
  required_guards, type, color, published, status, priority,
  override_note, position_id, created_at
)
select
  t.id, t.team_code, 'task', t.title, t.description, t.category,
  coalesce(t.start_date, t.due_date), t.due_date, t.start_time, t.end_time, null,
  null, null, null, true, t.status, t.priority,
  t.override_note, t.position_id, t.created_at
from gs_tasks t
where not exists (select 1 from gs_work_items w where w.id = t.id);

insert into gs_work_item_assignments (
  work_item_id, guard_id, source, score, reason, override_note, created_at
)
select
  a.shift_id, a.guard_id, a.source, a.score, a.reason, a.override_note, a.created_at
from gs_assignments a
where not exists (
  select 1 from gs_work_item_assignments wa
  where wa.work_item_id = a.shift_id and wa.guard_id = a.guard_id
);

-- tasks.assignees (jsonb) folded in the same way, assigned_to as fallback
-- for pre-folder rows — mirrors exactly what taskFromRow already does today.
insert into gs_work_item_assignments (work_item_id, guard_id, source, created_at)
select t.id, (elem)::uuid, 'manual', t.created_at
from gs_tasks t,
     jsonb_array_elements_text(
       case when jsonb_array_length(coalesce(t.assignees, '[]'::jsonb)) > 0
            then t.assignees
            when t.assigned_to is not null
            then jsonb_build_array(t.assigned_to::text)
            else '[]'::jsonb
       end
     ) as elem
where not exists (
  select 1 from gs_work_item_assignments wa
  where wa.work_item_id = t.id and wa.guard_id = (elem)::uuid
);
