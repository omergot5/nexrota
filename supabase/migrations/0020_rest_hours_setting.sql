-- ============================================================
-- שלב 4 (מחזור האיחוד) — מנוחה כבורר קבוע, לא שדה חופשי.
--
-- gs_teams.rest_hours מחליף את minRestHours שהיה לוקאלי למסך "שיבוץ חכם"
-- בלבד (SmartAssign.jsx, ברירת מחדל 8): מעכשיו זה ערך אחד ברמת-צוות,
-- שנשמר ב-DB ונקרא על ידי כל בדיקת אילוץ קשיח באפליקציה — לא רק תצוגה
-- מקדימה של המנוע האוטומטי. 10 או 12 בלבד (החלטה 4), בלי טווח חופשי.
-- ============================================================

alter table gs_teams
  add column if not exists rest_hours integer not null default 10;

alter table gs_teams
  add constraint gs_teams_rest_hours_check check (rest_hours in (10, 12));
