-- ============================================================
-- 0039 — רק פרופיל שנוצר בהצטרפות עצמית ניתן לתיקון שם
--
-- 0037 הרשתה לסשן מוכר לתקן שם בפרופיל "בלי היסטוריה". אבל גם רשומה
-- שהמנהל הכין ונאמצה זה עתה היא "בלי היסטוריה" — ואדם שני באותו טלפון
-- שהקליד שם אחר היה משנה את שמה, או מוחק אותה ומאמץ אחרת. כך רשומה
-- שהמנהל יצר נעלמת או משנה שם בלי שהוא עשה דבר.
--
-- self_joined מסמן פרופיל שנוצר בענף "אף אחד בשם הזה" של gs_join_team —
-- בדיוק המקרה של טעות הקלדה. רק אותו מותר לשנות או למחוק בתיקון. שורות
-- קיימות מקבלות false: לא ידוע מאיפה באו, ולכן לא נוגעים בהן.
-- ============================================================

alter table public.gs_profiles add column if not exists self_joined boolean not null default false;

create or replace function public.gs_join_team(p_code text, p_full_name text)
returns table(profile_id uuid, team_code text, team_name text, full_name text, created boolean)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_code  text;
  v_name  text;
  v_prof  record;
  v_match record;
  v_key   text := public.gs_norm_name(p_full_name);
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if v_key = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  select t.code, t.name into v_code, v_name
    from public.gs_teams t where t.code = upper(btrim(p_code));
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  -- Known session.
  select * into v_prof from public.gs_profiles p where p.user_id = auth.uid();
  if found then
    if v_prof.team_code <> v_code then
      raise exception 'ALREADY_IN_ANOTHER_TEAM';
    end if;

    if public.gs_norm_name(v_prof.full_name) = v_key then
      profile_id := v_prof.id; team_code := v_prof.team_code;
      team_name := v_name; full_name := v_prof.full_name; created := false;
      return next; return;
    end if;

    -- A different name from a session we already know. Only a profile this
    -- session created itself a moment ago (a typo) and that has no history
    -- may be corrected; a supervisor's placeholder never is.
    if v_prof.role <> 'guard'
       or not v_prof.self_joined
       or exists (select 1 from public.gs_work_item_assignments a where a.guard_id = v_prof.id)
       or exists (select 1 from public.gs_availability av where av.guard_id = v_prof.id)
       or exists (select 1 from public.gs_swap_requests s where s.from_guard = v_prof.id or s.to_guard = v_prof.id) then
      raise exception 'DEVICE_IN_USE:%', v_prof.full_name;
    end if;

    select * into v_match from public.gs_profiles p
      where p.team_code = v_code and p.role = 'guard' and p.id <> v_prof.id
        and public.gs_norm_name(p.full_name) = v_key
      order by (p.user_id is not null), p.created_at
      limit 1;

    if found then
      delete from public.gs_profiles where id = v_prof.id;
      update public.gs_profiles set user_id = auth.uid() where id = v_match.id;
      profile_id := v_match.id; team_code := v_code;
      team_name := v_name; full_name := v_match.full_name; created := false;
      return next; return;
    end if;

    update public.gs_profiles set full_name = btrim(p_full_name) where id = v_prof.id;
    profile_id := v_prof.id; team_code := v_code;
    team_name := v_name; full_name := btrim(p_full_name); created := true;
    return next; return;
  end if;

  -- Unknown session, known name: a returning guard. Unclaimed placeholders
  -- first, then the oldest existing profile of that name.
  select * into v_prof from public.gs_profiles p
    where p.team_code = v_code
      and p.role = 'guard'
      and public.gs_norm_name(p.full_name) = v_key
    order by (p.user_id is not null), p.created_at
    limit 1;

  if found then
    update public.gs_profiles set user_id = auth.uid() where id = v_prof.id;
    profile_id := v_prof.id; team_code := v_code;
    team_name := v_name; full_name := v_prof.full_name; created := false;
    return next; return;
  end if;

  -- Nobody by that name. A genuinely new person, or a misspelling.
  insert into public.gs_profiles (user_id, full_name, role, team_code, self_joined)
    values (auth.uid(), btrim(p_full_name), 'guard', v_code, true)
    returning * into v_prof;

  profile_id := v_prof.id; team_code := v_code;
  team_name := v_name; full_name := v_prof.full_name; created := true;
  return next;
end;
$function$;
