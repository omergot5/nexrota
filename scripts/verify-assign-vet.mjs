// Standalone check for the manual-assignment gate (assignVet.js).
//   node scripts/verify-assign-vet.mjs
//
// מה נשמר כאן: שיבוץ ידני (הוספה או גרירה) עובר את אותה בדיקה שהמנוע עושה —
// מנוחה, חפיפה, זמינות, תקרה — ושכשירות לא ניתנת לעקיפה אפילו עם נימוק.

import { refusalText, vetAssignment } from "../src/lib/assignVet.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const sh = (id, date, startTime, endTime, extra = {}) => ({
  id, date, startTime, endTime, label: id, category: "סיור", requiredGuards: 1, assignedGuards: [], ...extra,
});
const dana = { id: "g1", name: "דנה" };

console.log("\nשיבוץ ידני רגיל\n");
{
  const target = sh("t", "2026-10-12", "06:00", "14:00");
  const free = vetAssignment({ guard: dana, shift: target, shifts: [target] });
  check("אדם פנוי — מותר", free.ok === true);

  const clash = sh("c", "2026-10-12", "10:00", "16:00", { assignedGuards: ["g1"] });
  const overlap = vetAssignment({ guard: dana, shift: target, shifts: [target, clash] });
  check("חפיפה לתורנות אחרת — נדחה עם הסיבה", !overlap.ok && overlap.code === "overlap", JSON.stringify(overlap));

  const lateShift = sh("l", "2026-10-11", "22:00", "05:00", { assignedGuards: ["g1"] });
  const rest = vetAssignment({ guard: dana, shift: target, shifts: [target, lateShift] });
  check("פחות ממנוחה מינימלית — נדחה", !rest.ok && rest.code === "rest", JSON.stringify(rest));

  const off = vetAssignment({ guard: dana, shift: target, shifts: [target], availability: { "g1-t": "unavailable" } });
  check("סימן 'לא זמין' — נדחה", !off.ok && off.code === "unavailable");
}

console.log("\nכשירות — לעולם לא ניתנת לעקיפה\n");
{
  const target = sh("t", "2026-10-12", "06:00", "14:00", { category: "תורנות מטבח" });
  const guard = { id: "g1", name: "דנה", qualifiedCategories: ["סיור"] };
  const plain = vetAssignment({ guard, shift: target, shifts: [target] });
  check("לא כשירה לקטגוריה — נדחה", !plain.ok && plain.code === "unqualified");
  const forced = vetAssignment({ guard, shift: target, shifts: [target], overrideNote: "אין מי אחר" });
  check("גם עם נימוק — כשירות לא עוקפים", !forced.ok && forced.code === "unqualified");
}

console.log("\n'שבץ בכל זאת' — נימוק כתוב עוקף את שאר החוקים\n");
{
  const target = sh("t", "2026-10-12", "06:00", "14:00");
  const clash = sh("c", "2026-10-12", "10:00", "16:00", { assignedGuards: ["g1"] });
  const forced = vetAssignment({ guard: dana, shift: target, shifts: [target, clash], overrideNote: "חור בלילה, אין מי שיחליף" });
  check("עם נימוק — מותר, ומסומן כעקיפה", forced.ok === true && forced.overridden === true);
  const blank = vetAssignment({ guard: dana, shift: target, shifts: [target, clash], overrideNote: "   " });
  check("נימוק ריק (רווחים) לא נחשב נימוק", !blank.ok);
}

console.log("\nגרירה — האדם יוצא מהמשמרת שממנה גוררים\n");
{
  const from = sh("from", "2026-10-12", "06:00", "14:00", { assignedGuards: ["g1"] });
  const next = sh("next", "2026-10-12", "14:00", "22:00");
  const dragged = vetAssignment({ guard: dana, shift: next, shifts: [from, next], movingFromShiftId: "from" });
  check("גרירה לתורנות צמודה — מותרת (הוא כבר לא בראשונה)", dragged.ok === true, JSON.stringify(dragged));
  const copy = vetAssignment({ guard: dana, shift: from, shifts: [from, next] });
  check("אותה תורנות בלי גרירה: כבר משובצת", !copy.ok && copy.code === "already");
  // תורנות שחופפת רק למשמרת שממנה גוררים — מותרת, כי היא יוצאת.
  const sameSlot = sh("o", "2026-10-12", "10:00", "18:00");
  const freed = vetAssignment({ guard: dana, shift: sameSlot, shifts: [from, sameSlot], movingFromShiftId: "from" });
  check("חופפת רק למשמרת שהוא עוזב — מותרת", freed.ok === true, JSON.stringify(freed));
  // ... אבל אם יש לו תורנות שלישית שחופפת ליעד — נדחית, גם בגרירה.
  const third = sh("third", "2026-10-12", "16:00", "23:00", { assignedGuards: ["g1"] });
  const blocked = vetAssignment({ guard: dana, shift: sameSlot, shifts: [from, sameSlot, third], movingFromShiftId: "from" });
  check("חופפת לתורנות שלישית שלו — נדחית גם בגרירה", !blocked.ok && blocked.code === "overlap", JSON.stringify(blocked));
}

console.log("\nהודעה\n");
{
  const text = refusalText(dana, { reason: "חופף למשמרת אחרת" });
  check("ההודעה נושאת את שם האדם ואת הסיבה", text.includes("דנה") && text.includes("חופף"));
  check("נתונים חסרים לא קורסים", vetAssignment({}).ok === false);
}

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
