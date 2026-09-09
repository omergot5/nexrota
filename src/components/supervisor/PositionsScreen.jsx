// ============================================================
// עמדות קבועות — המסך הייעודי (Phase 4, POS-01/POS-05).
//
// מסך זה עוצר במכוון בגבול שנקבע ב-D-05: טופס הגדרה, רשימת עמדות, ובהמשך
// (Task 2) שתי הרשימות של POS-05 (מי כשיר / מי עובד השבוע) לכל עמדה. שום
// תצוגת לוז שרץ קדימה על פני שבועות — זו תחום פאזה 5, לא כאן.
//
// הטקסונומיה של הקטגוריות מגיעה מ-`categoryOptions` (views.jsx, D-01) ולא
// נבנית כאן מחדש: זה שדה הכשירות היחיד של העמדה (D-04), ומנהל שמצמצם
// כשירות בעורך של TeamView חייב לראות בדיוק את אותה רשימה כאן.
// ============================================================

import { useState, useSyncExternalStore } from "react";
import {
  Badge, Btn, Card, EmptyState, Field, IconBtn, Input, Modal, PageHeader, Segmented, Select,
} from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { DAYS_HE_SHORT, addDays, rangeLabelHe, shortDate, weekFrom } from "../../lib/dates.js";
import { subscribeTerms, t, termProfile } from "../../lib/terms.js";
import { categoryOptions } from "../../lib/categories.js";
import {
  missingRowsForWeek, plannedRowsForWeek, qualifiedGuardsForPosition, workingGuardIdsForWeek,
} from "../../lib/positions.js";

const emptyForm = (category) => ({
  title: "",
  shape: "template",
  category: category || "",
  weekdays: [],
  startTime: "08:00",
  endTime: "16:00",
  requiredGuards: 1,
  active: true,
});

const formFromPosition = (p) => ({
  title: p.title || "",
  shape: p.shape === "weekly" ? "weekly" : "template",
  category: p.category || "",
  weekdays: Array.isArray(p.weekdays) ? p.weekdays : [],
  startTime: p.startTime || "08:00",
  endTime: p.endTime || "16:00",
  requiredGuards: p.requiredGuards || 1,
  active: p.active !== false,
});

