-- ============================================================
-- 0037 — שם שנכתב קצת אחרת הוא אותו אדם, וטעות בשם ניתנת לתיקון
--
-- ממצא 6 בדוח ה-QA (docs/qa/2026-10-07-qa-report.md), אומת חי:
--
-- 1. "גי'ל" (גרש ASCII) מול "גי׳ל" (גרש עברי), גרשיים מסולסלים, רווח כפול,
--    מקף מול רווח — כל אחד מהם יצר אדם שני במקום לאמץ את הפרופיל שהמנהל
--    הכין. מקלדת עברית בטלפון מחליפה גרש אוטומטית, כך שזה קורה בפועל.
-- 2. מי שהקליד טעות קיבל פרופיל חדש, וההודעה אמרה "צא וכנס שוב". אבל
--    באותו מכשיר gs_join_team החזירה את הפרופיל השגוי (הסשן כבר מוכר), ואחרי
--    יציאה הפרופיל השגוי נשאר בצוות לצמיתות — מקבל שיבוצים ומעוות את ההוגנות.
--
-- התיקון:
--   - gs_norm_name: גרשים/גרשיים/מקפים מאוחדים, ניקוד יורד, רווחים מתכווצים.
--     גם ההתאמה בהצטרפות וגם האינדקס הייחודי משתמשים בה, כך שאי אפשר לייצר
--     את הכפילות גם לא דרך "הוסף שומר".
--   - סשן מוכר שמגיע עם שם אחר: אם הפרופיל שלו "ריק" (אין שיבוצים, זמינות או
--     בקשות החלפה) — הוא מתוקן. יש פרופיל בשם החדש? מאמצים אותו ומוחקים את
--     הריק. אין? משנים את השם. פרופיל שכבר יש לו היסטוריה לא נוגעים בו:
--     DEVICE_IN_USE, והאפליקציה מסבירה שצריך לצאת קודם.
-- ============================================================

create or replace function public.gs_norm_name(p text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select lower(btrim(regexp_replace(
    regexp_replace(
      translate(coalesce(p, ''), '׳’‘`´״“”־–—-', '''''''''''"""    '),
      '[֑-ֽֿ-ׇ]', '', 'g'),
    '\s+', ' ', 'g')))
$$;

drop index if exists public.gs_profiles_one_name_per_team;
create unique index gs_profiles_one_name_per_team
  on public.gs_profiles (team_code, public.gs_norm_name(full_name))
  where role = 'guard';

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

    -- A different name from a session we already know: correcting a typo,
    -- or a second person on the same phone. Only a profile with no history
    -- may be corrected; anything else belongs to whoever built that history.
    if v_prof.role <> 'guard'
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
  insert into public.gs_profiles (user_id, full_name, role, team_code)
    values (auth.uid(), btrim(p_full_name), 'guard', v_code)
    returning * into v_prof;

  profile_id := v_prof.id; team_code := v_code;
  team_name := v_name; full_name := v_prof.full_name; created := true;
  return next;
end;
$function$;
