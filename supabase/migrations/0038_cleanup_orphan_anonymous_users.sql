-- ============================================================
-- 0038 — ניקוי משתמשים אנונימיים יתומים
--
-- ממצא 9 בדוח ה-QA (docs/qa/2026-10-07-qa-report.md): כ-440 מתוך כ-530
-- המשתמשים ב-auth.users היו אנונימיים בלי שום פרופיל. כל כניסת שומר
-- שנכשלה (קוד שגוי), כל "יציאה" (הסשן האנונימי לא חוזר), כל שומר שהמנהל
-- הסיר, וכל צוות הדגמה שנוקה (0013) משאירים משתמש כזה לנצח.
--
-- כאן: מדי לילה נמחקים משתמשים אנונימיים בלי פרופיל שלא נכנסו 7 ימים.
-- משתמש עם פרופיל לא נמחק לעולם — גם אם לא נכנס חודשים. משתמש עם
-- אימייל (מנהל) לא נמחק לעולם. 7 ימים: מעבר לכל זרימת הצטרפות אמיתית.
-- ============================================================

create or replace function public.cleanup_orphan_anon_users()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from auth.users u
  where u.is_anonymous = true
    and u.created_at < now() - interval '7 days'
    and coalesce(u.last_sign_in_at, u.created_at) < now() - interval '7 days'
    and not exists (select 1 from public.gs_profiles p where p.user_id = u.id);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.cleanup_orphan_anon_users() from public, anon, authenticated;

select cron.schedule(
  'cleanup-orphan-anon-users-daily',
  '37 3 * * *', -- 20 דקות אחרי cleanup-demo-teams-daily, שמשחרר את משתמשי ההדגמה
  $$select public.cleanup_orphan_anon_users();$$
);
