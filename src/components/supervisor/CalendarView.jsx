import { useMemo, useState, useSyncExternalStore } from "react";
import { Badge, Btn, Card, EmptyState, IconBtn, PageHeader, guardColor, readableInk } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { subscribeTerms, t, termProfile } from "../../lib/terms.js";
import { categoryTone, TONE_VARS } from "../../design/categoryPalette.js";
import { buildResourceRows } from "../../lib/resourceView.js";
import ResourceGrid from "./ResourceGrid.jsx";
import PostWeekGrid from "./PostWeekGrid.jsx";
import DayShiftEditor from "./DayShiftEditor.jsx";
import ShareWeekBtn from "./ShareWeekBtn.jsx";
import { teamRules } from "../../lib/autoAssign.js";
import { initialCursor } from "../../lib/calendarCursor.js";
import { buildPostWeek, countMissing, opDayOf, orderShiftsByPost } from "../../lib/postWeek.js";
import {
  DAYS_HE, DAYS_HE_SHORT, addDays, boardItemsForDates, formatDateHe, fromISODate, monthGrid,
  monthLabelHe, rangeLabelHe, rangeTextHe, shiftHours, shiftPartName, splitShiftLabel, startOfWeek, toISODate,
  todayISO, weekFrom, shiftDisplayName,
} from "../../lib/dates.js";

// ============================================================
// CALENDAR
//
// One dataset, three zoom levels. A month to see the shape of the roster and
// spot the empty days, a week to work in, a day to check who is actually on.
// The mode never changes what the data means — only how far back you stand.
// תצוגת השבוע היא מעתה אותו מבנה קטגוריה×יום שמסך "מבט משאבים" הישן (הוסר ב-Phase 10)
// ומסך בניית השבוע (RosterWizard) כבר מציגים — רזולוציה שונה של אותו נתון,
// לא שפה עיצובית שונה (06-03, RESVIEW-02).
//
// משימות עוברות דרך boardItemsForDates — אותו מיזוג יחיד שהלוח המאוחד
// (UnifiedBoard) ומסך הדוחות כבר עוברים דרכו — כדי שמשימה לעולם לא תיעלם
// כאן בזמן שהיא מופיעה בכל מסך אחר (היה הפער לפני התיקון הזה: יומן זה בנה
// לעצמו byDate מ-shifts בלבד).
// ============================================================

const MODES = [
  { id: "month", label: "חודש", icon: "grid" },
  { id: "week", label: "שבוע", icon: "calendar" },
  { id: "day", label: "יום", icon: "clock" },
];

// זהה מילה במילה לתג שכבר קיים ב-UnifiedBoard/TaskRow — לא מנוסח מחדש.
const OUT_OF_ENGINE_TOOLTIP =
  "המשימה לא נושאת שעות, או פרושה על יותר מיום אחד — ולכן היא לא נכנסת למנוע: היא לא נספרת במנוחה, ברצף, בתקרה השבועית או בנטל.";

/**
 * חוסר האיוש היומי — סופר רק פריטים שיש להם בכלל מושג "כמה צריך"
 * (requiredGuards != null). לפריט timeless (משימה בלי שעות, או שורת עמדה
 * שבועית) אין מושג איוש בכלל — אותה מוסכמה בדיוק כמו missingOfItem
 * ב-UnifiedBoard.jsx, כדי ששני המסכים לעולם לא יחלקו על "כמה חסר".
 */
const coverageOf = (dayItems) => {
  const counted = dayItems.filter((s) => s.requiredGuards != null);
  if (!counted.length) return null;
  const need = counted.reduce((n, s) => n + Math.max(1, s.requiredGuards || 1), 0);
  const got = counted.reduce((n, s) => n + (s.assignedGuards?.length || 0), 0);
  return { need, got, full: got >= need, empty: got === 0 };
};

