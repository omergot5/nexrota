// Standalone sanity check for the vocabulary dictionary (terms.js).
//   node scripts/verify-terms.mjs
//
// Pure module only — no browser, no database. Added as part of Topic 3
// (test-coverage gaps): PROFILE_TERMS had zero coverage before this file.
// The real risk isn't a missing key (that's caught loudly — t() returns
// the raw key literal, which is visibly wrong in the UI). It's a PROFILE_TERMS
// override for a key that doesn't exist in BASE: the override is silently
// dead code (the merge `{ ...BASE, ...PROFILE_TERMS[mode] }` still applies
// it, but nothing ever reads that key), which usually means the matching
// key in BASE was renamed and the override was forgotten — the army/
// restaurant screen quietly falls back to the security wording instead.

import { BASE, PROFILE_TERMS, PROFILES } from "../src/lib/terms.js";
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
console.log("\nD-01 · terms.js — PROFILE_TERMS\n");
// ============================================================

const baseKeys = new Set(Object.keys(BASE));

check(
  "PROFILE_TERMS מכסה בדיוק את אותם מצבים כמו VALID_MODES (api.js)",
  JSON.stringify(Object.keys(PROFILE_TERMS).sort()) === JSON.stringify([...VALID_MODES].sort())
);

check(
  "PROFILES (מסך בחירת הפרופיל) מכסה בדיוק את אותם מצבים",
  JSON.stringify(PROFILES.map((p) => p.id).sort()) === JSON.stringify([...VALID_MODES].sort())
);

for (const mode of VALID_MODES) {
  const overrides = PROFILE_TERMS[mode] || {};
  const overrideKeys = Object.keys(overrides);
  const orphans = overrideKeys.filter((k) => !baseKeys.has(k));
  check(
    `${mode}: כל מפתח שנדרס קיים גם ב-BASE (אין דריסה יתומה שנופלת בשקט)`,
    orphans.length === 0,
    `orphans=${orphans.join(",")}`
  );
  check(
    `${mode}: כל ערך שנדרס הוא מחרוזת לא ריקה`,
    overrideKeys.every((k) => typeof overrides[k] === "string" && overrides[k].length > 0)
  );
}

// security הוא הבסיס עצמו (כל אוצר המילים היה אבטחה-מוטה מלכתחילה) —
// דריסה ריקה במפורש, לא בטעות.
check("security לא דורס שום מפתח (== BASE במלואו)", Object.keys(PROFILE_TERMS.security).length === 0);

// merge בפועל: לוקח מפתח שקיים בכל שלושת הפרופילים ומוודא שה-merge
// {...BASE, ...override} מייצר את הערך הנכון, לא את זה של BASE בטעות.
const merged = (mode) => ({ ...BASE, ...(PROFILE_TERMS[mode] || {}) });
check(
  "army.noun.memberPlural דורס את BASE ('כפופים', לא 'שומרים')",
  merged("army")["noun.memberPlural"] === "כפופים"
);
check(
  "restaurant.noun.memberPlural דורס את BASE ('עובדים', לא 'שומרים')",
  merged("restaurant")["noun.memberPlural"] === "עובדים"
);
check(
  "מפתח שאף פרופיל לא דורס (nav.dashboard) זהה בשלושתם",
  merged("security")["nav.dashboard"] === merged("restaurant")["nav.dashboard"] &&
    merged("restaurant")["nav.dashboard"] === merged("army")["nav.dashboard"]
);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
