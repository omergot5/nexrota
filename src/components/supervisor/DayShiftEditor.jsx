// ============================================================
// עריכת תורנות של יום אחד — לחיצה על תא בשבוע.
//
// העמדה (gs_positions) מגדירה את התבנית לכל השבוע; לפעמים יום אחד שונה:
// ביום שישי הסיור מתחיל מאוחר, בשבת צריך רק 5 בכוננות. כאן משנים את
// השורה של היום הזה בלבד (gs_work_items) — התבנית ושאר הימים לא זזים,
// ומימוש-השבוע (ensurePositionsForWeek) לא דורס אותה, כי הוא רק משלים
// ימים חסרים.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Alert, Avatar, Btn, CountField, Field, IconBtn, Input, Modal } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import TimeField from "../TimeField.jsx";
import { addDays, dayName, formatDateHe, shiftDisplayName, shiftHours, shortDate } from "../../lib/dates.js";
import { availStatus, checkAssignment, DEFAULT_RULES, teamRules } from "../../lib/autoAssign.js";
import { isAfterMidnight } from "../../lib/postWeek.js";
import { t } from "../../lib/terms.js";

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * "יום ראשון, 11 באוקטובר" — ולמשמרת שמתחילה אחרי חצות, הלילה שהיא שייכת
 * אליו: "ליל ראשון–שני (12/10, 00:00)". אחרת מי שלחץ על תא הלילה בעמודת
 * ראשון היה רואה פה "יום שני" ומתבלבל איזה לילה הוא עורך.
 */
function whenLabel(shift) {
  if (!isAfterMidnight(shift.startTime)) return formatDateHe(shift.date);
  const eve = addDays(shift.date, -1);
  return `ליל ${dayName(eve)}–${dayName(shift.date)} (${shortDate(shift.date)}, ${shift.startTime})`;
}

// מצב הזמינות בלשון שהמפקד קורא — ליד שם האדם ברשימת ההוספה.
const AVAIL_WORD = {
  preferred: "ביקש/ה את המשמרת",
  available: "זמין/ה",
  maybe: "אולי",
  unknown: "לא הגיש/ה",
  unavailable: "סימן/ה לא זמין/ה",
};
const AVAIL_RANK = { preferred: 0, available: 1, maybe: 2, unknown: 3, unavailable: 4 };

/**
 * מי משובץ בתורנות הזו, עם הסרה והוספה במקום. ההוספה עוברת באותה בדיקה
 * בדיוק שמסך "אסדר בעצמי" עושה (checkAssignment עם כללי הצוות): מי שחסום —
 * כשירות, חפיפה, מנוחה, זמינות, תקרה — מופיע ברשימה עם הסיבה ולא ניתן
 * לבחירה. כך שיבוץ ידני כאן לא יכול לעקוף חוק שהמנוע לא עוקף (עקרון ברזל 2).
 * הכתיבה מיידית (optimistic עם rollback), בלי קשר ל"שמור ליום הזה" שלמטה,
 * שנוגע רק בשעות ובכמות.
 */
