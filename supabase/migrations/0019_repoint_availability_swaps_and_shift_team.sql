-- api.js now inserts every new shift into gs_work_items, never gs_shifts —
-- a shift_id FK still pointing at gs_shifts would reject availability/swap
-- rows for any shift created after 0017/0018. Ids are 1:1 identical between
-- the two tables for the migrated backlog, so repointing is safe and loses
-- nothing.
alter table gs_availability
  drop constraint gs_availability_shift_id_fkey,
  add constraint gs_availability_shift_id_fkey
    foreign key (shift_id) references gs_work_items(id) on delete cascade;

alter table gs_swap_requests
  drop constraint gs_swap_requests_shift_id_fkey,
  add constraint gs_swap_requests_shift_id_fkey
    foreign key (shift_id) references gs_work_items(id) on delete cascade;

-- gs_availability's RLS policies (gs_availability_select/write_own/write_sup)
-- call gs_shift_team(shift_id) to resolve which team a shift belongs to.
-- It still read gs_shifts, which no longer receives new rows — every shift
-- created after 0017 returned NULL from it, so availability writes/reads
-- for new shifts silently failed the team match. Repointing the function at
-- gs_work_items fixes all three policies without having to touch their
-- definitions.
create or replace function public.gs_shift_team(sid uuid)
returns text
language sql stable security definer
set search_path = public
as $$select team_code from public.gs_work_items where id = sid$$;
