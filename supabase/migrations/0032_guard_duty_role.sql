-- ============================================================
-- תפקיד של חייל בפלוגה: סמל, מפקץ, מפקד כיתה.
--
-- בכוננות ובסיור חייב להיות בכל משמרת לפחות בעל תפקיד אחד (המנוע דורש את זה
-- בתחום צבא, ר' commandCategories ב-autoAssign.js). בעלי התפקידים בדרך כלל
-- לא עושים שמירה או מטבח — את זה מגדירים דרך הכשירויות הקיימות
-- (qualified_categories, 0008), לא כאן.
--
--   gs_profiles.duty_role   text, NULL = חייל רגיל.
--     'sergeant' | 'platoon' | 'squad'
--
-- אותה טבלה ואותה מדיניות RLS כמו half_time (0012) ו-color_slot (0031).
-- ============================================================

alter table gs_profiles add column if not exists duty_role text
  check (duty_role is null or duty_role in ('sergeant', 'platoon', 'squad'));
