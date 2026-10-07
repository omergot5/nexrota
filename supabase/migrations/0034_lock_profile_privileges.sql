-- ============================================================
-- 0034 — משתתף לא יכול להפוך את עצמו למנהל
--
-- נמצא בבדיקת QA (docs/qa/2026-10-07-qa-report.md, ממצא 1), אומת חי:
--
-- 1. gs_profiles_update מרשה לכל אחד לעדכן את השורה של עצמו, וה-with_check
--    בודק רק team_code. משתתף הריץ UPDATE role='supervisor' על עצמו ומיד
--    כתב, פרסם ומחק משמרות. אותו דבר ל-deadline_exempt, duty_role,
--    qualified_categories, half_time ועוד.
-- 2. gs_profiles_insert מרשה להכניס שורה עם user_id = auth.uid() ובלי שום
--    בדיקה על role או team_code. כל מי שמחזיק בקוד הצוות (והוא מופץ
--    בוואטסאפ) הכניס לעצמו פרופיל מנהל — בלי לעבור דרך gs_join_team.
--
-- התיקון:
--   - המדיניות 2 נמחקת. אף נתיב באפליקציה לא מכניס פרופיל של עצמו ישירות:
--     יצירת צוות והצטרפות עוברות ב-gs_create_team/gs_join_team (SECURITY
--     DEFINER, עוקפות RLS), ומנהל מוסיף שומרים דרך gs_profiles_insert_by_sup.
--   - טריגר על UPDATE: מי שאינו מנהל רשאי לשנות בשורה שלו רק את phone.
--     רשימת היתר ולא רשימת חסימה — עמודה שתתווסף בעתיד נעולה מעצמה.
--     current_user מבדיל בין קריאה ישירה מה-API (authenticated/anon) לבין
--     פונקציה SECURITY DEFINER (בעלים: postgres), כך ש-gs_join_team עדיין
--     יכולה להעביר user_id בעת אימוץ פרופיל.
-- ============================================================

drop policy if exists gs_profiles_insert on public.gs_profiles;

create or replace function public.gs_profiles_lock_privileged()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.gs_is_supervisor() then
    if (to_jsonb(new) - 'phone') is distinct from (to_jsonb(old) - 'phone') then
      raise exception 'PROFILE_FIELD_LOCKED' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.gs_profiles_lock_privileged() from public, anon, authenticated;

drop trigger if exists gs_profiles_lock_privileged on public.gs_profiles;
create trigger gs_profiles_lock_privileged
  before update on public.gs_profiles
  for each row execute function public.gs_profiles_lock_privileged();
