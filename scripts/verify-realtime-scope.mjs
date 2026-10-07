// Standalone check: מחיקה בצוות אחר לא מרעננת את המסך שלי.
//   node scripts/verify-realtime-scope.mjs
//
// נולד מממצא 8 ב-docs/qa/2026-10-07-qa-report.md: Supabase לא מחיל RLS על אירועי
// DELETE, ולכן כל מחיקה בכל צוות הגיעה לכל לקוח והפעילה טעינה מלאה.

import { isRelevantChange } from "../src/lib/realtimeScope.js";

let failures = 0;
const check = (label, cond) => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
};

const data = {
  shifts: [{ id: "s1" }, { id: "s2" }],
  tasks: [{ id: "t1" }],
  members: [{ id: "p1" }, { id: "sup" }],
  guards: [{ id: "p1" }],
  swapRequests: [{ id: "w1" }],
};
const del = (table, old) => ({ eventType: "DELETE", table, old });

console.log("\nINSERT/UPDATE תמיד עוברים (RLS כבר סינן אותם)\n");
check("INSERT", isRelevantChange({ eventType: "INSERT", table: "gs_work_items", new: { id: "zzz" } }, data));
check("UPDATE", isRelevantChange({ eventType: "UPDATE", table: "gs_profiles", new: { id: "zzz" } }, data));

console.log("\nDELETE של משהו שעל המסך — מרענן\n");
check("משמרת שלי", isRelevantChange(del("gs_work_items", { id: "s1" }), data));
check("משימה שלי", isRelevantChange(del("gs_work_items", { id: "t1" }), data));
check("שיבוץ במשמרת שלי", isRelevantChange(del("gs_work_item_assignments", { work_item_id: "s2", guard_id: "x" }), data));
check("זמינות במשמרת שלי", isRelevantChange(del("gs_availability", { shift_id: "s1", guard_id: "p1" }), data));
check("אדם מהצוות שלי", isRelevantChange(del("gs_profiles", { id: "p1" }), data));
check("בקשת החלפה שלי", isRelevantChange(del("gs_swap_requests", { id: "w1" }), data));

console.log("\nDELETE בצוות אחר — לא מרענן\n");
check("משמרת זרה", !isRelevantChange(del("gs_work_items", { id: "other" }), data));
check("שיבוץ זר", !isRelevantChange(del("gs_work_item_assignments", { work_item_id: "other", guard_id: "x" }), data));
check("זמינות זרה", !isRelevantChange(del("gs_availability", { shift_id: "other", guard_id: "x" }), data));
check("אדם זר", !isRelevantChange(del("gs_profiles", { id: "other" }), data));
check("בקשה זרה", !isRelevantChange(del("gs_swap_requests", { id: "other" }), data));

console.log("\nאירוע שאי אפשר לזהות — מרענן (עדיף מיותר מאשר פספוס)\n");
check("DELETE בלי מפתח", isRelevantChange(del("gs_work_items", {}), data));
check("טבלה לא מוכרת", isRelevantChange(del("gs_unknown", { id: "x" }), data));
check("לפני שנטענו נתונים — מחיקה לא מרעננת (הטעינה הראשונה מביאה הכול)", !isRelevantChange(del("gs_work_items", { id: "s1" }), {}));

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
