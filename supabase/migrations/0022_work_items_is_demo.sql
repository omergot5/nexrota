-- ============================================================
-- Phase 11 (INLINE-02) — דגל is_demo על gs_work_items, ורק שם.
--
-- "שיבוץ הדגמה" נגזר מהדגל הזה, לא מקבל דגל נפרד: gs_work_item_assignments/
-- gs_availability/gs_swap_requests כבר נושאות on delete cascade אל
-- gs_work_items (0017_work_items.sql, 0019_repoint_availability_swaps_and_
-- shift_team.sql) — ברגע ששורת gs_work_items עם is_demo=true נמחקת, כל
-- שיבוץ/זמינות/בקשת-החלפה שתלויים בה נמחקים איתה בחינם, בלי דגל is_demo
-- עצמאי על אף אחת מהטבלאות האלה.
--
-- gs_work_items_write (0017_work_items.sql) כבר "for all" עם
-- using (team_code = gs_my_team() and gs_is_supervisor()) — מנהל שיכול
-- למחוק/לעדכן כל שורת gs_work_items של הצוות שלו יכול לעשות זאת גם על
-- שורות is_demo, בלי מדיניות RLS נוספת.
-- ============================================================

alter table gs_work_items
  add column if not exists is_demo boolean not null default false;
