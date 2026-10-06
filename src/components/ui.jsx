// ============================================================
// Shared visual primitives.
//
// RTL-first, mobile-first, and token-only: nothing in this file names a
// literal colour, so the whole app re-themes from design/tokens.css.
// If a screen needs a one-off style, it belongs here as a variant rather
// than as a class-name soup at the call site.
// ============================================================

import { Children, Fragment, cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icons.jsx";

/* ------------------------------------------------------------------ *
 * Per-guard identity colour
 * ------------------------------------------------------------------ */

// צבע הזהות של אדם — נקבע לפי הצוות כולו, כך שאף שני אנשים לא חולקים צבע (עד 36).
// ההסבר המלא והבדיקה ב-lib/guardColors.js; כאן רק מייצאים מחדש, כדי שכל מי שמייבא מ-ui.jsx ימשיך לעבוד.
import { guardColor } from "../lib/guardColors.js";
export { guardColor };

/* ------------------------------------------------------------------ *
 * Per-category / per-position identity colour
 * ------------------------------------------------------------------ */

/**
 * הנימוק המקורי, לתיעוד היסטורי: צבע המשמרת עצמה (shiftTone) מקודד שעת
 * יום — בוקר/ערב/לילה — ולכן "סיור" בבוקר ו"עמדת שמירה 1" בבוקר יצאו
 * באותו גוון בדיוק, וזה לא ענה על "מי עושה מה" כשפורסמו כמה קטגוריות
 * באותו יום. המסקנה התהפכה: עשרה גוונים על אותו מסך יצרו לוח צבעוני
 * שלא אמר דבר, והפתרון שנבחר הוא תווית אחידה קריאה במקום קשת גוונים.
 */
const CATEGORY_COLORS = [
  "#C97A3D", "#3E8FA8", "#8E5FA0", "#5E9E5A", "#B0555F",
  "#7A8E3E", "#4F6FA8", "#A87A4F", "#5F9E8E", "#9E5F8E",
];

/**
 * [07] שני הצרכנים ההיסטוריים — הלוח המפורסם (ScheduleMgmt ב-`views.jsx`)
 * ותמונת השיתוף (`shareImage.js`) — עברו ב-Phase 7 לתווית עמדה שחורה
 * אחידה (`POSITION_LABEL_BG`) ואינם קוראים ל-`categoryColor`/
 * `positionColorKey` יותר. הפונקציות **נשמרות בכוונה ולא נמחקות**:
 * המחיקה נדחתה במפורש ב-`07-CONTEXT.md` ודורשת אישור, וביקורת צרכנים
 * קבועה (`scripts/verify-share-image.mjs`, D-07) מוודאת בכל ריצת
 * `npm test` שאין להן צרכן מחוץ לקובץ הזה. להסרה בטוחה בעתיד: לאשר
 * שהביקורת עדיין מדווחת "אין צרכן", ואז להסיר את `CATEGORY_COLORS`
 * ואת שתי הפונקציות יחד — לא בנפרד.
 */
export const categoryColor = (key) => {
  const s = String(key || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
};

/**
 * המפתח שצריך להזין ל-categoryColor כדי לצבוע "לפי משימה", לא "לפי
 * קטגוריה" — שני דברים שונים ברגע שעמדת 24/7 מתחלקת למשמרות (RosterWizard,
 * "לכמה שעות לחלק כל שמירה?"): "עמדת שמירה 1" ו"עמדת שמירה 2" חולקות
 * category זהה ("תורנות שמירה"), ולכן categoryColor(category) היה נותן
 * להן בדיוק אותו צבע — נצפה חי בלוח המפורסם: כל שש המשמרות של שתי
 * העמדות יצאו ב-rgb(176,85,95) אחד. השם עצמו ("עמדת שמירה 1 – משמרת 2")
 * כולל כבר את זהות העמדה לפני המקף — זו היחידה שצריך לצבוע לפיה, אחידה
 * על פני שלוש המשמרות של אותה עמדה ושונה מהעמדה השנייה.
 */
export const positionColorKey = (label, category) => {
  const base = String(label || "").split(" – ")[0].trim();
  return base || category || label;
};

// WCAG relative luminance. Picking the ink by measurement rather than by
// eye is what guarantees every chip clears 4.5:1 — including the ones a
// future palette edit adds.
const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * toLinear((n >> 16) & 255) +
    0.7152 * toLinear((n >> 8) & 255) +
    0.0722 * toLinear(n & 255)
  );
};