export default function CalendarView({
  shifts, tasks = [], guards, onNavigate, team, positions = [], actions, availability = {}, busy,
}) {
  // תחום הפעילות מוחל מ-useGuardian (setTermProfile) ולא מפרופ — אותה
  // קריאה בדיוק כמו PositionsScreen (ומסך "מבט משאבים" הישן שהוסר), כדי שהצבע-לפי-קטגוריה
  // לא ייסחף משני מקורות אמת (היה הפער לפני התיקון: הרכיב הזה קיבל mode
  // כפרופ עם ברירת מחדל "security" קבועה, במקום לקרוא את מצב התחום החי).
  const teamMode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const today = todayISO();
  // שבוע הוא ברירת המחדל, לא חודש: מי שנכנס ליומן בא לראות מה חסר *עכשיו*,
  // וחור נראה רק על ציר שעות (הועבר לכאן מ-SupervisorApp.jsx, שנהג לעטוף את
  // המסך הזה בבורר שבוע/חודש חיצוני משלו — שני מתגים לאותה שאלה בדיוק).
  const [mode, setMode] = useState("week");
  const [cursor, setCursor] = useState(() => initialCursor(shifts, today)); // any date inside the shown range
  const [editId, setEditId] = useState(null); // תורנות שנפתחה לעריכה מהגריד או מהיום
  const editShift = editId ? shifts.find((s) => s.id === editId) || null : null;
  const canEdit = Boolean(actions);

  const cur = fromISODate(cursor);
  const dates =
    mode === "month"
      ? monthGrid(cur.getFullYear(), cur.getMonth())
      : mode === "week"
      ? weekFrom(startOfWeek(cursor))
      : [cursor];

  // ממוזג רק על טווח התאריכים המוצג כרגע (חודש/שבוע/יום) — לא כל הנתונים
  // של הצוות בכל הזמנים — ולכן רץ מחדש בכל ניווט, בדיוק כמו boardItemsForDates
  // בכל קורא אחר שלה.
  const merged = useMemo(() => boardItemsForDates(shifts, tasks, dates), [shifts, tasks, dates]);
  const byDate = useMemo(() => {
    const map = new Map();
    for (const day of merged.days) map.set(day.date, [...day.timeless, ...day.timed]);
    if (team?.mode === "army") {
      // בצבא משמרת 00:00–05:00 נספרת ביום המבצעי הקודם — אותו כלל כמו בגריד השבועי
      // וביום, כדי שחודש, שבוע ויום יסכימו על כמה אנשים יש ביום נתון.
      const inRange = new Set(dates);
      const shiftIds = new Set(shifts.map((s) => s.id));
      for (const [date, items] of map) map.set(date, items.filter((s) => s.timeless || !shiftIds.has(s.id)));
      for (const s of shifts) {
        const day = opDayOf(s);
        if (!inRange.has(day)) continue;
        const list = map.get(day) || [];
        list.push(s);
        map.set(day, list);
      }
    }
    return map;
  }, [merged, team?.mode, shifts, dates]);

  // הפיבוט קטגוריה×יום של ResourceGrid — מחושב רק כשהתצוגה בפועל היא שבוע,
  // כדי שפיבוט של רשת חודש בת 42 יום לא ירוץ לשווא. ה-hook עצמו נקרא בלי
  // תנאי (חוק ה-hooks); רק הגוף מותנה. שים לב: `mode` כאן הוא רזולוציית
  // התצוגה (month/week/day), ואילו תחום הפעילות שנכנס ל-buildResourceRows
  // הוא `teamMode` — שני שמות שונים בכוונה כדי לא לבלבל בין השאלות.
  const weekRows = useMemo(
    () => (mode === "week" ? buildResourceRows({ shifts, tasks, weekDates: dates, mode: teamMode }) : []),
    [mode, shifts, tasks, dates, teamMode]
  );

  // בצבא השבוע והיום מוצגים לפי עמדה → משמרת, אותו סדר כמו בבניית השבוע,
  // במקום לפי קטגוריה. בלי עמדות (צוות חדש) חוזרים לתצוגה הקודמת.
  const army = team?.mode === "army";
  const posts = useMemo(
    () => (army && mode === "week" ? buildPostWeek({ shifts, positions, tasks, weekDates: dates, mode: teamMode }) : []),
    [army, mode, shifts, positions, tasks, dates, teamMode]
  );
  const missing = useMemo(() => countMissing(posts), [posts]);

  const step = (dir) => {
    if (mode === "month") {
      const d = new Date(cur.getFullYear(), cur.getMonth() + dir, 1);
      setCursor(toISODate(d));
    } else {
      setCursor(addDays(cursor, dir * (mode === "week" ? 7 : 1)));
    }
  };

  const title =
    mode === "month"
      ? monthLabelHe(cur.getFullYear(), cur.getMonth())
      : mode === "week"
      ? rangeLabelHe(dates)
      : formatDateHe(cursor);

  const shown = dates.flatMap((d) => byDate.get(d) || []);

  // שבוע שאף אחד עוד לא שובץ בו הוא "טרם שובץ", לא "ריק": עד שמריצים שיבוץ כל
  // יום בו אפס, ולצבוע את כל החודש באדום זה רעש. חוסר מסומן רק בשבוע שכבר התחיל להיבנות.
  const assignedWeeks = useMemo(() => {
    const set = new Set();
    for (const s of shifts) if ((s.assignedGuards || []).length) set.add(startOfWeek(opDayOf(s)));
    return set;
  }, [shifts]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("nav.calendar")}
        subtitle={`${shown.length} פריטים בתצוגה`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
          {army && mode === "week" && missing.assigned + missing.missing > 0 && (
            <ShareWeekBtn
              dates={dates}
              shifts={shifts.filter((s) => dates.includes(opDayOf(s)))}
              guards={guards}
              posts={posts}
              teamName={team?.name}
            />
          )}
          <div
            role="radiogroup"
            aria-label="רזולוציית תצוגה"
            className="inline-flex items-center gap-0.5 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline p-1"
          >
            {MODES.map((m) => {
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMode(m.id)}
                  className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5
                    cursor-pointer transition-colors duration-200 ${
                      on ? "bg-brand text-on-brand" : "text-muted hover:text-content"
                    }`}
                >
                  <Icon name={m.icon} size={14} />
                  {m.label}
                </button>
              );
            })}
          </div>
          </div>
        }
      />

      <Card className="p-3 sm:p-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-4">
          {/* Chevrons point the way the calendar moves, which in RTL is the
              mirror of the LTR habit: "next" sits on the left. */}
          <IconBtn icon="right" size="sm" label="הקודם" onClick={() => step(-1)} />
          <div className="text-center min-w-0">
            <h2 className="font-bold text-content text-sm sm:text-base truncate">{title}</h2>
            {cursor !== today && (
              <button
                onClick={() => setCursor(today)}
                className="text-[11px] text-brand hover:underline cursor-pointer"
              >
                חזור להיום
              </button>
            )}
          </div>
          <IconBtn icon="left" size="sm" label="הבא" onClick={() => step(1)} />
        </div>

        {mode === "month" && (
          <MonthGrid
            dates={dates}
            month={cur.getMonth()}
            byDate={byDate}
            today={today}
            teamMode={teamMode}
            assignedWeeks={assignedWeeks}
            onPick={(d) => {
              setCursor(d);
              setMode("day");
            }}
          />
        )}

        {mode === "week" && posts.length > 0 && (
          <div className="-mx-3 sm:-mx-4">
            {missing.assigned > 0 && (
              <p className="px-3 sm:px-4 pb-2 text-xs font-semibold" role="status">
                {missing.missing > 0 ? (
                  <span className="text-warn inline-flex items-center gap-1">
                    <Icon name="alert" size={13} />
                    {missing.missing === 1 ? "מקום אחד לא מאויש" : `${missing.missing} מקומות לא מאוישים`}
                  </span>
                ) : (
                  <span className="text-accent inline-flex items-center gap-1">
                    <Icon name="check-circle" size={13} /> הכול מאויש
                  </span>
                )}
              </p>
            )}
            <PostWeekGrid
              posts={posts}
              dates={dates}
              guards={guards}
              showMissing
              fullNames
              onEditShift={canEdit ? (s) => setEditId(s.id) : undefined}
            />
          </div>
        )}

        {mode === "week" && posts.length === 0 && weekRows.length > 0 && (
          // -mx מנטרל את ה-padding הרגיל של ה-Card בצדדים כדי שהגלילה
          // האופקית והעמודה הנעוצה של ResourceGrid יגיעו עד לקצה הכרטיס —
          // בדיוק כמו שמסך "מבט משאבים" הישן (הוסר) עטף אותו ב-Card שלו (p-0). מצב-ריק
          // לא מטופל כאן במכוון: ה-EmptyState הקיים בתחתית הרכיב כבר מכסה
          // weekRows.length === 0, ואין ליצור שני מצבים-ריקים מתחרים.
          <div className="-mx-3 sm:-mx-4">
            <ResourceGrid rows={weekRows} dates={dates} guards={guards} />
          </div>
        )}

        {mode === "day" && army && (
          <DayByPost
            date={cursor}
            shifts={shifts}
            items={byDate.get(cursor) || []}
            guards={guards}
            teamMode={teamMode}
            onEdit={canEdit ? (s) => setEditId(s.id) : undefined}
          />
        )}
        {mode === "day" && !army && (
          <DayList date={cursor} items={byDate.get(cursor) || []} guards={guards} teamMode={teamMode} />
        )}
      </Card>

      {canEdit && (
        <DayShiftEditor
          shift={editShift}
          onClose={() => setEditId(null)}
          onSave={(next) => actions.updateShift(next.id, next)}
          onCancelDay={(shift) => actions.deleteShift(shift.id)}
          longShiftCategories={teamRules(team).longShiftCategories}
          guards={guards}
          shifts={shifts}
          availability={availability}
          tasks={tasks}
          team={team}
          onToggleAssignment={actions.toggleAssignment}
          busy={busy}
        />
      )}

      {shown.length === 0 && mode !== "day" && (
        <EmptyState
          icon="calendar"
          title="אין מה להציג בתצוגה הזו"
          body={`נווט לתקופה אחרת, או צור משמרות במסך "${t("nav.shifts")}".`}
          action={
            onNavigate && (
              <Btn icon="plus" onClick={() => onNavigate("shifts")}>
                {t("nav.shifts")}
              </Btn>
            )
          }
        />
      )}
    </div>
  );
}

function MonthGrid({ dates, month, byDate, today, onPick, teamMode, assignedWeeks }) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS_HE.map((d, i) => (
          <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-muted py-1">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{DAYS_HE_SHORT[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const dayItems = byDate.get(date) || [];
          const cov = coverageOf(dayItems);
          // יום בשבוע שעוד לא שובץ: מספר שקט, בלי איקס אדום.
          const unplanned = cov?.empty && !assignedWeeks.has(startOfWeek(date));
          const inMonth = fromISODate(date).getMonth() === month;
          const isToday = date === today;
          return (
            <button
              key={date}
              onClick={() => onPick(date)}
              aria-label={`${formatDateHe(date)} — ${dayItems.length} משמרות`}
              className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start gap-0.5
                ring-1 ring-inset cursor-pointer transition-colors duration-200 min-h-[44px]
                ${isToday ? "ring-brand ring-2 bg-brand/10" : "ring-hairline hover:ring-brand/40 hover:bg-surface-hover"}
                ${inMonth ? "" : "opacity-35"}`}
            >
              <span
                className={`text-[11px] sm:text-xs font-bold ${isToday ? "text-brand" : "text-content"}`}
                data-numeric
              >
                {fromISODate(date).getDate()}
              </span>
              {/* Dots, capped at four, plus a count — a month cell that tries
                  to list shifts becomes unreadable at phone width. */}
              {dayItems.length > 0 && (
                <div className="hidden sm:flex flex-wrap gap-[2px] justify-center leading-none">
                  {dayItems.slice(0, 4).map((s) => (
                    <span
                      key={s.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: TONE_VARS[categoryTone(s.category, teamMode)] }}
                    />
                  ))}
                </div>
              )}
              {cov && unplanned && (
                <span className="mt-auto text-[10px] text-faint font-semibold">טרם שובץ</span>
              )}
              {cov && !unplanned && (
                <span
                  className={`mt-auto inline-flex flex-col sm:flex-row items-center sm:gap-0.5 text-[9px] sm:text-[11px] leading-tight font-extrabold ${
                    cov.empty ? "text-danger" : cov.full ? "text-accent" : "text-warn"
                  }`}
                  data-numeric
                >
                  <Icon name={cov.empty ? "x-circle" : cov.full ? "check-circle" : "alert"} size={11} />
                  {cov.got}/{cov.need}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-hairline text-[11px] text-muted flex-wrap">
        <span className="flex items-center gap-1.5">
          <Icon name="check-circle" size={12} className="text-accent" /> מאויש במלואו
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="alert" size={12} className="text-warn" /> חלקי
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="x-circle" size={12} className="text-danger" /> ריק
        </span>
      </div>
    </div>
  );
}

// WeekStrip (גרירת-שבב-שומר בין כרטיסי יום) הוסר בזמנו (RBC-01) לטובת
// תצוגת-שבוע מבוססת ספריית-לוח-שנה חיצונית, שהוחלפה מאז ב-ResourceGrid
// (06-03). שיבוץ מחדש בגרירה עדיין לא חי כאן: הוא קיים באפליקציה דרך
// UnifiedBoard.jsx, שלב "אסדר בעצמי" בבניית השבוע — אותו DRAG_MIME בדיוק,
// רק לא כפול כאן.

/**
 * יום בצבא: עמדה ← משמרות שלה לפי שעה (בוקר, צהריים ... לילה), עם מי משובץ בכל
 * אחת. "יום" הוא היום המבצעי — 00:00–05:00 שייך ללילה של היום הקודם, אותו כלל
 * כמו בגריד השבועי. משימות בלי שעות נשארות בקבוצה נפרדת בסוף.
 */
function DayByPost({ date, shifts, items, guards, teamMode, onEdit }) {
  const dayShifts = orderShiftsByPost(shifts.filter((s) => opDayOf(s) === date), teamMode);
  const loose = items.filter((s) => s.timeless);
  if (!dayShifts.length && !loose.length) {
    return (
      <EmptyState
        icon="calendar"
        title={`אין כלום ב${formatDateHe(date)}`}
        body="אפשר להוסיף משמרות במסך ניהול המשמרות."
      />
    );
  }

  const groups = [];
  for (const s of dayShifts) {
    const post = splitShiftLabel(s.label || "").post || s.label || "משמרת";
    const last = groups[groups.length - 1];
    if (last && last.post === post) last.shifts.push(s);
    else groups.push({ post, category: s.category, shifts: [s] });
  }
  const nameOf = (id) => guards.find((g) => g.id === id)?.name;

  const drafts = dayShifts.filter((s) => !s.published).length;

  return (
    <div className="space-y-4">
      {dayShifts.length > 0 && (
        <p className="text-xs font-semibold">
          {drafts === 0 ? (
            <span className="text-accent inline-flex items-center gap-1">
              <Icon name="check" size={13} /> הסידור של היום פורסם
            </span>
          ) : (
            <span className="text-muted">
              {drafts === dayShifts.length ? "טיוטה — הסידור של היום עוד לא פורסם" : `${drafts} מתוך ${dayShifts.length} משמרות עוד לא פורסמו`}
            </span>
          )}
        </p>
      )}
      {groups.map((group) => {
        const need = group.shifts.reduce((n, s) => n + Math.max(1, s.requiredGuards || 1), 0);
        const got = group.shifts.reduce((n, s) => n + Math.min(s.assignedGuards?.length || 0, Math.max(1, s.requiredGuards || 1)), 0);
        return (
          <section key={group.post} aria-label={group.post}>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: TONE_VARS[categoryTone(group.category, teamMode)] }}
                aria-hidden="true"
              />
              <h3 className="font-extrabold text-content text-sm">{group.post}</h3>
              <span className="text-xs text-muted font-semibold" data-numeric>
                {got}/{need}
              </span>
            </div>
            <div className="space-y-1.5">
              {group.shifts.map((s) => {
                const ids = s.assignedGuards || [];
                const lacking = Math.max(0, (s.requiredGuards || 1) - ids.length);
                return (
                  <div
                    key={s.id}
                    {...(onEdit
                      ? {
                          role: "button",
                          tabIndex: 0,
                          "aria-label": `עריכת ${group.post} ${shiftPartName(s)}`,
                          onClick: () => onEdit(s),
                          onKeyDown: (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onEdit(s);
                            }
                          },
                        }
                      : {})}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline ${
                      onEdit ? "cursor-pointer hover:ring-brand/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60" : ""
                    }`}
                  >
                    <div className="w-28 flex-shrink-0">
                      <div className="text-[13px] font-bold text-content">{shiftPartName(s) || "משמרת"}</div>
                      <div className="text-[11.5px] text-muted font-semibold" dir="ltr" data-numeric>
                        {s.startTime}–{s.endTime}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                      {ids.map((gid) => {
                        const name = nameOf(gid);
                        if (!name) return null;
                        const c = guardColor(gid);
                        return (
                          <span
                            key={gid}
                            className="px-2 py-0.5 rounded-md text-[12px] font-bold"
                            style={{ background: c, color: readableInk(c) }}
                          >
                            {name}
                          </span>
                        );
                      })}
                      {ids.length === 0 && <span className="text-[12px] text-faint font-medium">עוד לא שובץ</span>}
                      {lacking > 0 && ids.length > 0 && (
                        <Badge tone="danger" icon="alert">
                          {lacking === 1 ? "חסר מקום אחד" : `חסרים ${lacking}`}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {loose.length > 0 && (
        <section aria-label="משימות">
          <h3 className="font-extrabold text-content text-sm mb-1.5">משימות</h3>
          <DayList date={date} items={loose} guards={guards} teamMode={teamMode} />
        </section>
      )}
    </div>
  );
}

function DayList({ date, items, guards, teamMode }) {
  if (!items.length) {
    return (
      <EmptyState
        icon="calendar"
        title={`אין כלום ב${formatDateHe(date)}`}
        body="אפשר להוסיף משמרות במסך ניהול המשמרות."
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((s) => {
        const short = !s.timeless && (s.assignedGuards?.length || 0) < (s.requiredGuards || 1);
        return (
          <div
            key={s.id}
            className="flex items-start gap-3 p-3 rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline"
          >
            <div
              className="w-1.5 self-stretch rounded-full flex-shrink-0"
              style={{ background: TONE_VARS[categoryTone(s.category, teamMode)] }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-content text-sm">{s.timeless ? s.label : shiftDisplayName(s)}</span>
                {s.timeless ? (
                  <>
                    <span className="text-xs text-muted" data-numeric>
                      {rangeTextHe(s)}
                    </span>
                    <span title={OUT_OF_ENGINE_TOOLTIP}>
                      <Badge tone="neutral" icon="clock-off">
                        מחוץ למנוע
                      </Badge>
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted" data-numeric>
                    {s.startTime}–{s.endTime} · {shiftHours(s)} ש'
                  </span>
                )}
                {!s.timeless &&
                  (s.published ? (
                    <Badge tone="accent" icon="check">פורסם</Badge>
                  ) : (
                    <Badge tone="neutral">טיוטה</Badge>
                  ))}
                {short && (
                  <Badge tone="danger" icon="alert">
                    חסרים {s.requiredGuards - s.assignedGuards.length}
                  </Badge>
                )}
              </div>
              {s.location && (
                <p className="text-xs text-faint mt-0.5 flex items-center gap-1">
                  <Icon name="map-pin" size={11} />
                  {s.location}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(s.assignedGuards || []).map((gid) => {
                  const g = guards.find((x) => x.id === gid);
                  if (!g) return null;
                  const c = guardColor(gid);
                  return (
                    <span
                      key={gid}
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                      style={{ background: c, color: readableInk(c) }}
                    >
                      {g.name}
                    </span>
                  );
                })}
                {(s.assignedGuards || []).length === 0 && (
                  <span className="text-[11px] text-danger font-medium">לא שובץ אף אחד</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
