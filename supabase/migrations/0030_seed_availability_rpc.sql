-- ============================================================
-- 0030 — זמינות הדגמה בבקשה אחת קטנה (2026-10-06)
--
-- הדגמת הצבא כותבת זמינות של 45 חיילים מול ~97 תורנויות: כ-4,400 שורות
-- וכ-600KB של JSON. בחיבור עם העלאה איטית זה היה רוב זמן הפתיחה של ההדגמה
-- (עשרות שניות). כאן הלקוח שולח את אותו מידע כמחרוזת של אות אחת לכל
-- חייל×תורנות (a זמין / u לא זמין / m אולי / ? לא הגיש) — כ-10KB — והשרת
-- פורש אותה לשורות.
--
-- הדפוס עצמו (איזו אות לכל תא) נשאר מחושב ב-JS (demoAvailabilityCode,
-- armyDemo.js), במקום אחד שנבדק ב-Node — הפונקציה כאן רק פורשת.
--
-- SECURITY INVOKER בכוונה: הכתיבה עוברת דרך אותן מדיניות RLS של
-- gs_availability כמו upsert רגיל — מפקד יכול לכתוב רק לתורנויות של הצוות שלו.
-- ============================================================

create or replace function public.gs_seed_availability(p_shift_ids uuid[], p_guard_ids uuid[], p_codes text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n_shifts integer := coalesce(array_length(p_shift_ids, 1), 0);
  n_guards integer := coalesce(array_length(p_guard_ids, 1), 0);
  written integer;
begin
  if length(coalesce(p_codes, '')) <> n_shifts * n_guards then
    raise exception 'p_codes must hold one letter per guard x shift (% x % = %), got %',
      n_guards, n_shifts, n_guards * n_shifts, length(coalesce(p_codes, ''));
  end if;

  insert into public.gs_availability (shift_id, guard_id, status, comment)
  select p_shift_ids[s], p_guard_ids[g],
         case code.c when 'u' then 'unavailable' when 'm' then 'maybe' else 'available' end,
         null
  from generate_subscripts(p_guard_ids, 1) as g
  cross join generate_subscripts(p_shift_ids, 1) as s
  cross join lateral (select substr(p_codes, (g - 1) * n_shifts + s, 1) as c) as code
  where code.c in ('a', 'u', 'm')
  on conflict (shift_id, guard_id) do update set status = excluded.status, comment = excluded.comment;

  get diagnostics written = row_count;
  return written;
end;
$$;

revoke execute on function public.gs_seed_availability(uuid[], uuid[], text) from public, anon;
grant execute on function public.gs_seed_availability(uuid[], uuid[], text) to authenticated;
