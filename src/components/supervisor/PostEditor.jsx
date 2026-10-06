// ============================================================
// עורך עמדה — חלון אחד לעמדה ולכל המשמרות שלה.
//
// עמדה חדשה: שם, קטגוריה, ימים, וכמה משמרות ביום — 1 (שעות חופשיות), או
// חלוקה שווה של 24 שעות ל-2/3/4 שמתחילה בבוקר (06:00 כברירת מחדל). מתחת
// לשדות רואים בדיוק אילו משמרות ייווצרו.
//
// עמדה קיימת: שם, קטגוריה, ימים וכמות חלים על כל המשמרות שלה; השעות —
// לכל משמרת בנפרד, ואפשר להוסיף או להסיר משמרת. מה שהשתנה בתבנית מסתנכרן
// גם למשמרות שכבר נוצרו בשבוע (planTemplateSync, postWeek.js).
//
// העורך לא כותב לשרת: הוא מחזיר תוכנית {create, update, remove} והקורא
// (RosterWizard) מאשר מחיקות ושולח — כך כלל הפרה-אישור למחיקת עמדה נשאר
// במקום אחד.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Alert, Btn, CountField, Field, Input, Modal, Select } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import TimeField from "../TimeField.jsx";
import { DAYS_HE_SHORT, minutesOfTime, shiftHours, shiftPartName } from "../../lib/dates.js";
import { DEFAULT_RULES } from "../../lib/autoAssign.js";
import { postBlocks } from "../../lib/postWeek.js";
import { t } from "../../lib/terms.js";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const PER_DAY = [
  { value: 1, label: "משמרת אחת" },
  { value: 2, label: "2 × 12 שעות" },
  { value: 3, label: "3 × 8 שעות" },
  { value: 4, label: "4 × 6 שעות" },
  { value: "weekly", label: "כל השבוע, בלי שעות" },
];

const hoursOf = (b) => (b.startTime && b.endTime ? shiftHours({ date: "2026-01-04", startTime: b.startTime, endTime: b.endTime }) : 0);
const sameDays = (a = [], b = []) => [...a].sort().join() === [...b].sort().join();
const fromMorning = (b) => (minutesOfTime(b.startTime || "00:00") - 300 + 1440) % 1440;

function initialForm(target, categories) {
  if (target?.post) {
    const { post } = target;
    const blocks = post.blocks.filter((b) => b.positionId);
    const first = blocks[0]?.position || {};
    return {
      editing: true,
      weekly: Boolean(post.weekly),
      name: post.post,
      category: post.category || first.category || categories[0] || "",
      weekdays: post.weekly ? [] : first.weekdays || ALL_DAYS,
      requiredGuards: post.requiredGuards ?? first.requiredGuards ?? 1,
      blocks: blocks.map((b) => ({ positionId: b.positionId, position: b.position, startTime: b.startTime, endTime: b.endTime })),
      removed: [],
    };
  }
  const seed = target?.seed || {};
  return {
    editing: false,
    weekly: false,
    name: seed.title || "",
    category: seed.category || categories[0] || "",
    weekdays: seed.weekdays || ALL_DAYS,
    requiredGuards: seed.requiredGuards || 1,
    perDay: seed.perDay || 1,
    firstStart: "06:00",
    start: seed.startTime || "06:00",
    end: seed.endTime || "14:00",
  };
}

/**
 * @param {{post?: object, seed?: object} | null} target null = סגור; {post} = עריכה; {seed} או {} = עמדה חדשה
 * @param {(plan: {create: object[], update: object[], remove: string[], summary: string}) => Promise} onSubmit
 */
