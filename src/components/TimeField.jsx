// ============================================================
// בחירת שעה בגלגלת — שעות ודקות שמתגלגלות, במקום <input type="time">.
//
// השדה המובנה של הדפדפן נראה אחרת בכל מכשיר, ובממשק RTL הוא לפעמים
// מציג את החלקים בסדר הפוך. כאן השדה הוא כפתור שמציג "06:30" (תמיד LTR,
// כמו שעון), ולחיצה עליו פותחת מתחתיו שתי גלגלות: שעות 00–23 ודקות בקפיצות
// של 5. הערך מתעדכן תוך כדי גלילה — אין כפתור "אישור" שאפשר לשכוח.
//
// הגלגלת נשענת על scroll-snap של הדפדפן ולא על חישוב תנועה משלה: גלילה
// בגלגל העכבר, גרירה במגע ומקלדת מתנהגות כמו בכל רשימה נגללת, והשורה
// שנעצרת במרכז היא הערך. אפקט ה"תוף" (הטיה ודהייה לפי מרחק מהמרכז) הוא
// קוסמטי בלבד ולא משפיע על הערך.
// ============================================================

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { CONTROL } from "./ui.jsx";

const ROW = 40; // px — גובה שורה בגלגלת
const pad = (n) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

// דקה שלא מתחלקת ב-5 (ערך ישן, "13:37") נשארת ברשימה במקומה — אחרת פתיחת
// הגלגלת הייתה מזיזה אותה בשקט לדקה אחרת בלי שהמשתמש נגע בכלום.
const minuteOptions = (current) =>
  current && !MINUTES.includes(current) ? [...MINUTES, current].sort() : MINUTES;

