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

const emptyCell = guardRow.days.find((d) => d.date === "2026-09-07");
check("תא בלי אף פריט הוא מערך ריק, לא undefined", Array.isArray(emptyCell.items) && emptyCell.items.length === 0);

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

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
