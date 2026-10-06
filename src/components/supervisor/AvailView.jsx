// ============================================================
// "מי דיווח" — מי הגיש זמינות לשבוע, ומי עוד צריך תזכורת.
//
// שתי שאלות, לפי הסדר שהמפקד שואל אותן:
//   1. כמה הגישו ומי לא — וכפתור תזכורת. התזכורת לא נשלחת מהאפליקציה: היא
//      פותחת וואטסאפ עם נוסח מוכן (לכל אחד בנפרד, או לקבוצה), והמפקד לוחץ
//      "שלח" בעצמו. במקביל החייל רואה באנר באפליקציה שלו עד שיגיש
//      (GuardApp, ReportBanner) — אותו availStatus, אז שני המסכים לא חלוקים.
//   2. מה כל אחד ענה — לכל יום טבלה אחת, והעמודות בסדר של בניית השבוע: כותרת
//      לכל עמדה ומתחתיה משמרותיה (בוקר, צהריים, ערב, לילה). סימון: V / X /
//      מקף ("לא ענה"), אף פעם לא צבע בלבד.
// ============================================================

import { useMemo, useState, useSyncExternalStore } from "react";
import { Alert, Avatar, Badge, Btn, Card, EmptyState, Meter, PageHeader } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { AVAIL } from "../../design/availability.js";
import { availStatus } from "../../lib/autoAssign.js";
import { availabilityDeadline, countdownHe, formatDateHe, rangeLabelHe, shiftPartName, splitShiftLabel } from "../../lib/dates.js";
import { opDayOf, orderShiftsByPost } from "../../lib/postWeek.js";
import { deadlineLabelHe, guardsWhoHaveNotReported, reminderText, whatsappLink } from "../../lib/reminders.js";
import { subscribeTerms, t, termProfile } from "../../lib/terms.js";

/** V / X / אולי / מקף — אייקון ותווית נגישה, לא צבע לבדו. */
function Mark({ status, comment }) {
  if (status === "unknown") {
    return (
      <span className="text-faint" role="img" aria-label="לא ענה">
        —
      </span>
    );
  }
  const meta = AVAIL[status];
  return (
    <span className={`inline-flex items-center gap-0.5 ${meta.cls}`} title={comment || meta.label}>
      <Icon name={meta.icon} size={17} label={meta.label} />
      {comment && <Icon name="message" size={10} className="text-muted" />}
    </span>
  );
}

