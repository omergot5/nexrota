// ============================================================
// מבט משאבים שבועי (Resource View).
//
// שורה = עמדה/קטגוריה, עמודה = יום בשבוע — מבט-על אחד שבו מפקד רואה מי
// מאייש כל עמדה בכל יום, בלי לפתוח שבע לשוניות או לגלול בין כרטיסים.
// כל החישוב (איזה פריט שייך לאיזו קטגוריה/יום) קורה ב-buildResourceRows
// הטהור (lib/resourceView.js) — הרכיב הזה רק מצייר את מה שהוא מחזיר.
//
// תחום הפעילות מוחל מ-useGuardian (setTermProfile) ולא מפרופ, כמו
// PositionsScreen — אותה קריאה בדיוק, כדי שהצבע-לפי-קטגוריה (רוטציה
// שתלויה ב-FOLDERS_BY_MODE של התחום) לא ייסחף משני מקורות אמת.
// ============================================================

import { useMemo, useState, useSyncExternalStore } from "react";
import { Card, EmptyState, IconBtn, PageHeader } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { DAYS_HE_SHORT, rangeLabelHe, shortDate, weekByOffset } from "../../lib/dates.js";
import { subscribeTerms, termProfile } from "../../lib/terms.js";
import { buildResourceRows } from "../../lib/resourceView.js";
import { categoryTone, TONE_CLASSES } from "../../design/categoryPalette.js";

export default function ResourceView({ guards = [], shifts = [], tasks = [] }) {
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const [offset, setOffset] = useState(0);
  const weekDates = useMemo(() => weekByOffset(offset), [offset]);
  const rows = useMemo(
    () => buildResourceRows({ shifts, tasks, weekDates, mode }),
    [shifts, tasks, weekDates, mode]
  );

  const nameOf = (id) => (guards.find((g) => g.id === id)?.name || "מישהו").split(" ")[0];

  return (
    <div className="space-y-4">
      <PageHeader
        title="מבט משאבים"
        subtitle="מי מאייש כל עמדה, בכל יום בשבוע — במבט אחד"
        actions={
          <div className="glass flex items-center gap-1 p-1 rounded-xl">
            <IconBtn icon="right" label="שבוע קודם" size="sm" onClick={() => setOffset((o) => o - 1)} />
            <div className="px-2 text-xs font-bold text-content select-none min-w-[112px] text-center leading-tight">
              {rangeLabelHe(weekDates)}
              {offset === 0 && <span className="block text-[10px] text-brand font-semibold">השבוע</span>}
            </div>
            <IconBtn icon="left" label="שבוע הבא" size="sm" onClick={() => setOffset((o) => o + 1)} />
            {offset !== 0 && (
              <button
                onClick={() => setOffset(0)}
                className="mr-1 h-8 px-2.5 text-[11px] font-bold rounded-lg bg-surface-sunken text-muted hover:text-content cursor-pointer transition-colors"
              >
                היום
              </button>
            )}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon="grid"
          title="אין עדיין מה להציג"
          body="ברגע שיהיו משמרות או משימות בשבוע הזה, הן יופיעו כאן לפי עמדה/קטגוריה."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* גלילה אופקית עצמאית: שבעה ימים בעמודות רוחב-קבוע לא נדחסים
            * במסך צר, והעמודה הראשונה (שם התיקייה) נשארת נעוצה כדי שלא
            * יתנתק ההקשר "איזו שורה זו" תוך כדי גלילה ימינה. */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" dir="rtl">
              <thead>
                <tr className="bg-surface-sunken">
                  <th className="sticky right-0 z-10 bg-surface-sunken text-right px-3 py-2.5 text-xs font-bold text-muted w-36">
                    עמדה / קטגוריה
                  </th>
                  {weekDates.map((date, i) => (
                    <th
                      key={date}
                      className="px-2 py-2.5 text-center text-xs font-bold text-muted min-w-[124px] border-r border-hairline/60"
                    >
                      <div>{DAYS_HE_SHORT[i]}</div>
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
                        </div>
                      </td>
                      {row.days.map((day) => (
                        <td key={day.date} className="px-2 py-2 align-top border-r border-hairline/60">
                          {day.items.length === 0 ? (
                            <span className="block text-center text-[11px] text-faint" aria-label="לא מתוכנן">
                              —
                            </span>
                          ) : (
                            <div className="space-y-1">
                              {day.items.map((item) => {
                                const names = (item.assignedGuards || []).map(nameOf);
                                const unfilled = names.length === 0;
                                return (
                                  <div
                                    key={item.id}
                                    className={`rounded-lg border-r-[3px] px-1.5 py-1 ${tone.bg} ${tone.border}`}
                                  >
                                    {item.startTime && (
                                      <div className="text-[10px] font-bold text-muted leading-tight" data-numeric>
                                        {item.startTime}–{item.endTime}
                                      </div>
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
        </Card>
      )}
    </div>
  );
}
