-- ============================================================
-- 0035 — אישור בקשת החלפה כפעולה אטומית אחת
--
-- נמצא בבדיקת QA (docs/qa/2026-10-07-qa-report.md, ממצא 2), אומת חי:
--
-- 1. api.decideSwap הסיר את השומר המקורי ואז שיבץ את המקבל עם
--    source='swap' — ערך שה-CHECK על gs_work_item_assignments לא מכיר.
--    ההסרה עברה, השיבוץ נכשל: המשמרת נשארה בלי אף אחד והבקשה ב-pending.
-- 2. גם בלי הבאג הזה, שתי כתיבות נפרדות מהלקוח אינן אטומיות — כל כשל
--    ביניהן משאיר חור בסידור.
-- 3. כפתור "אשר" אצל המשתתף שהבקשה נשלחה אליו (GuardApp) קרא לאותה פונקציה,
--    אבל RLS מרשה לשנות שיבוצים רק למנהל — אצל משתתף האישור תמיד נכשל.
--
-- הפונקציה כאן עושה הכול בטרנזקציה אחת: בודקת הרשאה (מנהל הצוות, או
-- המשתתף שהבקשה נשלחה אליו), שהבקשה עדיין ממתינה, שהשולח עדיין משובץ
-- למשמרת ושהמקבל בצוות ולא משובץ אליה כבר — ורק אז מזיזה ומסמנת.
--
-- חוקי העבודה (מנוחה, רצף, תקרה) נבדקים בלקוח לפני האישור (checkAssignment
-- ב-autoAssign.js, שני המסכים מנטרלים את "אשר" כשהוא נכשל) — אותו מודל אמון
-- כמו שיבוץ ידני של מנהל, שגם הוא לא נבדק בשרת.
--
-- ועדכון ישיר של gs_swap_requests מצומצם למנהל בלבד: עד עכשיו המשתתף
-- שהבקשה נשלחה אליו יכול היה לסמן אותה approved בלי שום הזזה.
-- ============================================================

create or replace function public.gs_decide_swap(p_swap_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swap  public.gs_swap_requests%rowtype;
  v_me    uuid := public.gs_my_profile_id();
  v_team  text := public.gs_my_team();
  v_sup   boolean := public.gs_is_supervisor();
begin
  if auth.uid() is null or v_me is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'BAD_STATUS';
  end if;

  select * into v_swap from public.gs_swap_requests where id = p_swap_id for update;
  if not found or v_swap.team_code is distinct from v_team then
    raise exception 'SWAP_NOT_FOUND';
  end if;
  if not (v_sup or v_swap.to_guard = v_me) then
    raise exception 'SWAP_FORBIDDEN';
  end if;
  if v_swap.status <> 'pending' then
    raise exception 'SWAP_NOT_PENDING';
  end if;

  if p_status = 'approved' then
    if public.gs_work_item_team(v_swap.shift_id) is distinct from v_team then
      raise exception 'SWAP_STALE';
    end if;
    if not exists (select 1 from public.gs_profiles
                   where id = v_swap.to_guard and team_code = v_team and role = 'guard') then
      raise exception 'SWAP_TARGET_NOT_IN_TEAM';
    end if;
    if exists (select 1 from public.gs_work_item_assignments
               where work_item_id = v_swap.shift_id and guard_id = v_swap.to_guard) then
      raise exception 'SWAP_TARGET_ALREADY_ASSIGNED';
    end if;

    delete from public.gs_work_item_assignments
      where work_item_id = v_swap.shift_id and guard_id = v_swap.from_guard;
    if not found then
      raise exception 'SWAP_STALE';
    end if;

    -- 'manual' ולא 'auto': applyPlan מוחק רק שיבוצי auto, כך שהרצה חוזרת
    -- של השיבוץ החכם לא מבטלת החלפה שכבר אושרה.
    insert into public.gs_work_item_assignments (work_item_id, guard_id, source, reason)
      values (v_swap.shift_id, v_swap.to_guard, 'manual',
              case when v_sup then 'החלפה שאושרה על ידי האחמ"ש' else 'החלפה שאושרה בין השומרים' end);
  end if;

  update public.gs_swap_requests set status = p_status where id = p_swap_id;
end;
$$;

revoke execute on function public.gs_decide_swap(uuid, text) from public, anon;
grant  execute on function public.gs_decide_swap(uuid, text) to authenticated;

alter policy gs_swaps_update on public.gs_swap_requests
  using ((team_code = gs_my_team()) and gs_is_supervisor())
  with check (team_code = gs_my_team());
