-- Stage 0 of the shift/task unification: gs_work_items replaces gs_shifts +
-- gs_tasks (DB structure only — old tables stay in place as a read-only
-- backup until the merged engine, stage 1, is proven). `kind` is the
-- discriminator that lets api.js keep returning two separate arrays
-- (`shifts`/`tasks`) to every existing component, unchanged.
create table gs_work_items (
  id uuid primary key default gen_random_uuid(),
  team_code text not null references gs_teams(code) on delete cascade,
  kind text not null check (kind in ('shift','task')),
  title text not null,
  description text,
  category text,
  start_date date not null,
  due_date date not null,
  start_time time,
  end_time time,
  location text,
  required_guards int check (required_guards is null or required_guards between 1 and 10),
  type text default 'custom',
  color text default '#7FC0AE',
  published boolean not null default true,
  status text check (status is null or status in ('pending','done')),
  priority text default 'medium' check (priority is null or priority in ('low','medium','high')),
  override_note text,
  position_id uuid references gs_positions(id),
  created_at timestamptz not null default now()
);

create index gs_work_items_team_kind_idx on gs_work_items(team_code, kind);
create index gs_work_items_team_category_idx on gs_work_items(team_code, category);
create index gs_work_items_position_idx on gs_work_items(position_id);

alter table gs_work_items enable row level security;

-- gs_work_item_assignments replaces gs_assignments, and also absorbs what
-- gs_tasks.assignees/assigned_to used to hold — one assignment shape for
-- both kinds instead of a join table for one and a jsonb array for the
-- other.
create table gs_work_item_assignments (
  work_item_id uuid not null references gs_work_items(id) on delete cascade,
  guard_id uuid not null references gs_profiles(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','auto')),
  score numeric,
  reason text,
  override_note text,
  created_at timestamptz not null default now(),
  primary key (work_item_id, guard_id)
);

alter table gs_work_item_assignments enable row level security;

create function gs_work_item_team(wid uuid)
returns text
language sql stable security definer
set search_path = public
as $$select team_code from public.gs_work_items where id = wid$$;

create policy gs_work_items_select on gs_work_items
  for select to authenticated
  using (team_code = gs_my_team());

create policy gs_work_items_write on gs_work_items
  for all to authenticated
  using (team_code = gs_my_team() and gs_is_supervisor())
  with check (team_code = gs_my_team() and gs_is_supervisor());

-- Mirrors gs_tasks_update_own: a guard may update (e.g. mark done) a task
-- they are assigned to. Assignment now lives in the join table above, so
-- the check is an EXISTS instead of a column comparison.
create policy gs_work_items_update_own on gs_work_items
  for update to authenticated
  using (
    team_code = gs_my_team()
    and kind = 'task'
    and exists (
      select 1 from gs_work_item_assignments wa
      where wa.work_item_id = gs_work_items.id and wa.guard_id = gs_my_profile_id()
    )
  )
  with check (
    team_code = gs_my_team()
    and kind = 'task'
    and exists (
      select 1 from gs_work_item_assignments wa
      where wa.work_item_id = gs_work_items.id and wa.guard_id = gs_my_profile_id()
    )
  );

create policy gs_work_item_assignments_select on gs_work_item_assignments
  for select to authenticated
  using (gs_work_item_team(work_item_id) = gs_my_team());

create policy gs_work_item_assignments_write on gs_work_item_assignments
  for all to authenticated
  using (gs_work_item_team(work_item_id) = gs_my_team() and gs_is_supervisor())
  with check (gs_work_item_team(work_item_id) = gs_my_team() and gs_is_supervisor());

-- Missing from the initial pass: gs_shifts had a unique index on
-- (position_id, date) that materializeTemplateShifts relies on for its
-- upsert(onConflict:"position_id,date", ignoreDuplicates:true) race guard
-- (POS-04). gs_work_items needs the equivalent on (position_id, start_date).
-- Also restoring the plain (team_code, date) index gs_shifts had, as
-- (team_code, start_date).
create unique index gs_work_items_position_date_idx
  on gs_work_items (position_id, start_date);
create index gs_work_items_team_date_idx
  on gs_work_items (team_code, start_date);