// דיו כהה — הטלה של הלוגו, לא שחור־כחלחל. על שבב טורקיז בהיר ההבדל
// בין השניים הוא ההבדל בין "שייך למותג" ל"נשאר משהו מהעיצוב הקודם".
const INK_DARK = "#1C3B37";
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * Whichever of white / near-black is more readable on `hex`. Used for guard
 * avatars and for shift cards, which are painted in a user-chosen colour —
 * hardcoding white text there fails contrast on every light shift colour.
 */
export const readableInk = (hex) => {
  const l = luminance(hex);
  return ratio(l, 1) >= ratio(l, luminance(INK_DARK)) ? "#FFFFFF" : INK_DARK;
};

export const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

export const Card = ({ children, className = "", as: Tag = "div", ...rest }) => (
  <Tag className={`glass rounded-2xl p-5 ${className}`} {...rest}>
    {children}
  </Tag>
);

/** A card that is also a button. Keeps the hover/focus contract in one place. */
export const CardButton = ({ children, className = "", ...rest }) => (
  <button
    className={`glass rounded-2xl p-5 text-right w-full cursor-pointer transition-[background,border-color,transform] duration-200 hover:bg-surface-hover hover:border-hairline-strong active:scale-[0.995] ${className}`}
    {...rest}
  >
    {children}
  </button>
);

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

const BTN_VARIANTS = {
  primary:
    "bg-brand text-on-brand hover:bg-brand-strong shadow-lg shadow-brand/20 disabled:bg-brand/40",
  accent:
    "bg-accent text-on-accent hover:bg-accent-strong shadow-lg shadow-accent/20 disabled:bg-accent/40",
  danger: "bg-danger text-white hover:bg-danger/85",
  // "glass" is the default secondary on a glass canvas — a solid grey
  // button would punch a hole in the frosted surface behind it.
  secondary: "glass text-content hover:bg-surface-hover hover:border-hairline-strong",
  ghost: "text-muted hover:text-content hover:bg-surface-hover",
  outline: "border border-hairline-strong text-content hover:bg-surface-hover",
};

// h-11 is 44px — the minimum comfortable touch target. `sm` is below it on
// purpose and is only for dense desktop toolbars where rows are spaced out.
const BTN_SIZES = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
};

export const Btn = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon,
  disabled = false,
  loading = false,
  className = "",
  type = "button",
  ...rest
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`inline-flex items-center justify-center rounded-xl font-semibold cursor-pointer
      transition-[background-color,border-color,box-shadow,transform,filter] duration-200
      active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100
      ${BTN_VARIANTS[variant] || BTN_VARIANTS.primary} ${BTN_SIZES[size] || BTN_SIZES.md} ${className}`}
    {...rest}
  >
    {loading ? (
      <Spinner size={size === "lg" ? 18 : 15} />
    ) : (
      icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />
    )}
    {children}
  </button>
);

/**
 * Icon-only button. `label` is required — an unlabelled icon button is
 * silent to a screen reader, and it doubles as the hover tooltip.
 */
export const IconBtn = ({ icon, label, onClick, size = "md", className = "", ...rest }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`inline-flex items-center justify-center rounded-xl text-muted cursor-pointer
      hover:text-content hover:bg-surface-hover transition-colors duration-200
      ${size === "sm" ? "h-9 w-9" : "h-11 w-11"} ${className}`}
    {...rest}
  >
    <Icon name={icon} size={size === "sm" ? 16 : 19} />
  </button>
);

export const Spinner = ({ size = 16, className = "" }) => (
  <svg
    className={`animate-spin ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ *
 * Labels & status
 * ------------------------------------------------------------------ */

const TONES = {
  brand: "bg-brand/15 text-brand ring-brand/25",
  accent: "bg-accent/15 text-accent ring-accent/25",
  warn: "bg-warn/15 text-warn ring-warn/25",
  danger: "bg-danger/15 text-danger ring-danger/25",
  info: "bg-info/15 text-info ring-info/25",
  neutral: "bg-surface-sunken text-muted ring-hairline",
};

export const Badge = ({ children, tone = "neutral", icon, className = "" }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
      ring-1 ring-inset ${TONES[tone] || TONES.neutral} ${className}`}
  >
    {icon && <Icon name={icon} size={12} strokeWidth={2.25} />}
    {children}
  </span>
);

