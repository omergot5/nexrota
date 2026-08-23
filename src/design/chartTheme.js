// ============================================================
// צבעי המסגרת של תרשימי Recharts (צירים, רשת, tooltip).
//
// Recharts מעצב את הצירים ואת ה-tooltip שלו דרך props של JS שהופכים
// לתכונות SVG ולעיצוב inline — לא CSS. הפניה למשתנה מותאם-אישית לא
// נפתרת שם, ולכן חייבים למסור לו ערך צבע קונקרטי. מה שהשתנה הוא *מי*
// מחזיק את הערך: מודול עיצוב שקורא את tokens.css בזמן ריצה, לא מסך.
//
// זה בדיוק האילוץ ש-shiftPalette.js כבר מתעד עבור צבעי המשמרות — הבדל
// יחיד: כאן הערכים נגזרים מהטוקנים ולא נכתבים כ-hex קבוע, כדי שהחלפת
// ערכת נושא (בהיר/כהה) תשנה גם את צבעי התרשים בלי לגעת ברכיב.
//
// **הכלל שנובע מכך: זה המקום היחיד שבו צבעי המסגרת של התרשים חיים.
// רכיב רשאי לבקש אותם מהמודול הזה, אבל לעולם לא לנקוב בהם בעצמו.**
// ============================================================

const ALLOWED_ROLES = {
  axis: "--text-muted",
  grid: "--hairline",
  tooltipBg: "--surface-raised",
  tooltipText: "--text",
};

// נגישים רק כשאין document (רינדור ב-Node, כמו סקריפט הבדיקה, או קורא
// שלא החזיר כלום). נשמרים באותם שני סימונים ש-tokens.css עצמו משתמש
// בהם — ערוצי RGB מופרדים ברווח לצבעים אטומים, rgba() מוגמר למשטחי
// זכוכית — ולא כ-hex. הערכים הם הערכים של ערכת הנושא הבהירה עצמה.
const FALLBACK_RAW = {
  axis: "74 106 100",
  grid: "rgba(28, 59, 55, 0.11)",
  tooltipBg: "rgba(255, 255, 255, 0.97)",
  tooltipText: "28 59 55",
};

/**
 * מרכיב ערך גולמי לצבע תקף — או `null` אם הוא לא מזוהה. פונקציה טהורה,
 * בלי גישה לברירת מחדל: הקורא (`normalize`) אחראי לנפילה חזרה.
 */
function compose(v) {
  // כבר צורת צבע מוכרת (hex או פונקציית צבע) — עובר כמו שהוא. זה מה
  // ששומר על ה-alpha של משטח זכוכית שלם: לא מפרקים ולא מרכיבים מחדש.
  if (/^#[0-9a-fA-F]{3,8}$/.test(v) || /^(rgb|rgba|hsl|hsla)\(/i.test(v)) return v;
  // סימון הערוצים המופרדים ברווח שצבעים אטומים נשמרים בו ב-tokens.css.
  // מורכב לצורת rgb() בפסיקים — הצורה הבטוחה יותר לתכונת SVG, ולא
  // הצורה המרווחת של CSS Color 4 שתכונת SVG לא בהכרח מבינה.
  const m = v.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
  if (m) return `rgb(${m[1]}, ${m[2]}, ${m[3]})`;
  return null;
}

/**
 * מנרמל ערך שהתקבל מ-`read()`. **לפני כל בדיקת צורה, יש לקצץ רווחים**:
 * `getComputedStyle(...).getPropertyValue(...)` מחזיר רווח מוביל בכל
 * דפדפן אמיתי (`" 74 106 100"`, לא `"74 106 100"`), ומנרמל שלא קוצץ
 * נופל לברירת המחדל על כל טוקן, בכל ערכת נושא, בכל טעינת עמוד אמיתית —
 * בעוד שכל מחרוזת כתובה-ביד בבדיקות המודול עצמה, בהיותה נטולת רווח
 * כזה מלכתחילה, הייתה עוברת בכל מקרה. ערך לא מזוהה — ריק, הפניה שלא
 * נפתרה, זבל — נופל לברירת המחדל: זה גם גבול אבטחה, לא רק חוסן, כי
 * הערך המוחזר מוזרק לתוך אובייקט style.
 */
function normalize(raw, fallbackRaw) {
  const v = String(raw ?? "").trim();
  const composed = v ? compose(v) : null;
  if (composed) return composed;
  return compose(fallbackRaw); // הפולבק בנוי בעצמנו — תמיד תקף
}

/** קורא ברירת המחדל: `getComputedStyle` על שורש המסמך. בטוח ב-Node. */
function browserRead(name) {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

/**
 * מחזיר את צבעי המסגרת שהתרשים צריך: צבע ציר, צבע רשת, ואובייקט עיצוב
 * tooltip מלא. נפתר מארבעה טוקנים בלבד — תפקיד הטקסט המושתק לתוויות
 * הציר, תפקיד ה-hairline לרשת ולמסגרת ה-tooltip, תפקיד המשטח המורם
 * לרקע ה-tooltip, ותפקיד הטקסט הראשי לטקסט ה-tooltip. הרשימה הזאת היא
 * *כל* מה שהמודול קורא — לא בחירה שרירותית שדומה לערכים הקודמים, אלא
 * ארבעת התפקידים הנכונים סמנטית. שימו לב: זה מעלה את הניגודיות של
 * תווית הציר לרמת הטקסט המושתק — שיפור מכוון, לא תופעת לוואי.
 *
 * `read` ניתן להזרקה כדי שהמודול ייבדק ב-Node בלי DOM אמיתי; ברירת
 * המחדל קוראת מ-`getComputedStyle` ובטוחה כשאין `document`.
 *
 * **הכלל שהמודול הזה קיים בשבילו: רכיב מבקש צבע מכאן, ולעולם לא נוקב
 * בו בעצמו.** צבעי זהות המשמרת (`SHIFT_TONES`) ממשיכים לחיות ב-
 * `shiftPalette.js` בלבד — לא כאן.
 */
export function chartTheme(read = browserRead) {
  const axis = normalize(read(ALLOWED_ROLES.axis), FALLBACK_RAW.axis);
  const grid = normalize(read(ALLOWED_ROLES.grid), FALLBACK_RAW.grid);
  const tooltipBackground = normalize(read(ALLOWED_ROLES.tooltipBg), FALLBACK_RAW.tooltipBg);
  const tooltipText = normalize(read(ALLOWED_ROLES.tooltipText), FALLBACK_RAW.tooltipText);

  return {
    axis,
    grid,
    tooltip: {
      background: tooltipBackground,
      border: `1px solid ${grid}`,
      borderRadius: 12,
      color: tooltipText,
      fontSize: 12,
      direction: "rtl",
    },
  };
}
