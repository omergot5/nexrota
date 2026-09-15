import { useEffect, useMemo, useState } from "react";
import { SHIFT_TONES } from "../../design/shiftPalette.js";
import { Alert, Avatar, Btn, Field, Input, Select, Textarea } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { formatDateHe, isSingleDayTask, shiftHours } from "../../lib/dates.js";
import { isQualified } from "../../lib/autoAssign.js";
import { explainConflict, findConflicts } from "../../lib/conflicts.js";
import { categoryOptions, folderIcon, UNFILED } from "../../lib/categories.js";
import { t } from "../../lib/terms.js";

// ============================================================
// שלב 7 (מחזור האיחוד) — טופס פריט-עבודה אחד, מוטמע inline (לא Modal),
// שיוצר או עורך גם משמרת וגם משימה. עד עכשיו ShiftMgmt ו-TaskMgmt נשאו כל
// אחד טופס Modal נפרד ומשוכפל-בערכיו (אותם דפוסי שדה-תאריך/קטגוריה,
// שתי מימושים). מאז שלב 0 שניהם באמת אותה טבלה (gs_work_items, kind
// 'shift'|'task') — הטופס הזה הוא המקום היחיד שיוצר אחת מהן.
//
// `kind` נבחר בטופס עצמו (לא רק פרופ קשיח מההורה): לוחצים "משמרת" מתוך
// מסך המשמרות בציפייה ליצור משמרת, אבל שום דבר לא מונע לעבור ל"משימה"
// מתוך אותו טופס בדיוק — זו בדיוק הנקודה של איחוד הישויות. עריכה שונה:
// אי אפשר להפוך משמרת קיימת למשימה במקום (הן חיות בשתי מערכים נפרדים
// ברמת האפליקציה, ר' api.js), אז המתג נעול כש-`editing` קיים.
//
// בדיקת התנגשות/כשירות (החלטה 1, QUAL-04/05) שייכת רק ל"משימה" — משמרת
// מעולם לא בדקה זאת בטופס היצירה שלה (השיבוץ עצמו קורה בשלב אחר), וזה
// לא שלב 7 שמחליט להרחיב את זה.
// ============================================================

const SHIFT_TEMPLATES = [
  { key: "day12", label: "יום 07:00–19:00", startTime: "07:00", endTime: "19:00", type: "morning", color: SHIFT_TONES.morning },
  { key: "night12", label: "לילה 19:00–07:00", startTime: "19:00", endTime: "07:00", type: "night", color: SHIFT_TONES.night },
  { key: "morning", label: "בוקר 07:00–15:00", startTime: "07:00", endTime: "15:00", type: "morning", color: SHIFT_TONES.morning },
  { key: "noon", label: "צהריים 15:00–23:00", startTime: "15:00", endTime: "23:00", type: "afternoon", color: SHIFT_TONES.afternoon },
  { key: "night8", label: "לילה 23:00–07:00", startTime: "23:00", endTime: "07:00", type: "night", color: SHIFT_TONES.night },
];

const TASK_TITLE_EXAMPLE = { security: "בדיקת ציוד אבטחה", restaurant: "בדיקת מלאי", army: "בדיקת ציוד" };
const OVERRIDE_NOTE_EXAMPLE = {
  security: "עמדה ריקה באותה שעה, אין בפועל חפיפה",
  restaurant: "המטבח סגור באותן שעות, אז אין חפיפה בפועל",
  army: "עמדה ריקה באותה שעה, אין בפועל חפיפה",
};

const blankShift = (weekDates, defaultDate) => ({
  date: defaultDate || weekDates[0], startTime: "07:00", endTime: "19:00", label: "משמרת יום",
  location: "כניסה ראשית", requiredGuards: 1, type: "morning", color: SHIFT_TONES.morning,
  category: "",
});

const blankTask = (weekDates, defaultCategory) => ({
  title: "", description: "", category: defaultCategory || UNFILED, assignees: [],
  priority: "medium", startDate: weekDates[0], dueDate: weekDates[6] || weekDates[0],
  overrideNote: "", startTime: "", endTime: "",
});

/**
 * רצועת קטגוריות — שבבים לחיצים במקום שדה טקסט+datalist. "ללא קטגוריה"
 * (ערך "") מוצג רק למשמרת (D-03: משמרת בלי סוג עבודה פתוחה לכולם, סמנטיקה
 * שונה מ"כללי" של משימה, שהיא תיקייה נייטרלית ולא "אין קטגוריה").
 */
