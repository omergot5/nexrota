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

/**
 * חוסר האיוש של פריט מתוזמן, בדיוק כמו missingOf ב-WeekCalendar.jsx — אותו
 * חשבון, מוצג כאן כשורת רשימה במקום כמלבן ברשת. לפריט טיימלס אין מושג
 * איוש בכלל (D-08 אין פעולה, ואין שדה requiredGuards על שורת עמדה שבועית).
 */
const missingOfItem = (item) => {
  if (item.requiredGuards == null) return 0;
  return Math.max(0, Math.max(1, item.requiredGuards || 1) - (item.assignedGuards?.length || 0));
};

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

  // חוסר איוש ברמת השבוע כולו, פעם אחת מעל קבוצות הימים — לא באנר, לא
  // Alert, ולא חוזר על עצמו בכל יום. שורה מטושטשת (text-muted), לא אזהרה.
  const totalMissing = days.reduce(
    (sum, day) => sum + day.timed.reduce((s, item) => s + missingOfItem(item), 0),
    0
  );

  return (
    <div className="space-y-6">
      {totalMissing > 0 && (
        <p className="text-xs text-muted px-1" data-numeric>
          {totalMissing} מקומות לא מאוישים
        </p>
      )}
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
  // חוסר איוש הוא מושג שקיים רק לפריט מתוזמן (D-08 — שורת עמדה עתידית אין
  // לה עוד ניצול; פריט timeless אין לו requiredGuards בכלל).
  const missing = timeless ? 0 : missingOfItem(item);
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-inset bg-surface-sunken ${
        missing > 0 ? "ring-warn" : "ring-hairline"
      }`}
    >
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
          {/* שלושה ערוצים — אייקון, מילים, וטבעת אזהרה על השורה כולה —
            * לעולם לא צבע לבדו (WCAG 1.4.1). שורה מאוישת במלואה לא מקבלת
            * שום תג — תג "תקין" על כל שורה הוא בדיוק הרעש ש-TaskRow כבר
            * נמנע ממנו. */}
          {missing > 0 && (
            <span className="flex items-center gap-1 font-bold text-warn">
              <Icon name="alert" size={11} />
              חסרים {missing}
            </span>
          )}
        </span>
      </div>
      <People ids={item.assignedGuards || []} guards={guards} size={24} max={3} />
    </div>
  );
}
