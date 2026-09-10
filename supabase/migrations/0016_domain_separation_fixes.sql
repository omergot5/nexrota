-- ============================================================
-- תיקוני הפרדת-תחומים (Plan: נושא 1/3 — דליפות בין פרופילי-ניהול).
--
-- שלושה תיקונים עצמאיים, מאוחדים למיגרציה אחת כי כולם נובעים מאותה
-- סיבת-שורש: הטקסונומיה של קטגוריה-לפי-תחום (FOLDERS_BY_MODE,
-- src/lib/categories.js) קיימת רק בצד הלקוח, ושלוש נקודות ב-DB לא עודכנו
-- כשהיא התפצלה מ-civil/army לשלושה תחומים (מיגרציה 0011):
--
-- 1. gs_create_team: אף פעם לא קיבל פרמטר mode — כל צוות חדש נופל
--    ל-mode='security' ברירת המחדל, בלי קשר למה שהמשתמש בחר באשף ההרשמה.
-- 2. gs_task_templates.mode: ה-CHECK עדיין ('civil','army','any') מלפני
--    הפיצול — לצוותי security/restaurant אין תבניות בכלל (וגם אי אפשר
--    ליצור כאלה, כי ה-CHECK עצמו חוסם את הערך).
-- 3. gs_role_compatibility: אין לה עמודת mode בכלל — חמשת הכללים
--    המובנים (עברית צבאית: "כוננות"/"תורנות מטבח"/"תורנות שמירה") מוצגים
--    היום ל-*כל* צוות ב"התנגשויות בין קטגוריות" (TeamView), בלי קשר לתחום.
--
-- בנוסף: שני התבניות המובנות "עמדות"/"מטבח" עדיין נושאות את שמות
-- הקטגוריה הישנים ("שמירות"/"מטבח") מלפני שה-army taxonomy תוקן ל-
-- "תורנות שמירה"/"תורנות מטבח" (מיגרציה 0015 תיקנה את זה ב-
-- gs_role_compatibility אבל לא כאן) — אותה בעיה בדיוק, טבלה אחרת.
-- ============================================================

-- ---------- 1. gs_create_team מקבל mode, עם ברירת מחדל ואימות ----------
-- CREATE OR REPLACE עם חתימה שונה (פרמטר נוסף) לא מחליף את הפונקציה
-- הקיימת — הוא יוצר עומס-יתר (overload) נוסף לצידה, וקריאת RPC עם שני
-- ארגומנטים בלבד הייתה ממשיכה לפתור לגרסה הישנה בלי mode בכלל. ה-DROP
-- הזה הוא לא ניקוי קוסמטי — בלעדיו התיקון לא עושה כלום בפועל.
drop function if exists public.gs_create_team(text, text);

