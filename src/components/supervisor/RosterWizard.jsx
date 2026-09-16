// ============================================================
// אשף בניית סד"כ — צבא בלבד (Phase 6, ההחלפה של "בניית השבוע" למצב army).
//
// לא מנוע חדש: שכבת UI מעל gs_positions/positions.js הקיימים (Phase 4).
// כל "משימה" ברצועה היא עמדה (gs_positions row) — תבנית עם ימים/שעות, או
// שבועית-24/7 בלי שעות. השמירה עוברת ב-actions.addPosition/updatePosition,
// בדיוק כמו PositionsScreen; האשף הזה רק עוטף אותו טופס בצורת קרוסלה
// קטגוריה-אחר-קטגוריה כדי שמפקד לא יצטרך לדעת ש"עמדות קבע" קיים בכלל.
//
// "הכול חוסם הכול" (D-01, כבר ממומש ב-conflicts.js/autoAssign.js): אין כאן
// שום מטריצת יחסים בין קטגוריות להגדיר — זה בכוונה. הבאנר רק מסביר את מה
// שכבר קורה.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Btn, Card, IconBtn, Input, PageHeader, Select } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import { DAYS_HE_SHORT, fromISODate, rangeLabelHe } from "../../lib/dates.js";
import { foldersFor } from "../../lib/categories.js";
import { expectedDatesForWeek } from "../../lib/positions.js";
import { t } from "../../lib/terms.js";

// ארבע נקודות פתיחה שכל מפקד צריך, בסדר שבו הן מוזכרות בבקשה המקורית —
// לא רשימה סגורה: "הוסף משימה" מוסיף עוד, ו-x בכרטיס מוחק. אלה רק
// הצעה כדי שצוות חדש לא יתחיל ממסך ריק לגמרי.
const SEED_POSITIONS = [
  { title: "סיור", category: "סיור", shape: "template", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "06:00", endTime: "18:00" },
  { title: "כוננות", category: "כוננות", shape: "template", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "18:00", endTime: "06:00" },
  { title: "תורנות מטבח", category: "תורנות מטבח", shape: "template", weekdays: [0, 1, 2, 3, 4, 5], startTime: "05:30", endTime: "13:30" },
  { title: "עמדת שמירה 1", category: "תורנות שמירה", shape: "template", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "06:00", endTime: "18:00" },
];

// "מלא לי שבוע" — אותה שתי-תבניות בדיוק שקיימות היום ב-ShiftMgmt
// (views.jsx, WEEK_PATTERNS), רק שכאן הן יוצרות עמדות-תבנית (שחוזרות
// לבד כל שבוע) במקום משמרות חד-פעמיות — כדי שהכפתור הזה לא "יברח"
// מהמודל שהאשף הזה בנוי סביבו.
const FIXED_PATTERNS = [
  {
    key: "x2", title: "בוקר + לילה", hint: "12 שעות כל אחת",
    rows: [
      { title: "משמרת יום", startTime: "07:00", endTime: "19:00" },
      { title: "משמרת לילה", startTime: "19:00", endTime: "07:00" },
    ],
  },
  {
    key: "x3", title: "3 משמרות ביום", hint: "8 שעות כל אחת",
    rows: [
      { title: "בוקר", startTime: "07:00", endTime: "15:00" },
      { title: "צהריים", startTime: "15:00", endTime: "23:00" },
      { title: "לילה", startTime: "23:00", endTime: "07:00" },
    ],
  },
];

const emptyDraft = (seed) => ({
  id: null,
  seedId: seed?.id || null,
  title: seed?.title || "",
  category: seed?.category || "",
  shape: seed?.shape || "template",
  weekdays: seed?.weekdays || [0, 1, 2, 3, 4, 5, 6],
  startTime: seed?.startTime || "08:00",
  endTime: seed?.endTime || "16:00",
  requiredGuards: 1,
  active: true,
});

const draftFromPosition = (p) => ({
  id: p.id,
  title: p.title || "",
  category: p.category || "",
  shape: p.shape === "weekly" ? "weekly" : "template",
  weekdays: Array.isArray(p.weekdays) ? p.weekdays : [],
  startTime: p.startTime || "08:00",
  endTime: p.endTime || "16:00",
  requiredGuards: p.requiredGuards || 1,
  active: p.active !== false,
});