function Wheel({ options, value, onChange, label }) {
  const id = useId();
  const ref = useRef(null);
  const settle = useRef(null);
  const frame = useRef(null);
  const index = Math.max(0, options.indexOf(value));
  // המיקום הרציף (scrollTop / ROW), רק לציור ההטיה — לא הערך עצמו.
  const [pos, setPos] = useState(index);
  // לחיצות מקש רצופות מגיעות לפני שהטופס הספיק להתעדכן — בלי האינדקס
  // הממתין כאן, שתי לחיצות "למטה" היו מזיזות שורה אחת בלבד.
  const pending = useRef(null);

  // ערך שהשתנה מבחוץ (או פתיחה ראשונה) — מקפיצים את הגלגלת אליו בלי
  // אנימציה. אחרי גלילה של המשתמש הגלגלת כבר עומדת שם, והבדיקה מונעת קפיצה.
  useLayoutEffect(() => {
    pending.current = null;
    const el = ref.current;
    if (!el) return;
    if (Math.abs(el.scrollTop - index * ROW) > 2) el.scrollTop = index * ROW;
    setPos(el.scrollTop / ROW);
  }, [index]);

  useEffect(
    () => () => {
      clearTimeout(settle.current);
      cancelAnimationFrame(frame.current);
    },
    []
  );

  const onScroll = () => {
    const el = ref.current;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setPos(el.scrollTop / ROW));
    clearTimeout(settle.current);
    // הערך נקבע כשהגלילה נרגעת, לא בכל פיקסל — אחרת כל גלילה הייתה
    // שולחת עשרות עדכונים לטופס בדרך לשורה שהמשתמש בכלל רוצה.
    settle.current = setTimeout(() => {
      const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (options[i] !== value) onChange(options[i]);
    }, 110);
  };

  const step = (delta) => {
    const from = pending.current ?? index;
    const i = Math.min(options.length - 1, Math.max(0, from + delta));
    if (i === from) return;
    pending.current = i;
    onChange(options[i]);
  };

  const onKeyDown = (e) => {
    const moves = { ArrowUp: -1, ArrowDown: 1, PageUp: -4, PageDown: 4 };
    if (e.key in moves) {
      e.preventDefault();
      step(moves[e.key]);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      step(e.key === "Home" ? -options.length : options.length);
    }
  };

  return (
    <div className="relative w-16 h-[200px]">
      {/* פס הבחירה — השורה שבמרכז היא הערך */}
      <div
        className="absolute inset-x-0 top-[80px] h-10 rounded-xl bg-brand/12 ring-1 ring-inset ring-brand/35 pointer-events-none"
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={`${id}-${index}`}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="absolute inset-0 overflow-y-auto overscroll-contain snap-y snap-mandatory rounded-xl
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40
          [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
          [mask-image:linear-gradient(to_bottom,transparent,#000_32%,#000_68%,transparent)]
          [-webkit-mask-image:linear-gradient(to_bottom,transparent,#000_32%,#000_68%,transparent)]"
      >
        <div className="py-[80px]">
          {options.map((opt, i) => {
            const d = i - pos;
            const far = Math.min(Math.abs(d), 3);
            const selected = i === index;
            return (
              <div
                key={opt}
                id={`${id}-${i}`}
                role="option"
                aria-selected={selected}
                onClick={() => onChange(opt)}
                className={`h-10 flex items-center justify-center snap-center cursor-pointer select-none
                  text-lg tabular-nums ${selected ? "font-extrabold text-content" : "font-semibold text-muted"}`}
                style={{
                  opacity: 1 - far * 0.27,
                  transform: `perspective(260px) rotateX(${Math.max(-65, Math.min(65, -d * 21))}deg)`,
                }}
              >
                {opt}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * שדה שעה: כפתור שמציג את הערך, וגלגלות שעות/דקות שנפתחות מתחתיו.
 *
 * @param {string} value "HH:MM" או "" (לא נבחרה שעה)
 * @param {(v: string) => void} onChange מקבל "HH:MM"
 * @param {string} [label] שם השדה לקורא-מסך ("שעת התחלה")
 */
export default function TimeField({ value, onChange, label, invalid, placeholder = "--:--", ...rest }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  const [h, m] = String(value || "").split(":");
  const hour = HOURS.includes(h) ? h : null;
  const minute = /^\d{2}$/.test(m || "") ? m : null;

  // לחיצה מחוץ לשדה או Escape סוגרים את הגלגלות. ה-Escape נתפס בשלב
  // ה-capture ונעצר שם, כדי שבתוך Modal הוא יסגור את הגלגלת ולא את החלון כולו.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // שדה ריק נפתח על 08:00 אבל לא נשמר עד שהמשתמש מזיז משהו — פתיחה לבדה
  // לא ממציאה שעה שאף אחד לא בחר.
  const shownHour = hour ?? "08";
  const shownMinute = minute ?? "00";

  return (
    <div ref={wrap}>
      <button
        type="button"
        {...rest}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-label={`${label ? `${label}: ` : ""}${value || "לא נבחרה שעה"}`}
        className={`${CONTROL} flex items-center justify-between gap-2 cursor-pointer text-right ${
          open ? "border-brand ring-2 ring-brand/30" : ""
        } ${invalid ? "border-danger" : ""}`}
      >
        <span dir="ltr" data-numeric className={`text-base font-bold tracking-wide ${value ? "text-content" : "text-faint"}`}>
          {value || placeholder}
        </span>
        <Icon name="clock" size={16} className="text-muted flex-shrink-0" />
      </button>

      {open && (
        <div className="mt-1.5 rounded-2xl bg-surface-sunken ring-1 ring-inset ring-hairline p-2 animate-fade-up">
          <div dir="ltr" className="flex items-center justify-center gap-1.5">
            <Wheel
              options={HOURS}
              value={shownHour}
              onChange={(hh) => onChange(`${hh}:${shownMinute}`)}
              label={label ? `${label} — שעה` : "שעה"}
            />
            <span className="text-xl font-extrabold text-muted" aria-hidden="true">:</span>
            <Wheel
              options={minuteOptions(minute)}
              value={shownMinute}
              onChange={(mm) => onChange(`${shownHour}:${mm}`)}
              label={label ? `${label} — דקות` : "דקות"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
