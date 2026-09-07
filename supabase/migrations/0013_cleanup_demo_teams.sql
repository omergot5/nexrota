-- ============================================================
-- ניקוי אוטומטי של צוותי הדגמה יתומים.
--
-- "הפעל הדגמה" יוצר צוות אמיתי וקבוע ב-gs_teams (RPC gs_create_team,
-- useGuardian.js's startGuestDemo) עם משתמש אנונימי (Supabase
-- signInAnonymously). אם אותו דפדפן לוחץ שוב, useGuardian.js כבר בודק
-- ומונע כפילות — אבל כל ביקור טרי (דפדפן אחר, ניקוי נתונים) יוצר עוד
-- צוות שלעולם לא נמחק. נכון לכתיבת המיגרציה: 106 מתוך 121 הצוותים
-- בבסיס הנתונים (87%) הם צוותי הדגמה יתומים, הישן ביותר בן שלושה שבועות.
--
-- למה לא "כל משתמש אנונימי": כניסת שומר/עובד אמיתי (קוד צוות + שם,
-- בלי סיסמה — joinAsGuard ב-api.js) *גם היא* עוברת דרך
-- signInAnonymously בדיוק כמו ההדגמה. מחיקה לפי אנונימיות בלבד הייתה
-- מוחקת שומרים אמיתיים מצוותים אמיתיים. הכלל הבטוח: שם הצוות *וגם*
-- מי שיצר אותו (role='supervisor') הוא/היא אנונימי/ת — נבדק מול בסיס
-- הנתונים החי: 106 מתוך 106 הצוותים ששמם "מוקד הדגמה" עונים על שני
-- התנאים גם יחד, אז אין שום צוות אמיתי בסיכון.
--
-- הסף: 48 שעות, הרבה יותר מה"שתי דקות, בלי התחייבות" שההדגמה עצמה
-- מבטיחה בדף הנחיתה — כדי שאף אחד שבאמת בודק את המוצר לא ייקטע.
--
-- מחיקת gs_teams מספיקה: כל טבלה תלוית-צוות (gs_profiles, gs_shifts,
-- gs_tasks, gs_task_templates, gs_swap_requests, gs_positions,
-- gs_role_compatibility, ודרכם גם gs_availability) מוגדרת עם
-- ON DELETE CASCADE על team_code — נבדק ישירות מול information_schema
-- לפני כתיבת המיגרציה הזו.
-- ============================================================

create extension if not exists pg_cron;

create or replace function cleanup_demo_teams()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with demo_teams as (
    select t.code
    from gs_teams t
    join gs_profiles p on p.team_code = t.code and p.role = 'supervisor'
    join auth.users u on u.id = p.user_id
    where t.name = 'מוקד הדגמה'
      and u.is_anonymous = true
      and t.created_at < now() - interval '48 hours'
  )
  delete from gs_teams where code in (select code from demo_teams);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

select cron.schedule(
  'cleanup-demo-teams-daily',
  '17 3 * * *', -- כל יום ב-03:17 UTC, שעה שקטה בלי סיבה מיוחדת חוץ מלהימנע ממשעות עגולות שריצות אחרות עלולות לתפוס
  $$select cleanup_demo_teams();$$
);