export const Alert = ({ tone = "info", title, children, onClose }) => {
  const icon = { info: "info", warn: "alert", danger: "alert", accent: "check-circle" }[tone] || "info";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ring-1 ring-inset ${
        TONES[tone] || TONES.info
      }`}
    >
      <Icon name={icon} size={17} className="mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "text-content/80 mt-0.5" : ""}>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="סגור התראה"
          className="opacity-60 hover:opacity-100 cursor-pointer transition-opacity -m-1 p-1"
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
};

export const Avatar = ({ id, name, size = 36, ring = false, label, className = "", ...rest }) => {
  const bg = guardColor(id);
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none ${
        ring ? "ring-2 ring-bg" : ""
      } ${className}`}
      style={{
        backgroundColor: bg,
        color: readableInk(bg),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
      }}
      title={name}
      {...rest}
    >
      {label || initials(name)}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Data display
 * ------------------------------------------------------------------ */

export const StatCard = ({ title, value, subtitle, icon, tone = "brand", onClick }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`glass rounded-2xl p-4 text-right w-full ${
        onClick
          ? "cursor-pointer hover:bg-surface-hover hover:border-hairline-strong transition-[background,border-color] duration-200"
          : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ring-inset ${
            TONES[tone] || TONES.brand
          }`}
        >
          <Icon name={icon} size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted font-semibold">{title}</p>
          <p className="text-2xl font-bold text-content leading-tight" data-numeric>
            {value}
          </p>
          {subtitle && <p className="text-[11px] text-faint mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </Tag>
  );
};

/** Horizontal meter for workload / coverage. */
export const Meter = ({ value, max = 100, color = "rgb(var(--brand))", height = 6, label }) => {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div
      className="bg-surface-sunken rounded-full overflow-hidden"
      style={{ height }}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, height, backgroundColor: color }}
      />
    </div>
  );
};

/**
 * מצב ריק שהוא *התחלה*, לא הודעת שגיאה.
 *
 * `choices` הוא העיקר: במקום להגיד למשתמש "אין נתונים" ולהשאיר אותו לבד,
 * המסך מציע לו שתיים-שלוש דרכים מוכנות להתחיל, ולידן תמיד גם את הדרך
 * הידנית. משתמש שאף פעם לא ראה את המוצר לא צריך להחליט מה זו "תבנית" —
 * הוא בוחר את מה שמתאר את השבוע שלו.
 */
export const EmptyState = ({ icon = "inbox", title, body, action, choices }) => (
  <Card className="text-center py-12">
    <div className="w-14 h-14 rounded-2xl bg-surface-sunken ring-1 ring-inset ring-hairline text-muted mx-auto mb-4 flex items-center justify-center">
      <Icon name={icon} size={26} />
    </div>
    <h3 className="font-bold text-content mb-1">{title}</h3>
    {body && <p className="text-sm text-muted max-w-sm mx-auto mb-4">{body}</p>}
    {choices?.length > 0 && (
      <div className="grid gap-2 sm:grid-cols-3 max-w-2xl mx-auto text-right mb-4">
        {choices.map((c) => (
          <button
            key={c.label}
            onClick={c.onClick}
            disabled={c.disabled}
            className="rounded-xl bg-surface-sunken ring-1 ring-inset ring-hairline p-3.5 cursor-pointer
              transition-[background,box-shadow] duration-200 hover:bg-surface-hover hover:ring-brand/40
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-content">
              {c.icon && <Icon name={c.icon} size={15} className="text-brand" />}
              {c.label}
            </span>
            {c.hint && <span className="block text-[11px] text-muted mt-1 leading-snug">{c.hint}</span>}
          </button>
        ))}
      </div>
    )}
    {action}
  </Card>
);

