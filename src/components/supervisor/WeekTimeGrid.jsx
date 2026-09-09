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
import { toCalendarEvents } from "../../lib/calendarEvents.js";
import { categoryTone, TONE_VARS } from "../../design/categoryPalette.js";

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
 */
function eventPropGetter(event, mode) {
  const tone = categoryTone(event.resource.category, mode);
  return {
    style: {
      backgroundColor: TONE_VARS[tone],
      color: "rgb(var(--cat-on))",
      border: "none",
      borderRadius: 8,
    },
  };
}

function EventContent({ event }) {
  const names = event.resource.assignedGuardNames || [];
  return (
    <div className="text-[11px] leading-tight">
      <div className="font-bold truncate">{event.title}</div>
      {names.length === 0 ? (
        <div className="opacity-80">לא משובץ</div>
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
  const { min, max } = useMemo(() => {
    const base = dates[0] ? new Date(dates[0]) : new Date();
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    const e = new Date(base);
    e.setHours(23, 59, 59, 999);
    return { min: d, max: e };
  }, [dates]);

  return (
    <div className="nexrota-rbc" dir="rtl">
      <Calendar
        localizer={localizer}
        events={events}
        view="week"
        views={["week"]}
        date={dates[0] ? new Date(dates[0]) : new Date()}
        toolbar={false}
        rtl
        culture="he"
        messages={MESSAGES}
        min={min}
        max={max}
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
