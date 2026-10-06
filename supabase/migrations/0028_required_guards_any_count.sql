-- ============================================================
-- 0028 — כמות אנשים למשמרת בלי תקרה של 10 (2026-10-06)
--
-- הממשק הגביל ל-6 וה-DB ל-10, אבל כוננות של פלוגה מחזיקה 7 ויותר במקביל.
-- התקרה החדשה (999) היא רק הגנה מפני הקלדה שגויה (10000), לא מגבלה עסקית.
-- ============================================================

alter table public.gs_work_items drop constraint if exists gs_work_items_required_guards_check;
alter table public.gs_work_items add constraint gs_work_items_required_guards_check
  check (required_guards is null or (required_guards >= 1 and required_guards <= 999));

-- הטבלה הישנה שלפני gs_work_items — אותו כלל, כדי ששני המקומות לא יסתרו.
alter table public.gs_shifts drop constraint if exists gs_shifts_required_guards_check;
alter table public.gs_shifts add constraint gs_shifts_required_guards_check
  check (required_guards >= 1 and required_guards <= 999);
