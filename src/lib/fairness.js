// ============================================================
// מנוע ההוגנות — חלון מתגלגל והמלצה מספרית.
//
// `teamAverages` ב-autoAssign.js עונה על "האם יצא לי יותר מאחרים *בשבוע
// שעל המסך*". זו שאלה נכונה, אבל היא קצרת טווח: מי שנשא שני שבועות
// רצופים ומקבל שבוע שלישי רגיל נראה שם בסדר גמור.
//
// המודול הזה מסתכל **אחורה** על חלון מתגלגל (ברירת מחדל: שבועיים), ומתרגם
// את הפער לכמות: לא "יניר עמוס" אלא "יניר צריך 2 כדי לאזן". מנהל לא יכול
// לפעול לפי תווית; הוא יכול לפעול לפי מספר.
//
// שלוש החלטות:
//
// 1. **נטל, לא ספירה.** לילה שוקל 1.4 וסופ"ש 1.25, בדיוק כמו במנוע. אחרת
//    ההמלצה כאן והשיבוץ שם היו מושכים לכיוונים מנוגדים.
//
// 2. **החוב מתורגם למשמרות דרך הנטל *הממוצע***, לא דרך משמרת מדומה בת
//    משקל 1. אחרת בצוות שרוב משמרותיו לילה כל המספרים היו מנופחים.
//
// 3. **מי שאין לו חוב לא מקבל המלצה.** רשימה שבה כל אדם נושא תג היא
//    רשימה בלי מידע.
// ============================================================

import { shiftHours, addDays } from "./dates.js";
import { shiftLoad } from "./autoAssign.js";

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * הנטל שכל אדם צבר בפועל בחלון שמסתיים ביום `until` (לא כולל).
 *
 * החלון נמדד לאחור מתחילת השבוע שמסדרים, ולא מהיום: מנהל שבונה את שבוע
 * הבא ביום חמישי צריך לראות את מה שקדם לשבוע ההוא, לא את מה שקדם לרגע
 * שבו הוא יושב מול המסך.
 *
 * `until` הוא ארגומנט חובה בכוונה, בלי ברירת מחדל של "היום": מודול טהור
 * שקורא ל-new Date() בשקט כשהקורא שוכח פרמטר מפר את ההבטחה של קלט זהה ⟵
 * פלט זהה בלי שום סימן ברגע הקריאה, בדיוק כמו שהאיסור על Math.random()
 * חל על autoAssign.js. הקריאה היחידה כרגע (views.jsx) כבר מעבירה weekStart.
 */
export function rollingLoad({ guards = [], shifts = [], until, days = 14 }) {
  const from = addDays(until, -days);
  return { from, until, per: tally(guards, shifts, (s) => s.date >= from && s.date < until) };
}

/** אותו מונה בלי חלון — לשבוע שנבנה עכשיו, שכולו רלוונטי בהגדרה. */
export function totalLoad(guards = [], shifts = []) {
  return tally(guards, shifts, () => true);
}

function tally(guards, shifts, inWindow) {
  const per = {};
  for (const g of guards) per[g.id] = { count: 0, nights: 0, hours: 0, load: 0 };

  for (const s of shifts) {
    if (!s?.date || !inWindow(s)) continue;
    const hours = shiftHours(s);
    const weight = shiftLoad(s);
    for (const id of s.assignedGuards || []) {
      const rec = per[id];
      if (!rec) continue; // שובץ בעבר ואז הוסר מהצוות
      rec.count += 1;
      rec.hours += hours;
      rec.load += weight;
      if (s.type === "night") rec.nights += 1;
    }
  }
  return per;
}

/**
 * ההמלצה למנהל: כמה משמרות כל אדם צריך בשבוע שנבנה כדי לסגור את הפער.
 *
 * `planned` הוא מה שכבר שובץ לשבוע *הזה*, כדי שההמלצה תרד תוך כדי עבודה
 * ולא תישאר תלושה מהמסך.
 */
/**
 * כמה "שווה" משמרת ממוצעת אצל הרשימה הזאת — הנטל הממוצע לתורנות בודדת.
 *
 * ההגדרה היחידה של הגודל הזה מעל המנוע: `fairnessPlan` קוראת לה במקום
 * לגזור בעצמה, ו-`loadTable` (מסך הדוחות, 01-03) קוראת לה גם היא — כדי
 * שהסף שנמדד נגדו (D-02) יהיה תמיד אותו מספר. רשימה ריקה חוזרת ל-1,
 * בדיוק כמו ברירת המחדל הקודמת של `fairnessPlan`.
 */
