// ============================================================
// יומן שבועי בסגנון Google Calendar (RBC-01).
//
// עטיפה דקה סביב react-big-calendar: הוא פותר את הבעיה הקשה (ציר שעות,
// אירועים חופפים זה לצד זה, גלילה) — הרכיב הזה רק מזין אותו מ-
// `toCalendarEvents` (lib/calendarEvents.js, שכבר עוטף boardItemsForDates)
// ומצייר כל אירוע בצבע-הקטגוריה שלו (categoryPalette.js) במקום בצבע
// ברירת המחדל הכחול של הספרייה.
//
// dayjsLocalizer ולא moment: dayjs צורך שברירי הגודל של moment (הפרויקט
// לא סוחב אותו בשום מקום אחר), ו-RBC תומך בו כאזרח מן המניין.
// ============================================================

import { useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/he.js";
import isBetween from "dayjs/plugin/isBetween.js";
import localeData from "dayjs/plugin/localeData.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./WeekTimeGrid.css";
import { toCalendarEvents } from "../../lib/calendarEvents.js";
import { fromISODate } from "../../lib/dates.js";
import { categoryTone, TONE_VARS } from "../../design/categoryPalette.js";
import { guardColor } from "../ui.jsx";

dayjs.extend(isBetween);
dayjs.extend(localeData);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.locale("he");

const localizer = dayjsLocalizer(dayjs);

// RBC בונה כותרות/תוויות משעה ל-Date-formatting library משלו — לא עובר
// דרך terms.js (מונחי-תפקיד, לא ימי-שבוע), אז אין כאן קונפליקט עם D-01.
const MESSAGES = {
  week: "שבוע",
  day: "יום",
  today: "היום",
  previous: "הקודם",
  next: "הבא",
  noEventsInRange: "אין כלום בטווח הזה",
  allDay: "כל היום",
};

/**
 * `event.resource.category`/`mode` → צבע האירוע. `rgb(var(--cat-on))`
 * ולא `readableInk` מחושב: כל ששת גווני הקטגוריה נבחרו כהים מספיק
 * שלבן מנצח תמיד במצב בהיר, ובהירים מספיק שכהה מנצח תמיד במצב כהה —
 * מחושב פעם אחת ותועד ב-tokens.css, לא בכל רינדור.
 *
 * פינות מרובעות בצד שבו האירוע ממשיך (continuesAfter/Before, מ-
 * calendarEvents.js) — אותו רמז חזותי ש-Google Calendar עצמו נותן למשמרת
 * שפוצלה על פני חצות: שני חצאים שנראים כמו רצף אחד, לא שני אירועים סתם
 * שמזדמן להם להיות צמודים.
 *
 * פס-שומר: הרקע נשאר לפי קטגוריה (ככה מבדילים "מה" — שמירות מול סיור),
 * ומעליו פס בצד-התחלה בצבע קבוע לפי guardColor(id) — אותו צבע יציב שכבר
 * מזהה את השומר בכל מקום אחר באפליקציה — כדי שאפשר יהיה להבדיל גם "מי":
 * שתי משמרות שמירות של שני שומרים שונים כבר לא נראות זהות. `border-inline-
 * start` ולא `border-right` בכוונה — מתהפך אוטומטית עם RTL/LTR בלי קוד
 * נפרד. רק כשיש שומר משובץ בפועל; משמרת ריקה לא "שייכת" לאף אחד.
 */
function eventPropGetter(event, mode) {
  const tone = categoryTone(event.resource.category, mode);
  const { continuesAfter, continuesBefore, assignedGuards } = event.resource;
  const guardId = assignedGuards?.[0];
  return {
    style: {
      backgroundColor: TONE_VARS[tone],
      color: "rgb(var(--cat-on))",
      border: "none",
      borderInlineStart: guardId ? `4px solid ${guardColor(guardId)}` : "none",
      borderRadius: 8,
      ...(continuesAfter && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
      ...(continuesBefore && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }),
    },
  };
}

// שעה מוצגת כאן ולא דרך rbc-event-label המובנה (מוסתר ב-WeekTimeGrid.css):
// שליטה מלאה על הפריסה הקומפקטית — שעה⋅כותרת⋅שם בשלוש שורות צמודות, לא
// שני מקורות טקסט נפרדים שמתחרים על אותו שטח צר. בחצי הממשיך (אחרי
// חצות) מוצגת חץ במקום שעה — "07:00" בראש התא היה קורא כאילו המשמרת
// *מתחילה* שם, בעוד שהיא רק נגמרת שם.
// חסר-איוש: אותו מושג בדיוק כמו `coverageOf` ב-CalendarView.jsx (MonthGrid/
// DayList) — נספר רק לפריט שיש לו בכלל מושג "כמה צריך" (requiredGuards !=
// null). בלי זה משמרת חלקית-מאוישת נראתה זהה למאוישת במלואה בתצוגת השבוע,
// בעוד שתי התצוגות האחרות כבר מציגות את הפער הזה.
function EventContent({ event }) {
  const names = event.resource.assignedGuardNames || [];
  const need = event.resource.requiredGuards;
  const hh = String(event.start.getHours()).padStart(2, "0");
  const mm = String(event.start.getMinutes()).padStart(2, "0");
  const short = need != null && names.length < need;
  return (
    <div className="text-[11px] leading-[1.15]">
      {!event.allDay && (
        <div className="flex items-center justify-between gap-1">
          <span className="font-black text-[10px]" data-numeric>
            {event.resource.continuesBefore ? "⋯" : `${hh}:${mm}`}
          </span>
          {short && (
            // רקע `bg-bg` אטום (לא `bg-surface` — הוא כבר rgba עם אלפא
            // אפויה, ובמצב כהה כמעט שקוף) מאחורי התג: `text-danger`/`text-warn`
            // מחושבים בכוונה מול `--bg` בדיוק (יחסי הניגודיות בתיעוד ה-tokens),
            // לא מול צבע-הקטגוריה הדינמי של אריח האירוע — משמרת בקטגוריה
            // cat-red הייתה מציגה טקסט אדום על רקע אדום בלי הרקע הזה.
            <span
              className={`font-black text-[9px] px-1 rounded bg-bg ${names.length === 0 ? "text-danger" : "text-warn"}`}
              data-numeric
              aria-label={`חסרים ${need - names.length}`}
            >
              {names.length}/{need}
            </span>
          )}
        </div>
      )}
      <div className="font-bold truncate">{event.title}</div>
      {names.length === 0 ? (
        <div className="opacity-80 truncate">לא משובץ</div>
      ) : (
        <div className="opacity-90 truncate">{names.join(", ")}</div>
      )}
    </div>
  );
}

export default function WeekTimeGrid({ shifts = [], tasks = [], guards = [], dates = [], mode = "security", onSelectEvent }) {
  const nameOf = (id) => guards.find((g) => g.id === id)?.name?.split(" ")[0] || "מישהו";

  const events = useMemo(() => {
    const raw = toCalendarEvents({ shifts, tasks, dates });
    // שמות במקום מזהים, מחושב כאן ולא בתוך lib/calendarEvents.js: המודול
    // הטהור לא מכיר את רשימת השומרים (guards לא פרמטר שלו) — ריבוד נכון
    // בין "אילו מזהים משויכים" (טהור, נבדק ב-node) ל"איך קוראים להם"
    // (תלוי-props, כאן בלבד).
    return raw.map((e) => ({ ...e, resource: { ...e.resource, assignedGuardNames: e.resource.assignedGuards.map(nameOf) } }));
  }, [shifts, tasks, dates, guards]);

  // RBC קורא מ-min/max רק את רכיב השעה (לא התאריך) ומחיל אותו על כל
  // העמודות באופן אחיד — ולא מפצל אירוע שחוצה חצות לשתי עמודות יום.
  // ציר של 24 שעות מלאות, לא 06:00–02:00 "חכם", כי אין דרך אמיתית ב-RBC
  // לגלגל את קצה משמרת הלילה לעמודה הבאה: משמרת 19:00–07:00 תיחתך
  // ב-23:59 בעמודת ההתחלה שלה — נראה, לא נעלם, וזו המגבלה שהספרייה
  // עצמה כופה על תצוגת שבוע/יום.
  // `fromISODate` (dates.js) עוגן בצהריים מקומיים בכוונה, לא `new Date(iso)`
  // גולמי (חצות UTC) — ב-timezone מאחורי UTC, `new Date("2026-09-13")`
  // מוצג מקומית כ-12/9 בערב, וה-min/max שלמטה היו מתאפסים ליום הלא נכון
  // עוד לפני שהגיעו ל-RBC. אותה מוסכמה בדיוק ש-calendarEvents.js כבר
  // משתמש בה — לא ממציאים כאן עיגון תאריך שני.
  const { min, max, scrollTo } = useMemo(() => {
    const base = dates[0] ? fromISODate(dates[0]) : new Date();
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    const e = new Date(base);
    e.setHours(23, 59, 59, 999);
    const s = new Date(base);
    s.setHours(6, 0, 0, 0);
    return { min: d, max: e, scrollTo: s };
  }, [dates]);

  return (
    <div className="nexrota-rbc" dir="rtl">
      <Calendar
        localizer={localizer}
        events={events}
        view="week"
        views={["week"]}
        date={dates[0] ? fromISODate(dates[0]) : new Date()}
        toolbar={false}
        rtl
        culture="he"
        messages={MESSAGES}
        min={min}
        max={max}
        // ציר 24 שעות מלא (min/max) פותח גלילה בחצות בברירת המחדל — לא
        // כמו Google Calendar, שנפתח על שעות היום. גלילה ראשונית ל-06:00,
        // בלי לצמצם את min/max עצמם (שם עדיין חייבים להישאר 24 שעות מלאות
        // כדי שמשמרת לילה שמתחילה 19:00 לא תיחתך בטרם עת).
        scrollToTime={scrollTo}
        step={30}
        timeslots={2}
        eventPropGetter={(event) => eventPropGetter(event, mode)}
        components={{ event: EventContent }}
        onSelectEvent={onSelectEvent}
        style={{ height: 640 }}
      />
    </div>
  );
}