/**
 * הפעולה הראשית של המסך. אחת בלבד, בתחתית, נדבקת לתחתית הגלילה.
 *
 * שלושה כללים שהיא אוכפת, וזו כל הסיבה שהיא רכיב ולא עוד `<Btn>`:
 * אחת למסך — אם צריך שתיים, המסך עושה יותר מדי; בתחתית — שם האגודל,
 * ושם העין מגיעה אחרי שקראה את התוכן; ובגוף ראשון — "סדר לי את השבוע",
 * לא "הרצת שיבוץ". `hint` אומר מה יקרה, כדי שהכפתור לא יצטרך.
 */
export const PrimaryAction = ({
  children, onClick, icon, hint, loading = false, disabled = false, variant = "primary",
}) => (
  <div className="sticky bottom-0 z-20 pt-5">
    <div className="glass-raised rounded-2xl p-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
      {hint && (
        <p className="text-xs text-muted px-2 flex-1 min-w-0 leading-snug text-center sm:text-right">
          {hint}
        </p>
      )}
      <Btn
        size="lg"
        variant={variant}
        icon={icon}
        onClick={onClick}
        loading={loading}
        disabled={disabled}
        className={hint ? "w-full sm:w-auto sm:min-w-[15rem]" : "w-full"}
      >
        {children}
      </Btn>
    </div>
  </div>
);

/**
 * רצועת הביטול — התשובה של המוצר הזה ל"האם אתה בטוח?".
 *
 * חלונית אישור עוצרת את המשתמש *לפני* כל פעולה, כולל אלף הפעמים שבהן הוא
 * צדק, וכך היא מאבדת את המשמעות שלה בדיוק בפעם שבה הוא טעה. הרצועה הזאת
 * הפוכה: הפעולה קורית, המסך מתעדכן, ושמונה שניות אחר כך היא נסגרת. הפס
 * הדק מתרוקן כדי שהזמן שנשאר ייראה ולא ינוחש.
 */
// `bottom` פרמטרי כי לא לכל מסך יש את אותו רצפה: SupervisorApp פנוי
// למטה, אבל GuardApp יושב מעל שורת ניווט תחתונה קבועה (bottom tab bar) —
// bottom-4 הקבוע היה יושב מתחתיה או חופף אותה.
export const UndoBar = ({ label, onUndo, bottom = "bottom-4" }) => {
  if (!label) return null;
  return (
    <div className={`fixed ${bottom} inset-x-0 z-[60] flex justify-center px-4 pointer-events-none`}>
      <div
        role="status"
        className="pointer-events-auto glass-raised rounded-2xl overflow-hidden
          shadow-lg animate-fade-up min-w-[17rem] max-w-[calc(100vw-2rem)]"
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-sm font-semibold text-content truncate">{label}</span>
          <button
            onClick={onUndo}
            className="mr-auto flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-bold
              text-brand bg-brand/10 hover:bg-brand/20 cursor-pointer transition-colors flex-shrink-0"
          >
            <Icon name="undo" size={15} />
            ביטול
          </button>
        </div>
        <div className="h-[3px] bg-brand/15">
          <div className="h-full bg-brand origin-right animate-drain motion-reduce:hidden" />
        </div>
      </div>
    </div>
  );
};

/**
 * כותרת מסך. `title` אופציונלי בכוונה: כשהמסך יושב בתוך זרימת "השבוע",
 * פס השלבים כבר אומר איפה אנחנו, וכותרת שנייה שחוזרת על אותן מילים היא
 * רעש — לא היררכיה. בלי כותרת נשארים הכיתוב המשני והפעולות בלבד.
 */
export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    {(title || subtitle) && (
      <div>
        {title && <h1 className="text-2xl font-bold text-content tracking-tight">{title}</h1>}
        {subtitle && <p className={`text-muted text-sm ${title ? "mt-1" : ""}`}>{subtitle}</p>}
      </div>
    )}
    {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
  </div>
);

/* ------------------------------------------------------------------ *
 * Forms
 * ------------------------------------------------------------------ */