export default function PositionsScreen({
  positions = [], guards = [], shifts = [], tasks = [], weekDates = [], actions, busy,
}) {
  // תחום הפעילות מוחל מ-useGuardian (setTermProfile), לא מפרופ שהמסך הזה
  // לא מקבל — אותה קריאה בדיוק ש-ProfilePicker כבר משתמש בה (views.jsx).
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const categories = categoryOptions(shifts, tasks, mode);
  const [editing, setEditing] = useState(null); // "new" | position object | null
  const [form, setForm] = useState(null);

  const openNew = () => {
    setForm(emptyForm(categories[0]));
    setEditing("new");
  };

  const openEdit = (p) => {
    setForm(formFromPosition(p));
    setEditing(p);
  };

  const closeModal = () => {
    setEditing(null);
    setForm(null);
  };

  const toggleWeekday = (d) =>
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d)
        ? f.weekdays.filter((x) => x !== d)
        : [...f.weekdays, d].sort((a, b) => a - b),
    }));

  const invalid = !form?.title?.trim() || !form?.category;

  const save = async () => {
    if (invalid) return;
    // T-04-03 / ASVS V5: מסונן למספרים שלמים 0–6 בלי קשר לאיך שנבנה —
    // גם אם מקור אחר של הטופס אי-פעם יכניס ערך זר, הוא לא מגיע לשמירה.
    const cleanWeekdays = (form.weekdays || []).filter(
      (d) => Number.isInteger(d) && d >= 0 && d <= 6
    );
    const payload = {
      title: form.title.trim(),
      shape: form.shape,
      category: form.category,
      // עמדה שבועית לעולם אינה נשמרת עם ימים/שעות ממציאים — היא נפרשת על
      // השבוע כולו, ושדות שלא הוזנו לא צריכים ערך בדוי (04-02-PLAN Task 1).
      weekdays: form.shape === "template" ? cleanWeekdays : [],
      startTime: form.shape === "template" ? form.startTime || null : null,
      endTime: form.shape === "template" ? form.endTime || null : null,
      requiredGuards: Math.max(1, Number(form.requiredGuards) || 1),
      active: form.active !== false,
    };
    if (editing === "new") {
      await actions.addPosition(payload);
    } else if (editing) {
      await actions.updatePosition(editing.id, payload);
    }
    closeModal();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.positions")}
        subtitle="עמדה שמוגדרת פעם אחת וממשיכה לחזור לכל שבוע לבד"
        actions={
          <Btn icon="plus" onClick={openNew}>
            עמדה חדשה
          </Btn>
        }
      />

      {positions.length === 0 ? (
        <EmptyState
          icon="shield"
          title="אין עדיין עמדות קבועות"
          body='עמדה קבועה מוגדרת פעם אחת בטופס הזה, ומשם והלאה היא נכנסת לכל שבוע לבד — בלי לחזור לכאן ובלי כפתור "צור שבוע".'
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {positions.map((p) => (
            <PositionCard
              key={p.id}
              position={p}
              guards={guards}
              shifts={shifts}
              tasks={tasks}
              weekDates={weekDates}
              onEdit={() => openEdit(p)}
              onDelete={() => actions.deletePosition(p.id)}
            />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={closeModal}
        title={editing === "new" ? "עמדה חדשה" : `עריכת "${editing?.title || ""}"`}
        footer={
          <>
            <Btn onClick={save} loading={busy} disabled={invalid} className="flex-1">
              שמור
            </Btn>
            <Btn variant="secondary" onClick={closeModal}>
              ביטול
            </Btn>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <Field label="שם העמדה">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder='למשל "עמדת קבלה"'
                autoFocus
              />
            </Field>

            <Field label="צורת העמדה">
              <Segmented
                value={form.shape}
                onChange={(v) => setForm((f) => ({ ...f, shape: v }))}
                options={[
                  { value: "template", label: t("positions.shape.template") },
                  { value: "weekly", label: t("positions.shape.weekly") },
                ]}
              />
            </Field>

            <Field label="קטגוריה" hint="שדה הכשירות היחיד של העמדה — אותה טקסונומיה שמוצעת בטופס המשמרת ובעורך הכשירות">
              <Select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            {form.shape === "template" && (
              <>
                <Field label="ימים">
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_HE_SHORT.map((label, d) => {
                      const on = form.weekdays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleWeekday(d)}
                          aria-pressed={on}
                          className={`w-10 h-10 rounded-lg text-sm font-bold cursor-pointer
                            transition-colors duration-200 ring-1 ring-inset ${
                              on
                                ? "bg-brand text-on-brand ring-brand"
                                : "bg-surface-sunken text-muted ring-hairline hover:text-content"
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="שעת התחלה">
                    <Input
                      type="time"
                      value={form.startTime || ""}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    />
                  </Field>
                  <Field label="שעת סיום">
                    <Input
                      type="time"
                      value={form.endTime || ""}
                      onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    />
                  </Field>
                </div>
              </>
            )}

            <Field label="מספר נדרש" hint="כמה אנשים צריך בעמדה בו-זמנית">
              <Input
                type="number"
                min={1}
                value={form.requiredGuards}
                onChange={(e) => setForm((f) => ({ ...f, requiredGuards: e.target.value }))}
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4 rounded accent-brand cursor-pointer"
              />
              <span className="text-sm text-content">עמדה פעילה</span>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

/**
 * כרטיס עמדה יחיד: הגדרה + שתי הרשימות של POS-05.
 *
 * שתי הרשימות למטה נגזרות משתי פונקציות שונות ומשני שדות מקור שונים —
 * `qualifiedGuardsForPosition` קוראת `guard.qualifiedCategories`,
 * `workingGuardIdsForWeek` קוראת `assignedGuards`/`assignees` על שורות
 * שהתממשו. אין נתיב קוד אחד שבו רשימה אחת נגזרת מהשנייה (04-01-SUMMARY,
 * 04-RESEARCH.md Pitfall 2).
 */
function PositionCard({ position: p, guards, shifts, tasks, weekDates, onEdit, onDelete }) {
  const sundayISO = weekDates[0];
  const qualified = qualifiedGuardsForPosition(p, guards);

  // `workingGuardIdsForWeek` נותנת את קבוצת ה-ID; תאריך-העבודה של כל שם
  // נגזר כאן בנפרד, מאותם שדות בדיוק ומאותו `weekDates` שהמסך כבר מחזיק —
  // זו קיבוץ לתצוגה, לא מקור שני של אמת.
  const workingIds = new Set(workingGuardIdsForWeek(p, { shifts, tasks }, sundayISO));
  const weekSet = new Set(weekDates);
  const datesByGuard = new Map();
  for (const s of shifts) {
    if (s.positionId !== p.id || !weekSet.has(s.date)) continue;
    for (const gid of s.assignedGuards || []) {
      if (!datesByGuard.has(gid)) datesByGuard.set(gid, new Set());
      datesByGuard.get(gid).add(s.date);
    }
  }
  for (const task of tasks) {
    const d = task.dueDate || task.startDate;
    if (task.positionId !== p.id || !weekSet.has(d)) continue;
    for (const gid of task.assignees || []) {
      if (!datesByGuard.has(gid)) datesByGuard.set(gid, new Set());
      datesByGuard.get(gid).add(d);
    }
  }
  const working = [...workingIds].map((id) => ({
    id,
    name: guards.find((g) => g.id === id)?.name || "—",
    dates: [...(datesByGuard.get(id) || [])].sort(),
  }));

  // BOARD-02 — תחזית ארבעה שבועות קדימה (D-05), מורכבת מעל
  // plannedRowsForWeek/missingRowsForWeek בלבד — positions.js לא הורחב
  // (05-RESEARCH.md <board02_positions>). "ממומש" נגזר, לא מאוחסן: שורה
  // מתוכננת נחשבת ממומשת כשתאריך הזהות שלה (date || dueDate) נעדר
  // מתוצאת missingRowsForWeek לאותו שבוע — בדיוק אותו ביטוי ש-
  // missingRowsForWeek עצמה משתמשת בו, בלי כלל השוואה שני.
  const realizedRows = [...shifts, ...tasks];
  const forwardWeeks = Array.from({ length: 4 }, (_, n) => addDays(sundayISO, n * 7)).map((weekSunday) => {
    const planned = plannedRowsForWeek(p, weekSunday);
    const missingDates = new Set(
      missingRowsForWeek(p, weekSunday, realizedRows).map((row) => row.date || row.dueDate)
    );
    return {
      sunday: weekSunday,
      rows: planned.map((row) => ({ ...row, realized: !missingDates.has(row.date || row.dueDate) })),
    };
  });

  return (
    <Card className={!p.active ? "opacity-70" : ""}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-bold text-content flex items-center gap-2 flex-wrap">
            {p.title}
            {!p.active && <Badge tone="neutral">מושבתת</Badge>}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <Badge tone="brand" icon={p.shape === "template" ? "clock" : "calendar"}>
              {p.shape === "template" ? t("positions.shape.template") : t("positions.shape.weekly")}
            </Badge>
            <Badge tone="neutral">{p.category}</Badge>
          </div>
          {p.shape === "template" && (
            <p className="text-xs text-muted mt-2" data-numeric>
              {(p.weekdays || []).map((d) => DAYS_HE_SHORT[d]).join(" · ") || "אין ימים מוגדרים"}
              {p.startTime && p.endTime && ` · ${p.startTime}–${p.endTime}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <IconBtn icon="pencil" size="sm" label={`ערוך את ${p.title}`} onClick={onEdit} />
          <IconBtn
            icon="trash"
            size="sm"
            label={`מחק את ${p.title}`}
            className="hover:text-danger"
            onClick={onDelete}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-hairline">
        {/* רשימה א' — מי כשיר. קריאה בלבד: אין כפתור, אין תיבת סימון, ואין
          * שום דבר שנקרא כ"שייך אדם לעמדה" (D-04, POS-02). צ'יפ מתוחם, לא
          * שורה מלאה — הצורה עצמה, לא רק הצבע, אומרת "זה לא שיבוץ". */}
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted mb-2">
            <Icon name="key" size={14} />
            {t("positions.qualified")}
          </h4>
          {qualified.length === 0 ? (
            <p className="text-xs text-warn flex items-center gap-1.5">
              <Icon name="alert" size={12} strokeWidth={2.25} />
              אין כשירים לקטגוריה "{p.category}" — העמדה לא יכולה להתמלא
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {qualified.map((g) => (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium
                    text-content ring-1 ring-inset ring-hairline-strong bg-transparent"
                >
                  {g.name}
                  <span className="text-faint">· כשיר/ה</span>
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-faint mt-2">
            שינוי כשירות נעשה בעורך הכשירות במסך "{t("nav.team")}", לא כאן.
          </p>
        </div>

        {/* רשימה ב' — מי עובד בפועל השבוע. שורה מלאה עם רקע מלא ותאריך על
          * כל שם — ההבדל הוא בצורה ובטקסט, לא רק בכותרת (POS-05). */}
        <div>
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted mb-2">
            <Icon name="calendar" size={14} />
            {t("positions.working")}
          </h4>
          {working.length === 0 ? (
            <p className="text-xs text-muted">עוד לא שובץ אף אחד השבוע</p>
          ) : (
            <ul className="space-y-1.5">
              {working.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-2 h-9 px-2.5 rounded-lg
                    bg-surface-sunken ring-1 ring-inset ring-hairline"
                >
                  <span className="text-sm font-semibold text-content truncate">{w.name}</span>
                  <span className="text-[11px] text-muted flex-shrink-0" data-numeric>
                    {w.dates.map((d) => d.slice(5)).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* BOARD-02 — תחזית ארבעה שבועות קדימה. אותה גבול-שיער (hairline)
        * שהרשימות למעלה יושבות תחתיו, ולא קרוסלה או פס אופקי (D-05,
        * UI-SPEC overflow/E2): ארבע סקציות רצופות, אנכיות, בתוך הכרטיס
        * הקיים. תצוגה לקריאה בלבד — קריאה בלבד, בלי שיבוץ/השבתה/מחיקה
        * (D-08). */}
      <div className="mt-4 pt-4 border-t border-hairline">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted mb-3">
          <Icon name="trending" size={14} />
          {t("positions.forward")}
        </h4>
        <div className="space-y-4">
          {forwardWeeks.map(({ sunday: weekSunday, rows }, n) => (
            <div key={weekSunday}>
              <p className="text-[11px] font-semibold text-muted mb-1.5" data-numeric>
                {forwardWeekLabel(n)} · {rangeLabelHe(weekFrom(weekSunday))}
              </p>
              {rows.length === 0 ? (
                <p className="text-xs text-muted">אין שורות מתוכננות השבוע הזה</p>
              ) : (
                <div className="space-y-1.5">
                  {rows.map((row) => (
                    <ForecastRow key={row.date || row.dueDate} row={row} onEdit={onEdit} positionTitle={p.title} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * "השבוע" / "השבוע הבא" / "בעוד N שבועות" — ההבדל בין השבוע הנוכחי
 * לשבועות הבאים הוא במילים, לא בצבע לבדו (UI-SPEC Layout Contract,
 * BOARD-02: "'today' distinguishable by wording rather than by colour alone").
 */
const forwardWeekLabel = (n) => (n === 0 ? "השבוע" : n === 1 ? "השבוע הבא" : `בעוד ${n} שבועות`);

/**
 * שורת תחזית אחת, משותפת לשתי צורות העמדה (D-06): מה שקובע את התצוגה הוא
 * הנתון של השורה עצמו — `date`+שעות לתבנית, `startDate`/`dueDate` בלי
 * שעות לשבועית — לא ענף על `position.shape`. שורה ממומשת אינה
 * אינטראקטיבית בכלל (D-08); שורה שטרם התממשה היא כפתור שפותח אך ורק את
 * עריכת ההגדרה של העמדה עצמה — אין לה זהות בבסיס הנתונים עדיין, ואין
 * שום שיבוץ/השבתה/פעולה אחרת בסקציה הזו (D-07).
 */
function ForecastRow({ row, onEdit, positionTitle }) {
  const isDated = Boolean(row.date);
  const label = isDated ? shortDate(row.date) : rangeLabelHe([row.startDate, row.dueDate]);
  const rowClass =
    "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg ring-1 ring-inset " +
    "ring-hairline bg-surface-sunken w-full text-right";

  const content = (
    <>
      <span className="flex items-center gap-1.5 min-w-0">
        <Icon name={isDated ? "clock" : "calendar"} size={13} className="text-muted flex-shrink-0" />
        <span className="text-sm font-semibold text-content truncate">{label}</span>
        {isDated && row.startTime && row.endTime && (
          <span className="text-[11px] text-faint flex-shrink-0" data-numeric>
            {row.startTime}–{row.endTime}
          </span>
        )}
      </span>
      {/* תג "מתוכנן" מופיע רק על החריג — שורה שכבר התממשה לא נושאת שום
        * תג נוסף, אותו אינסטינקט "תג מסמן רק את היוצא מן הכלל" שב-TaskRow
        * (UI-SPEC Copywriting Contract). */}
      {!row.realized && (
        <span title="השורה הזו עוד לא נוצרה — היא תיווצר לבד כשהשבוע יגיע, ואין מה להגדיר בה.">
          <Badge tone="neutral">{t("positions.planned")}</Badge>
        </span>
      )}
    </>
  );

  if (row.realized) {
    return <div className={rowClass}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`שורה מתוכננת של ${positionTitle} — פתח לעריכת ההגדרה`}
      className={`${rowClass} cursor-pointer hover:bg-surface-hover transition-colors duration-200`}
    >
      {content}
    </button>
  );
}
