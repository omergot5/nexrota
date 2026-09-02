// ============================================================
// הלוח המאוחד (BOARD-01, BOARD-04).
//
// לקריאה בלבד, בכוונה (D-03, D-08): הרכיב הזה מקבל shifts/tasks/guards/
// dates כפרופס כבר-טעונים, לא נוגע ב-actions ולא קורא ל-Supabase, ואין בו
// שום onClick שכותב נתון. עריכה נשארת במסכי הניהול הקיימים (ShiftMgmt/
// TaskMgmt) — הלוח רק מציג את מה שהם כבר יצרו, ממוזג דרך boardItemsForDates
// (המסלול היחיד) ולעולם לא במסלול מיזוג שני.
//
// `scopeGuardId` מכובד כבר עכשיו, לא רק במסך המנהל: כשהוא לא null, פריט
// נשמר רק אם `assignedGuards` שלו כולל את המזהה הזה. זה מה שמאפשר לפאזה
// 5-02 להרכיב את אותו רכיב בדיוק בתוך מסך המשתתף — רכיב לוח שני היה בדיוק
// המסלול השני האסור.
// ============================================================

import { Badge, EmptyState } from "../ui.jsx";
import { Dot, Icon } from "../icons.jsx";
import {
  DAYS_HE_SHORT, boardItemsForDates, fromISODate, isToday, rangeTextHe, shortDate,
} from "../../lib/dates.js";
import { shiftTone } from "../../design/shiftPalette.js";
import { People } from "./views.jsx";

// זהה מילה במילה לתג שכבר קיים ב-TaskRow (views.jsx) — לא מנוסח מחדש.
const OUT_OF_ENGINE_TOOLTIP =
  "המשימה לא נושאת שעות, או פרושה על יותר מיום אחד — ולכן היא לא נכנסת למנוע: היא לא נספרת במנוחה, ברצף, בתקרה השבועית או בנטל.";

export default function UnifiedBoard({
  shifts = [], tasks = [], guards = [], dates = [], scopeGuardId = null, empty,
}) {
  const merged = boardItemsForDates(shifts, tasks, dates);

  const scope = (items) =>
    scopeGuardId == null
      ? items
      : items.filter((item) => (item.assignedGuards || []).includes(scopeGuardId));

  const days = merged.days
    .map((day) => ({ date: day.date, timeless: scope(day.timeless), timed: scope(day.timed) }))
    .filter((day) => day.timeless.length > 0 || day.timed.length > 0);

  // מצב ריק שלם: ניסוח, לא אזהרה (D-15) — לא Alert, לא danger, לא warn.
  if (days.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title={empty?.title || "השבוע עדיין ריק"}
        body={
          empty?.body ||
          "בנה משמרות או משימות, והלוח ייבנה מעצמו — או תתחיל מ'תסדר לי את השבוע'."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {days.map((day) => (
        <DayGroup key={day.date} day={day} guards={guards} />
      ))}
    </div>
  );
}

function DayGroup({ day, guards }) {
  const iso = day.date;
  const today = isToday(iso);
  return (
    <div className="space-y-2">
      {/* כותרת היום כבדה מכל שורה מתחתיה בכוונה — זה מה שהעין מוצאת קודם,
        * בלי מקרא ובלי onboarding (D-14). */}
      <div className={`flex items-baseline gap-2 px-1 py-1 rounded-lg ${today ? "bg-brand/10" : ""}`}>
        <span className={`text-base font-bold ${today ? "text-brand" : "text-content"}`}>
          {DAYS_HE_SHORT[fromISODate(iso).getDay()]}
        </span>
        <span className="text-[11px] text-faint" data-numeric>
          {shortDate(iso)}
        </span>
      </div>
      <div className="space-y-2">
        {/* טיימלס קודם, אחר כך מתוזמן — בדיוק כמו שboardItemsForDates כבר
          * החזיר; אין מיון שני כאן (D-16). */}
        {day.timeless.map((item) => (
          <BoardRow key={`t-${item.id}`} item={item} guards={guards} />
        ))}
        {day.timed.map((item) => (
          <BoardRow key={`s-${item.id}`} item={item} guards={guards} />
        ))}
      </div>
    </div>
  );
}

function BoardRow({ item, guards }) {
  const timeless = Boolean(item.timeless);
  return (
    <div className="flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-inset ring-hairline bg-surface-sunken">
      <Dot color={shiftTone(item.color, item.type)} size={10} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-content truncate">{item.label}</p>
        {/* ההבדל היחיד בין שורת טיימלס לשורה מתוזמנת הוא איזה יסוד מטא
          * מופיע כאן — לא צבע, לא רקע, לא צורה (D-12). */}
        <span
          className="flex items-center gap-3 mt-0.5 flex-wrap text-[11px] text-faint"
          data-numeric
        >
          {timeless ? (
            <>
              <span className="flex items-center gap-1">
                <Icon name="calendar" size={11} />
                {rangeTextHe(item)}
              </span>
              <span title={OUT_OF_ENGINE_TOOLTIP}>
                <Badge tone="neutral" icon="lock">
                  מחוץ למנוע
                </Badge>
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1">
              <Icon name="clock" size={11} />
              {item.startTime}–{item.endTime}
            </span>
          )}
        </span>
      </div>
      <People ids={item.assignedGuards || []} guards={guards} size={24} max={3} />
    </div>
  );
}
