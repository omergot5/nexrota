// ============================================================
// הצבע של כל אדם — כדי שחייל מזהה את עצמו בסידור לפי צבע, לא רק לפי שם.
//
// עד היום היו עשרה צבעים שנבחרו לפי hash של המזהה: בצוות של 30, שלושה אנשים
// בממוצע חלקו אותו צבע, ובמקרה גרוע חמישה. "הצבע שלי" לא היה קיים.
//
// כאן הצבע נקבע לפי הצוות כולו:
//   - 12 גוונים רחוקים זה מזה × 3 עוצמות = 36 צבעים שונים.
//   - כל אדם מקבל גוון שעוד לא נלקח (או שנלקח הכי מעט), ובתוך הגוון — עוצמה
//     שעוד לא נלקחה. עד 12 אנשים: כולם בגוון אחר. עד 36: אף צבע לא חוזר.
//   - דטרמיניסטי: אותם אנשים ⟵ אותם צבעים, בכל מכשיר ובכל טעינה (בלי Math.random).
//   - נקודת ההתחלה של כל אדם נגזרת מהמזהה שלו, כך שצירוף או הסרה של אדם
//     משנים מעט אחרים ולא את כולם.
//
// כל צבע נבנה כך שדיו (לבן או כהה) עליו עומד ב-4.5:1 — לא בעין, במדידה.
// הצבע הוא עזר זיהוי ולא הזהות: השם תמיד כתוב לידו.
//
// טהור (בלי React ובלי רשת), כדי שנבדק ב-Node ישירות.
// ============================================================

// זוויות גוון (HSL) — מרוחקות זו מזו ככל האפשר בין שכנים: טורקיז, כחול, אינדיגו,
// סגול, מגנטה, ורוד, אדום, כתום, ענבר, ליים, ירוק, ציאן.
const HUES = [172, 215, 255, 285, 320, 345, 5, 25, 45, 75, 130, 195];

// עוצמה = בהירות יחסית (luminance) שאליה הצבע נבנה. עמוק וחזק עם דיו לבן,
// בהיר עם דיו כהה. הטווח שביניהם (≈0.18–0.36) נכשל בשני הדיו, ולכן לא בשימוש.
const TONES = [0.07, 0.16, 0.46];

const SATURATION = 0.62;

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

const luminanceOf = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

const toHex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;

/** הבהירות (L ב-HSL) שנותנת את ה-luminance המבוקש, בחיפוש בינארי. */
function colorAt(hue, targetLum) {
  let lo = 0.02;
  let hi = 0.98;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (luminanceOf(hslToRgb(hue, SATURATION, mid)) < targetLum) lo = mid;
    else hi = mid;
  }
  return toHex(hslToRgb(hue, SATURATION, (lo + hi) / 2));
}

/** [tone][hue] → hex. */
export const GUARD_PALETTE = TONES.map((lum) => HUES.map((h) => colorAt(h, lum)));
export const GUARD_COLOR_COUNT = HUES.length * TONES.length;

const hashOf = (value) => {
  const s = String(value ?? "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
};

const argMin = (counts, start) => {
  let best = start % counts.length;
  for (let step = 0; step < counts.length; step++) {
    const i = (start + step) % counts.length;
    if (counts[i] < counts[best]) best = i;
  }
  return best;
};

/**
 * @param {{id: string}[]} guards
 * @returns {Map<string, string>} מזהה ⟵ צבע (hex)
 */
export function colorsForGuards(guards = []) {
  const ids = [...new Set(guards.map((g) => String(g.id)))].sort();
  const hueUse = new Array(HUES.length).fill(0);
  const toneUse = HUES.map(() => new Array(TONES.length).fill(0));
  const out = new Map();
  for (const id of ids) {
    const h = hashOf(id);
    const hue = argMin(hueUse, h % HUES.length);
    const tone = argMin(toneUse[hue], Math.floor(h / HUES.length) % TONES.length);
    hueUse[hue]++;
    toneUse[hue][tone]++;
    out.set(id, GUARD_PALETTE[tone][hue]);
  }
  return out;
}

const fallbackColor = (id) => {
  const h = hashOf(id);
  return GUARD_PALETTE[h % TONES.length][h % HUES.length];
};

/** פונקציית-צבע לפי רשימת אנשים נתונה — לקוד שמחזיק את הרשימה ביד (הקנבס של תמונת השיתוף). */
export function colorLookup(guards) {
  const map = colorsForGuards(guards);
  return (id) => map.get(String(id ?? "")) ?? fallbackColor(String(id ?? ""));
}

let assigned = new Map();

/** נקרא פעם אחת בכל שינוי ברשימת האנשים (useGuardian). */
export function assignGuardColors(guards) {
  assigned = colorsForGuards(guards);
}

/** הצבע של אדם. אדם שעוד לא ברשימה (למשל מסך שנטען לפניה) מקבל צבע לפי המזהה בלבד. */
export const guardColor = (id) => {
  const key = String(id ?? "");
  return assigned.get(key) ?? fallbackColor(key);
};