// מיוצא בשביל שדות שבנויים מחוץ לקובץ הזה (TimeField) ונראים בדיוק כמו Input.
export const CONTROL =
  "w-full h-11 bg-surface-sunken border border-hairline rounded-xl px-3.5 text-sm text-content " +
  "placeholder:text-faint transition-[border-color,box-shadow] duration-200 " +
  "hover:border-hairline-strong focus:border-brand focus:ring-2 focus:ring-brand/30 focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const Field = ({ label, hint, error, htmlFor, children }) => {
  // useId, לא נגזר מ-htmlFor: לא כל קורא ל-Field מעביר htmlFor (רוב שדות
  // ה-error בפועל ב-views.jsx לא מעבירים), אז זה חייב לעבוד גם בלעדיו.
  // aria-describedby מקשר את הודעת השגיאה לשדה עצמו — בלעדיו aria-invalid
  // (שכבר קיים ב-Input) אומר לקורא-מסך "פסול" בלי לומר למה.
  const errorId = useId();
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-content mb-1.5">
          {label}
        </label>
      )}
      {/* גם invalid וגם aria-invalid: Input הפנימי כבר קובע aria-invalid
        * משלו מתוך הפרופ invalid (ומחליף כל aria-invalid שמגיע דרך
        * ...rest, כי ה-JSX שלו קובע אותו שוב אחרי הפריסה) — בלי invalid
        * כאן הערך שהזרקנו היה נדרס בחזרה ל-undefined. Textarea/Select
        * אין להם invalid משלהם, אז ה-aria-invalid הגולמי הוא מה שמגיע
        * אליהם דרך ה-rest, בלי החלפה. */}
      {error && isValidElement(children)
        ? cloneElement(children, { "aria-describedby": errorId, "aria-invalid": true, invalid: true })
        : children}
      {/* Hint and error share the slot, so the layout doesn't jump when a
       * field goes invalid — and the error replaces rather than stacks. */}
      {error ? (
        <p id={errorId} className="text-xs text-danger mt-1.5 flex items-center gap-1">
          <Icon name="alert" size={12} strokeWidth={2.25} />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-faint mt-1.5">{hint}</p>
      )}
    </div>
  );
};

export const Input = ({ className = "", invalid, ...rest }) => (
  <input
    {...rest}
    aria-invalid={invalid || undefined}
    className={`${CONTROL} ${invalid ? "border-danger focus:border-danger focus:ring-danger/30" : ""} ${className}`}
  />
);

/**
 * רשימה נפתחת — מחליפה את <select> של הדפדפן, שנראה אחרת בכל מכשיר ובעיקר
 * כמו שנות ה-90. אותה חתימה כמו <select>: <option> כילדים, value ו-onChange
 * שמקבל אובייקט עם target.value, כך שאף מסך לא צריך להשתנות.
 *
 * התפריט נפתח בפורטל מעל כל השאר (גם מתוך חלון קופץ שחותך תוכן), ונפתח מעלה
 * כשאין מקום למטה. מקלדת: חצים, Home/End, Enter/רווח, Escape. ה-Escape נתפס
 * בשלב ה-capture כמו ב-TimeField, כדי שבתוך חלון הוא יסגור את הרשימה ולא את החלון.
 */
function readOptions(children) {
  const out = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) out.push(...readOptions(c.props.children));
    else if (c.type === "option") {
      const label = c.props.children;
      out.push({
        value: String(c.props.value ?? (typeof label === "string" ? label : "")),
        label,
        disabled: Boolean(c.props.disabled),
      });
    }
  });
  return out;
}

