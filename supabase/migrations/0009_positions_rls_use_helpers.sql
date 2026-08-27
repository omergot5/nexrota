-- ============================================================
-- תיקון: gs_positions_read/write נכתבו עם תת-שאילתת auth.uid() גולמית,
-- בדיוק כמו gs_task_templates/gs_role_compatibility (התקדים ש-04-RESEARCH.md
-- הפנה אליו). בפועל תבנית זו מחזירה 0 שורות לסשן הדגמה אנונימי אמיתי,
-- בעוד gs_shifts/gs_profiles — שמשתמשות בפונקציות ה-SECURITY DEFINER
-- gs_my_team()/gs_is_supervisor() — טוענות תקין באותו סשן בדיוק (אומת חי
-- בדפדפן: state.shifts.length=15 מול state.positions.length=0 על אותו
-- state, לפני התיקון). ה-state הריק הזה גרם ל-ensurePositionsForWeek
-- להחזיר {created:0} בלי כתיבה בכל שבוע חוץ מזה שבו העמדה נוצרה — הפרה
-- ישירה של POS-01 ("מנהל מגדיר עמדה פעם אחת... בלי שנגע בכלום").
--
-- gs_task_templates/gs_role_compatibility מסתירות את אותה תקלה בעצמן כי
-- יש להן `team_code is null or ...` (שורות ברירת-מחדל משותפות תמיד
-- נראות, גם אם הענף המשויך-לצוות שבור). gs_positions היא הטבלה
-- הראשונה בסכימה הזו שבה כשל התבנית הישנה נראה בפועל.
--
-- התיקון: אותה תבנית מדויקת שכבר מוכחת עובדת ב-gs_shifts, לא המצאה
-- חדשה. מוחל חי דרך Supabase MCP ב-2026-08-27 (migration
-- positions_rls_use_helpers), מתועד כאן בשביל שהריפו ישקף את מה שרץ.
-- ============================================================

drop policy if exists gs_positions_read on gs_positions;
create policy gs_positions_read on gs_positions
  for select using (team_code = gs_my_team());

drop policy if exists gs_positions_write on gs_positions;
create policy gs_positions_write on gs_positions
  for all using (team_code = gs_my_team() and gs_is_supervisor());
