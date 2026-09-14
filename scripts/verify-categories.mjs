// Standalone sanity check for the shared category taxonomy (D-01).
//   node scripts/verify-categories.mjs
//
// Pure module only — no browser, no database. Added as part of Topic 3
// (test-coverage gaps): FOLDERS_BY_MODE had zero coverage before this file,
// even though it's exactly the mechanism Topic 1 fixed (task templates and
// built-in conflict rules used to leak between security/restaurant/army).
// A silent regression here — a deleted mode key, a category typo, a mode
// missing "כללי" — would break domain separation again with nothing to
// catch it.

import { categoryOptions, DEFAULT_MODE, folderIcon, foldersFor, FOLDERS_BY_MODE, UNFILED } from "../src/lib/categories.js";
import { VALID_MODES } from "../src/lib/api.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
console.log("\nD-01 · categories.js — FOLDERS_BY_MODE\n");
// ============================================================

// שלושה מקומות עצמאיים אמורים להסכים על אותה רשימת תחומים בדיוק:
// FOLDERS_BY_MODE (כאן), VALID_MODES (api.js, תואם את ה-CHECK ב-DB),
// ו-PROFILE_TERMS (terms.js, נבדק ב-verify-terms.mjs). סטייה בין
// FOLDERS_BY_MODE ל-VALID_MODES היא בדיוק הבאג שנושא 1 תיקן במיגרציה
// 0016 — מצב שה-DB מכיר אבל הקוד לא, או להפך.
const folderKeys = Object.keys(FOLDERS_BY_MODE).sort();
const validModesSorted = [...VALID_MODES].sort();
check(
  "FOLDERS_BY_MODE מכסה בדיוק את אותם מצבים כמו VALID_MODES (api.js)",
  JSON.stringify(folderKeys) === JSON.stringify(validModesSorted),
  `folders=${folderKeys.join(",")} valid=${validModesSorted.join(",")}`
);

for (const mode of VALID_MODES) {
  const list = FOLDERS_BY_MODE[mode];
  check(`${mode}: יש רשימת תיקיות לא ריקה`, Array.isArray(list) && list.length > 0);
  check(`${mode}: כולל את הקטגוריה הנייטרלית "${UNFILED}"`, (list || []).some((f) => f.name === UNFILED));
  check(
    `${mode}: אין שם תיקייה כפול בתוך אותו מצב`,
    new Set((list || []).map((f) => f.name)).size === (list || []).length
  );
  check(
    `${mode}: לכל תיקייה יש icon (מחרוזת לא ריקה)`,
    (list || []).every((f) => typeof f.icon === "string" && f.icon.length > 0)
  );
}

// foldersFor: מצב לא מוכר נופל לברירת המחדל, לא זורק ולא מחזיר undefined.
check("foldersFor('no-such-mode') נופל ל-DEFAULT_MODE", foldersFor("no-such-mode") === FOLDERS_BY_MODE[DEFAULT_MODE]);
check("foldersFor(undefined) לא זורק", (() => {
  try {
    return Array.isArray(foldersFor(undefined));
  } catch {
    return false;
  }
})());

// folderIcon: מחפש בכל הרשימות (לא רק במצב הפעיל) — קטגוריה שהגיעה
// מתחום אחר לפני מעבר-פרופיל (סעיף 5 בתוכנית נושא 1) עדיין מקבלת אייקון
// אמיתי, לא "clipboard" גנרי סתם כי היא לא נמצאה במצב הנוכחי.
check("folderIcon מוצא קטגוריה שקיימת רק במצב אחר (army: 'כוננות')", folderIcon("כוננות") === "bell");
check("folderIcon על שם לא-קיים בכלל נופל ל-'clipboard'", folderIcon("קטגוריה שלא קיימת בשום מקום") === "clipboard");

// categoryOptions: סדר קבוע (תיקיות מוצעות לפי סדרן, ואז מותאמות-אישית
// לפי א"ב) — לכל אחד משלושת המצבים, לא רק security (זה כבר נבדק
// עקיפות דרך resource-view, אבל רק על security).
for (const mode of VALID_MODES) {
  const known = foldersFor(mode).map((f) => f.name);
  const opts = categoryOptions([], [], mode);
  check(`categoryOptions([], [], '${mode}') מחזיר את כל התיקיות המוצעות, לפי הסדר`, JSON.stringify(opts) === JSON.stringify(known));
}

const shifts = [{ category: "קטגוריה-בי" }, { category: "קטגוריה-אלף" }];
const optsWithCustom = categoryOptions(shifts, [], "security");
const known = foldersFor("security").map((f) => f.name);
check(
  "קטגוריות מותאמות-אישית מגיעות אחרי המוצעות, לפי א״ב",
  JSON.stringify(optsWithCustom) === JSON.stringify([...known, "קטגוריה-אלף", "קטגוריה-בי"])
);

// דטרמיניזם.
const j1 = JSON.stringify(categoryOptions(shifts, [], "restaurant"));
const j2 = JSON.stringify(categoryOptions(shifts, [], "restaurant"));
check("categoryOptions דטרמיניסטי על אותו קלט", j1 === j2);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
