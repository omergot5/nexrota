// Standalone check for the availability reminder engine (reminders.js).
//   node scripts/verify-reminders.mjs
//
// מה נשמר כאן: הבאנר אצל החייל והרשימה אצל המפקד נגזרים מאותו availStatus,
// ולכן לא יכולים לחלוק; ושהקישור לוואטסאפ לעולם לא נשלח למספר שגוי.

import { availabilityProgress, guardsWhoHaveNotReported, reminderText, waPhone, whatsappLink } from "../src/lib/reminders.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const week = ["2026-10-11", "2026-10-12", "2026-10-13"];
const shifts = [
  { id: "a", date: "2026-10-11", startTime: "06:00", endTime: "14:00" },
  { id: "b", date: "2026-10-12", startTime: "06:00", endTime: "14:00" },
  { id: "c", date: "2026-10-13", startTime: "06:00", endTime: "14:00" },
  { id: "x", date: "2026-10-25", startTime: "06:00", endTime: "14:00" }, // שבוע אחר
];
const guards = [{ id: "g1", name: "דנה" }, { id: "g2", name: "רועי" }, { id: "g3", name: "מאיה" }];
const availability = {
  "g1-a": "available", "g1-b": "unavailable", "g1-c": "available", // ענתה על הכול
  "g2-a": "available",                                              // ענה על חלק
  // g3 — לא ענתה בכלל. תשובה על משמרת בשבוע אחר לא נחשבת.
  "g3-x": "available",
};

console.log("\nהתקדמות החייל — מה שהבאנר אומר\n");
const p1 = availabilityProgress({ userId: "g1", shifts, availability, weekDates: week });
check("ענתה על הכול: אין מה להזכיר", p1.total === 3 && p1.remaining === 0, JSON.stringify(p1));
const p2 = availabilityProgress({ userId: "g2", shifts, availability, weekDates: week });
check("ענה על אחת מתוך שלוש: נשארו שתיים", p2.total === 3 && p2.answered === 1 && p2.remaining === 2, JSON.stringify(p2));
const p3 = availabilityProgress({ userId: "g3", shifts, availability, weekDates: week });
check("לא ענתה: כל השלוש פתוחות, ומשמרת משבוע אחר לא נספרת", p3.remaining === 3, JSON.stringify(p3));
check("שבוע בלי משמרות: אין מה להגיש", availabilityProgress({ userId: "g3", shifts: [], availability, weekDates: week }).total === 0);

console.log("\nמי לא הגיש — מה שהמפקד רואה\n");
const missing = guardsWhoHaveNotReported({ guards, shifts, availability, weekDates: week }).map((g) => g.id);
check("רק מי שלא נגע בשום משמרת של השבוע", missing.join() === "g3", missing.join());
check("מי שענה על חלק — הגיש", !missing.includes("g2"));
check("הרשימה והבאנר מסכימים: מי שאין לו מענה בכלל הוא מי שנשארו לו כל המשמרות",
  guards.every((g) => {
    const p = availabilityProgress({ userId: g.id, shifts, availability, weekDates: week });
    return missing.includes(g.id) === (p.total > 0 && p.remaining === p.total);
  }));

console.log("\nטלפון וקישור וואטסאפ\n");
check("050-123-4567 → 972501234567", waPhone("050-123-4567") === "972501234567");
check("+972 50 123 4567 נשאר", waPhone("+972 50 123 4567") === "972501234567");
check("מספר קצר מדי — אין נמען", waPhone("123") === null && waPhone("") === null && waPhone(null) === null);
const link = whatsappLink({ phone: "0501234567", text: 'היי "דנה"\nשורה שנייה' });
check("הקישור מכוון למספר", link.startsWith("https://wa.me/972501234567?text="));
check("הנוסח מקודד: מירכאות ושורה חדשה לא שוברות את הקישור", !/[\s"]/.test(link.split("?text=")[1]) && link.includes("%0A"));
check("בלי טלפון נפתח בלי נמען", whatsappLink({ phone: "", text: "x" }) === "https://wa.me/?text=x");

console.log("\nנוסח ההודעה\n");
const one = reminderText({ name: "דנה", range: "11–17 באוקטובר", deadline: "חמישי 8.10 בשעה 18:00", teamCode: "LA7234" });
check("אישית: פונה בשם", one.startsWith("היי דנה"));
check("אישית: אומרת עד מתי ואיך נכנסים", one.includes("עד חמישי 8.10 בשעה 18:00") && one.includes("LA7234"));
const group = reminderText({ names: ["מאיה", "רועי"], range: "11–17 באוקטובר", deadline: "חמישי", teamCode: "LA7234" });
check("קבוצה: מפרטת מי עוד חסר", group.includes("טרם הגישו: מאיה, רועי."));
check("קבוצה: לא פונה לאדם אחד בשמו", !group.startsWith("היי"));

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
