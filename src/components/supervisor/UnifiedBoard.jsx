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
//
// רשת עמודות-ימים, לא רשימה מתגלגלת: "השבוע במבט אחד" (D-04) אמור להיקרא
// בעין אחת, בדיוק כמו Google Calendar — ולא בגלילה דרך שבעה כותרי-יום בזה
// אחר זה. אותם breakpoints בדיוק כמו ה-WeekStrip של CalendarView.jsx, כדי
// ששני המסכים ידברו את אותה שפת רשת ולא יסטו זה מזה על אותה שאלה.
// ============================================================

import { Badge, EmptyState, readableInk } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import {
  DAYS_HE_SHORT, boardItemsForDates, fromISODate, isToday, rangeTextHe, shortDate,
} from "../../lib/dates.js";
import { shiftTone } from "../../design/shiftPalette.js";
import { isQualified } from "../../lib/autoAssign.js";
import { t } from "../../lib/terms.js";
import { People } from "./views.jsx";

// זהה מילה במילה לתג שכבר קיים ב-TaskRow (views.jsx) — לא מנוסח מחדש.
const OUT_OF_ENGINE_TOOLTIP =
  "המשימה לא נושאת שעות, או פרושה על יותר מיום אחד — ולכן היא לא נכנסת למנוע: היא לא נספרת במנוחה, ברצף, בתקרה השבועית או בנטל.";

// ============================================================
// חסימת כשירות (BOARD-03, D-09) — הטיפול המדויק של QUAL-08
// (AssignView/TaskMgmt ב-views.jsx), מוגדר כאן פעם אחת ומועבר כפרופ ל-
// `People`. לעולם ring-hairline-strong/bg-surface-sunken — לא ring-danger:
// חוסר כשירות הוא עובדה על האדם, לא שגיאה שהצופה גרם לה.
// ============================================================
const QUAL_BLOCK_LABEL = "לא כשיר/ה";
const QUAL_BLOCK_RING = "ring-hairline-strong bg-surface-sunken";

// אותו ניסוח בדיוק ש-checkQualification (autoAssign.js) ו-AssignView נועלים
// — כדי שהלוח ומסך השיבוץ הידני לעולם לא יתארו את אותה חסימה במילים שונות.
const qualRefusal = (category) => `לא מוגדר/ת כשיר/ה לקטגוריית "${category}"`;

/**
 * חוסר האיוש של פריט מתוזמן. לפריט טיימלס אין מושג איוש בכלל (D-08 אין
 * פעולה, ואין שדה requiredGuards על שורת עמדה שבועית).
 */
const missingOfItem = (item) => {
  if (item.requiredGuards == null) return 0;
  return Math.max(0, (item.requiredGuards || 1) - (item.assignedGuards?.length || 0));
};

