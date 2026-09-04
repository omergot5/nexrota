import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Alert, Avatar, Badge, Btn, Card, EmptyState, Field, Input, Meter, Modal, PageHeader,
  readableInk, Segmented, Select,
} from "./ui.jsx";
import { Icon } from "./icons.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import {
  availabilityDeadline, boardItemsForDates, countdownHe, dayName, formatDateHe,
  rangeLabelHe, shiftInterval, shortDate, toISODate, todayISO, weekByOffset,
  withEngineTasks,
} from "../lib/dates.js";
import { availStatus, checkAssignment, teamAverages } from "../lib/autoAssign.js";
import { qualifiedGuardsForPosition } from "../lib/positions.js";
import { shiftTone } from "../design/shiftPalette.js";
import { subscribeTerms, t, termProfile } from "../lib/terms.js";
import UnifiedBoard from "./supervisor/UnifiedBoard.jsx";

const navItems = () => [
  { id: "schedule", label: t("guard.nav.schedule"), icon: "calendar" },
  { id: "availability", label: t("guard.nav.availability"), icon: "check-circle" },
  { id: "swaps", label: t("guard.nav.swaps"), icon: "swap", badge: true },
];

/** Availability as icon + word + colour — never colour alone. */
const AVAIL = {
  preferred:   { icon: "star",         label: "מעדיף",   short: "מעדיף", tone: "brand" },
  available:   { icon: "check-circle", label: "זמין",    short: "זמין",  tone: "accent" },
  maybe:       { icon: "help",         label: "אולי",    short: "אולי",  tone: "warn" },
  unavailable: { icon: "x-circle",     label: "לא זמין", short: "לא",    tone: "danger" },
};

const AVAIL_CHOICES = ["preferred", "available", "maybe", "unavailable"];

const SWAP_STATUS = {
  pending:  { label: "ממתין", tone: "warn" },
  approved: { label: "אושר",  tone: "accent" },
  rejected: { label: "נדחה",  tone: "danger" },
};

// ============================================================
// MY SCHEDULE
// ============================================================

/**
 * הכרטיס הפותח. מאבטח שפותח את האפליקציה שואל שאלה אחת — "מתי אני עובד?" —
 * וכל דבר שעומד בינו לבין התשובה הוא מס. לכן התורנות הבאה מקבלת את החלק
 * העליון של המסך, בלי ניווט, בלי כותרת ביניים, ועם ספירה לאחור במילים ולא
 * בשעון: "עוד יומיים ו-3 שעות" נקרא בלי חישוב, "13/08 07:00" לא.
 */
