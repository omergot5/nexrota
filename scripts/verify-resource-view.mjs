// Standalone sanity check for the resource-view row/day pivot.
//   node scripts/verify-resource-view.mjs
//
// Pure module only — no browser, no database. Covers: category grouping,
// row ordering (proposed folders first then alphabetical custom), per-day
// item ordering (timed before timeless, by start time), and determinism.

import { buildResourceRows } from "../src/lib/resourceView.js";
import { weekFrom } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
console.log("\nRESOURCE-VIEW · buildResourceRows — פיקסצ'ר שבוע קבוע (2026-09-06)\n");
// ============================================================

const sunday = "2026-09-06";
const weekDates = weekFrom(sunday);

const shifts = [
  // שמירות (מוצע ב-security), יום ראשון, 07:00 — עם מאויש
  { id: "s-guard", date: sunday, startTime: "07:00", endTime: "19:00", label: "בוקר", assignedGuards: ["g1"], category: "שמירות" },
  // אותה קטגוריה, אותו יום, שעה מאוחרת יותר — לבדוק סדר בתוך תא
  { id: "s-guard-2", date: sunday, startTime: "19:00", endTime: "07:00", label: "לילה", assignedGuards: [], category: "שמירות" },
  // קטגוריה מותאמת-אישית, לא ברשימת ההצעה
  { id: "s-custom", date: sunday, startTime: "10:00", endTime: "14:00", label: "משהו", assignedGuards: ["g2"], category: "אבטחת אירוע" },
];

const tasks = [
  // סיור, יום שני, engine-eligible
  {
    id: "t-patrol", title: "סיור בוקר", category: "סיור", assignees: ["g3"], status: "open", priority: "medium",
    startDate: "2026-09-07", dueDate: "2026-09-07", startTime: "08:00", endTime: "12:00", positionId: null,
  },
  // כללי, קפוא (בלי שעות) — timeless, אמור לנחות אחרי הפריטים בעלי שעה
  {
    id: "t-general-frozen", title: "משהו כללי", category: "", assignees: [], status: "open", priority: "medium",
    startDate: null, dueDate: sunday, startTime: null, endTime: null, positionId: null,
  },
];

const rows = buildResourceRows({ shifts, tasks, weekDates, mode: "security" });

check("יש שורה לכל קטגוריה שבפועל בשימוש: שמירות, סיור, אבטחת אירוע, כללי", rows.length === 4, `rows=${rows.map((r) => r.category).join(",")}`);

const order = rows.map((r) => r.category);
check(
  "סדר השורות: תיקיות מוצעות של security לפי סדרן קודם (שמירות לפני סיור), ואז מותאמת-אישית",
  order.indexOf("שמירות") < order.indexOf("סיור") && order.indexOf("סיור") < order.indexOf("אבטחת אירוע"),
  `order=${order.join(",")}`
);

const guardRow = rows.find((r) => r.category === "שמירות");
const sundayCell = guardRow.days.find((d) => d.date === sunday);
check("תא שמירות/ראשון מכיל את שני הפריטים", sundayCell.items.length === 2, `count=${sundayCell.items.length}`);
check(
  "בתוך התא, הפריט המוקדם יותר (07:00) קודם לפריט המאוחר (19:00)",
  sundayCell.items[0].id === "s-guard" && sundayCell.items[1].id === "s-guard-2"
);

const generalRow = rows.find((r) => r.category === "כללי");
const generalCell = generalRow.days.find((d) => d.date === sunday);
check("הפריט הקפוא (כללי) נופל ביום העוגן שלו (dueDate)", generalCell.items.length === 1, `count=${generalCell.items.length}`);
check("לפריט הקפוא אין startTime (timeless, לא מזוייף)", !generalCell.items[0].startTime);

const emptyCell = generalRow.days.find((d) => d.date === "2026-09-08");
check("תא בלי אף פריט הוא מערך ריק, לא undefined", Array.isArray(emptyCell.items) && emptyCell.items.length === 0);

