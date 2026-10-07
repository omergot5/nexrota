-- ============================================================
-- 0036 — משתתף לא רואה שיבוצים של משמרות שלא פורסמו
--
-- ממצא 4 בדוח ה-QA (docs/qa/2026-10-07-qa-report.md). ההסתרה של סידור
-- שלא פורסם הייתה רק בלקוח (GuardApp.jsx): משתתף שקרא את ה-API ראה מי
-- משובץ לאן עוד לפני הפרסום, וגם אחרי "בטל פרסום".
--
-- את המשמרות עצמן משתתף *חייב* לראות לפני הפרסום — עליהן הוא מגיש
-- זמינות. מה שאסור לו לראות הוא השיבוץ. לכן הסינון הוא על
-- gs_work_item_assignments ולא על gs_work_items: שיבוץ של משמרת שלא פורסמה
-- גלוי רק למנהל. משימות (kind='task') אינן מתפרסמות — הן גלויות כמו קודם.
--
-- ובנוסף: ברירת המחדל של published הייתה true, כך שכל הכנסה שלא שלחה את
-- העמודה במפורש (seedDemoTeam, סקריפטים) פרסמה מיד. עכשיו false.
-- ============================================================

alter table public.gs_work_items alter column published set default false;

create or replace function public.gs_work_item_visible(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select published or kind = 'task' from public.gs_work_items where id = wid), false)
$$;

revoke execute on function public.gs_work_item_visible(uuid) from public, anon;
grant  execute on function public.gs_work_item_visible(uuid) to authenticated;

alter policy gs_work_item_assignments_select on public.gs_work_item_assignments
  using (
    (gs_work_item_team(work_item_id) = gs_my_team())
    and ((select gs_is_supervisor()) or gs_work_item_visible(work_item_id))
  );
