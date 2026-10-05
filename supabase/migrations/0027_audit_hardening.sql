-- ============================================================
-- 0027 — הקשחה אחרי ביקורת טרום-השקה (2026-10-05)
--
-- לא הורצה על ה-DB החי. להריץ ידנית אחרי עיון.
--
-- 1. EXECUTE על פונקציות SECURITY DEFINER: Postgres נותן EXECUTE ל-PUBLIC
--    כברירת מחדל, ולכן `anon` (מי שמחזיק במפתח הציבורי בלי התחברות) יכול
--    לקרוא ל-/rest/v1/rpc/<fn>. כניסה אנונימית של האפליקציה מקבלת JWT של
--    `authenticated`, ולכן לא נפגעת.
-- 2. auth.uid() בתוך policy מחושב מחדש בכל שורה; (select auth.uid()) הופך
--    אותו ל-initplan שמחושב פעם אחת. אותו תיקון ש-0026 עשתה ל-availability.
--    ההגדרות כאן הועתקו מ-pg_policies החי, בלי שינוי לוגי.
-- 3. אינדקסים על מפתחות זרים שאין להם כיסוי (advisor unindexed_foreign_keys).
-- ============================================================

-- ---------- 1. EXECUTE ----------

-- pg_cron רץ כ-postgres ולא צריך הרשאה; אף לקוח לא קורא לפונקציה הזו.
revoke execute on function public.cleanup_demo_teams() from public, anon, authenticated;

revoke execute on function public.gs_create_team(text, text, text) from public, anon;
grant  execute on function public.gs_create_team(text, text, text) to authenticated;

-- משמשת policies של gs_work_item_assignments, שרצות כמשתמש המחובר.
revoke execute on function public.gs_work_item_team(uuid) from public, anon;
grant  execute on function public.gs_work_item_team(uuid) to authenticated;

-- ---------- 2. initplan ----------

alter policy gs_teams_select on public.gs_teams
  using ((code = gs_my_team()) or (owner_id = (select auth.uid())));
alter policy gs_teams_insert on public.gs_teams
  with check (owner_id = (select auth.uid()));
alter policy gs_teams_update on public.gs_teams
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
alter policy gs_teams_delete on public.gs_teams
  using (owner_id = (select auth.uid()));

alter policy gs_profiles_insert on public.gs_profiles
  with check (user_id = (select auth.uid()));
alter policy gs_profiles_update on public.gs_profiles
  using ((user_id = (select auth.uid())) or ((team_code = gs_my_team()) and gs_is_supervisor()))
  with check (team_code = gs_my_team());

alter policy gs_task_templates_read on public.gs_task_templates
  using ((team_code is null) or (team_code in (
    select p.team_code from public.gs_profiles p where p.user_id = (select auth.uid()))));
alter policy gs_task_templates_write on public.gs_task_templates
  using (team_code in (
    select p.team_code from public.gs_profiles p
    where p.user_id = (select auth.uid()) and p.role = 'supervisor'));

alter policy gs_role_compat_read on public.gs_role_compatibility
  using ((team_code is null) or (team_code in (
    select p.team_code from public.gs_profiles p where p.user_id = (select auth.uid()))));
alter policy gs_role_compat_write on public.gs_role_compatibility
  using (team_code in (
    select p.team_code from public.gs_profiles p
    where p.user_id = (select auth.uid()) and p.role = 'supervisor'));

-- ---------- 3. אינדקסים ----------

create index if not exists gs_assignments_guard_idx          on public.gs_assignments (guard_id);
create index if not exists gs_availability_guard_idx         on public.gs_availability (guard_id);
create index if not exists gs_work_item_assignments_guard_idx on public.gs_work_item_assignments (guard_id);
create index if not exists gs_swap_requests_team_idx         on public.gs_swap_requests (team_code);
create index if not exists gs_swap_requests_shift_idx        on public.gs_swap_requests (shift_id);
create index if not exists gs_swap_requests_from_guard_idx   on public.gs_swap_requests (from_guard);
create index if not exists gs_swap_requests_to_guard_idx     on public.gs_swap_requests (to_guard);
create index if not exists gs_positions_team_idx             on public.gs_positions (team_code);
create index if not exists gs_task_templates_team_idx        on public.gs_task_templates (team_code);
create index if not exists gs_role_compatibility_team_idx    on public.gs_role_compatibility (team_code);
create index if not exists gs_tasks_assigned_to_idx          on public.gs_tasks (assigned_to);
create index if not exists gs_teams_owner_idx                on public.gs_teams (owner_id);
