// ============================================================
// גריד "עמדה/קטגוריה × יום" — רכיב תצוגה גנרי יחיד.
//
// דפוס אחד, שלושה מסכים: מבט-משאבים (ResourceView), פאנל-תצוגה בתוך
// אשף בניית השבוע (RosterWizard, 06-02), ותצוגת שבוע ביומן (CalendarView,
// 06-03 — מחליף את הרכיב הישן מבוסס-הספרייה-החיצונית שקדם לו). כל סימון חזותי של הדפוס
// — טבלה, עמודה נעוצה, תא-פריט, צבע-לפי-קטגוריה — חי כאן ורק כאן, כדי
// שלא ישכפל שלוש פעמים JSX/CSS שאמור להיראות זהה בשלושתם (D-04).
//
// מפורשות **לא** באחריות הרכיב הזה — מי שקורא לו מחזיק את כל אלה:
//   - אין כאן buildResourceRows ואין ייבוא מהמנוע הטהור שמפַבֵּט את הנתונים:
//     הפיבוט קטגוריה×יום נשאר אצל הקורא, שמזין rows מוכן (D-02).
//   - אין כאן ניווט שבועי (offset/weekByOffset) — dates מגיע מוכן.
//   - אין כאן Card/PageHeader — עטיפת המסך היא של הקורא.
//   - אין כאן מצב-ריק (rows.length === 0 מחזיר null) — ה-EmptyState שייך
//     לקורא, כי לכל מסך יש טקסט-ריק אחר שמתאים להקשר שלו.
// ============================================================

import { useSyncExternalStore } from "react";
import { Icon } from "../icons.jsx";
import { DAYS_HE_SHORT, fromISODate, shortDate } from "../../lib/dates.js";
import { subscribeTerms, termProfile } from "../../lib/terms.js";
import { categoryTone, TONE_CLASSES } from "../../design/categoryPalette.js";

export default function ResourceGrid({ rows = [], dates = [], guards = [], firstColLabel = "עמדה / קטגוריה" }) {
  // תחום הפעילות מוחל מ-subscribeTerms/termProfile, לא מפרופ (D-07) —
  // אותה קריאה בדיוק שהייתה קיימת ב-ResourceView, כדי שהצבע-לפי-קטגוריה
  // (רוטציה שתלויה ב-FOLDERS_BY_MODE של התחום) לא ייסחף משני מקורות אמת.
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);

  const nameOf = (id) => (guards.find((g) => g.id === id)?.name || "מישהו").split(" ")[0];

  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" dir="rtl">
        <thead>
          <tr className="bg-surface-sunken">
            <th className="sticky right-0 z-10 bg-surface-sunken text-right px-3 py-2.5 text-xs font-bold text-muted w-36">
              {firstColLabel}
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className="px-2 py-2.5 text-center text-xs font-bold text-muted min-w-[124px] border-r border-hairline/60"
              >
                {/* שם היום נגזר מהתאריך עצמו, לא מהאינדקס במערך: dates הוא
                  * prop גנרי באורך ואופסט כלשהם — גזירה מהאינדקס מניחה
                  * בשקט ששבוע מתחיל בראשון, ואותה הנחה שקטה היא בדיוק מה
                  * שנשבר כשמסך שלישי מעביר טווח אחר (אותו דפוס כמו
                  * RosterWizard.jsx). */}
                <div>{DAYS_HE_SHORT[fromISODate(date).getDay()]}</div>
                <div className="text-[10px] text-faint font-semibold" data-numeric>
                  {shortDate(date)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tone = TONE_CLASSES[categoryTone(row.category, mode)];
            return (
              <tr key={row.category} className="border-t border-hairline">
                <td className="sticky right-0 z-10 bg-surface px-3 py-2.5 align-top">
                  <div className="flex items-center gap-1.5 font-bold text-content text-xs">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tone.dot}`} aria-hidden="true" />
                    <Icon name={row.icon} size={14} className="text-muted flex-shrink-0" />
                    {row.category}
                    {row.pending === true && (
                      // נצרך על ידי 06-02 (פאנל-תצוגה חי בזמן עריכת עמדות):
                      // שורה שעדיין לא נשמרה, מסומנת "בעריכה" עד שתאושר.
                      <span className="text-[9.5px] font-bold text-brand border border-dashed border-brand/50 rounded px-1 flex-shrink-0">
                        בעריכה
                      </span>
                    )}
                  </div>
                </td>
                {row.days.map((day) => (
                  <td key={day.date} className="px-2 py-2 align-top border-r border-hairline/60">
                    {day.items.length === 0 ? (
                      <span className="block text-center text-[11px] text-faint" aria-label="לא מתוכנן">
                        —
                      </span>
                    ) : (
                      // כל הפריטים ב-day.items, בלי slice/Math.min/תקרה —
                      // הגובה של התא נגזר מהנתונים (RESVIEW-03 / D-05).
                      <div className="space-y-1">
                        {day.items.map((item) => {
                          const names = (item.assignedGuards || []).map(nameOf);
                          const unfilled = names.length === 0;
                          const need = item.requiredGuards;
                          const short = need != null && names.length < need;

                          if (item.pending === true) {
                            // עדיין לא נשמר (06-02): בלי tone, בלי שמות,
                            // בלי תג איוש — אין עדיין מה למנות.
                            return (
                              <div
                                key={item.id}
                                title={item.label}
                                className="rounded-lg border border-dashed border-brand/50 px-1.5 py-1 text-brand"
                              >
                                {item.startTime && (
                                  <div className="text-[10px] font-bold leading-tight" data-numeric>
                                    {item.startTime}–{item.endTime}
                                  </div>
                                )}
                                <div className="text-[11px] font-semibold leading-tight">{item.label}</div>
                              </div>
                            );
                          }

                          const shortageBadge = short && (
                            // רקע bg-bg אטום בכוונה (לא bg-surface — הוא
                            // כבר rgba עם אלפא אפויה, ובמצב כהה כמעט שקוף)
                            // מאחורי התג: text-danger/text-warn מחושבים מול
                            // --bg בדיוק (יחסי הניגודיות בתיעוד ה-tokens),
                            // לא מול צבע-הקטגוריה הדינמי של התא — משמרת
                            // בקטגוריה cat-red הייתה מציגה טקסט אדום על
                            // רקע אדום בלי הרקע האטום הזה (זהה לתג המקביל
                            // שהיה ברכיב הישן שהוחלף, לפני 06-03).
                            <span
                              className={`font-black text-[9px] px-1 rounded bg-bg ${
                                names.length === 0 ? "text-danger" : "text-warn"
                              }`}
                              data-numeric
                              aria-label={`חסרים ${need - names.length}`}
                            >
                              {names.length}/{need}
                            </span>
                          );

                          return (
                            <div
                              key={item.id}
                              title={item.label}
                              className={`rounded-lg border-r-[3px] px-1.5 py-1 ${tone.bg} ${tone.border}`}
                            >
                              {item.startTime ? (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold text-muted leading-tight" data-numeric>
                                    {item.startTime}–{item.endTime}
                                  </span>
                                  {shortageBadge}
                                </div>
                              ) : (
                                // פריט timeless: תג-החוסר (אם יש) מוצג בשורה
                                // משלו, כי אין שורת-שעות לשתף איתה.
                                shortageBadge
                              )}
                              <div
                                className={`text-[11px] font-semibold leading-tight ${
                                  unfilled ? "text-faint" : "text-content"
                                }`}
                              >
                                {unfilled ? "לא משובץ" : names.join(", ")}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