// s-guard-2 (19:00–07:00, יום ראשון) חוצה חצות — ההמשך שלו אמור לנחות גם
// בתא שמירות/שני. בלי זה מבט-המשאבים "בולע" את חצי המשמרת שאחרי חצות
// (הבאג שתוקן כאן).
const mondayGuardCell = guardRow.days.find((d) => d.date === "2026-09-07");
check(
  "משמרת חוצה-חצות ממשיכה גם בתא שמירות/שני",
  mondayGuardCell.items.length === 1 && mondayGuardCell.items[0].id === "s-guard-2"
);
check("המשך המשמרת מסומן continuesBefore", mondayGuardCell.items[0].continuesBefore === true);
check(
  "המשך המשמרת מציג startTime=00:00 (לא 19:00 המקורי) — כדי שהתא לא יראה כאילו יש שם משמרת-לילה שלמה נוספת",
  mondayGuardCell.items[0].startTime === "00:00" && mondayGuardCell.items[0].endTime === "07:00"
);

// המשך-המשמרת אחרי חצות ממוין ראשון בתא, לא לפי השעה המקורית (19:00) —
// אחרת משמרת בוקר אמיתית (07:00) הייתה מוצגת "לפני" משמרת-לילה שכבר
// רצה מאז חצות, בהיפוך לסדר הכרונולוגי האמיתי.
const mondayMorning = { id: "s-monday-am", date: "2026-09-07", startTime: "07:00", endTime: "15:00", label: "בוקר שני", assignedGuards: [], category: "שמירות" };
const orderRows = buildResourceRows({ shifts: [...shifts, mondayMorning], tasks, weekDates, mode: "security" });
const orderMondayCell = orderRows.find((r) => r.category === "שמירות").days.find((d) => d.date === "2026-09-07");
check(
  "המשך-משמרת-הלילה (00:00) ממוין לפני משמרת הבוקר האמיתית (07:00) באותו תא",
  orderMondayCell.items.length === 2 &&
    orderMondayCell.items[0].id === "s-guard-2" &&
    orderMondayCell.items[1].id === "s-monday-am"
);

const customRow = rows.find((r) => r.category === "אבטחת אירוע");
check("קטגוריה מותאמת-אישית מקבלת אייקון סביר (לא קורס)", typeof customRow.icon === "string" && customRow.icon.length > 0);

// דטרמיניזם: אותו קלט, שלוש קריאות רצופות, אותה תוצאה בדיוק.
const j1 = JSON.stringify(buildResourceRows({ shifts, tasks, weekDates, mode: "security" }));
const j2 = JSON.stringify(buildResourceRows({ shifts, tasks, weekDates, mode: "security" }));
const j3 = JSON.stringify(buildResourceRows({ shifts, tasks, weekDates, mode: "security" }));
check("שלוש קריאות רצופות על אותו קלט מייצרות JSON זהה", j1 === j2 && j2 === j3);

// קלט ריק לא קורס.
const empty = buildResourceRows({ shifts: [], tasks: [], weekDates, mode: "security" });
check("קלט ריק מחזיר מערך שורות ריק, לא קורס", Array.isArray(empty) && empty.length === 0);

// mode לא מוכר נופל לברירת המחדל (security) בלי לזרוק.
const fallback = buildResourceRows({ shifts, tasks, weekDates, mode: "no-such-mode" });
check("mode לא מוכר לא זורק — נופל לטקסונומיית ברירת המחדל", Array.isArray(fallback) && fallback.length > 0);

// ============================================================
// גבולות ל-crossesMidnight (הרחבה, אחרי הבאג שתוקן למעלה: חצי-לילה
// שנבלע). שלושה תרחישים ש-Topic 3 זיהה כבלתי-מכוסים: פריט timeless
// (בלי startTime בכלל — לא אמור לקרוס), משמרת שנגמרת בדיוק בחצות (לא
// אמורה "להמשיך" ליום שאחריה, כי אין לה עוד רגע אחרי), ומשמרת חוצה-חצות
// שהיום-שאחריה נופל מחוץ ל-weekDates (לא אמורה לייצר תא בשום מקום).
// ============================================================
const timelessShift = { id: "s-timeless-ish", date: sunday, startTime: null, endTime: null, label: "בלי שעה", assignedGuards: [], category: "שמירות" };
const timelessRows = buildResourceRows({ shifts: [timelessShift], tasks: [], weekDates, mode: "security" });
check(
  "פריט בלי startTime לא קורס ולא 'חוצה חצות' (לא נופל גם ביום שאחריו)",
  timelessRows.find((r) => r.category === "שמירות")?.days.find((d) => d.date === "2026-09-07")?.items.length === 0
);

