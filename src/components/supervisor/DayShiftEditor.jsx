// ============================================================
// עריכת תורנות של יום אחד — לחיצה על תא בשבוע.
//
// העמדה (gs_positions) מגדירה את התבנית לכל השבוע; לפעמים יום אחד שונה:
// ביום שישי הסיור מתחיל מאוחר, בשבת צריך רק 5 בכוננות. כאן משנים את
// השורה של היום הזה בלבד (gs_work_items) — התבנית ושאר הימים לא זזים,
// ומימוש-השבוע (ensurePositionsForWeek) לא דורס אותה, כי הוא רק משלים
// ימים חסרים.
// ============================================================

import { useEffect, useState } from "react";
import { Alert, Btn, CountField, Field, Modal } from "../ui.jsx";
import TimeField from "../TimeField.jsx";
import { formatDateHe, shiftDisplayName, shiftHours } from "../../lib/dates.js";
import { DEFAULT_RULES } from "../../lib/autoAssign.js";
import { t } from "../../lib/terms.js";

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {object|null} shift המשמרת שנלחצה; null = סגור
 * @param {(shift: object) => Promise} onSave מקבל את המשמרת המלאה עם השינויים
 */
export default function DayShiftEditor({ shift, onClose, onSave, busy }) {
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
      subtitle={`${formatDateHe(shift.date)} · השינוי חל רק על היום הזה`}
      footer={
        <>
          <Btn className="flex-1" onClick={save} loading={busy} disabled={!changed || !form.startTime || !form.endTime}>
            שמור ליום הזה
          </Btn>
          <Btn variant="secondary" onClick={onClose}>
            ביטול
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

        {hours > maxBlock && (
          <Alert tone="warn">
            {`${round1(hours)} שעות ברצף — יותר מ-${maxBlock}. השיבוץ האוטומטי לא ישבץ לתורנות הזו אף אחד, אלא אם מעלים את "מקסימום שעות רצופות" בכללים.`}
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