create or replace function public.gs_create_team(
  p_team_name text,
  p_full_name text,
  p_mode text default 'security'
)
returns table(team_code text, profile_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_code text;
  v_profile uuid;
  v_existing record;
  v_mode text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select p.team_code, p.id into v_existing from public.gs_profiles p where p.user_id = auth.uid();
  if found then
    team_code := v_existing.team_code; profile_id := v_existing.id; return next; return;
  end if;

  -- אימות עצמאי ולא רק הסתמכות על ה-CHECK של הטבלה: ערך לא-תקין נופל
  -- בשקט ל-'security' (אותו דפוס בדיוק כמו VALID_MODES ב-src/lib/api.js),
  -- לא זורק שגיאת constraint שהלקוח לא בנוי לתפוס.
  v_mode := case when p_mode in ('army', 'security', 'restaurant') then p_mode else 'security' end;

  v_code := public.gs_generate_code();
  insert into public.gs_teams (code, name, owner_id, mode)
    values (v_code, coalesce(nullif(trim(p_team_name), ''), 'הצוות שלי'), auth.uid(), v_mode);

  insert into public.gs_profiles (user_id, full_name, role, team_code)
    values (auth.uid(), coalesce(nullif(trim(p_full_name), ''), 'מנהל משמרת'), 'supervisor', v_code)
    returning id into v_profile;

  team_code := v_code; profile_id := v_profile; return next;
end;
$function$;

-- ---------- 2. gs_task_templates: CHECK מורחב + תיקון שמות קטגוריה ----------
alter table gs_task_templates drop constraint if exists gs_task_templates_mode_check;
alter table gs_task_templates
  add constraint gs_task_templates_mode_check check (mode in ('army', 'security', 'restaurant', 'any'));

-- אותה דליפה בדיוק שתוקנה ב-0015 עבור gs_role_compatibility, כאן בטבלה
-- אחרת: "עמדות"/"מטבח" עדיין נושאות שמות-קטגוריה שלא קיימים בפועל
-- ב-FOLDERS_BY_MODE.army (views.jsx/categories.js מציעים "תורנות
-- שמירה"/"תורנות מטבח").
update gs_task_templates set category = 'תורנות שמירה' where team_code is null and mode = 'army' and category = 'שמירות';
update gs_task_templates set category = 'תורנות מטבח' where team_code is null and mode = 'army' and category = 'מטבח';

-- תבניות התחלתיות ל-security/restaurant, כדי שהתכונה לא תהיה ריקה
-- למשתמש-ראשון בשני התחומים — אותו דפוס בדיוק כמו זרעי ה-army ב-0004.
insert into gs_task_templates (team_code, mode, title, category, icon, positions, priority, sort)
select * from (values
  (null::text, 'security', 'משמרת שמירה', 'שמירות',       'shield',    '[]'::jsonb, 'high',   10),
  (null::text, 'security', 'סיור',        'סיור',         'target',    '[]'::jsonb, 'medium', 20),
  (null::text, 'security', 'עמדה קבועה',  'עמדה קבועה',   'pin',       '["עמדה 1","עמדה 2"]'::jsonb, 'high', 30),
  (null::text, 'security', 'בדיקת ציוד',  'ציוד אבטחה',   'wrench',    '[]'::jsonb, 'medium', 40),
  (null::text, 'security', 'דוח משמרת',   'דוח משמרת',    'clipboard', '[]'::jsonb, 'low',    50),
  (null::text, 'restaurant', 'משמרת מטבח',    'מטבח',           'inbox',     '[]'::jsonb, 'high',   10),
  (null::text, 'restaurant', 'הגשה',          'הגשה',           'users',     '[]'::jsonb, 'medium', 20),
  (null::text, 'restaurant', 'בר',            'בר',             'star',      '[]'::jsonb, 'medium', 30),
  (null::text, 'restaurant', 'קופה',          'קופה',           'briefcase', '[]'::jsonb, 'medium', 40),
  (null::text, 'restaurant', 'מלאי והזמנות',  'מלאי והזמנות',   'trending',  '[]'::jsonb, 'low',    50)
) as v(team_code, mode, title, category, icon, positions, priority, sort)
where not exists (
  select 1 from gs_task_templates t
   where t.team_code is null and t.mode = v.mode and t.title = v.title
);

-- ---------- 3. gs_role_compatibility: עמודת mode, לתייג את המובנים ----------
-- nullable בכוונה: כלל שנוצר ע"י צוות (team_code not null) אינו תלוי-מצב,
-- כי הוא כבר משויך לתחום הצוות דרך team_code עצמו — mode רלוונטי רק
-- לשורות מובנות (team_code is null), כדי שנדע לפי איזה תחום להציג אותן.
alter table gs_role_compatibility add column if not exists mode text;
alter table gs_role_compatibility drop constraint if exists gs_role_compat_mode_check;
alter table gs_role_compatibility
  add constraint gs_role_compat_mode_check check (mode is null or mode in ('army', 'security', 'restaurant'));

update gs_role_compatibility set mode = 'army'
 where team_code is null
   and a in ('כוננות', 'תורנות מטבח', 'תורנות שמירה', 'סיור')
   and mode is null;