function NextDuty({ shift, mates }) {
  // הכרטיס נשאר "רק זמן" (P-04): הפריט תמיד מגיע מהמאגר המתוזמן, ולכן
  // תמיד יש לו startTime/endTime — אבל הוא יכול להיות משימה שעברה דרך
  // taskAsShiftShape, שאין לה color/location. shiftTone נותן גם למשמרת
  // בלי צבע אישי וגם לפריט-משימה גוון מהסולם הקיים — לא צבע חדש שמבדיל
  // בין סוגי פריטים (D-12), אותה מוסכמה ש-UnifiedBoard כבר משתמש בה.
  const color = shiftTone(shift.color, shift.type);
  const ink = readableInk(color);
  const { start } = shiftInterval(shift);
  const started = start <= Date.now();
  return (
    <div
      className="rounded-3xl p-5 shadow-xl relative overflow-hidden animate-fade-up"
      style={{ background: color, color: ink }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-75">
        התורנות הבאה שלך
      </p>
      <p className="text-2xl font-black leading-tight mt-1.5">
        {started ? "עכשיו" : countdownHe(start)}
      </p>
      {/* formatDateHe כבר כולל את שם היום — הוספת dayName לצידו נותנת
        * "ראשון · יום ראשון, 23 באוגוסט". */}
      <p className="text-sm font-semibold opacity-95 mt-0.5">{formatDateHe(shift.date)}</p>

      <div className="h-px bg-current opacity-20 my-4" />

      <div className="flex items-center gap-4 flex-wrap text-sm font-semibold">
        <span className="flex items-center gap-1.5" data-numeric>
          <Icon name="clock" size={15} />
          {shift.startTime}–{shift.endTime}
        </span>
        {shift.location && (
          <span className="flex items-center gap-1.5">
            <Icon name="map-pin" size={15} />
            {shift.location}
          </span>
        )}
        <span className="opacity-85">{shift.label}</span>
      </div>

      <p className="text-xs opacity-85 mt-3">
        {mates.length === 0 ? "לבד במשמרת" : `עם ${mates.join(" · ")}`}
      </p>
    </div>
  );
}

/**
 * שורת ההוגנות. מספר בודד ("3 תורנויות") לא עונה על השאלה שבאמת נשאלת —
 * "יצא לי יותר מלאחרים?" — ולכן כל מונה מופיע לצד ממוצע הצוות.
 *
 * היא מוצגת פעם אחת, לא תחת כל תורנות: אותם שני מספרים חוזרים מתחת לחמישה
 * כרטיסים הם רעש, והם גם גורמים לקורא לחשוב שהמספר משתנה ביניהם.
 */
function FairnessLine({ mine, avg }) {
  const rows = [
    { label: "תורנויות", value: mine.count, avg: avg.count },
    { label: "לילות", value: mine.nights, avg: avg.nights },
    // נטל ולא שעות: זו היחידה שהמנוע באמת מחלק לפיה, ולהציג כאן מספר אחר
    // פירושו שורת הוגנות שלא תואמת את ההחלטות שהתקבלו.
    { label: "נטל", value: Math.round(mine.load), avg: avg.load, hint: "לילה וסופ״ש שוקלים יותר" },
  ];
  return (
    <Card className="p-3.5">
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-hairline">
        {rows.map((r) => {
          // סטייה של פחות מחצי יחידה היא רעש חישובי, לא אי־צדק.
          const diff = r.value - r.avg;
          const tone =
            diff > 0.5 ? "text-warn" : diff < -0.5 ? "text-accent" : "text-content";
          return (
            <div key={r.label} className="text-center px-2">
              <p className={`text-xl font-black ${tone}`} data-numeric>
                {r.value}
              </p>
              <p className="text-[11px] font-semibold text-muted mt-0.5" title={r.hint}>
                {r.label}
              </p>
              <p className="text-[10px] text-faint" data-numeric>
                ממוצע {r.avg}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MySchedule({ user, guards, shifts, tasks = [], positions = [] }) {
  const today = todayISO();
  const publishedAll = shifts.filter((s) => s.published);

  // משימות לא מסוננות לפי published בכוונה, בניגוד ל-publishedAll שמעל:
  // למשימה אין דגל כזה בכלל — היא לא טיוטת סידור שממתינה לפרסום, היא
  // עבודה שקיימת. זה בדיוק המספר ש-FAIR-05 (אבן דרך א') הבטיח למשתתף:
  // הנטל שהמנוע באמת מחלק לפיו, לא ספירת משמרות עצמאית. (בלוק ההוגנות הזה
  // לא זז בפאזה 5 — הוא נשאר בדיוק כמו שהיה.)
  const withTasks = useMemo(
    () => withEngineTasks(publishedAll, tasks),
    [publishedAll, tasks]
  );
  const { perGuard, avg } = useMemo(
    () => teamAverages(guards, withTasks),
    [guards, withTasks]
  );
  const mine_ = perGuard[user.id];
  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "—";

  // חלון התאריכים של הלוח שלי (P-06): כל תאריך-עוגן ששייך לצוות — לא רק
  // לי — מהיום קדימה, בלי הגבלה לשבוע אחד כמו שהמסך הזה תמיד נהג. אותו
  // אידיום dueDate || startDate ש-boardShapeOf עצמו כבר משתמש בו. UnifiedBoard
  // (scopeGuardId) הוא זה שמצמצם כל יום לפריטים שלי בפועל, לא הרשימה הזו.
  const myDates = [...new Set([
    ...publishedAll.map((s) => s.date),
    ...tasks.map((t) => t.dueDate || t.startDate).filter(Boolean),
  ])]
    .filter((d) => d >= today)
    .sort();

  // הכרטיס הפותח צריך פריט עם זמן אמיתי (P-04) — לא מיון שני של
  // shifts/tasks כאן, אלא מעבר על הלוח שכבר ממוזג וממוין ע"י
  // boardItemsForDates עצמה (אותו מסלול מיזוג יחיד ש-UnifiedBoard משתמש
  // בו), עד לפריט הראשון שמשויך אליי.
  const myBoard = boardItemsForDates(publishedAll, tasks, myDates);
  let next = null;
  for (const day of myBoard.days) {
    const found = day.timed.find((it) => (it.assignedGuards || []).includes(user.id));
    if (found) {
      next = found;
      break;
    }
  }

  // התורנות הראשונה יוצאת מהלוח שמתחתיה כדי שלא תופיע פעמיים — אותה
  // דה-דופליקציה שה-`[next, ...rest]` הישן ביצע, רק שכאן היא מסננת את
  // המקור (shifts/tasks) לפני שהלוח ממזג אותם מחדש, לא ממיינת דבר בעצמה.
  const boardShifts =
    next && next.type !== "task" ? publishedAll.filter((s) => s.id !== next.id) : publishedAll;
  const boardTasksForMine =
    next && next.type === "task" ? tasks.filter((t) => t.id !== next.id) : tasks;

  // מצב ריק (D-15): שני הענפים הישנים — "עדיין לא פורסם" מול "פורסם, אבל
  // אני לא בו" — נשארים בדיוק, רק הכותרת מתעדכנת כי הרשימה כבר לא רק
  // משמרות (UI-SPEC Copywriting Contract).
  const myEmpty = {
    title: "אין לך כלום השבוע",
    body:
      publishedAll.length === 0
        ? 'האחמ"ש עדיין לא פרסם את הסידור. ברגע שיפרסם — הוא יופיע כאן.'
        : "לא שובצת למשמרות בסידור שפורסם. אם זו טעות, פנה לאחמ״ש.",
  };

  // "העמדות שאני כשיר/ה להן" (POS-05, ROADMAP §4.4): גזירה קריאה-בלבד מעל
  // qualifiedGuardsForPosition, אותה פונקציה טהורה בדיוק שהמסך של המנהל
  // קורא. זו רשימת היתר, לא רשימת שיבוץ — עמדה שהמשתמש באמת עובד בה השבוע
  // כבר מופיעה למעלה בין התורנויות כי היא התממשה לשורה רגילה; היא לא
  // משוכפלת לכאן.
  const myPositions = positions.filter(
    (p) => p.active && qualifiedGuardsForPosition(p, [user]).length > 0
  );

  return (
    <div className="space-y-6">
      {next && (
        <>
          <NextDuty
            shift={next}
            mates={(next.assignedGuards || []).filter((id) => id !== user.id).map(nameOf)}
          />
          {mine_ && <FairnessLine mine={mine_} avg={avg} />}
        </>
      )}

      {/* הלוח המאוחד (BOARD-01/BOARD-03): אותו רכיב בדיוק שהמנהל רואה, כאן
        * בהיקף המשתתף (scopeGuardId) — משמרות ומשימות יחד, ממוין לפי זמן,
        * עם אותו טיפול חסימת-כשירות. לא רשימה שנייה. */}
      <UnifiedBoard
        shifts={boardShifts}
        tasks={boardTasksForMine}
        guards={guards}
        dates={myDates}
        scopeGuardId={user.id}
        empty={myEmpty}
      />

      {(publishedAll.length > 0 || tasks.length > 0) && (
        <Card>
          <h2 className="font-bold text-content mb-3 flex items-center gap-2">
            <Icon name="clipboard" size={17} className="text-muted" />
            הסידור המלא של הצוות
          </h2>
          <UnifiedBoard
            shifts={publishedAll}
            tasks={tasks}
            guards={guards}
            dates={[...new Set([
              ...publishedAll.map((s) => s.date),
              ...tasks.map((t) => t.dueDate || t.startDate).filter(Boolean),
            ])].sort()}
          />
        </Card>
      )}

      {/* בלוק כשירות, לא לוח עבודה. שני הכללים שהופכים אותו לבלתי-ניתן
        * לבלבול עם התורנויות למעלה (POS-05, אותם ארבעה ערוצים):
        * `<Icon name="key">` ולא "calendar", וצ'יפ מתוחם בלי תאריך —
        * תאריך על פריט כאן הוא בדיוק הרמז שהופך אותו למשמרת בעיני הקורא. */}
      {myPositions.length > 0 && (
        <Card>
          <h2 className="font-bold text-content mb-1 flex items-center gap-2">
            <Icon name="key" size={17} className="text-muted" />
            {t("positions.mine")}
          </h2>
          <p className="text-xs text-muted mb-3">
            זו רשימת מה שמותר לך — לא לוח עבודה. מה שאתה בפועל עובד בו השבוע כבר מופיע למעלה בין
            התורנויות.
          </p>
          <div className="flex flex-wrap gap-2">
            {myPositions.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium
                  text-content ring-1 ring-inset ring-hairline-strong bg-transparent"
              >
                <Icon name="key" size={13} className="text-muted" />
                {p.title}
                <span className="text-faint text-xs">· {p.category}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// AVAILABILITY SUBMISSION
// ============================================================

function MyAvailability({ user, team, shifts, availability, actions, busy }) {
  const [offset, setOffset] = useState(1);
  const weekDates = useMemo(() => weekByOffset(offset), [offset]);
  const weekShifts = shifts.filter((s) => weekDates.includes(s.date));

  // The week is only locked once it has actually started — a guard should
  // never be stuck unable to answer for a week that is still in the future.
  const weekStarted = weekDates[0] < todayISO();
  const deadline = useMemo(() => availabilityDeadline(weekDates[0], team), [weekDates, team]);
  const pastDeadline = new Date() > deadline && !weekStarted;
  const hoursLeft = (deadline - new Date()) / 3600000;
  const deadlineLabel = `${dayName(toISODate(deadline))}, ${deadline.toLocaleDateString("he-IL")} בשעה ${String(deadline.getHours()).padStart(2, "0")}:00`;

  const answered = weekShifts.filter(
    (s) => availStatus(availability, user.id, s.id) !== "unknown"
  ).length;
  const remaining = weekShifts.length - answered;

  const setStatus = (shift, status) => {
    const raw = availability[`${user.id}-${shift.id}`];
    actions.setAvailability(shift.id, user.id, status, typeof raw === "object" ? raw?.comment : "");
  };

  const setComment = (shift, comment) => {
    const status = availStatus(availability, user.id, shift.id);
    actions.setAvailability(shift.id, user.id, status === "unknown" ? "available" : status, comment);
  };

  const markAll = (status) => {
    for (const s of weekShifts) {
      if (availStatus(availability, user.id, s.id) === "unknown") setStatus(s, status);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("guard.nav.availability")}
        subtitle="סמן באילו משמרות אתה יכול לעבוד — זה מה שהשיבוץ מסתמך עליו"
      />

      <Segmented
        value={offset}
        onChange={setOffset}
        options={[
          { value: 0, label: "השבוע" },
          { value: 1, label: "שבוע הבא" },
          { value: 2, label: "עוד שבועיים" },
        ]}
      />

      {weekShifts.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="אין משמרות בשבוע הזה"
          body={`האחמ"ש עדיין לא הגדיר משמרות ל${rangeLabelHe(weekDates)}. נסה שבוע אחר או חזור מאוחר יותר.`}
        />
      ) : (
        <>
          {weekStarted ? (
            <Alert tone="warn" title="השבוע הזה כבר התחיל">
              לא ניתן לשנות זמינות. פנה לאחמ״ש אם משהו השתנה.
            </Alert>
          ) : pastDeadline ? (
            <Alert
              tone={user.deadlineExempt ? "info" : "danger"}
              title={user.deadlineExempt ? "המועד חלף — אבל אושר לך להגיש" : "המועד להגשה חלף"}
            >
              {deadlineLabel} ({countdownHe(deadline)}).{" "}
              {user.deadlineExempt
                ? 'האחמ״ש פתח לך את ההגשה באופן אישי, אפשר להמשיך כרגיל.'
                : "עדיין אפשר להגיש, אבל ייתכן שהאחמ״ש כבר בנה את הסידור — עדכן אותו."}
            </Alert>
          ) : (
            // Urgency escalates on its own as the deadline closes. A guard who
            // opens the app the night before should not have to work out from a
            // date whether that is soon.
            <Alert
              tone={hoursLeft <= 24 ? "warn" : "info"}
              title={hoursLeft <= 24 ? "ההגשה נסגרת בקרוב" : undefined}
              icon={hoursLeft <= 24 ? "bell" : undefined}
            >
              יש להגיש עד {deadlineLabel} — <b>{countdownHe(deadline)}</b>
              {remaining > 0 && ` · נותרו ${remaining} משמרות ללא מענה`}
            </Alert>
          )}

          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* בלי min-w-0: הטקסט קצר וקבוע, ולא צריך הגנת truncate. עם
                * min-w-0 הדפדפן היה מרשה לתיבה הזו להתכווץ עד כמעט אפס
                * במקום לגלוש לשורה שנייה — שני כפתורי ה"סמן הכל" (טקסט
                * ארוך, בלי flex-shrink) היו סופגים את כל הרוחב, ומשאירים
                * ל"ענית על 1 מתוך 14 משמרות" ~38px ברוחב טלפון, שגורם לכל
                * מילה להישבר לשורה משלה. */}
              <div className="flex-1">
                <p className="text-sm font-semibold text-content">
                  ענית על {answered} מתוך {weekShifts.length} משמרות
                </p>
                <div className="max-w-[240px] mt-2">
                  <Meter
                    value={answered}
                    max={weekShifts.length}
                    height={8}
                    label="התקדמות ההגשה"
                  />
                </div>
              </div>
              {!weekStarted && answered < weekShifts.length && (
                <div className="flex gap-2 flex-wrap">
                  <Btn size="sm" variant="outline" icon="check-circle" onClick={() => markAll("available")} disabled={busy}>
                    סמן הכל כזמין
                  </Btn>
                  <Btn size="sm" variant="outline" icon="x-circle" onClick={() => markAll("unavailable")} disabled={busy}>
                    סמן הכל כלא זמין
                  </Btn>
                </div>
              )}
            </div>
            {/* Without this, "מעדיף" reads as a stronger "זמין" and everyone
                picks it. Saying out loud that it costs nothing and grants no
                guarantee is what keeps the signal meaningful. */}
            <p className="text-xs text-muted mt-3 pt-3 border-t border-hairline flex items-start gap-2">
              <Icon name="star" size={13} className="text-brand mt-0.5 shrink-0" />
              <span>
                <b className="text-content">מעדיף</b> = אני פנוי, ואם אפשר הייתי שמח דווקא למשמרת הזו.
                זה לא סוגר לך שום אופציה ולא מבטיח שיבוץ — זה רק מכריע בין שני שומרים שממילא פנויים.
              </span>
            </p>
          </Card>

          <div className="space-y-6">
            {weekDates.map((date) => {
              const day = weekShifts.filter((s) => s.date === date);
              if (!day.length) return null;
              return (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <h2 className="text-sm font-bold text-content glass px-3 py-1.5 rounded-lg">
                      {dayName(date)}
                    </h2>
                    <span className="text-xs text-muted">{formatDateHe(date)}</span>
                    <div className="flex-1 h-px bg-hairline" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {day.map((s) => {
                      const raw = availability[`${user.id}-${s.id}`];
                      const status = availStatus(availability, user.id, s.id);
                      const comment = typeof raw === "object" ? raw?.comment || "" : "";
                      const meta = AVAIL[status];
                      return (
                        <Card
                          key={s.id}
                          className="p-4"
                          style={{ borderRightColor: s.color, borderRightWidth: 6 }}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                            <div className="min-w-0">
                              <h3 className="font-bold text-base text-content">{s.label}</h3>
                              <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                                <span data-numeric>
                                  {s.startTime}–{s.endTime}
                                </span>
                                <Icon name="map-pin" size={11} />
                                {s.location}
                              </p>
                            </div>
                            {meta && (
                              <Badge tone={meta.tone} icon={meta.icon}>
                                {meta.label}
                              </Badge>
                            )}
                          </div>

                          <div
                            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                            role="radiogroup"
                            aria-label={`זמינות ל${s.label} ב${formatDateHe(s.date)}`}
                          >
                            {AVAIL_CHOICES.map((val) => {
                              const m = AVAIL[val];
                              const on = status === val;
                              const toneCls = {
                                preferred: on
                                  ? "bg-brand text-on-brand ring-brand"
                                  : "text-brand ring-brand/25 hover:bg-brand/10",
                                available: on
                                  ? "bg-accent text-on-accent ring-accent"
                                  : "text-accent ring-accent/25 hover:bg-accent/10",
                                maybe: on
                                  ? "bg-warn text-white ring-warn"
                                  : "text-warn ring-warn/25 hover:bg-warn/10",
                                unavailable: on
                                  ? "bg-danger text-white ring-danger"
                                  : "text-danger ring-danger/25 hover:bg-danger/10",
                              }[val];
                              return (
                                <button
                                  key={val}
                                  role="radio"
                                  aria-checked={on}
                                  disabled={weekStarted || busy}
                                  onClick={() => setStatus(s, val)}
                                  className={`h-11 rounded-xl text-xs font-bold ring-1 ring-inset cursor-pointer
                                    flex items-center justify-center gap-1.5
                                    transition-[background,color,box-shadow] duration-200
                                    disabled:opacity-40 disabled:cursor-not-allowed ${toneCls}`}
                                >
                                  <Icon name={m.icon} size={14} strokeWidth={2.25} />
                                  {m.short}
                                </button>
                              );
                            })}
                          </div>

                          <Input
                            type="text"
                            placeholder="הערה לאחמ״ש (אופציונלי)…"
                            aria-label={`הערה על ${s.label}`}
                            disabled={weekStarted}
                            defaultValue={comment}
                            onBlur={(e) => e.target.value !== comment && setComment(s, e.target.value)}
                            className="mt-3 h-10 text-xs"
                          />
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// SWAPS
// ============================================================

function MySwaps({ user, guards, shifts, availability = {}, swapRequests, actions, busy, tasks = [] }) {
  // Agreeing to cover a shift runs the same hard constraints the engine runs,
  // so a guard cannot accept a shift that would break their own rest rule.
  // Not narrowed to a week — same reasoning as the supervisor's SwapMgmt.
  //
  // guard is resolved from the full `guards` prop, not built as a synthetic
  // {id} object: checkAssignment now reads qualifiedCategories off the guard
  // (03-01/03-02), and a missing field reads as "unrestricted" by design
  // (default-allow) — so a bare {id} would have silently approved every
  // swap regardless of the real person's qualifications, while SwapMgmt
  // (views.jsx), which already resolves the full record, would correctly
  // refuse the identical request. Same shape and wording as SwapMgmt's
  // legality function, so the two screens' refusals are interchangeable.
  const legality = (r) => {
    const shift = shifts.find((x) => x.id === r.shiftId);
    const guard = guards.find((g) => g.id === r.toGuard);
    if (!shift || !guard) {
      return { ok: false, reason: "המשמרת או המאבטח כבר לא קיימים" };
    }
    return checkAssignment({ guard, shift, shifts, availability, tasks });
  };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ shiftId: "", toGuard: "", message: "" });
  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const myShifts = shifts.filter((s) => s.assignedGuards.includes(user.id) && s.date >= todayISO());
  const sent = swapRequests.filter((r) => r.fromGuard === user.id);
  const incoming = swapRequests.filter((r) => r.toGuard === user.id);

  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "—";
  const shiftOf = (id) => shifts.find((s) => s.id === id);

  const submit = async () => {
    if (!form.shiftId || !form.toGuard) return;
    await actions.createSwap({
      shiftId: form.shiftId,
      fromGuard: user.id,
      toGuard: form.toGuard,
      message: form.message,
    });
    setForm({ shiftId: "", toGuard: "", message: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="בקשות החלפה"
        subtitle="בקש ממישהו אחר לקחת משמרת שלך"
        actions={
          <Btn icon="plus" onClick={() => setShowForm(true)} disabled={!myShifts.length}>
            בקשה
          </Btn>
        }
      />

      {!myShifts.length && !sent.length && !incoming.length && (
        <EmptyState
          icon="swap"
          title="אין לך משמרות להחליף"
          body="אחרי שתשובץ למשמרת בסידור שפורסם, תוכל לבקש מחבר לצוות להחליף אותך."
        />
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="font-bold text-content mb-2.5 flex items-center gap-2">
            <Icon name="inbox" size={17} className="text-muted" />
            בקשות אליך
          </h2>
          <div className="space-y-2.5">
            {incoming.map((r) => {
              const s = shiftOf(r.shiftId);
              const status = SWAP_STATUS[r.status];
              // מחושב פעם אחת, לא פעמיים (disabled + title) — ובעיקר: לא
              // רק title. tooltip ב-hover לא קיים בטלפון, ופה בדיוק אמורים
              // להיות רוב המשתמשים (ראו הערת ה-nav התחתון בקומפוננטה הזו).
              // כפתור "מסכים" אפור בלי שום הסבר גלוי הוא בדיוק מה שהמוצר
              // הזה אמור לעולם לא לעשות.
              const check = r.status === "pending" ? legality(r) : { ok: true };
              return (
                <Card key={r.id} className={r.status === "pending" ? "!border-warn/30" : "opacity-70"}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-content">
                        {nameOf(r.fromGuard)} מבקש שתחליף אותו
                      </p>
                      {s && (
                        <p className="text-xs text-muted mt-0.5">
                          {formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}
                        </p>
                      )}
                      {r.message && (
                        <p className="text-xs text-muted mt-1 flex items-center gap-1">
                          <Icon name="message" size={12} />
                          {r.message}
                        </p>
                      )}
                      {r.status === "pending" && !check.ok && (
                        <p className="text-xs text-warn mt-1.5 flex items-start gap-1">
                          <Icon name="alert" size={13} className="mt-0.5 flex-shrink-0" />
                          <span>אי אפשר להסכים: {check.reason}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {r.status === "pending" && (
                        <>
                          <Btn
                            size="sm"
                            variant="accent"
                            icon="check"
                            onClick={() => actions.decideSwap(r, "approved")}
                            disabled={busy || !check.ok}
                          >
                            מסכים
                          </Btn>
                          <Btn
                            size="sm"
                            variant="danger"
                            icon="x"
                            onClick={() => actions.decideSwap(r, "rejected")}
                            disabled={busy}
                          >
                            לא
                          </Btn>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {sent.length > 0 && (
        <section>
          <h2 className="font-bold text-content mb-2.5 flex items-center gap-2">
            <Icon name="send" size={17} className="text-muted" />
            הבקשות שלך
          </h2>
          <div className="space-y-2.5">
            {sent.map((r) => {
              const s = shiftOf(r.shiftId);
              const status = SWAP_STATUS[r.status];
              return (
                <Card key={r.id}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-content">בקשה ל{nameOf(r.toGuard)}</p>
                      {s && (
                        <p className="text-xs text-muted mt-0.5">
                          {formatDateHe(s.date)} · {s.label} {s.startTime}–{s.endTime}
                        </p>
                      )}
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="בקשת החלפה"
        footer={
          <>
            <Btn
              onClick={submit}
              loading={busy}
              className="flex-1"
              disabled={!form.shiftId || !form.toGuard}
            >
              שלח בקשה
            </Btn>
            <Btn variant="secondary" onClick={() => setShowForm(false)}>
              ביטול
            </Btn>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="המשמרת שלי">
            <Select value={form.shiftId} onChange={field("shiftId")}>
              <option value="">בחר משמרת</option>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {shortDate(s.date)} — {s.label} {s.startTime}–{s.endTime}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="לבקש מ">
            <Select value={form.toGuard} onChange={field("toGuard")}>
              <option value="">בחר שומר</option>
              {guards
                .filter((g) => g.id !== user.id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="סיבה (אופציונלי)">
            <Input value={form.message} onChange={field("message")} placeholder="אירוע משפחתי…" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SHELL
// ============================================================

export default function GuardApp({ state }) {
  const {
    user, team, guards, shifts, availability, swapRequests, tasks, positions, actions, busy, error,
    clearError, logout, offline,
  } = state;
  const [view, setView] = useState("schedule");
  const profile = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const NAV = useMemo(() => navItems(), [profile]);

  // Nobody on the roster matched this name, so a fresh profile was made. That
  // is right for a genuinely new guard and wrong for a typo — and the two look
  // identical from here. Only the guard knows which, so ask them while they
  // can still fix it, rather than letting a stray second entry sit in the
  // supervisor's roster unnoticed.
  const [nameNoticeSeen, setNameNoticeSeen] = useState(false);
  const showNameNotice = user.isNewProfile && !nameNoticeSeen;

  const incoming = swapRequests.filter(
    (r) => r.toGuard === user.id && r.status === "pending"
  ).length;

  const views = {
    schedule: (
      <MySchedule user={user} guards={guards} shifts={shifts} tasks={tasks} positions={positions} />
    ),
    availability: (
      <MyAvailability
        user={user}
        team={team}
        shifts={shifts}
        availability={availability}
        actions={actions}
        busy={busy}
      />
    ),
    swaps: (
      <MySwaps
        user={user}
        guards={guards}
        shifts={shifts}
        availability={availability}
        swapRequests={swapRequests}
        actions={actions}
        busy={busy}
        tasks={tasks}
      />
    ),
  };

  return (
    <div className="app-canvas flex flex-col h-[100dvh]" dir="rtl">
      <header className="flex-shrink-0 glass rounded-none border-x-0 border-t-0 safe-top">
        <div className="flex items-center justify-between gap-2 px-4 py-3 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar id={user.id} name={user.name} size={38} />
            <div className="min-w-0">
              <p className="font-bold text-sm text-content truncate">{user.name}</p>
              <p className="text-muted text-[11px]">
                מאבטח · {team?.name || "צוות"}{" "}
                <span className="font-mono">{user.teamCode}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            <button
              onClick={logout}
              className="text-muted hover:text-danger text-sm px-3 h-11 rounded-xl hover:bg-danger/10 cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Icon name="logout" size={16} />
              <span className="hidden sm:inline">יציאה</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-3 sm:p-5 pb-24 space-y-5">
          {error && (
            <Alert tone="danger" onClose={clearError}>
              {error}
            </Alert>
          )}
          {offline && (
            <Alert tone="warn" title="אין חיבור — מוצג הסידור האחרון שנטען">
              אפשר לקרוא הכול. שינויים לא יישמרו עד שהרשת תחזור.
            </Alert>
          )}
          {showNameNotice && (
            <Alert tone="warn" onClose={() => setNameNoticeSeen(true)}>
              <b>נרשמת בתור "{user.name}" — פרופיל חדש.</b>{" "}
              אם האחמ״ש כבר הוסיף אותך לצוות, ייתכן שהשם נכתב קצת אחרת. במקרה כזה
              צא וכנס שוב עם השם המדויק שהוא רשם, אחרת המשמרות שלך יגיעו לרשומה השנייה.
              אם זו הפעם הראשונה שלך — הכל תקין, אפשר להתעלם.
            </Alert>
          )}
          {views[view]}
        </div>
      </div>

      {/* Bottom tab bar — guards are on phones, not laptops. */}
      <nav aria-label="ניווט ראשי" className="flex-shrink-0 glass rounded-none border-x-0 border-b-0 safe-bottom">
        <div className="flex max-w-3xl mx-auto">
          {NAV.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] relative
                  cursor-pointer transition-colors duration-200 ${
                    active ? "text-brand" : "text-muted hover:text-content"
                  }`}
              >
                <Icon name={item.icon} size={21} />
                <span className="text-[10px] font-semibold">{item.label}</span>
                {item.badge && incoming > 0 && (
                  <span className="absolute top-1.5 left-1/2 mr-4 bg-danger text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {incoming}
                  </span>
                )}
                {active && <span className="absolute top-0 inset-x-4 h-0.5 bg-brand rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
