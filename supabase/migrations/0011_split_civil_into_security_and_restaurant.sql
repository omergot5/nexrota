-- ============================================================
-- מפצל את "civil" לשני תחומי פעילות ברורים: אבטחה ומסעדנות.
--
-- "civil" מעולם לא היה תחום אמיתי — הוא כיסה "אבטחה, מסעדה או מוקד" בבת
-- אחת (ראה ה-hint הישן ב-PROFILES, terms.js), וכל אוצר המילים שלו (שומר,
-- משמרת) היה בפועל אבטחה-מוטה מההתחלה. כל צוות שהיה 'civil' עד עכשיו
-- עובר ל-'security' — לא ניחוש: זה בדיוק הפרשנות שהאוצר-מילים שלו כבר
-- נתן לו, בלי אף שינוי נראה למשתמש. 'restaurant' היא בחירה חדשה שאף
-- צוות קיים לא באמת ביקש עד עכשיו, כי היא לא הייתה קיימת.
--
-- שני צעדים ולא אחד: קודם מרחיבים את ה-constraint כדי שהעדכון עצמו לא
-- ייכשל על הערך הישן שהוא עוד לא מכיר, ורק אז מצמצמים אותו לרשימה
-- הסופית בלי 'civil'.
-- ============================================================

alter table gs_teams drop constraint if exists gs_teams_mode_chk;
alter table gs_teams
  add constraint gs_teams_mode_chk check (mode in ('civil', 'army', 'security', 'restaurant'));

update gs_teams set mode = 'security' where mode = 'civil';

alter table gs_teams drop constraint if exists gs_teams_mode_chk;
alter table gs_teams
  add constraint gs_teams_mode_chk check (mode in ('army', 'security', 'restaurant'));

alter table gs_teams alter column mode set default 'security';
