// ============================================================
// מבט משאבים שבועי (Resource View).
//
// שורה = עמדה/קטגוריה, עמודה = יום בשבוע — מבט-על אחד שבו מפקד רואה מי
// מאייש כל עמדה בכל יום, בלי לפתוח שבע לשוניות או לגלול בין כרטיסים.
// כל החישוב (איזה פריט שייך לאיזו קטגוריה/יום) קורה ב-buildResourceRows
// הטהור (lib/resourceView.js). הציור עצמו — הטבלה, העמודה הנעוצה, תא-
// הפריט — חי ב-ResourceGrid.jsx (דפוס משותף לשלושה מסכים, D-04); הרכיב
// הזה מחזיק רק את השבוע (ניווט offset) ואת המצב-הריק.
//
// תחום הפעילות מוחל מ-useGuardian (setTermProfile) ולא מפרופ, כמו
// PositionsScreen — אותה קריאה בדיוק, כדי ש-buildResourceRows (שצריך mode
// כדי לדעת אילו תיקיות מוצעות) לא ייסחף משני מקורות אמת.
// ============================================================

import { useMemo, useState, useSyncExternalStore } from "react";
import { Card, EmptyState, IconBtn, PageHeader } from "../ui.jsx";
import { rangeLabelHe, weekByOffset } from "../../lib/dates.js";
import { subscribeTerms, termProfile } from "../../lib/terms.js";
import { buildResourceRows } from "../../lib/resourceView.js";
import ResourceGrid from "./ResourceGrid.jsx";

export default function ResourceView({ guards = [], shifts = [], tasks = [] }) {
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const [offset, setOffset] = useState(0);
  const weekDates = useMemo(() => weekByOffset(offset), [offset]);
  const rows = useMemo(
    () => buildResourceRows({ shifts, tasks, weekDates, mode }),
    [shifts, tasks, weekDates, mode]
  );

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
            * יתנתק ההקשר "איזו שורה זו" תוך כדי גלילה ימינה — ר' ResourceGrid.jsx. */}
          <ResourceGrid rows={rows} dates={weekDates} guards={guards} />
        </Card>
      )}
    </div>
  );
}
