// ============================================================
// הסידור שמסדר את עצמו — הפיצ'ר של מסך הכניסה.
//
// מסך כניסה שכתוב עליו "שיבוץ חכם" מבקש מהמבקר להאמין למילה. הלוח הזה
// *מראה* לו: שבעה ימים מתמלאים לנגד עיניו, שם אחרי שם, ובסוף שורת הסיכום
// היא לא "✓ הכל טוב" גנרי — היא קטע אמיתי מיומן ההחלטות של המנוע, מחושב
// באמת (לא מוקלד ביד), עם אותה תגית ASSIGN/OK שרואים אחרי שנכנסים — רק
// כתג ממולא, לא כטקסט מונוספייס על רקע כהה שנקרא כמו קונסולת דיבוג.
// מי שמסדר משמרות ביד מזהה תוך שנייה מה נחסך לו, ומי שמכיר מוצרי AI
// אחרים מזהה שזה לא מסך-כניסה גנרי — כי אף אחד לא מראה נימוק אמיתי
// *לפני* שביקשת להיכנס.
//
// ארבע החלטות שמחזיקות את זה:
//
//   1. **אנימציית CSS בלבד ללוח.** אין `setInterval`, אין רינדור מחדש על
//      טיימר. ההשהיה של כל תא היא `animation-delay` שמחושב מהאינדקס,
//      והלולאה היא `infinite`. מסך כניסה שמבזבז מחזורי מעבד על אנימציה
//      הוא סתירה עצמית.
//
//   2. **נתונים אמיתיים למראה, לא Lorem — ועכשיו גם אמיתיים בפועל.** שמות
//      עבריים, שעות סבירות, וצבעים מאותה פלטה של המוצר עצמו ללוח; שורת
//      היומן למטה היא תוצאה אמיתית של `autoAssign()` על נתוני דמו קבועים
//      — `useMemo` בלי תלויות, מחושב פעם אחת ברינדור הראשון ולא שוב.
//
//   3. **מכובד ל-`prefers-reduced-motion`.** מי שביקש פחות תנועה מקבל את
//      הלוח מלא ודומם — לא ריק. המידע הוא העיקר, התנועה היא הקישוט.
//
//   4. **אותה שפה חזותית כמו יומן ההחלטות האמיתי** (SmartAssign.jsx):
//      תגית ASSIGN/BALANCE באנגלית, לא כתובה מחדש — כדי שהמעבר מהדגמה
//      להתחברות לא ירגיש כמו שני מוצרים שונים. שני המקומות עודכנו יחד
//      מתגי-טקסט מונוספייס לתגי-badge ממולאים, לא רק כאן.
// ============================================================

import { useMemo } from "react";
import { DAYS_HE_SHORT } from "../lib/dates.js";
import { SHIFT_TONES } from "../design/shiftPalette.js";
import { readableInk } from "./ui.jsx";
import { autoAssign } from "../lib/autoAssign.js";

const NAMES = ["דן", "רינה", "גיא", "אבי", "נועה", "מיכל", "יובל"];

// פיקסצ'ר קבוע, לא תלוי בתאריך של היום — זו הדגמה, לא לוח אמיתי, אז
// התאריכים עצמם לא נראים למשתמש (רק "יום X'"). ארבעה שומרים, שני ימים,
// זמינות מעורבת בכוונה כדי שיהיה למנוע על מה להתלבט — בדיוק כמו
// demoData.js, בקנה מידה זעיר שרץ בלי רשת.
const LOG_GUARDS = ["דן מזרחי", "רינה שמיר", "גיא לוי", "אבי ישראלי"].map((name, i) => ({
  id: `p${i}`,
  name,
}));
const LOG_SHIFTS = [
  { id: "p-d0", date: "2026-01-04", label: "משמרת יום", type: "morning", startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [] },
  { id: "p-n0", date: "2026-01-04", label: "משמרת לילה", type: "night", startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [] },
  { id: "p-d1", date: "2026-01-05", label: "משמרת יום", type: "morning", startTime: "07:00", endTime: "19:00", requiredGuards: 1, assignedGuards: [] },
  { id: "p-n1", date: "2026-01-05", label: "משמרת לילה", type: "night", startTime: "19:00", endTime: "07:00", requiredGuards: 1, assignedGuards: [] },
];
const LOG_AVAILABILITY = {
  "p0-p-d0": "available", "p1-p-d0": "maybe", "p2-p-d0": "available", "p3-p-d0": "unavailable",
  "p0-p-n0": "unavailable", "p1-p-n0": "available", "p2-p-n0": "available", "p3-p-n0": "available",
  "p0-p-d1": "available", "p1-p-d1": "unavailable", "p2-p-d1": "available", "p3-p-d1": "available",
  "p0-p-n1": "available", "p1-p-n1": "available", "p2-p-n1": "unavailable", "p3-p-n1": "maybe",
};

/**
 * שתי שורות: בוקר ולילה.
 *
 * הצבעים נלקחים מ-`SHIFT_TONES` ולא מטוקני `brand`/`accent` — שניהם
 * טורקיז, ובלוח קטן הם נקראו כאותו צבע בדיוק. כאן, כמו בכל המוצר,
 * בהיר = מוקדם וכהה = מאוחר, ולכן ההדגמה מלמדת את השפה של המסך
 * שאליו נכנסים אחריה.
 */
