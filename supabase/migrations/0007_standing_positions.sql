-- ============================================================
-- עמדות קבועות: הגדרה אחת שממשיכה להתקיים כל שבוע בלי פעולה נוספת.
--
-- gs_positions מחזיקה רק את ה*הגדרה* — לא את השורות השבועיות. שורה
-- שבועית היא gs_shifts/gs_tasks רגילה שנושאת position_id, בדיוק כמו כל
-- שורה אחרת מהסוג הזה. הזהות השבועית היא הצמד (position_id, date) —
-- לעולם לא UUID שנגזר מ-hash ולעולם לא שעון הקיר של תהליך ההרצה.
--
-- שתי צורות עמדה, בעמודה אחת (shape):
--   template — יום/שעה קבועים. הצמד הזהות נופל על gs_shifts (position_id, date).
--   weekly   — עמדה שחלה על השבוע כולו בלי שעות. נופלת על gs_tasks עם
--     start_date = יום ראשון של השבוע, due_date = יום שבת שלו — כך שהיא
--     נקראת על מסך כפריט שנפרש על השבוע כולו, לא כמשימה של יום ראשון
--     בלבד (הכרעת Task 1, סעיף 2 — סטייה מודעת מהסקיצה המקורית של
--     04-RESEARCH.md, ששם את due_date על יום ראשון). האינדקס הייחודי
--     נשאר (position_id, due_date), ולכן הזהות עדיין דטרמיניסטית לגמרי:
--     יום שבת נגזר אך ורק מיום ראשון של שבוע היעד.
--
-- required_guards קיים על העמדה (ברירת מחדל 1) גם שהערכת ההתחלה תמיד
-- תהיה אדם אחד — עמודה חשופה שלא נכתבת לעולם אינה מזיקה, והרחבה
-- עתידית לא תדרוש מיגרציה שנייה (Open Question 1, 04-RESEARCH.md).
--
-- שתי עמודות ה-FK החדשות (gs_shifts.position_id, gs_tasks.position_id)
-- הן on delete SET NULL, לא CASCADE: מחיקת הגדרת עמדה לעולם אינה
-- מוחקת שורה שכבר התממשה ממנה. היסטוריית העומס וההוגנות — וגם
-- nextRotationGuard() העתידי (04-03), שקורא היסטוריית תורות — חייבת
-- לשרוד מחיקת הגדרה.
--
-- שני האינדקסים הייחודיים חלקיים (where position_id is not null): בלי
-- החלקיות, כל השורות הקיימות שבהן position_id הוא NULL היו מתנגשות
-- זו בזו על ההגבלה הייחודית.
-- ============================================================

create table if not exists gs_positions (
  id              uuid primary key default gen_random_uuid(),
  team_code       text not null references gs_teams(code) on delete cascade,
  shape           text not null check (shape in ('template', 'weekly')),
  title           text not null,
  category        text not null,
  weekdays        jsonb,
  start_time      time,
  end_time        time,
  required_guards int not null default 1,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table gs_positions enable row level security;

drop policy if exists gs_positions_read on gs_positions;
create policy gs_positions_read on gs_positions
  for select using (
    team_code in (select team_code from gs_profiles where user_id = auth.uid())
  );

drop policy if exists gs_positions_write on gs_positions;
create policy gs_positions_write on gs_positions
  for all using (
    team_code in (
      select team_code from gs_profiles
       where user_id = auth.uid() and role = 'supervisor'
    )
  );

alter table gs_shifts add column if not exists position_id uuid
  references gs_positions(id) on delete set null;
alter table gs_tasks add column if not exists position_id uuid
  references gs_positions(id) on delete set null;

create unique index if not exists gs_shifts_position_date_idx
  on gs_shifts (position_id, date)
  where position_id is not null;

create unique index if not exists gs_tasks_position_date_idx
  on gs_tasks (position_id, due_date)
  where position_id is not null;
