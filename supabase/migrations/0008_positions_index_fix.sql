-- ============================================================
-- תיקון לאינדקסים הייחודיים על position_id שנוצרו ב-0007.
--
-- מה התגלה בבדיקה חיה (npm run test:backend, verify-backend.mjs):
-- PostgREST/supabase-js בונות `ON CONFLICT (position_id, date)` מרשימת
-- העמודות שהועברה ל-onConflict בלבד — הן אינן יודעות לצרף את הפרדיקט
-- `where position_id is not null` שהאינדקס החלקי דורש כדי להיות מטרת
-- ההתנגשות המוסקת. בלי הפרדיקט, Postgres לא מזהה את האינדקס בכלל,
-- וההרצה נכשלת עם "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification" — בדיוק הנתיב ש-materializeTemplateShifts
-- (04-01-PLAN.md, Pattern 1) נשען עליו ל-POS-04.
--
-- הפתרון: אינדקס ייחודי **לא**-חלקי על אותן שתי עמודות. זה בטוח בדיוק
-- כמו הגרסה החלקית, כי בפוסטגרס NULL אינו שווה ל-NULL באינדקס ייחודי —
-- שתי שורות עם position_id = NULL לעולם אינן מתנגשות זו בזו, גם בלי
-- הפרדיקט המפורש. הפרדיקט ב-0007 היה זהירות-יתר, לא נחיצות: הוא לא
-- הגן על שום מקרה שה-NULL semantics לא כבר הגנו עליו, אבל כן שבר את
-- יכולת ה-onConflict הפשוטה ש-supabase-js חושפת. ראה גם 04-01-SUMMARY.md.
-- ============================================================

drop index if exists gs_shifts_position_date_idx;
create unique index if not exists gs_shifts_position_date_idx
  on gs_shifts (position_id, date);

drop index if exists gs_tasks_position_date_idx;
create unique index if not exists gs_tasks_position_date_idx
  on gs_tasks (position_id, due_date);
