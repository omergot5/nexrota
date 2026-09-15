// ============================================================
// שלב 5 (מחזור האיחוד, החלטה 5) — חלון ההוגנות הוא הגדרת-צוות אחת
// (gs_teams.fairness_window_days), לא קבוע קשיח בקוד: כמה אחורה
// rollingLoad/fairnessPlan (fairness.js) מסתכלים כדי לחשב מי "חייב" עוד
// משמרת. חמש אפשרויות בלבד, עד 4 חודשים (התקרה המפורשת בהחלטה) — לא טווח
// חופשי.
//
// "כבוי" הוא 0 ימים, לא ערך מיוחד שצריך טיפול נפרד בקוד הקורא: rollingLoad
// עם days=0 כבר מחזיר חלון ריק בעצמו (from === until, ר' fairness.js),
// ולכן "כבוי" פשוט אומר שכל שבוע מתחיל מאפס — בלי if נוסף בשום מקום שקורא
// לזה.
//
// זהו חלון ה-**מנוע** (carriedLoad ב-SmartAssign, fairnessPlan ב-AssignView)
// — לא ה"עומס לתצוגה" של loadWindow.js (recent/all), שהוא בחירת-תצוגה
// מקומית לדפדפן ונשאר כפי שהוא.
// ============================================================

export const FAIRNESS_WINDOW_OPTIONS = [
  { days: 14, label: "שבועיים" },
  { days: 30, label: "חודש" },
  { days: 90, label: "3 חודשים" },
  { days: 120, label: "4 חודשים" },
  { days: 0, label: "כבוי" },
];

export const VALID_FAIRNESS_WINDOWS = FAIRNESS_WINDOW_OPTIONS.map((o) => o.days);

export const DEFAULT_FAIRNESS_WINDOW_DAYS = 90;

/** ערך לא-תקין (שורה ישנה, DB לא מעודכן) נופל לברירת המחדל — לא לטווח חופשי. */
export function normalizeFairnessWindow(days) {
  return VALID_FAIRNESS_WINDOWS.includes(days) ? days : DEFAULT_FAIRNESS_WINDOW_DAYS;
}

export function fairnessWindowLabel(days) {
  return FAIRNESS_WINDOW_OPTIONS.find((o) => o.days === days)?.label || `${days} ימים`;
}