function CategoryStrip({ value, onChange, options, allowNone = false }) {
  const [customOpen, setCustomOpen] = useState(false);
  const known = allowNone ? ["", ...options] : options;
  const isKnown = known.includes(value);

  return (
    <div className="flex flex-wrap gap-2">
      {known.map((name) => {
        const active = value === name;
        return (
          <button
            key={name || "__none__"}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setCustomOpen(false);
              onChange(name);
            }}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer
              ring-1 ring-inset transition-colors duration-200 ${
                active
                  ? "bg-brand text-on-brand ring-brand"
                  : "bg-surface-sunken ring-hairline text-muted hover:text-content"
              }`}
          >
            <Icon name={name ? folderIcon(name) : "x"} size={13} />
            {name || "ללא קטגוריה"}
          </button>
        );
      })}
      {customOpen || !isKnown ? (
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="שם קטגוריה חדשה"
          className="h-9 w-40 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer
            border border-dashed border-hairline text-faint hover:text-muted"
        >
          <Icon name="plus" size={13} />
          אחר
        </button>
      )}
    </div>
  );
}

export default function WorkItemForm({
  open, onClose, kind: initialKind, editing, weekDates, guards, shifts = [], tasks = [],
  mode = "security", actions, busy, defaultDate, defaultCategory,
}) {
  const [kind, setKind] = useState(initialKind);
  const [form, setForm] = useState(() =>
    initialKind === "shift" ? blankShift(weekDates, defaultDate) : blankTask(weekDates, defaultCategory)
  );
  const [override, setOverride] = useState(false);

  // נטען מחדש בכל פתיחה — עריכה מתחילה מהפריט הקיים, יצירה חדשה מהריק
  // המתאים ל-kind. לא useMemo: זו אתחול-מצב מכוון, לא נגזרת.
  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    if (editing && initialKind === "shift") {
      setForm({ ...editing });
    } else if (editing && initialKind === "task") {
      setForm({
        title: editing.title, description: editing.description, category: editing.category || UNFILED,
        assignees: editing.assignees || [], priority: editing.priority,
        startDate: editing.startDate || "", dueDate: editing.dueDate || "",
        overrideNote: editing.overrideNote || "",
        startTime: editing.startTime || "", endTime: editing.endTime || "",
      });
      setOverride(Boolean(editing.overrideNote));
    } else {
      setForm(initialKind === "shift" ? blankShift(weekDates, defaultDate) : blankTask(weekDates, defaultCategory));
      setOverride(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, initialKind]);

  const field = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const changeKind = (next) => {
    if (editing) return; // המתג נעול בעריכה — ר' הערת הכותרת.
    setKind(next);
    setForm(next === "shift" ? blankShift(weekDates, defaultDate) : blankTask(weekDates, defaultCategory));
  };

  const toggleAssignee = (id) =>
    setForm((f) => ({
      ...f,
      assignees: f.assignees.includes(id) ? f.assignees.filter((x) => x !== id) : [...f.assignees, id],
    }));

  const applyTemplate = (tpl) =>
    setForm((f) => ({
      ...f,
      startTime: tpl.startTime, endTime: tpl.endTime, type: tpl.type, color: tpl.color,
      label: tpl.type === "night" ? "משמרת לילה" : tpl.type === "afternoon" ? "משמרת צהריים" : "משמרת יום",
    }));

  // ---- החלטה 1: בדיקת חפיפה, רק למשימה (ר' הערת הכותרת) ----
  const conflicts = useMemo(
    () =>
      kind === "task"
        ? findConflicts({ candidate: { ...form, id: editing?.id }, assignees: form.assignees, tasks, shifts })
        : [],
    [kind, form, editing, tasks, shifts]
  );
  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "מישהו";
  const blocked = conflicts.length > 0 && (!override || !form.overrideNote.trim());
  const unqualifiedAssignees =
    kind === "task"
      ? (form.assignees || []).map((id) => guards.find((g) => g.id === id)).filter((g) => g && !isQualified(g, form.category))
      : [];
  const qualBlocked = unqualifiedAssignees.length > 0;
  const showHours = kind === "task" && isSingleDayTask(form);
  const hoursInvalid = kind === "task" && showHours && Boolean(form.startTime) !== Boolean(form.endTime);

  const canSave = kind === "shift" ? Boolean(form.date && form.startTime && form.endTime) : Boolean(form.title.trim()) && !blocked && !hoursInvalid && !qualBlocked;

  const save = async () => {
    if (!canSave) return;
    if (kind === "shift") {
      if (editing) await actions.updateShift(editing.id, form);
      else await actions.addShifts([form]);
    } else {
      const clean =
        form.startDate && form.dueDate && form.startDate > form.dueDate
          ? { ...form, startDate: form.dueDate, dueDate: form.startDate }
          : form;
      const withHours = isSingleDayTask(clean) ? clean : { ...clean, startTime: "", endTime: "" };
      const withNote = { ...withHours, overrideNote: conflicts.length ? withHours.overrideNote : "" };
      if (editing) await actions.editTask(editing.id, withNote);
      else await actions.createTask(withNote);
    }
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    if (kind === "shift") await actions.deleteShift(editing.id);
    else await actions.deleteTask(editing.id);
    onClose();
  };

  if (!open) return null;

  const categories = categoryOptions(shifts, tasks, mode);

  return (
    <div className="rounded-2xl ring-1 ring-inset ring-brand/30 bg-surface p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["shift", "task"].map((k) => (
            <button
              key={k}
              type="button"
              disabled={Boolean(editing)}
              onClick={() => changeKind(k)}
              aria-pressed={kind === k}
              className={`flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-sm font-bold cursor-pointer
                ring-1 ring-inset transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${
                  kind === k
                    ? "bg-brand text-on-brand ring-brand"
                    : "bg-surface-sunken ring-hairline text-muted hover:text-content"
                }`}
            >
              <Icon name={k === "shift" ? "calendar" : "clipboard"} size={15} />
              {k === "shift" ? "משמרת" : "משימה"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full text-faint hover:text-content hover:bg-surface-hover cursor-pointer"
          aria-label="סגור"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-content mb-2">קטגוריה</p>
        <CategoryStrip
          value={form.category}
          onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          options={categories}
          allowNone={kind === "shift"}
        />
      </div>

      {kind === "shift" ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-content mb-2">תבניות מהירות</p>
            <div className="flex flex-wrap gap-2">
              {SHIFT_TEMPLATES.map((tpl) => {
                const active = form.startTime === tpl.startTime && form.endTime === tpl.endTime;
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    aria-pressed={active}
                    className={`px-3 h-9 rounded-lg text-xs font-medium ring-1 ring-inset cursor-pointer transition-colors duration-200 ${
                      active
                        ? "bg-brand text-on-brand ring-brand"
                        : "bg-surface-sunken ring-hairline text-muted hover:text-content hover:ring-brand/40"
                    }`}
                  >
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך">
              <Select value={form.date} onChange={field("date")}>
                {weekDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateHe(d)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="תווית">
              <Input value={form.label} onChange={field("label")} />
            </Field>
            <Field label="שעת התחלה">
              <Input type="time" value={form.startTime} onChange={field("startTime")} />
            </Field>
            <Field label="שעת סיום">
              <Input type="time" value={form.endTime} onChange={field("endTime")} />
            </Field>
            <Field label="מיקום">
              <Input value={form.location} onChange={field("location")} />
            </Field>
            <Field label={`${t("noun.memberPlural")} נדרשים`}>
              <Input
                type="number"
                min="1"
                max="10"
                value={form.requiredGuards}
                onChange={(e) => setForm((f) => ({ ...f, requiredGuards: Number(e.target.value) }))}
              />
            </Field>
          </div>
          <p className="text-xs text-muted">
            אורך המשמרת:{" "}
            {shiftHours({ date: form.date, startTime: form.startTime, endTime: form.endTime })} שעות
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="כותרת">
            <Input
              value={form.title}
              onChange={field("title")}
              placeholder={TASK_TITLE_EXAMPLE[mode] || TASK_TITLE_EXAMPLE.security}
              autoFocus
            />
          </Field>

          <Field label="תיאור" hint="אופציונלי">
            <Input value={form.description} onChange={field("description")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="מתאריך">
              <Input type="date" value={form.startDate || ""} onChange={field("startDate")} />
            </Field>
            <Field label="עד תאריך">
              <Input type="date" value={form.dueDate || ""} onChange={field("dueDate")} />
            </Field>
          </div>

          {showHours ? (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="משעה" error={hoursInvalid && !form.startTime ? "חסרה שעת התחלה" : undefined}>
                  <Input type="time" value={form.startTime} onChange={field("startTime")} />
                </Field>
                <Field label="עד שעה" error={hoursInvalid && !form.endTime ? "חסרה שעת סיום" : undefined}>
                  <Input type="time" value={form.endTime} onChange={field("endTime")} />
                </Field>
              </div>
              <p className="text-xs text-faint mt-1.5">
                משימה עם שעות נספרת במנוחה, ברצף, בתקרה השבועית ובנטל — בדיוק כמו משמרת.
              </p>
            </div>
          ) : (
            <p className="text-xs text-faint">שדות שעה זמינים כשתאריך ההתחלה ותאריך הסיום של המשימה זהים.</p>
          )}

          <Field label="עדיפות">
            <Select value={form.priority} onChange={field("priority")}>
              <option value="high">גבוהה</option>
              <option value="medium">בינונית</option>
              <option value="low">נמוכה</option>
            </Select>
          </Field>

          <Field label="מי מבצע" hint={form.assignees.length ? `${form.assignees.length} נבחרו` : "אפשר לבחור כמה"}>
            <div className="flex flex-wrap gap-2">
              {guards.map((g) => {
                const on = form.assignees.includes(g.id);
                const qualified = isQualified(g, form.category);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleAssignee(g.id)}
                    disabled={!qualified}
                    aria-pressed={on}
                    title={qualified ? undefined : `לא מוגדר/ת כשיר/ה לקטגוריית "${form.category}"`}
                    className={`flex items-center gap-2 h-11 pr-1.5 pl-3 rounded-xl cursor-pointer
                      ring-1 ring-inset transition-colors duration-200
                      disabled:opacity-70 disabled:cursor-not-allowed ${
                        on
                          ? "bg-brand/12 ring-brand/45 text-content"
                          : !qualified
                          ? "ring-hairline-strong bg-surface-sunken text-muted"
                          : "bg-surface-sunken ring-hairline text-muted hover:text-content"
                      }`}
                  >
                    <Avatar id={g.id} name={g.name} size={26} />
                    <span className="text-sm font-medium">{g.name}</span>
                    {!qualified ? (
                      <span className="flex items-center gap-1 text-[11px]">
                        <Icon name="lock" size={13} strokeWidth={2.5} />
                        לא כשיר/ה
                      </span>
                    ) : (
                      on && <Icon name="check" size={14} className="text-brand" strokeWidth={3} />
                    )}
                  </button>
                );
              })}
            </div>
          </Field>

          {qualBlocked && (
            <div className="rounded-2xl ring-1 ring-inset ring-danger/40 bg-danger/10 p-3.5">
              <div className="flex items-start gap-2">
                <Icon name="lock" size={17} className="text-danger flex-shrink-0 mt-0.5" />
                <p className="text-sm text-content">
                  <span className="font-bold">{unqualifiedAssignees.map((g) => g.name).join(", ")}</span>{" "}
                  לא כשירים לקטגוריית "{form.category}" — אי אפשר לשמור את המשימה עד שהם יוסרו מרשימת
                  המבצעים. אין דרך לעקוף את זה.
                </p>
              </div>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="rounded-2xl ring-1 ring-inset ring-warn/40 bg-warn/10 p-3.5 space-y-3">
              <div className="flex items-start gap-2">
                <Icon name="alert" size={17} className="text-warn flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-bold text-content text-sm">
                    {conflicts.length === 1 ? "שיבוץ אחד מתנגש" : `${conflicts.length} שיבוצים מתנגשים`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {conflicts.map((c) => (
                      <li key={`${c.personId}-${c.taskId}`} className="text-xs text-muted">
                        {explainConflict(c, nameOf)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                  className="w-4 h-4 accent-[rgb(var(--warn))] cursor-pointer"
                />
                <span className="text-sm font-semibold text-content">אני יודע — שבץ בכל זאת</span>
              </label>

              {override && (
                <Field
                  label="למה"
                  hint="חובה. ההסבר נשמר, ומגיע גם לאנשים המשובצים"
                  error={form.overrideNote.trim() ? undefined : "בלי סיבה אי אפשר לעקוף"}
                >
                  <Textarea
                    rows={2}
                    value={form.overrideNote}
                    onChange={field("overrideNote")}
                    placeholder={OVERRIDE_NOTE_EXAMPLE[mode] || OVERRIDE_NOTE_EXAMPLE.security}
                    autoFocus
                  />
                </Field>
              )}
            </div>
          )}
        </div>
      )}

      {kind === "task" && conflicts.length === 0 && form.overrideNote && (
        <Alert tone="info">נימוק עקיפה קודם נשמר על הפריט הזה; הוא יימחק כי אין יותר התנגשות.</Alert>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Btn onClick={save} loading={busy} disabled={!canSave} className="flex-1">
          {qualBlocked ? "יש חוסר כשירות" : blocked ? "יש התנגשות" : editing ? "שמור" : kind === "shift" ? "צור משמרת" : "צור משימה"}
        </Btn>
        {editing && (
          <Btn variant="danger" icon="trash" onClick={remove} disabled={busy}>
            מחק
          </Btn>
        )}
        <Btn variant="secondary" onClick={onClose} disabled={busy}>
          ביטול
        </Btn>
      </div>
    </div>
  );
}