export default function UnifiedBoard({
  shifts = [], tasks = [], guards = [], dates = [], scopeGuardId = null, empty,
}) {
  const merged = boardItemsForDates(shifts, tasks, dates);

  const scope = (items) =>
    scopeGuardId == null
      ? items
      : items.filter((item) => (item.assignedGuards || []).includes(scopeGuardId));

  // טיימלס קודם, אחר כך מתוזמן — בדיוק כמו שboardItemsForDates כבר החזיר;
  // אין מיון שני כאן (D-16). כל תאריך ב-dates מקבל עמודה משלו, גם אם היא
  // ריקה (D-04: עמודה חסרה הייתה שוברת את המשמעות המיקומית של "יום שלישי"
  // ברשת — בדיוק כמו שWeekStrip לעולם לא מדלג על יום ריק).
  const days = merged.days.map((day) => ({
    date: day.date,
    items: [...scope(day.timeless), ...scope(day.timed)],
  }));

  const totalItems = days.reduce((sum, d) => sum + d.items.length, 0);

  // מצב ריק שלם: ניסוח, לא אזהרה (D-15) — לא Alert, לא danger, לא warn.
  // ברירת המחדל (G-05-1) לא קוראת בשם שום כפתור: זו התצוגה שמופיעה גם
  // ביומן וגם אצל המשתתף, ובאף אחד מהם אין את שלב "תסדר לי" על המסך.
  // מסך "השבוע" של המנהל מעביר `empty` משלו (WeekFlow.jsx) שקורא בשם
  // הפעולה הראשית שכן נמצאת שם, ממש מתחת ללוח.
  if (totalItems === 0) {
    return (
      <EmptyState
        icon="inbox"
        title={empty?.title || "השבוע עדיין ריק"}
        body={empty?.body || `בנה ${t("unit.shifts")} או משימות, והלוח ייבנה מעצמו.`}
      />
    );
  }

  // חוסר איוש ברמת השבוע כולו, פעם אחת מעל הרשת — לא באנר, לא Alert, ולא
  // חוזר על עצמו בכל עמודה. שורה מטושטשת (text-muted), לא אזהרה. רק פריטים
  // מתוזמנים נספרים (D-08 — לפריט טיימלס אין מושג איוש בכלל).
  const totalMissing = days.reduce(
    (sum, day) => sum + day.items.reduce((s, item) => s + (item.timeless ? 0 : missingOfItem(item)), 0),
    0
  );

  return (
    <div className="space-y-3">
      {totalMissing > 0 && (
        <p className="text-xs text-muted px-1" data-numeric>
          {totalMissing} מקומות לא מאוישים
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {days.map((day) => (
          <DayColumn key={day.date} day={day} guards={guards} />
        ))}
      </div>
    </div>
  );
}

function DayColumn({ day, guards }) {
  const iso = day.date;
  const today = isToday(iso);
  return (
    <div>
      <div
        className={`text-center mb-2 pb-1.5 border-b-2 ${today ? "border-brand" : "border-hairline"}`}
      >
        <p className={`text-[11px] ${today ? "text-brand font-bold" : "text-muted"}`}>
          {DAYS_HE_SHORT[fromISODate(iso).getDay()]}
        </p>
        <p className={`text-sm font-bold ${today ? "text-brand" : "text-content"}`} data-numeric>
          {shortDate(iso)}
        </p>
      </div>
      <div className="space-y-1.5">
        {day.items.map((item) => (
          <BoardCard key={`${item.timeless ? "t" : "s"}-${item.id}`} item={item} guards={guards} />
        ))}
        {day.items.length === 0 && <p className="text-center text-[11px] text-faint py-3">—</p>}
      </div>
    </div>
  );
}

function BoardCard({ item, guards }) {
  const timeless = Boolean(item.timeless);
  // חוסר איוש הוא מושג שקיים רק לפריט מתוזמן (D-08 — שורת עמדה עתידית אין
  // לה עוד ניצול; פריט timeless אין לו requiredGuards בכלל).
  const missing = timeless ? 0 : missingOfItem(item);
  const tone = shiftTone(item.color, item.type);
  const ink = readableInk(tone);
  return (
    <div
      className={`rounded-lg p-2 text-[11px] ring-1 ring-inset ${missing > 0 ? "ring-warn ring-2" : "ring-transparent"}`}
      style={{ background: tone, color: ink }}
    >
      <p className="font-bold truncate">{item.label}</p>
      {/* ההבדל היחיד בין כרטיס טיימלס לכרטיס מתוזמן הוא איזה יסוד מטא מופיע
        * כאן — לא צבע, לא רקע, לא צורה (D-12). */}
      {timeless ? (
        <div className="mt-0.5 space-y-1 opacity-90">
          <span className="flex items-center gap-1" data-numeric>
            <Icon name="calendar" size={10} />
            {rangeTextHe(item)}
          </span>
          <span title={OUT_OF_ENGINE_TOOLTIP}>
            {/* clock-off, לא lock (G-05-1): המנעול שמור כולו לחסימת כשירות
              * אישית (People למטה) — הגלף הזה הוא הנגדת השעון הרגיל שכרטיס
              * מתוזמן מציג, לא סימן נעילה נוסף. */}
            <Badge tone="neutral" icon="clock-off" className="!bg-black/20 !text-inherit !ring-0">
              מחוץ למנוע
            </Badge>
          </span>
        </div>
      ) : (
        <span className="flex items-center gap-1 mt-0.5 opacity-90" data-numeric>
          <Icon name="clock" size={10} />
          {item.startTime}–{item.endTime}
        </span>
      )}
      {/* שלושה ערוצים — אייקון, מילים, וטבעת אזהרה על הכרטיס כולו — לעולם לא
        * צבע לבדו (WCAG 1.4.1). כרטיס מאויש במלואו לא מקבל שום תג — תג
        * "תקין" על כל כרטיס הוא בדיוק הרעש ש-TaskRow כבר נמנע ממנו. */}
      {missing > 0 && (
        <span className="flex items-center gap-1 mt-0.5 font-bold" data-numeric>
          <Icon name="alert" size={10} />
          חסרים {missing}
        </span>
      )}
      {/* חסימת כשירות ברמת האדם, לא ברמת הפריט (D-11): People סורק רק את מי
        * שכבר ב-item.assignedGuards — בדיוק כפי שהתקבל למעלה — ולא את כל
        * הצוות (D-10). isQualified נקרא כאן, בזמן רינדור, עבור כל אדם בערימה
        * בנפרד; התוצאה לא נשמרת ולא נגזרת מחדש מהרשימה הגולמית על האדם. אותו
        * קוד בדיוק רץ בין אם item הוא משמרת ובין אם הוא משימה — אין כאן ענף
        * לפי סוג הפריט (BOARD-03). */}
      <div className="mt-1.5">
        <People
          ids={item.assignedGuards || []}
          guards={guards}
          size={20}
          max={3}
          isBlocked={(g) => !isQualified(g, item.category)}
          blockedLabel={QUAL_BLOCK_LABEL}
          blockedClassName={QUAL_BLOCK_RING}
          blockedTitle={() => qualRefusal(item.category)}
        />
      </div>
    </div>
  );
}