export function meanShiftLoad(shifts = []) {
  return shifts.length ? shifts.reduce((a, s) => a + shiftLoad(s), 0) / shifts.length : 1;
}

export function fairnessPlan({ guards = [], history = [], planned = [], until, days = 14 }) {
  const active = guards.filter((g) => g.active !== false);
  if (!active.length) return { rows: [], avgLoad: 0, perShiftLoad: 1, window: { days } };

  const past = rollingLoad({ guards: active, shifts: history, until, days });
  const now = totalLoad(active, planned);

  const total = active.reduce((a, g) => a + past.per[g.id].load + now[g.id].load, 0);
  const avgLoad = total / active.length;

  // כמה "שווה" משמרת ממוצעת אצל הצוות הזה. בלי זה החוב היה מתורגם ליחידות
  // מדומות שלא מתאימות לתמהיל האמיתי.
  const perShiftLoad = meanShiftLoad([...history, ...planned]);

  const rows = active
    .map((g) => {
      const carried = past.per[g.id].load;
      const assigned = now[g.id].load;
      const deficit = avgLoad - (carried + assigned);
      return {
        id: g.id,
        name: g.name,
        carried: round1(carried),
        assigned: now[g.id].count,
        nights: past.per[g.id].nights + now[g.id].nights,
        deficit: round1(deficit),
        // חוב חיובי = מגיע לו עוד. שלילי = הוא כבר מעל הממוצע.
        needs: Math.round(deficit / (perShiftLoad || 1)),
      };
    })
    // שובר שוויון לקסיקוגרפי על מזהה, לא רק מיון ראשי — בדיוק כמו tieBreak
    // ב-autoAssign.js ו-workingGuardIdsForWeek ב-positions.js. בלעדיו, שני
    // שומרים עם אותו deficit בדיוק (הצוות הטרי ביותר: כולם על אפס) יוצאים
    // בסדר שתלוי במקרה בסדר שבו guards הגיע מהקורא, לא בערכים עצמם.
    .sort((a, b) => b.deficit - a.deficit || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { rows, avgLoad: round1(avgLoad), perShiftLoad: round1(perShiftLoad), window: { days, from: past.from, until } };
}

/**
 * המשפט שמופיע ליד השם.
 *
 * שתיקה היא תשובה לגיטימית: מי שנמצא בטווח של פחות ממשמרת אחת מהממוצע
 * מאוזן, ותג "מאוזן" ליד כל שם היה הופך את הרשימה לרעש.
 */
export function fairnessHint(row) {
  if (!row) return null;
  if (row.needs >= 1) return { tone: "brand", text: `צריך עוד ${row.needs}`, level: "under" };
  if (row.needs <= -1) return { tone: "warn", text: `מעל הממוצע ב-${Math.abs(row.needs)}`, level: "over" };
  return null;
}

/**
 * התג ליד שם ברשימת "חלוקת העומס המוצעת" של המנהל (FAIR-02, D-01, D-05).
 *
 * המקום היחיד בכל המוצר שמחליט אם אדם נמצא מעל או מתחת לממוצע *לתצוגה* —
 * הרכיב מציג את `{tone, text}` שהוא מחזיר ותו לא, בדיוק כמו `fairnessHint`.
 *
 * סף הרעש נגזר מ-`perShiftLoad` של הרוסטר הזה עצמו (חצי משמרת ממוצעת),
 * ולא קבוע — אחרת צוות של משמרות קצרות וצוות של לילות ארוכים היו מקבלים
 * אותה רגישות למרות שהיחידה שלהם שונה לגמרי (D-02). ערך אפס, שלילי או
 * חסר נופל לברירת המחדל הקיימת של המודול — יחידה אחת — בדיוק כמו
 * `fairnessPlan`'s `perShiftLoad || 1`.
 */
export function loadShareHint({ load, meanLoad, perShiftLoad } = {}) {
  const safeLoad = Number(load) || 0;
  const safeMean = Number(meanLoad) || 0;
  const rawPerShift = Number(perShiftLoad);
  const effectivePerShift = rawPerShift > 0 ? rawPerShift : 1;
  const noiseFloor = effectivePerShift * 0.5;

  const diff = safeLoad - safeMean;
  if (diff >= noiseFloor) {
    return { tone: "warn", text: `מעל הממוצע בנטל ב-${round1(diff)}`, level: "over" };
  }
  if (diff <= -noiseFloor) {
    return { tone: "brand", text: `מתחת לממוצע בנטל ב-${round1(Math.abs(diff))}`, level: "under" };
  }
  return null;
}