function PeopleSection({ shift, guards, shifts, availability, tasks, team, onToggle, busy }) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const rules = useMemo(() => teamRules(team), [team]);

  const assignedIds = shift.assignedGuards || [];
  const assigned = assignedIds.map((id) => guards.find((g) => g.id === id)).filter(Boolean);
  const required = Math.max(1, shift.requiredGuards || 1);

  const candidates = useMemo(() => {
    if (!adding) return [];
    const q = query.trim();
    return guards
      .filter((g) => !assignedIds.includes(g.id) && (!q || g.name.includes(q)))
      .map((guard) => ({
        guard,
        status: availStatus(availability, guard.id, shift.id),
        legality: checkAssignment({ guard, shift, shifts, availability, tasks, rules }),
      }))
      .sort(
        (a, b) =>
          Number(b.legality.ok) - Number(a.legality.ok) ||
          AVAIL_RANK[a.status] - AVAIL_RANK[b.status] ||
          a.guard.name.localeCompare(b.guard.name, "he")
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding, query, guards, shifts, availability, tasks, rules, shift, assignedIds.join()]);

  return (
    <Field label={`${t("noun.memberPlural")} משובצים · ${assigned.length}/${required}`}>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {assigned.length === 0 && <span className="text-[12px] text-faint py-1">עוד לא שובץ אף אחד</span>}
          {assigned.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1.5 pr-1 pl-0.5 py-0.5 rounded-full bg-surface-sunken ring-1 ring-inset ring-hairline"
            >
              <Avatar id={g.id} name={g.name} size={22} />
              <span className="text-[12.5px] font-semibold text-content">{g.name}</span>
              <IconBtn icon="x" size="sm" label={`הסר את ${g.name}`} disabled={busy} className="!h-7 !w-7 !rounded-full" onClick={() => onToggle(shift.id, g.id)} />
            </span>
          ))}
          <Btn size="sm" variant={adding ? "secondary" : "outline"} icon={adding ? "check" : "plus"} onClick={() => setAdding((v) => !v)}>
            {adding ? "סיימתי" : "הוסף"}
          </Btn>
        </div>

        {adding && (
          <div className="rounded-xl ring-1 ring-inset ring-hairline p-2 space-y-1.5">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש לפי שם" aria-label="חיפוש לפי שם" />
            <div className="max-h-56 overflow-auto space-y-1">
              {candidates.length === 0 && (
                <p className="text-center text-[12px] text-faint py-3">אין מי להוסיף</p>
              )}
              {candidates.map(({ guard, status, legality }) => (
                <button
                  key={guard.id}
                  type="button"
                  disabled={busy || !legality.ok}
                  onClick={() => onToggle(shift.id, guard.id)}
                  className="w-full flex items-center gap-2 p-1.5 rounded-lg text-right cursor-pointer ring-1 ring-inset ring-hairline
                    hover:ring-hairline-strong transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Avatar id={guard.id} name={guard.name} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-content truncate">{guard.name}</span>
                    {!legality.ok && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Icon name="lock" size={10} /> {legality.reason}
                      </span>
                    )}
                  </span>
                  <span className={`text-[11px] flex-shrink-0 ${status === "preferred" ? "text-accent font-bold" : "text-faint"}`}>
                    {AVAIL_WORD[status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/**
 * @param {object|null} shift המשמרת שנלחצה; null = סגור
 * @param {(shift: object) => Promise} onSave מקבל את המשמרת המלאה עם השינויים
 * @param {(shift: object) => void} [onCancelDay] ביטול התורנות ביום הזה בלבד
 * @param {(shiftId: string, guardId: string) => void} [onToggleAssignment] כשמועבר,
 *   מופיע גם ניהול האנשים של התורנות (הסרה והוספה). בלעדיו החלון נשאר שעות וכמות בלבד.
 */
export default function DayShiftEditor({
  shift, onClose, onSave, onCancelDay, longShiftCategories = [], busy,
  guards = [], shifts = [], availability = {}, tasks = [], team, onToggleAssignment,
}) {
  const [form, setForm] = useState(null);

  // טופס חדש לכל משמרת שנפתחת — לא שאריות מהמשמרת הקודמת.
  useEffect(() => {
    setForm(
      shift ? { startTime: shift.startTime, endTime: shift.endTime, requiredGuards: shift.requiredGuards || 1 } : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift?.id]);

  if (!shift || !form) return null;

  const required = Math.max(1, Math.round(Number(form.requiredGuards) || 1));
  const hours =
    form.startTime && form.endTime ? shiftHours({ date: shift.date, startTime: form.startTime, endTime: form.endTime }) : 0;
  const maxBlock = DEFAULT_RULES.maxConsecutiveHours;
  const assigned = (shift.assignedGuards || []).length;
  const changed =
    form.startTime !== shift.startTime || form.endTime !== shift.endTime || required !== (shift.requiredGuards || 1);
  const members = t("noun.memberPlural");

  const save = async () => {
    await onSave({ ...shift, startTime: form.startTime, endTime: form.endTime, requiredGuards: required });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={shiftDisplayName(shift)}
      subtitle={`${whenLabel(shift)} · השינוי חל רק על היום הזה`}
      footer={
        <>
          <Btn className="flex-1" onClick={save} loading={busy} disabled={!changed || !form.startTime || !form.endTime}>
            שמור ליום הזה
          </Btn>
          {onCancelDay && (
            // מחיקת פריט בודד — UndoBar של 8 שניות, לא אישור מראש (עקרון ברזל 3).
            <Btn
              variant="ghost"
              icon="trash"
              onClick={() => {
                onCancelDay(shift);
                onClose();
              }}
            >
              בטל ביום הזה
            </Btn>
          )}
          <Btn variant="secondary" onClick={onClose}>
            סגור
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 items-start">
          <Field label="התחלה">
            <TimeField label="שעת התחלה" value={form.startTime} onChange={(v) => setForm((f) => ({ ...f, startTime: v }))} />
          </Field>
          <Field label="סיום">
            <TimeField label="שעת סיום" value={form.endTime} onChange={(v) => setForm((f) => ({ ...f, endTime: v }))} />
          </Field>
        </div>

        <Field label={`${members} נדרשים`}>
          <CountField
            label={`${members} נדרשים`}
            value={form.requiredGuards}
            onChange={(v) => setForm((f) => ({ ...f, requiredGuards: v }))}
          />
        </Field>

        {onToggleAssignment && (
          <PeopleSection
            shift={shift}
            guards={guards}
            shifts={shifts}
            availability={availability}
            tasks={tasks}
            team={team}
            onToggle={onToggleAssignment}
            busy={busy}
          />
        )}

        {hours > maxBlock && !longShiftCategories.includes(shift.category) && (
          <Alert tone="warn">
            {`${round1(hours)} שעות ברצף — יותר מ-${maxBlock}. השיבוץ האוטומטי לא ישבץ לתורנות הזו אף אחד, אלא אם הקטגוריה מסומנת ב"משמרות ארוכות" בהגדרות הצוות.`}
          </Alert>
        )}
        {assigned > required && (
          <Alert tone="warn">
            {`כבר משובצים ${assigned} — אחרי השמירה צריך להוריד ${assigned - required} מהתורנות.`}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