const ROWS = [
  { label: "07:00", bg: SHIFT_TONES.morning },
  { label: "19:00", bg: SHIFT_TONES.night },
];

export default function LiveSchedulePreview() {
  // מחושב פעם אחת. שני ASSIGN אמיתיים (לא הראשונים בהכרח — הכי גבוהים
  // בהתאמה, כדי שהדוגמה תיראה משכנעת) ועוד את הסטטיסטיקה האמיתית שיצאה
  // מהריצה הזו בדיוק, לא מספר מוקלד.
  const { logLines, summary } = useMemo(() => {
    const plan = autoAssign({ shifts: LOG_SHIFTS, guards: LOG_GUARDS, availability: LOG_AVAILABILITY });
    const byId = new Map(LOG_GUARDS.map((g) => [g.id, g.name]));
    const byShiftId = new Map(LOG_SHIFTS.map((s) => [s.id, s]));
    const assigns = plan.log
      .filter((l) => l.step === "assign")
      .map((l) => {
        const shift = byShiftId.get(l.shiftId);
        const dayIdx = LOG_SHIFTS.findIndex((s) => s.id === l.shiftId) < 2 ? 0 : 1;
        const score = plan.detailByShift[l.shiftId]?.[0]?.score ?? 0;
        return {
          tag: "ASSIGN",
          text: `יום ${DAYS_HE_SHORT[dayIdx]} · ${shift.startTime} — ${byId.get(l.guardId)}`,
          detail: `${score}% התאמה`,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    return { logLines: assigns, summary: plan.summary };
  }, []);

  return (
    <div
      className="glass-raised rounded-3xl p-4 sm:p-5 select-none w-full max-w-md"
      // הלוח הוא קישוט שמדגים את המוצר. קורא מסך שיקריא 14 שמות בדויים
      // רק יעכב את מי שבא להתחבר.
      aria-hidden="true"
    >
      <div className="mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand">
            כך זה נראה
          </p>
          <p className="text-sm font-bold text-content mt-0.5">שבוע שלם, בלחיצה אחת</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {DAYS_HE_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold text-faint pb-0.5">
            {d}
          </div>
        ))}

        {ROWS.map((row, r) =>
          DAYS_HE_SHORT.map((d, i) => {
            // ההשהיה רצה על פני שתי השורות ברצף, כך שהלוח מתמלא
            // יום־אחרי־יום ולא שורה־אחרי־שורה — בדיוק כמו שאדם היה ממלא.
            const step = r * 7 + i;
            return (
              <div
                key={`${row.label}-${d}`}
                style={{
                  animationDelay: `${step * 0.14}s`,
                  background: row.bg,
                  color: readableInk(row.bg),
                }}
                className="rounded-lg px-0.5 sm:px-1 py-1.5 text-center
                  animate-slot-in motion-reduce:animate-none"
              >
                <span className="block text-[9px] font-semibold opacity-80" data-numeric>
                  {row.label}
                </span>
                <span className="block text-[10px] font-bold truncate leading-tight">
                  {NAMES[(step * 3 + r) % NAMES.length]}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* השורה התחתונה נדלקת אחרי שכל התאים מלאים — היא הפאנץ' של ההדגמה,
        * ועכשיו היא לא "✓ הכל טוב" גנרי אלא קטע אמיתי מיומן ההחלטות —
        * אותה תגית ASSIGN שרואים אחרי שנכנסים (יומן ההחלטות, SmartAssign.jsx),
        * רק כתג ממולא ולא כמילה מונוספייס דלוקה על רקע כהה — הגרסה הישנה
        * נראתה כמו קונסולת דיבוג שנפלה בטעות לתוך עמוד נחיתה מלוטש. מה
        * שרשום כאן הוא מה שהמנוע *באמת* החליט על הפיקסצ'ר הזעיר למעלה,
        * לא טקסט קבוע. */}
      <div
        dir="ltr"
        style={{ animationDelay: "2.2s" }}
        className="mt-4 rounded-2xl bg-surface-sunken ring-1 ring-inset ring-hairline p-3.5 space-y-2
          animate-slot-in motion-reduce:animate-none"
      >
        {logLines.map((line, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span className="flex-shrink-0 text-[9px] font-black tracking-wide text-on-accent bg-accent rounded-md px-1.5 py-[3px]">
              {line.tag}
            </span>
            <span dir="rtl" className="text-content/85 text-[12.5px] font-medium flex-1 truncate">
              {line.text}
            </span>
            <span className="text-faint text-[11px] flex-shrink-0" data-numeric>
              {line.detail}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2.5 pt-2.5 mt-1 border-t border-hairline">
          <span className="flex-shrink-0 text-[9px] font-black tracking-wide text-on-brand bg-brand rounded-md px-1.5 py-[3px]">
            OK
          </span>
          <span dir="rtl" className="text-content/85 text-[12.5px] font-semibold flex-1" data-numeric>
            כיסוי {summary.coverage}% · הוגנות {summary.fairnessScore}
          </span>
          <span
            aria-hidden="true"
            className="w-[6px] h-[12px] bg-accent flex-shrink-0 animate-pulse motion-reduce:animate-none"
          />
        </div>
      </div>
    </div>
  );
}