const midnightEndShift = { id: "s-mid-end", date: sunday, startTime: "19:00", endTime: "00:00", label: "עד חצות", assignedGuards: [], category: "שמירות" };
const midnightEndRows = buildResourceRows({ shifts: [midnightEndShift], tasks: [], weekDates, mode: "security" });
check(
  "משמרת שנגמרת בדיוק בחצות לא יוצרת המשך ביום שאחריה",
  midnightEndRows.find((r) => r.category === "שמירות")?.days.find((d) => d.date === "2026-09-07")?.items.length === 0
);

const lastDay = weekDates[weekDates.length - 1]; // שבת — היום שאחריה (ראשון הבא) מחוץ לשבוע הזה
const edgeShift = { id: "s-edge", date: lastDay, startTime: "19:00", endTime: "07:00", label: "לילה בקצה השבוע", assignedGuards: [], category: "שמירות" };
const edgeRows = buildResourceRows({ shifts: [edgeShift], tasks: [], weekDates, mode: "security" });
const edgeGuardRow = edgeRows.find((r) => r.category === "שמירות");
check(
  "משמרת חוצה-חצות בקצה השבוע לא קורסת כשיום-ההמשך מחוץ ל-weekDates",
  edgeGuardRow.days.reduce((n, d) => n + d.items.length, 0) === 1
);

// ============================================================
// RESVIEW-03 · מספר פריטים דינמי בתא (D-05)
//
// למה הקטע הזה קיים: המפרט המקורי תיאר במקום אחד "3 משמרות" ובמקום אחר
// "4 עמודות-משמרת × 6 שעות", ושני התיאורים סתרו זה את זה. ההכרעה
// (06-CONTEXT.md, D-05) היא "דינמי לפי מה שבפועל מתוכנן לעמדה באותו
// יום — אין תקרה, אין מספר עמודות קבוע". הקטע הזה הוא מה שהופך את
// ההכרעה הזו מהנחה למשהו שנבדק בפועל בכל הרצה של npm test: שאם מישהו
// יחזיר בטעות תקרה (Math.min, slice(0,4) וכו') ל-ResourceGrid או
// ל-buildResourceRows, הבדיקה תיפול באדום ולא תישאר תלויה בעין.
// ============================================================
console.log("\nRESVIEW-03 · buildResourceRows — מספר פריטים דינמי בתא, בלי תקרה\n");

const dynSunday = "2026-09-06";
const dynWeek = weekFrom(dynSunday);

// ארבע קטגוריות נפרדות, אותו יום ראשון, מספר משמרות שונה בכל אחת —
// שעות יום בלבד (לא חוצות חצות), כדי שספירת התא תהיה בדיוק מספר
// המשמרות שהוזנו ולא תושפע מעותק-ההמשך (כבר מכוסה למעלה).
const oneShift = [
  { id: "d1-a", date: dynSunday, startTime: "08:00", endTime: "10:00", label: "יחיד", assignedGuards: [], category: "שמירות" },
];
const twoShifts = [
  { id: "d2-a", date: dynSunday, startTime: "08:00", endTime: "10:00", label: "א", assignedGuards: [], category: "סיור" },
  { id: "d2-b", date: dynSunday, startTime: "12:00", endTime: "14:00", label: "ב", assignedGuards: [], category: "סיור" },
];
const threeShifts = [
  { id: "d3-a", date: dynSunday, startTime: "08:00", endTime: "10:00", label: "א", assignedGuards: [], category: "עמדה קבועה" },
  { id: "d3-b", date: dynSunday, startTime: "10:00", endTime: "12:00", label: "ב", assignedGuards: [], category: "עמדה קבועה" },
  { id: "d3-c", date: dynSunday, startTime: "12:00", endTime: "14:00", label: "ג", assignedGuards: [], category: "עמדה קבועה" },
];
// סדר-קלט לא-כרונולוגי בכוונה — הבדיקה #4 למטה מוודאת שהתא ממיין
// מחדש לפי startTime ולא שומר על סדר ההזנה.
const fiveShifts = [
  { id: "d5-c", date: dynSunday, startTime: "15:00", endTime: "17:00", label: "ג", assignedGuards: [], category: "ציוד אבטחה" },
  { id: "d5-a", date: dynSunday, startTime: "07:00", endTime: "09:00", label: "א", assignedGuards: [], category: "ציוד אבטחה" },
  { id: "d5-e", date: dynSunday, startTime: "13:00", endTime: "15:00", label: "ה", assignedGuards: [], category: "ציוד אבטחה" },
  { id: "d5-b", date: dynSunday, startTime: "09:00", endTime: "11:00", label: "ב", assignedGuards: [], category: "ציוד אבטחה" },
  { id: "d5-d", date: dynSunday, startTime: "11:00", endTime: "13:00", label: "ד", assignedGuards: [], category: "ציוד אבטחה" },
];

