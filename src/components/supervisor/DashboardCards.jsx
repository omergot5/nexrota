import { Btn, Card, Meter, guardColor, readableInk } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { dutyRoleLabel, markedName } from "../../lib/dutyRoles.js";
import { formatDateHe, rangeLabelHe, shiftPartName, splitShiftLabel } from "../../lib/dates.js";

// ============================================================
// שני הכרטיסים שדף הבקרה פותח בהם: איפה השבוע עומד, ומי על מה עכשיו.
// כל המספרים מגיעים מוכנים מ-weekStatus.js (טהור ונבדק) — כאן רק ציור.
// ============================================================

// "150 מתוך 152" כשלושה פריטים בשורה, לא כמחרוזת אחת: בטקסט רציף סדר הספרות
// ב-RTL מתהפך (152 מתוך 150), ובשורת flex הסדר תמיד כמו בקריאה בעברית.
function Frac({ a, b, suffix }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span>{a}</span>
      <span>מתוך</span>
      <span>{b}</span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

function Row({ label, done, total, text, tone }) {
  const complete = total > 0 && done >= total;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-sm font-semibold text-content flex items-center gap-1.5">
          <Icon
            name={complete ? "check-circle" : "clock"}
            size={15}
            className={complete ? "text-accent" : "text-muted"}
          />
          {label}
        </span>
        <span className={`text-sm font-bold ${complete ? "text-accent" : tone || "text-content"}`}>
          {text}
        </span>
      </div>
      <Meter value={done} max={Math.max(1, total)} height={6} label={label} color={complete ? "rgb(var(--accent))" : undefined} />
    </div>
  );
}

/**
 * "השבוע הזה": שלושה שלבים (דיווח, שיבוץ, פרסום) וצעד אחד מומלץ. הכפתור מוביל
 * ישר לשלב הנכון בבניית השבוע — לא למסך הפתיחה שלה.
 */
export function WeekStatusCard({ status, weekDates, openTasks = 0, onNavigate, soldiers }) {
  const { reported, slots, published, next } = status;
  const allDone = next.id === "done";
  return (
    <Card className={allDone ? "" : "!ring-brand/30"}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-bold text-content flex items-center gap-2">
            <Icon name="calendar" size={18} className="text-brand" />
            השבוע הזה
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {rangeLabelHe(weekDates)} · {status.shiftCount} תורנויות
          </p>
        </div>
        {allDone ? (
          <span className="text-sm font-bold text-accent inline-flex items-center gap-1.5">
            <Icon name="check-circle" size={16} /> הכול מוכן
          </span>
        ) : (
          <Btn icon="left" onClick={() => onNavigate(next.id)}>
            {next.label}
          </Btn>
        )}
      </div>

      <div className="space-y-3.5">
        <Row
          label="דיווחו זמינות"
          done={reported.done}
          total={reported.total}
          text={<Frac a={reported.done} b={reported.total} suffix={soldiers} />}
        />
        <Row
          label="מקומות מאוישים"
          done={slots.filled}
          total={slots.need}
          text={<Frac a={slots.filled} b={slots.need} />}
          tone={slots.assigned > 0 ? "text-warn" : undefined}
        />
        <Row
          label="פורסם לצוות"
          done={published.done}
          total={published.total}
          text={published.done === 0 ? "טיוטה" : <Frac a={published.done} b={published.total} />}
        />
      </div>

      {openTasks > 0 && (
        <p className="text-xs text-warn font-semibold mt-4 pt-3 border-t border-hairline">
          {openTasks === 1 ? "משימה אחת פתוחה השבוע" : `${openTasks} משימות פתוחות השבוע`}
        </p>
      )}
    </Card>
  );
}

const MAX_POSTS = 5;

/**
 * מי על מה: עמדה ← משמרות לפי שעה, בלי שבבים ובלי אוואטרים — שמות מלאים, כי
 * זו השאלה "מי אצלי בעמדה 2 בערב". קטוע בכוונה ל-MAX_POSTS עמדות; השאר ביומן.
 */
export function FocusDayCard({ focus, guards, onNavigate }) {
  if (!focus) {
    return (
      <Card>
        <h2 className="font-bold text-content mb-4 flex items-center gap-2">
          <Icon name="calendar" size={17} className="text-muted" />
          המשמרות הקרובות
        </h2>
        <p className="text-muted text-sm text-center py-8">אין משמרות מתוכננות</p>
      </Card>
    );
  }
  const groups = [];
  for (const s of focus.shifts) {
    const post = splitShiftLabel(s.label || "").post || s.label || "משמרת";
    const last = groups[groups.length - 1];
    if (last && last.post === post) last.shifts.push(s);
    else groups.push({ post, shifts: [s] });
  }
  const nameOf = (id) => guards.find((g) => g.id === id)?.name;
  const shown = groups.slice(0, MAX_POSTS);
  const hidden = groups.length - shown.length;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-content flex items-center gap-2">
          <Icon name="calendar" size={17} className="text-muted" />
          {focus.isToday ? "היום, עמדה אחרי עמדה" : "המשמרות הקרובות"}
        </h2>
        <span className="text-xs text-muted font-semibold">{formatDateHe(focus.date)}</span>
      </div>

      <div className="space-y-3.5">
        {shown.map((group) => (
          <section key={group.post} aria-label={group.post}>
            <h3 className="text-[13px] font-extrabold text-content mb-1">{group.post}</h3>
            <ul className="space-y-1">
              {group.shifts.map((s) => {
                const ids = s.assignedGuards || [];
                const lacking = Math.max(0, (s.requiredGuards || 1) - ids.length);
                return (
                  <li key={s.id} className="flex items-baseline gap-2 text-[13px]">
                    <span className="w-[4.5rem] flex-shrink-0 text-muted font-semibold">{shiftPartName(s) || "משמרת"}</span>
                    <span className="min-w-0 flex-1 text-content flex flex-wrap items-center gap-1">
                      {ids.map((id) => {
                        const name = nameOf(id);
                        if (!name) return null;
                        const c = guardColor(id);
                        const who = guards.find((g) => g.id === id);
                        // הצבע הוא של האדם — אותו צבע בכל מסך ובתמונה שנשלחת. השם תמיד כתוב עליו.
                        return (
                          <span
                            key={id}
                            className="px-2 py-0.5 rounded-md text-[12px] font-bold"
                            style={{ background: c, color: readableInk(c) }}
                            title={who?.dutyRole ? dutyRoleLabel(who.dutyRole) : undefined}
                          >
                            {markedName(who, name)}
                          </span>
                        );
                      })}
                      {ids.length === 0 && <span className="text-faint">עוד לא שובץ</span>}
                      {lacking > 0 && ids.length > 0 && (
                        <span className="text-warn font-bold inline-flex items-center gap-0.5 mr-2">
                          <Icon name="alert" size={11} />
                          {lacking === 1 ? "חסר 1" : `חסרים ${lacking}`}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-faint">{hidden > 0 ? `ועוד ${hidden} עמדות` : ""}</span>
        <Btn variant="ghost" size="sm" icon="left" onClick={() => onNavigate("calendar")}>
          ליומן המלא
        </Btn>
      </div>
    </Card>
  );
}
