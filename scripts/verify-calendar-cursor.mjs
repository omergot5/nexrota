// Standalone check for where the calendar opens (calendarCursor.js).
//   node scripts/verify-calendar-cursor.mjs

import { initialCursor } from "../src/lib/calendarCursor.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const at = (...dates) => dates.map((date) => ({ date }));

console.log("\nהיומן נפתח על השבוע שעובדים עליו\n");
const today = "2026-10-06"; // שלישי
check("אין משמרות בכלל — היום", initialCursor([], today) === today);
check("יש משמרות השבוע — היום", initialCursor(at("2026-10-07"), today) === today);
check("רק השבוע הבא נבנה — היומן קופץ אליו", initialCursor(at("2026-10-11", "2026-10-13"), today) === "2026-10-11");
check("כמה שבועות קדימה — הקרוב ביותר", initialCursor(at("2026-10-25", "2026-10-18"), today) === "2026-10-18");
check("רק עבר — המשמרת האחרונה", initialCursor(at("2026-09-20", "2026-09-27"), today) === "2026-09-27");
check("שבוע עם משמרת עבר וגם עתיד — היום", initialCursor(at("2026-10-04", "2026-10-08"), today) === today);
check("משמרת בלי תאריך לא שוברת", initialCursor([{}, ...at("2026-10-11")], today) === "2026-10-11");

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