export const Select = ({ className = "", children, value, onChange, disabled, invalid, ...rest }) => {
  const options = readOptions(children);
  const listId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState(null);

  const selectedIndex = options.findIndex((o) => o.value === String(value ?? ""));
  const current = selectedIndex >= 0 ? options[selectedIndex] : null;
  // "בחר ..." (ערך ריק) נראה כמו placeholder, לא כבחירה.
  const isPlaceholder = !current || current.value === "";

  const firstEnabled = (from, dir) => {
    for (let i = from; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return -1;
  };

  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const want = Math.min(280, options.length * 44 + 12);
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const down = below >= want || below >= above;
    setPlace({
      left: r.left,
      width: r.width,
      maxHeight: Math.max(120, Math.min(280, down ? below : above)),
      ...(down ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }),
    });
  };

  const openMenu = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : Math.max(0, firstEnabled(0, 1)));
    measure();
    setOpen(true);
  };

  const choose = (i) => {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    if (opt.value !== String(value ?? "")) onChange?.({ target: { value: opt.value } });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, place]);

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const next = firstEnabled(active + dir, dir);
      if (next >= 0) setActive(next);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const next = e.key === "Home" ? firstEnabled(0, 1) : firstEnabled(options.length - 1, -1);
      if (next >= 0) setActive(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        {...rest}
        ref={triggerRef}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`${CONTROL} flex items-center justify-between gap-2 cursor-pointer text-right ${
          open ? "border-brand ring-2 ring-brand/30" : ""
        } ${invalid ? "border-danger" : ""} ${className}`}
      >
        <span className={`truncate ${isPlaceholder ? "text-faint" : "text-content font-semibold"}`}>
          {current ? current.label : ""}
        </span>
        <Icon
          name="down"
          size={16}
          className={`text-muted flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        place &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            style={{ position: "fixed", zIndex: 300, ...place }}
            className="overflow-y-auto overscroll-contain rounded-2xl bg-bg ring-1 ring-inset ring-hairline-strong
              shadow-2xl p-1.5 animate-fade-up [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {options.map((o, i) => {
              const selected = i === selectedIndex;
              return (
                <div
                  key={`${o.value}-${i}`}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={o.disabled || undefined}
                  onClick={() => choose(i)}
                  onPointerEnter={() => !o.disabled && setActive(i)}
                  className={`min-h-[44px] px-3 rounded-xl flex items-center justify-between gap-3 text-sm select-none
                    ${o.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    ${selected ? "bg-brand/15 text-content font-extrabold" : "text-content font-medium"}
                    ${i === active && !selected && !o.disabled ? "bg-brand/10" : ""}`}
                >
                  <span className={`truncate ${o.value === "" ? "text-faint" : ""}`}>{o.label}</span>
                  {selected && <Icon name="check" size={16} strokeWidth={2.5} className="text-brand flex-shrink-0" />}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};

export const Textarea = ({ className = "", rows = 3, ...rest }) => (
  <textarea {...rest} rows={rows} className={`${CONTROL} h-auto py-2.5 resize-y ${className}`} />
);

/**
 * כמות (כמה אנשים במשמרת): −/+ לצעד אחד, ושדה שאפשר פשוט להקליד בו כל
 * מספר. תוך כדי הקלדה מותר רגע ריק (מחקו "1" כדי לכתוב "12"); הערך נחתך
 * לטווח רק ביציאה מהשדה, כדי לא להילחם במשתמש באמצע מספר.
 *
 * @param {number|""} value
 * @param {(v: number|"") => void} onChange
 * @param {string} label שם הכמות לקורא-מסך ("חיילים נדרשים")
 */
export const CountField = ({ value, onChange, label, min = 1, max = 999 }) => {
  const n = Number(value) || min;
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));
  const stepBtn =
    "w-11 h-11 flex-shrink-0 rounded-xl ring-1 ring-inset ring-hairline bg-surface-sunken text-lg font-extrabold " +
    "cursor-pointer hover:ring-hairline-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" aria-label={`פחות ${label}`} disabled={n <= min} onClick={() => onChange(clamp(n - 1))} className={stepBtn}>
        –
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        onBlur={() => onChange(clamp(value))}
        onFocus={(e) => e.target.select()}
        data-numeric
        className={`${CONTROL.replace("w-full ", "")} w-20 text-center text-lg font-extrabold px-1
          [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <button type="button" aria-label={`עוד ${label}`} disabled={n >= max} onClick={() => onChange(clamp(n + 1))} className={stepBtn}>
        +
      </button>
    </div>
  );
};

/**
 * Segmented control. Better than a <select> for 2–4 mutually exclusive
 * options because the alternatives stay visible, and better than radios
 * because it fits a toolbar.
 */
export const Segmented = ({ value, onChange, options, size = "md", className = "" }) => (
  <div
    role="tablist"
    className={`inline-flex bg-surface-sunken ring-1 ring-inset ring-hairline rounded-xl p-1 gap-1 ${className}`}
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={`inline-flex items-center gap-1.5 rounded-lg font-semibold cursor-pointer
            transition-colors duration-200 whitespace-nowrap
            ${size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm"}
            ${active ? "bg-brand text-on-brand shadow-sm" : "text-muted hover:text-content"}`}
        >
          {opt.icon && <Icon name={opt.icon} size={14} />}
          {opt.label}
        </button>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ *
 * Overlay
 * ------------------------------------------------------------------ */

export const Modal = ({ open, onClose, title, subtitle, children, wide = false, footer }) => {
  const panelRef = useRef(null);

  // Escape לסגירה, ופוקוס-פתיחה על הפאנל עצמו — בלי זה מקלדת/קורא-מסך
  // נשארים על מה שהיה מאחורי ה-overlay, בלי שום דרך לדעת שמודל בכלל נפתח.
  // לא מלכודת-פוקוס מלאה (Tab עדיין יכול לצאת) — זו הרחבה נפרדת, גדולה
  // וסיכונית יותר, לרכיב משותף שכל מסך במוצר תלוי בו.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-up"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`glass-raised relative w-full rounded-t-3xl sm:rounded-2xl max-h-[92vh]
          flex flex-col animate-scale-in outline-none ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-hairline">
          <div className="min-w-0">
            <h2 className="font-bold text-content">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <IconBtn icon="x" label="סגור" onClick={onClose} size="sm" className="-mt-1 -ml-1" />
        </header>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="px-5 py-4 border-t border-hairline flex gap-2 justify-start">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

/**
 * דיאלוג-אישור גנרי (CONFIRM-01) — הבסיס היחיד לכל אישור-לפני-פעולה
 * בפרויקט. מכליל את `SeedDemoDialog` (views.jsx, Phase 9) ל-props
 * דינמיים במקום title/body קבועים; שום מסך לא בונה לוגיקת-אישור משלו.
 *
 * שני דברים שכדאי לדעת לפני שקוראים לו:
 * (1) "ביטול" (ובאותה מידה Escape/קליק-רקע/X) **לעולם לא** קורא ל-
 *     `onConfirm` — אף אחת מהפעולות שהרכיב הזה עוטף לא מציירת patch
 *     אופטימי לפני שהמשתמש מאשר (CONFIRM-06, 12-CONTEXT.md open_questions
 *     #4), אז "ביטול" הוא תמיד ניקוי-state טהור, לא ביטול של פעולה
 *     שכבר קרתה.
 * (2) `pending` הוא הכללה של הדפוס שכבר הוכח ב-`SeedDemoDialog`
 *     (pending → חוסם סגירה בזמן שהכתיבה בתהליך), לא מנגנון חדש.
 * (3) הדיאלוג נסגר אחרי `onConfirm` רק אם הוא **לא** זרק. `onConfirm`
 *     חייב לדחות (reject) על כישלון כדי שהמשתמש לא יראה "הצלחה" מדומה —
 *     קורא שעוטף פעולת `useGuardian.js` חייב להעביר `{ rethrow: true }`
 *     ל-`run()`/`optimistic()` שלה (ברירת המחדל בולעת שגיאות). על כישלון
 *     הדיאלוג פשוט נשאר פתוח; באנר-השגיאה הכללי כבר מסביר מה נכשל.
 */
export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  tone = "danger",
  busy,
}) => {
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
    } catch {
      // הדיאלוג נשאר פתוח בכישלון (Phase 12, WR-01 ב-12-REVIEW.md) — onConfirm
      // חייב לזרוק (rethrow: true) כדי שהמשתמש לא יראה את הדיאלוג נסגר בשקט
      // כאילו הפעולה הצליחה. באנר-השגיאה הכללי (SupervisorApp) כבר מסביר מה
      // נכשל; לא כופלים כאן הודעת-שגיאה נוספת.
      setPending(false);
      return;
    }
    setPending(false);
    onClose();
  };
  const closeUnlessPending = () => {
    if (!pending) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={closeUnlessPending}
      title={title}
      footer={
        <>
          <Btn variant={tone} onClick={confirm} loading={busy || pending} className="flex-1">
            {confirmLabel}
          </Btn>
          <Btn variant="secondary" onClick={closeUnlessPending} disabled={pending}>
            {cancelLabel}
          </Btn>
        </>
      }
    >
      <div className="text-sm text-content">{body}</div>
    </Modal>
  );
};
