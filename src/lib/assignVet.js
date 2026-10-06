// ============================================================
// בדיקת חוקיות לשיבוץ ידני — מקום אחד, בתוך הפעולה עצמה.
//
// עקרון ברזל 2: שיבוץ שמפר חוק עבודה נדחה. עד היום הפעולות ידני (toggleAssignment)
// וגרירה (moveAssignment) בדקו כשירות בלבד, וכל מסך שרצה לאכוף את השאר
// (מסך "אסדר בעצמי", הגריד, ההחלפות) בדק בעצמו לפני הקריאה. מסך חדש ששכח
// לבדוק עקף את החוק בשקט. כאן הבדיקה יושבת בפעולה, ולכן אי אפשר לעקוף אותה
// ממסך.
//
// שני דברים נשארים כמו שהיו, בכוונה:
//   - כשירות לעולם לא ניתנת לעקיפה (QUAL-05) — גם לא עם נימוק.
//   - "שבץ בכל זאת" (SmartAssign) עובר עם נימוק כתוב: הוא עוקף את שאר
//     האילוצים הקשיחים, ונרשם עם הנימוק. בלי נימוק — נדחה.
//
// טהור (בלי React ובלי רשת), כדי שנבדק ב-Node ישירות.
// ============================================================

import { checkAssignment, checkQualification, teamRules } from "./autoAssign.js";

/**
 * @param {object} p
 * @param {object} p.guard
 * @param {object} p.shift המשמרת שאליה משבצים
 * @param {Array}  p.shifts כל המשמרות של הצוות (נטל השבוע של האדם נגזר מהן)
 * @param {object} [p.availability]
 * @param {Array}  [p.tasks]
 * @param {object} [p.team]
 * @param {string} [p.overrideNote] נימוק ל"שבץ בכל זאת" — עוקף הכל חוץ מכשירות
 * @param {string} [p.movingFromShiftId] גרירה: האדם יוצא מהמשמרת הזו לפני הבדיקה,
 *   כדי שמשמרת צמודה אליה לא תיחשב התנגשות שלו בעצמו
 * @returns {{ok: true, overridden?: true} | {ok: false, code: string, reason: string}}
 */
export function vetAssignment({ guard, shift, shifts = [], availability = {}, tasks = [], team, overrideNote, movingFromShiftId }) {
  if (!guard || !shift) {
    return { ok: false, code: "missing", reason: "חסרים פרטי המשמרת או האדם" };
  }

  const qualified = checkQualification({ guard, shift });
  if (!qualified.ok) return qualified;

  if (typeof overrideNote === "string" && overrideNote.trim()) return { ok: true, overridden: true };

  const roster = movingFromShiftId
    ? shifts.map((s) =>
        s.id === movingFromShiftId ? { ...s, assignedGuards: (s.assignedGuards || []).filter((g) => g !== guard.id) } : s
      )
    : shifts;

  const verdict = checkAssignment({ guard, shift, shifts: roster, availability, tasks, rules: teamRules(team) });
  return verdict.ok ? { ok: true } : verdict;
}

/** ההודעה שהמשתמש רואה כשהשיבוץ נדחה — עם שם האדם, כדי שיהיה ברור על מי מדובר. */
export const refusalText = (guard, verdict) => `לא ניתן לשבץ את ${guard?.name || "האדם"}: ${verdict.reason}`;
