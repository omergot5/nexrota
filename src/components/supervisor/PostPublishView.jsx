// ============================================================
// הפצת הסד"כ — צבא. אותה תמונה שנבנתה בבניית השבוע, לקריאה בלבד, עם שמות
// מלאים: מה שהמפקד רואה כאן הוא בדיוק מה שהחיילים יראו, ומה שיוצא בתמונה
// לוואטסאפ (shareImage.js, renderPostWeekCanvas) — שלושתם נגזרים מאותו
// buildPostWeek, אז אין שני סידורים שיכולים להיראות שונה.
//
// הפרסום לפי יום נשאר: שורת ימים מעל הגריד, כפתור לכל יום. יום נקבע לפי
// היום המבצעי (opDayOf), כמו הגריד — לילה של 00:00–06:00 מתפרסם עם היום
// שלפניו, כי כך הוא מוצג.
// ============================================================

import { useMemo } from "react";
import { Badge, Btn, Card } from "../ui.jsx";
import PostWeekGrid from "./PostWeekGrid.jsx";
import { dayName, formatDateHe, shortDate } from "../../lib/dates.js";
import { opDayOf } from "../../lib/postWeek.js";
import { t } from "../../lib/terms.js";

/**
 * @param {(req: {ids: string[], publish: boolean, scopeShiftsPhrase: string, confirmLabel: string}) => void} onAskPublish
 *   אותו חוזה של askPublish ב-ScheduleMgmt — שער האישור המשותף (CONFIRM-02).
 */
export default function PostPublishView({ posts, shifts, weekDates, guards, busy, onAskPublish }) {
  const days = useMemo(
    () =>
      weekDates.map((date) => {
        const dayShifts = shifts.filter((s) => opDayOf(s) === date);
        return { date, ids: dayShifts.map((s) => s.id), allPub: dayShifts.length > 0 && dayShifts.every((s) => s.published) };
      }),
    [shifts, weekDates]
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {days.map(({ date, ids, allPub }) => (
          <div key={date} className="rounded-xl ring-1 ring-inset ring-hairline bg-surface p-2 text-center space-y-1.5">
            <div>
              <p className="text-[11px] text-muted">{dayName(date)}</p>
              <p className="text-sm font-bold text-content" data-numeric>
                {shortDate(date)}
              </p>
            </div>
            {ids.length === 0 ? (
              <p className="text-[11px] text-faint py-1.5">אין {t("unit.shifts")}</p>
            ) : (
              <>
                <Badge tone={allPub ? "accent" : "neutral"} icon={allPub ? "check" : "pencil"}>
                  {allPub ? "מפורסם" : "טיוטה"}
                </Badge>
                <Btn
                  size="sm"
                  variant={allPub ? "outline" : "primary"}
                  className="w-full"
                  loading={busy}
                  onClick={() =>
                    onAskPublish({
                      ids,
                      publish: !allPub,
                      scopeShiftsPhrase: `${t("unit.shifts")} ${formatDateHe(date)}`,
                      confirmLabel: allPub ? t("action.unpublishShort") : t("action.publishDay"),
                    })
                  }
                >
                  {allPub ? t("action.unpublishShort") : t("action.publishDay")}
                </Btn>
              </>
            )}
          </div>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <PostWeekGrid posts={posts} dates={weekDates} guards={guards} fullNames showMissing />
      </Card>
    </div>
  );
}