export default function AvailView({ guards = [], shifts = [], availability = {}, weekDates = [], embedded = false, team }) {
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const [copied, setCopied] = useState(false);

  // לפי היום המבצעי (opDayOf): משמרת שמתחילה אחרי חצות יושבת תחת היום הקודם,
  // כמו בגריד של בניית השבוע — אחרת "ליל ראשון" היה מופיע כעמודה של יום שני.
  const weekShifts = useMemo(() => shifts.filter((s) => weekDates.includes(opDayOf(s))), [shifts, weekDates]);
  const missing = useMemo(
    () => guardsWhoHaveNotReported({ guards, shifts, availability, weekDates }),
    [guards, shifts, availability, weekDates]
  );
  const reported = guards.length - missing.length;
  const missingIds = new Set(missing.map((g) => g.id));

  const deadline = useMemo(() => availabilityDeadline(weekDates[0], team), [weekDates, team]);
  const range = rangeLabelHe(weekDates);
  // קוד הצוות נושא כל פרופיל (profileFromRow) — לא שדה של team.
  const base = { range, deadline: deadlineLabelHe(deadline), teamCode: team?.code || guards[0]?.teamCode };

  const copyGroupText = async () => {
    try {
      await navigator.clipboard.writeText(reminderText({ ...base, names: missing.map((g) => g.name) }));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ההעתקה נחסמה (http, או הרשאה) — הכפתור של וואטסאפ עדיין עובד */
    }
  };

  const header = (
    <PageHeader
      title={embedded ? null : t("nav.availability")}
      subtitle={`${range} · ${reported} מתוך ${guards.length} הגישו`}
    />
  );

  if (!weekShifts.length) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon="calendar"
          title={`אין ${t("unit.shifts")} בשבוע הזה`}
          body={`בנה ${t("unit.shifts")} בשלב "${t("nav.shifts")}", ואז ${t("noun.memberPlural")} יוכלו להגיש זמינות.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[14rem]">
            <p className="text-sm font-semibold text-content" data-numeric>
              {reported} מתוך {guards.length} {t("noun.memberPlural")} הגישו
            </p>
            <div className="max-w-xs mt-2">
              <Meter value={reported} max={Math.max(guards.length, 1)} height={8} label="התקדמות ההגשה" />
            </div>
          </div>
          <p className="text-xs text-muted">
            ההגשה נסגרת {deadlineLabelHe(deadline)} · <b className="text-content">{countdownHe(deadline)}</b>
          </p>
        </div>
      </Card>

      {guards.length > 0 &&
        (missing.length === 0 ? (
          <Alert tone="accent">כל ה{t("noun.memberPlural")} הגישו זמינות — השיבוץ יהיה מדויק ככל האפשר.</Alert>
        ) : (
          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <h3 className="text-[14px] font-extrabold text-content flex items-center gap-1.5">
                  <Icon name="bell" size={15} className="text-warn" />
                  עוד לא הגישו · <span data-numeric>{missing.length}</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  אצל כל אחד מהם מופיע באנר באפליקציה עד שיגיש. אפשר להזכיר גם בוואטסאפ.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={whatsappLink({ text: reminderText({ ...base, names: missing.map((g) => g.name) }) })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-bold cursor-pointer
                    bg-accent text-on-accent hover:bg-accent-strong transition-colors"
                >
                  <Icon name="send" size={14} />
                  תזכורת בוואטסאפ
                </a>
                <Btn size="sm" variant="outline" icon={copied ? "check" : "copy"} onClick={copyGroupText}>
                  {copied ? "הועתק" : "העתק הודעה"}
                </Btn>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {missing.map((g) => (
                <li
                  key={g.id}
                  className="inline-flex items-center gap-1.5 pr-1 pl-2.5 py-1 rounded-full bg-surface-sunken ring-1 ring-inset ring-hairline"
                >
                  <Avatar id={g.id} name={g.name} size={22} />
                  <span className="text-[12.5px] font-semibold text-content">{g.name}</span>
                  {g.phone && (
                    <a
                      href={whatsappLink({ phone: g.phone, text: reminderText({ ...base, name: g.name.split(" ")[0] }) })}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`שלח תזכורת ל${g.name} בוואטסאפ`}
                      title="תזכורת אישית בוואטסאפ"
                      className="text-muted hover:text-accent transition-colors cursor-pointer"
                    >
                      <Icon name="send" size={13} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {weekDates.map((date) => {
        const dayShifts = orderShiftsByPost(weekShifts.filter((s) => opDayOf(s) === date), mode);
        if (!dayShifts.length) return null;

        // כותרת לכל עמדה, מעל המשמרות שלה — רצף העמודות כבר ממוין לפי עמדה.
        const groups = [];
        for (const s of dayShifts) {
          const post = splitShiftLabel(s.label || "").post || s.label;
          const last = groups[groups.length - 1];
          if (last && last.post === post) last.shifts.push(s);
          else groups.push({ post, shifts: [s] });
        }

        return (
          <Card key={date} className="overflow-x-auto">
            <h3 className="font-bold text-content mb-3">{formatDateHe(date)}</h3>
            <table className="w-full text-sm border-collapse">
              <caption className="sr-only">זמינות ה{t("noun.memberPlural")} ל{formatDateHe(date)}</caption>
              <thead>
                <tr>
                  <th rowSpan={2} scope="col" className="sticky right-0 z-10 bg-surface text-right py-2 px-3 font-medium text-muted align-bottom">
                    {t("noun.member")}
                  </th>
                  {groups.map((g) => (
                    <th
                      key={g.post}
                      scope="colgroup"
                      colSpan={g.shifts.length}
                      className="text-center py-1.5 px-2 text-[12px] font-extrabold text-content border-r border-hairline bg-surface-sunken/50"
                    >
                      {g.post}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-hairline">
                  {dayShifts.map((s, i) => {
                    const startsGroup = i === 0 || splitShiftLabel(dayShifts[i - 1].label || "").post !== splitShiftLabel(s.label || "").post;
                    return (
                      <th
                        key={s.id}
                        scope="col"
                        className={`text-center py-1.5 px-2 font-medium text-muted min-w-[4.5rem] ${startsGroup ? "border-r border-hairline" : ""}`}
                      >
                        <div className="text-[11.5px] font-bold">{shiftPartName(s) || "משמרת"}</div>
                        <div className="text-[10px] font-normal text-faint" dir="ltr" data-numeric>
                          {s.startTime}–{s.endTime}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {guards.map((g) => (
                  <tr key={g.id} className="border-b border-hairline last:border-0">
                    <th scope="row" className="sticky right-0 z-10 bg-surface py-2 px-3 text-right font-normal whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Avatar id={g.id} name={g.name} size={22} />
                        <span className="font-medium text-content text-xs">{g.name}</span>
                        {missingIds.has(g.id) && (
                          <Badge tone="warn" icon="bell">
                            לא הגיש
                          </Badge>
                        )}
                      </div>
                    </th>
                    {dayShifts.map((s, i) => {
                      const raw = availability[`${g.id}-${s.id}`];
                      const comment = typeof raw === "object" ? raw?.comment : "";
                      const startsGroup = i === 0 || splitShiftLabel(dayShifts[i - 1].label || "").post !== splitShiftLabel(s.label || "").post;
                      return (
                        <td key={s.id} className={`py-2 px-2 text-center ${startsGroup ? "border-r border-hairline" : ""}`}>
                          <Mark status={availStatus(availability, g.id, s.id)} comment={comment} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        );
      })}
    </div>
  );
}
