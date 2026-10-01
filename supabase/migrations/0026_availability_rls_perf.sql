-- gs_availability: מדיניות ה-RLS קראה ל-gs_shift_team()/gs_my_team() לכל שורה בטבלה
-- כולה (כל הצוותים), ושלוש מדיניות ALL נבחנו גם על SELECT. עם ~23 אלף שורות
-- השאילתה לקחה ~1.5 שנ' ובעומס נפלה על statement timeout — והמסך התרוקן.
-- כאן: (1) קבוצת המשמרות של הצוות מחושבת פעם אחת (initplan, SECURITY DEFINER —
-- בלי RLS מקונן, כמו gs_shift_team היום), (2) מדיניות הכתיבה מפוצלת כך
-- שה-SELECT בודק מדיניות אחת בלבד. אותה הרשאה בדיוק, רק זולה.

create or replace function public.gs_my_team_shift_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$ select id from public.gs_work_items where team_code = public.gs_my_team() $$;

revoke all on function public.gs_my_team_shift_ids() from public, anon;
grant execute on function public.gs_my_team_shift_ids() to authenticated;

drop policy if exists gs_availability_select on public.gs_availability;
drop policy if exists gs_availability_write_own on public.gs_availability;
drop policy if exists gs_availability_write_sup on public.gs_availability;

create policy gs_availability_select on public.gs_availability
  for select using (shift_id in (select public.gs_my_team_shift_ids()));

create policy gs_availability_own_insert on public.gs_availability
  for insert with check (
    guard_id = (select public.gs_my_profile_id())
    and shift_id in (select public.gs_my_team_shift_ids()));
create policy gs_availability_own_update on public.gs_availability
  for update using (guard_id = (select public.gs_my_profile_id()))
  with check (
    guard_id = (select public.gs_my_profile_id())
    and shift_id in (select public.gs_my_team_shift_ids()));
create policy gs_availability_own_delete on public.gs_availability
  for delete using (guard_id = (select public.gs_my_profile_id()));

create policy gs_availability_sup_insert on public.gs_availability
  for insert with check (
    shift_id in (select public.gs_my_team_shift_ids()) and (select public.gs_is_supervisor()));
create policy gs_availability_sup_update on public.gs_availability
  for update using (
    shift_id in (select public.gs_my_team_shift_ids()) and (select public.gs_is_supervisor()))
  with check (
    shift_id in (select public.gs_my_team_shift_ids()) and (select public.gs_is_supervisor()));
create policy gs_availability_sup_delete on public.gs_availability
  for delete using (
    shift_id in (select public.gs_my_team_shift_ids()) and (select public.gs_is_supervisor()));