const dynShifts = [...oneShift, ...twoShifts, ...threeShifts, ...fiveShifts];
const dynRows = buildResourceRows({ shifts: dynShifts, tasks: [], weekDates: dynWeek, mode: "security" });

const countOf = (category) => dynRows.find((r) => r.category === category)?.days.find((d) => d.date === dynSunday)?.items.length;

const counts = {
  "שמירות": countOf("שמירות"),
  "סיור": countOf("סיור"),
  "עמדה קבועה": countOf("עמדה קבועה"),
  "ציוד אבטחה": countOf("ציוד אבטחה"),
};

// 1. כל קטגוריה מחזירה בדיוק את מספר הפריטים שהוזן לה.
check("תא שמירות/ראשון מכיל 1 פריט", counts["שמירות"] === 1, `count=${counts["שמירות"]}`);
check("תא סיור/ראשון מכיל 2 פריטים", counts["סיור"] === 2, `count=${counts["סיור"]}`);
check("תא עמדה-קבועה/ראשון מכיל 3 פריטים", counts["עמדה קבועה"] === 3, `count=${counts["עמדה קבועה"]}`);
check("תא ציוד-אבטחה/ראשון מכיל 5 פריטים", counts["ציוד אבטחה"] === 5, `count=${counts["ציוד אבטחה"]}`);

// 2. הספירות שונות זו מזו באותה קריאה אחת — המנוע לא מיישר תאים למספר
// אחיד (למשל תקרה סמויה של 3 הייתה הופכת את {1,2,3,5} ל-{1,2,3,3}).
const countSet = new Set(Object.values(counts));
check(
  "קבוצת הספירות בארבע השורות היא בדיוק {1,2,3,5}",
  countSet.size === 4 && [1, 2, 3, 5].every((n) => countSet.has(n)),
  `counts=${JSON.stringify(counts)}`
);

// 3. אין תקרה נסתרת: אצווה של 12 משמרות באותה קטגוריה/יום מחזירה 12.
const twelveShifts = Array.from({ length: 12 }, (_, i) => ({
  id: `d12-${i}`,
  date: dynSunday,
  startTime: `${String(6 + i).padStart(2, "0")}:00`,
  endTime: `${String(7 + i).padStart(2, "0")}:00`,
  label: `משמרת ${i + 1}`,
  assignedGuards: [],
  category: "דוח משמרת",
}));
const twelveRows = buildResourceRows({ shifts: twelveShifts, tasks: [], weekDates: dynWeek, mode: "security" });
const twelveCount = twelveRows.find((r) => r.category === "דוח משמרת")?.days.find((d) => d.date === dynSunday)?.items.length;
check("תא עם 12 משמרות מחזיר 12 — לא 3, לא 4, לא 10", twelveCount === 12, `count=${twelveCount}`);

// 4. הסדר בתוך התא של חמש המשמרות כרונולוגי עולה לפי startTime — נגזר
// מהנתונים, לא מסדר ההזנה (שהוזן במכוון לא-מסודר למעלה).
const fiveCell = dynRows.find((r) => r.category === "ציוד אבטחה")?.days.find((d) => d.date === dynSunday);
const fiveOrder = (fiveCell?.items || []).map((it) => it.startTime);
check(
  "חמש המשמרות בתא ציוד-אבטחה ממוינות כרונולוגית עולה, לא לפי סדר ההזנה",
  JSON.stringify(fiveOrder) === JSON.stringify(["07:00", "09:00", "11:00", "13:00", "15:00"]),
  `order=${fiveOrder.join(",")}`
);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
