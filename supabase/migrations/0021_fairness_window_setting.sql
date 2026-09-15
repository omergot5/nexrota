-- ============================================================
-- שלב 5 (מחזור האיחוד) — חלון הוגנות כבורר-צוות, לא קבוע קשיח בקוד.
--
-- gs_teams.fairness_window_days מחליף את ה-14 שהיה שרוף בקוד (RECENT_DAYS,
-- loadWindow.js) בכל מקום שבו המנוע בפועל מסתכל אחורה (rollingLoad/
-- fairnessPlan, fairness.js): 2 שבועות / חודש / 3 חודשים (ברירת מחדל) /
-- 4 חודשים (תקרה) / כבוי (0). ראה src/lib/fairnessWindow.js למקור-האמת
-- היחיד לרשימת הערכים המותרים.
-- ============================================================

alter table gs_teams
  add column if not exists fairness_window_days integer not null default 90;

alter table gs_teams
  add constraint gs_teams_fairness_window_check check (fairness_window_days in (0, 14, 30, 90, 120));