export default function RosterWizard({
  positions = [], guards = [], weekDates = [], actions, busy, embedded = false,
}) {
  const categories = foldersFor("army").map((f) => f.name);

  // רשימת הפריטים ברצועה: כל עמדה קיימת (פעילה) של הצוות, ואחריה כל זרע
  // שהשם שלו לא תפוס כבר על ידי עמדה קיימת — כדי שרענון הדף לא יחזיר
  // כפילות "סיור" אחרי שכבר הוגדר "סיור".
  const existingTitles = new Set(positions.filter((p) => p.active).map((p) => p.title));
  const seeds = SEED_POSITIONS.filter((s) => !existingTitles.has(s.title));

  const [draftSeeds, setDraftSeeds] = useState([]); // זרעים/עמדות-חדשות שנוספו ידנית ב"הוסף משימה", עדיין לא נשמרו
  const [activeKey, setActiveKey] = useState(null);
  const [form, setForm] = useState(null); // draft נוכחי בעריכה

  // מפתח כל פריט נגזר מזהות יציבה — לעולם לא מהאינדקס שלו במערך: זרעי
  // SEED_POSITIONS מזוהים לפי השם הקבוע שלהם (לא משתנה בין רינדורים), וזרעים
  // שנוספו ב"הוסף משימה" מזוהים לפי seed.id שנוצר פעם אחת ביצירה. בלי זה,
  // ברגע שזרע אחד נשמר והופך לעמדה אמיתית, כל שאר הזרעים "זזים" אינדקס אחד
  // אחורה וה-key שלהם מתחלף — בדיוק מה שגרם ל"המשך למשימה הבאה" לקפוץ בחזרה
  // לפריט הראשון במקום להתקדם (נתפס בבדיקת דפדפן חיה).
  const items = useMemo(() => {
    const real = positions
      .filter((p) => p.active)
      .map((p) => ({ key: `pos:${p.id}`, done: true, position: p }));
    const pending = [...seeds, ...draftSeeds].map((s) => ({
      key: `seed:${s.id || s.title}`, done: false, seed: s,
    }));
    return [...real, ...pending];
  }, [positions, seeds, draftSeeds]);

  // מפתח בפועל: אם activeKey מצביע לפריט שכבר לא קיים (נמחק, או שנשמר
  // ולכן קיבל key חדש בצורת pos:<id>), נופל אוטומטית לפריט הראשון — בלי
  // setState בזמן רינדור.
  const resolvedActiveKey = items.some((it) => it.key === activeKey) ? activeKey : items[0]?.key || null;
  const activeItem = items.find((it) => it.key === resolvedActiveKey) || null;

  useEffect(() => {
    setForm(activeItem ? (activeItem.position ? draftFromPosition(activeItem.position) : emptyDraft(activeItem.seed)) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedActiveKey]);

  const openItem = (item) => {
    if (!item) return;
    setActiveKey(item.key);
  };

  const toggleWeekday = (d) =>
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort((a, b) => a - b),
    }));

  const invalid = !form?.title?.trim() || !form?.category;

  const save = async () => {
    if (invalid) return;
    const cleanWeekdays = (form.weekdays || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    const payload = {
      title: form.title.trim(),
      shape: form.shape,
      category: form.category,
      weekdays: form.shape === "template" ? cleanWeekdays : [],
      startTime: form.shape === "template" ? form.startTime || null : null,
      endTime: form.shape === "template" ? form.endTime || null : null,
      requiredGuards: Math.max(1, Number(form.requiredGuards) || 1),
      active: true,
    };
    if (form.id) {
      await actions.updatePosition(form.id, payload);
    } else {
      await actions.addPosition(payload);
      if (form.seedId) setDraftSeeds((d) => d.filter((s) => s.id !== form.seedId));
    }
    // ה-effect ב-SupervisorApp שקורא ל-ensurePositionsForWeek רץ רק כשעובר
    // שבוע (POS-01) — לא כשנוצרת עמדה חדשה תוך כדי עבודה באשף הזה. בלי
    // הקריאה הזו, עמדה שהוגדרה כרגע לא הייתה נכנסת ל-gs_work_items (ולכן
    // לא הייתה מופיעה בדיווח זמינות/שיבוץ חכם) עד שהמפקד עוזב את השבוע
    // וחוזר אליו — נתפס בבדיקת דפדפן חיה על הצוות הרביעי (עמדת שמירה 1).
    await actions.ensurePositionsForWeek(weekDates[0]);
  };

  const saveAndNext = async () => {
    await save();
    const idx = items.findIndex((it) => it.key === resolvedActiveKey);
    const next = items[(idx + 1) % items.length];
    if (next) openItem(next);
  };

  const removeItem = (item) => {
    if (item.position) {
      actions.deletePosition(item.position.id);
    } else if (item.seed.id) {
      setDraftSeeds((d) => d.filter((s) => s.id !== item.seed.id));
    }
    // זרע מובנה (SEED_POSITIONS) בלי id: אין מה למחוק במצב — הוא פשוט
    // חוזר ברצועה עד שייבנה בפועל, בדיוק כמו לפני שנפתח.
    if (item.key === resolvedActiveKey) setActiveKey(null);
  };

  const addBlank = () => {
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seed = { id, title: "", category: categories[0] || "", shape: "template" };
    // מכוון ישירות למפתח שהפריט החדש יקבל ברינדור הבא — לא ל-null, כדי
    // שהעריכה תיפתח על הפריט החדש ולא תיפול חזרה לראשון ברצועה.
    setActiveKey(`seed:${id}`);
    setDraftSeeds((d) => [...d, seed]);
  };

  const fillFixedPattern = async (pattern) => {
    for (const row of pattern.rows) {
      await actions.addPosition({
        title: row.title,
        category: categories[0] || "כללי",
        shape: "template",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        startTime: row.startTime,
        endTime: row.endTime,
        requiredGuards: 1,
        active: true,
      });
    }
    await actions.ensurePositionsForWeek(weekDates[0]);
  };

  // תצוגת השבוע: לכל יום, אילו עמדות שמורות רצות בו (expectedDatesForWeek,
  // פונקציה טהורה קיימת) — plus placeholder לפריט שבעריכה כרגע ולכל שאר
  // הפריטים שעוד לא הוגדרו, כדי שהעמודה תמיד תשקף את 7 הימים גם לפני
  // שהמנוע מימש שורות בפועל.
  const sundayISO = weekDates[0];
  const dayItems = weekDates.map((date) => {
    const active = [];
    for (const it of items) {
      if (it.position) {
        const dates = expectedDatesForWeek(it.position, sundayISO);
        if (dates.includes(date)) active.push({ key: it.key, label: it.position.title, done: true, full247: it.position.shape === "weekly" });
      } else if (it.key === resolvedActiveKey) {
        active.push({ key: it.key, label: form?.title || it.seed.title, done: false, editing: true });
      }
    }
    return { date, active };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={embedded ? null : t("nav.shifts")}
        subtitle={`${rangeLabelHe(weekDates)} · הגדירו כל משימה פעם אחת — היא ממשיכה לחזור לבד כל שבוע`}
        actions={
          <Btn variant="outline" icon="zap" loading={busy} onClick={() => fillFixedPattern(FIXED_PATTERNS[0])}>
            מלא לי שבוע במבנה קבוע
          </Btn>
        }
      />

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="בחירת משימה לעריכה"
      >
        {items.map((it) => {
          const label = it.position?.title || it.seed.title || "משימה חדשה";
          const active = it.key === resolvedActiveKey;
          return (
            <button
              key={it.key}
              role="tab"
              aria-selected={active}
              onClick={() => openItem(it)}
              className={`flex-shrink-0 flex items-center gap-2 h-10 px-3.5 rounded-xl text-[13px] font-bold
                cursor-pointer transition-colors duration-200 ring-1 ring-inset ${
                  active
                    ? "bg-brand text-on-brand ring-brand"
                    : "bg-surface-sunken text-muted ring-hairline hover:text-content"
                }`}
            >
              {it.done ? (
                <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${active ? "bg-on-brand/25" : "bg-accent text-on-accent"}`}>
                  <Icon name="check" size={10} strokeWidth={3} />
                </span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50 flex-shrink-0" />
              )}
              {label}
            </button>
          );
        })}
        <button
          onClick={addBlank}
          className="flex-shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-[13px] font-bold
            cursor-pointer border border-dashed border-hairline-strong text-faint hover:text-brand hover:border-brand/50 transition-colors duration-200"
        >
          <Icon name="plus" size={14} /> הוסף משימה
        </button>
      </div>

      <div className="flex gap-2 items-start p-3.5 rounded-2xl bg-brand/8 ring-1 ring-inset ring-brand/20 text-[12.5px] text-muted leading-relaxed">
        <Icon name="lock" size={16} className="text-brand mt-0.5 flex-shrink-0" />
        <span>
          <strong className="text-content">הכול חוסם הכול.</strong> ברגע שכפוף/ה משובץ/ת למשימה אחת, הוא/היא לא
          יכול/ה להופיע באף משימה אחרת שחופפת אליה בזמן — בלי קשר לקטגוריה. זה כבר קורה במנוע לבד, לא צריך להגדיר
          את זה כאן.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr] items-start">
        <Card className="p-4">
          <h3 className="text-[13px] font-extrabold text-content mb-3">ככה השבוע נראה עד עכשיו</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {dayItems.map(({ date, active }) => (
              <div key={date}>
                <div className="text-center mb-2 pb-1.5 border-b-2 border-hairline">
                  <p className="text-[10.5px] text-faint font-bold" data-numeric>
                    {DAYS_HE_SHORT[fromISODate(date).getDay()] || ""}
                  </p>
                </div>
                <div className="space-y-1 min-h-[70px]">
                  {active.length === 0 && (
                    <div className="rounded-lg border border-dashed border-hairline-strong h-8" />
                  )}
                  {active.map((a) => (
                    <div
                      key={a.key}
                      className={`rounded-lg px-1.5 py-1 text-[9.5px] font-bold leading-tight truncate ${
                        a.editing
                          ? "border border-dashed border-brand/50 text-brand text-center"
                          : "bg-accent/15 text-accent"
                      }`}
                      title={a.label}
                    >
                      {a.editing ? "בעריכה" : a.full247 ? `${a.label} · 24/7` : a.label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {form && (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-extrabold text-content">
                {form.id ? `עריכת "${form.title}"` : "משימה חדשה"}
              </h3>
              {activeItem && (
                <IconBtn icon="trash" size="sm" label="הסר משימה זו" onClick={() => removeItem(activeItem)} />
              )}
            </div>

            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder='שם המשימה, למשל "עמדת שמירה 2"'
            />

            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              <option value="" disabled>בחרו קטגוריה</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-brand/7 ring-1 ring-inset ring-brand/20 cursor-pointer">
              <input
                type="checkbox"
                checked={form.shape === "weekly"}
                onChange={(e) => setForm((f) => ({ ...f, shape: e.target.checked ? "weekly" : "template" }))}
                className="mt-0.5 w-4 h-4 rounded accent-brand cursor-pointer"
              />
              <span>
                <span className="block text-[13px] font-bold text-content">עמדה מאוישת 24/7</span>
                <span className="block text-[11px] text-faint mt-0.5">כל השבוע, בלי שעת התחלה/סיום</span>
              </span>
            </label>

            {form.shape === "template" && (
              <>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS_HE_SHORT.map((label, d) => {
                    const on = form.weekdays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleWeekday(d)}
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
                <div className="grid grid-cols-2 gap-3">
                  <Input type="time" value={form.startTime || ""} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
                  <Input type="time" value={form.endTime || ""} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                </div>
              </>
            )}

            <div>
              <p className="text-[12px] font-bold text-muted mb-1.5">כמות כפופים נדרשת בו-זמנית</p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label="הפחת כמות כפופים נדרשת"
                  onClick={() => setForm((f) => ({ ...f, requiredGuards: Math.max(1, (Number(f.requiredGuards) || 1) - 1) }))}
                  className="w-9 h-9 rounded-lg ring-1 ring-inset ring-hairline bg-surface-sunken font-extrabold cursor-pointer"
                >
                  –
                </button>
                <span className="w-8 text-center text-lg font-extrabold" data-numeric role="status" aria-live="polite">
                  {form.requiredGuards}
                </span>
                <button
                  type="button"
                  aria-label="הוסף כמות כפופים נדרשת"
                  onClick={() => setForm((f) => ({ ...f, requiredGuards: Math.min(6, (Number(f.requiredGuards) || 1) + 1) }))}
                  className="w-9 h-9 rounded-lg ring-1 ring-inset ring-hairline bg-surface-sunken font-extrabold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <Btn className="w-full" loading={busy} disabled={invalid} onClick={saveAndNext} icon="left">
              המשך למשימה הבאה
            </Btn>
          </Card>
        )}
      </div>
    </div>
  );
}
