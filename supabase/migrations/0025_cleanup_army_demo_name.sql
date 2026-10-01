-- ההדגמה האורחת הפכה לצבאית ושמה "פלוגת הדגמה" (קודם "מוקד הדגמה").
-- הניקוי היומי חיפש רק את השם הישן, ולכן צוותי ההדגמה החדשים לא היו נמחקים.
create or replace function public.cleanup_demo_teams()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  deleted_count integer;
begin
  with demo_teams as (
    select t.code
    from gs_teams t
    join gs_profiles p on p.team_code = t.code and p.role = 'supervisor'
    join auth.users u on u.id = p.user_id
    where t.name in ('מוקד הדגמה', 'פלוגת הדגמה')
      and u.is_anonymous = true
      and t.created_at < now() - interval '48 hours'
  )
  delete from gs_teams where code in (select code from demo_teams);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$function$;