export default function PostEditor({ target, onClose, onSubmit, onDelete, categories = [], longShiftCategories = [], busy }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    setForm(target ? initialForm(target, categories) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const preview = useMemo(() => {
    if (!form || form.editing || form.weekly || form.perDay === "weekly") return [];
    return postBlocks({ name: form.name || "עמדה", perDay: form.perDay, firstStart: form.firstStart, start: form.start, end: form.end });
  }, [form]);

  if (!target || !form) return null;

  const isWeekly = form.weekly || form.perDay === "weekly";
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleDay = (d) =>
    set({ weekdays: form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort((a, b) => a - b) });

  // המשמרות כפי שייראו אחרי השמירה (לבדיקות ולתצוגה).
  const finalBlocks = form.editing
    ? [...form.blocks].sort((a, b) => fromMorning(a) - fromMorning(b))
    : preview;
  const required = Math.max(1, Math.round(Number(form.requiredGuards) || 1));
  const maxBlock = DEFAULT_RULES.maxConsecutiveHours;
  // האזהרה היחידה בעורך: משמרת ארוכה מהרצף המותר שהמנוע לעולם לא יאייש.
  // פער מנוחה מול עמדה אחרת לא מוצג כאן — המנוע פשוט לא ישבץ את אותו חייל
  // לשתיהן, ועם הרבה עמדות האזהרה הייתה מופיעה כמעט תמיד בלי שיש מה לעשות איתה.
  // קטגוריה שמותרת בה משמרת ארוכה (מטבח, כוננות — הגדרות הצוות) לא מקבלת אזהרה.
  const tooLong = !isWeekly && !longShiftCategories.includes(form.category) && finalBlocks.some((b) => hoursOf(b) > maxBlock);

  const invalid =
    !form.name.trim() ||
    !form.category ||
    (!isWeekly && (!form.weekdays.length || finalBlocks.some((b) => !b.startTime || !b.endTime) || !finalBlocks.length));

  const titleFor = (i, count) => (count > 1 ? `${form.name.trim()} – משמרת ${i + 1}` : form.name.trim());

  const submit = async () => {
    if (invalid) return;
    const name = form.name.trim();
    const common = { category: form.category, requiredGuards: required, active: true };
    let plan;
    if (!form.editing) {
      plan = isWeekly
        ? { create: [{ ...common, title: name, shape: "weekly", weekdays: [] }], update: [], remove: [] }
        : {
            create: preview.map((b) => ({
              ...common,
              title: b.title,
              shape: "template",
              weekdays: form.weekdays,
              startTime: b.startTime,
              endTime: b.endTime,
            })),
            update: [],
            remove: [],
          };
    } else if (form.weekly) {
      const b = form.blocks[0];
      const after = { ...b.position, ...common, title: name };
      plan = { create: [], update: changed(b.position, after) ? [{ id: b.positionId, before: b.position, after }] : [], remove: [] };
    } else {
      const create = [];
      const update = [];
      finalBlocks.forEach((b, i) => {
        const fields = {
          ...common,
          title: titleFor(i, finalBlocks.length),
          shape: "template",
          weekdays: form.weekdays,
          startTime: b.startTime,
          endTime: b.endTime,
        };
        if (!b.positionId) create.push(fields);
        else {
          const after = { ...b.position, ...fields };
          if (changed(b.position, after)) update.push({ id: b.positionId, before: b.position, after });
        }
      });
      plan = { create, update, remove: form.removed };
    }
    await onSubmit({ ...plan, summary: name });
  };

  const footer = (
    <>
      <Btn className="flex-1" onClick={submit} loading={busy} disabled={invalid}>
        {form.editing ? "שמור" : "צור עמדה"}
      </Btn>
      <Btn variant="secondary" onClick={onClose}>
        ביטול
      </Btn>
    </>
  );

  return (
    <Modal open onClose={onClose} title={form.editing ? form.name || "עמדה" : "עמדה חדשה"} footer={footer}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <Field label="שם העמדה">
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder='למשל "עמדת שמירה 3"' autoFocus={!form.editing} />
          </Field>
          {form.editing && onDelete && (
            <Btn variant="ghost" icon="trash" onClick={() => onDelete(target.post)} aria-label="מחק את העמדה">
              מחק
            </Btn>
          )}
        </div>

        <Field label="קטגוריה">
          <Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        {!form.editing && (
          <Field label="משמרות ביום">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="משמרות ביום">
              {PER_DAY.map((o) => {
                const on = form.perDay === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ perDay: o.value })}
                    className={`h-9 px-3 rounded-lg text-[12.5px] font-bold cursor-pointer ring-1 ring-inset transition-colors ${
                      on ? "bg-brand text-on-brand ring-brand" : "bg-surface-sunken text-muted ring-hairline hover:text-content"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {!isWeekly && (
          <Field label="ימים">
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_HE_SHORT.map((label, d) => {
                const on = form.weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={on}
                    className={`w-9 h-9 rounded-lg text-[12.5px] font-bold cursor-pointer ring-1 ring-inset ${
                      on ? "bg-brand text-on-brand ring-brand" : "bg-surface-sunken text-muted ring-hairline"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {!form.editing && !isWeekly && form.perDay === 1 && (
          <div className="grid grid-cols-2 gap-3 items-start">
            <Field label="התחלה">
              <TimeField label="שעת התחלה" value={form.start} onChange={(v) => set({ start: v })} />
            </Field>
            <Field label="סיום">
              <TimeField label="שעת סיום" value={form.end} onChange={(v) => set({ end: v })} />
            </Field>
          </div>
        )}

        {!form.editing && !isWeekly && form.perDay > 1 && (
          <Field label="המשמרת הראשונה מתחילה ב">
            <div className="max-w-[11rem]">
              <TimeField label="תחילת המשמרת הראשונה" value={form.firstStart} onChange={(v) => set({ firstStart: v })} />
            </div>
          </Field>
        )}

        {form.editing && !form.weekly && (
          <Field label="המשמרות">
            <div className="space-y-2">
              {finalBlocks.map((b) => {
                const index = form.blocks.indexOf(b);
                const update = (patch) =>
                  setForm((f) => ({ ...f, blocks: f.blocks.map((x, i) => (i === index ? { ...x, ...patch } : x)) }));
                return (
                  <div key={b.positionId || `new-${index}`} className="grid grid-cols-[4.5rem_1fr_1fr_auto] gap-2 items-start">
                    <span className="h-11 flex items-center text-[12.5px] font-bold text-content">{shiftPartName(b) || "משמרת"}</span>
                    <TimeField label={`${shiftPartName(b)} — התחלה`} value={b.startTime} onChange={(v) => update({ startTime: v })} />
                    <TimeField label={`${shiftPartName(b)} — סיום`} value={b.endTime} onChange={(v) => update({ endTime: v })} />
                    <button
                      type="button"
                      disabled={form.blocks.length <= 1}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          blocks: f.blocks.filter((_, i) => i !== index),
                          removed: b.positionId ? [...f.removed, b.positionId] : f.removed,
                        }))
                      }
                      aria-label={`הסר את משמרת ה${shiftPartName(b)}`}
                      className="h-11 w-11 flex items-center justify-center rounded-xl text-muted hover:text-danger hover:bg-surface-hover cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                );
              })}
              <Btn
                variant="ghost"
                size="sm"
                icon="plus"
                onClick={() => {
                  const last = finalBlocks[finalBlocks.length - 1];
                  const start = last?.endTime || "06:00";
                  const length = last ? Math.round(hoursOf(last) * 60) : 480;
                  const end = minutesToTime(minutesOfTime(start) + length);
                  setForm((f) => ({ ...f, blocks: [...f.blocks, { positionId: null, position: null, startTime: start, endTime: end }] }));
                }}
              >
                הוסף משמרת
              </Btn>
            </div>
          </Field>
        )}

        <Field label={isWeekly ? `${t("noun.memberPlural")} נדרשים` : `${t("noun.memberPlural")} בכל משמרת`}>
          <CountField
            label={`${t("noun.memberPlural")} נדרשים`}
            value={form.requiredGuards}
            onChange={(v) => set({ requiredGuards: v })}
          />
        </Field>

        {!form.editing && !isWeekly && preview.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="המשמרות שייווצרו">
            {preview.map((b) => (
              <span key={b.title} className="text-[11.5px] font-bold bg-accent/15 text-accent px-2 py-1 rounded-lg">
                {shiftPartName(b)}{" "}
                <span dir="ltr" data-numeric>
                  {b.startTime}–{b.endTime}
                </span>
              </span>
            ))}
          </div>
        )}

        {tooLong && (
          <Alert tone="warn">
            {`משמרת של יותר מ-${maxBlock} שעות ברצף — השיבוץ האוטומטי לא ישבץ אליה אף אחד. אם יש בה הפסקות, אפשר לסמן את "${form.category}" ב"משמרות ארוכות" בהגדרות הצוות.`}
          </Alert>
        )}
        {form.editing && form.removed.length > 0 && (
          <Alert tone="warn">
            {`${form.removed.length === 1 ? "משמרת אחת תימחק" : `${form.removed.length} משמרות יימחקו`} מהעמדה, יחד עם התורנויות שלהן מהשבוע הזה והלאה.`}
          </Alert>
        )}
      </div>
    </Modal>
  );
}

function changed(before, after) {
  return (
    before.title !== after.title ||
    before.category !== after.category ||
    (before.requiredGuards || 1) !== (after.requiredGuards || 1) ||
    before.startTime !== after.startTime ||
    before.endTime !== after.endTime ||
    !sameDays(before.weekdays || [], after.weekdays || [])
  );
}

function minutesToTime(m) {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}
