// Standalone check for per-person colours (guardColors.js).
//   node scripts/verify-guard-colors.mjs
//
// מה נשמר כאן: חייל מזהה את עצמו לפי צבע, ולכן עד 36 אנשים אף צבע לא חוזר, עד 12
// כולם בגוון אחר, וכל צבע נושא דיו קריא. ושהצירוף של אדם לא מערבב את כולם.

import { GUARD_COLOR_COUNT, GUARD_PALETTE, colorsForGuards } from "../src/lib/guardColors.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * linear(((n >> 16) & 255) / 255) + 0.7152 * linear(((n >> 8) & 255) / 255) + 0.0722 * linear((n & 255) / 255);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const INK_DARK = lum("#1C3B37");

// מזהים שנראים כמו אמיתיים (uuid) אבל קבועים — הבדיקה חייבת להיות דטרמיניסטית.
const uuidLike = (i) => {
  const h = (n) => ((i * 2654435761 + n * 40503) >>> 0).toString(16).padStart(8, "0");
  return `${h(1)}-${h(2).slice(0, 4)}-${h(3).slice(0, 4)}-${h(4).slice(0, 4)}-${h(5)}${h(6).slice(0, 4)}`;
};
const team = (n) => Array.from({ length: n }, (_, i) => ({ id: uuidLike(i + 1) }));

console.log("\nהפלטה\n");
{
  const all = GUARD_PALETTE.flat();
  check(`${GUARD_COLOR_COUNT} צבעים`, all.length === GUARD_COLOR_COUNT);
  check("כולם שונים זה מזה", new Set(all).size === all.length);
  const worst = Math.min(...all.map((hex) => Math.max(ratio(lum(hex), 1), ratio(lum(hex), INK_DARK))));
  check("דיו לבן או כהה עומד ב-4.5:1 על כל צבע", worst >= 4.5, `הגרוע ביותר ${worst.toFixed(2)}`);
}

console.log("\nייחודיות\n");
{
  for (const n of [12, 20, 30, 36]) {
    const colors = [...colorsForGuards(team(n)).values()];
    check(`${n} אנשים — ${n} צבעים שונים`, new Set(colors).size === n, `${new Set(colors).size} שונים`);
  }
  const ids12 = colorsForGuards(team(12));
  // גוון = העמדה בתוך הטבלה; 12 אנשים צריכים 12 גוונים שונים.
  const hueOf = (hex) => GUARD_PALETTE.map((row) => row.indexOf(hex)).find((i) => i >= 0);
  check("עד 12 אנשים — כל אחד בגוון אחר", new Set([...ids12.values()].map(hueOf)).size === 12);
  const over = [...colorsForGuards(team(40)).values()];
  check("יותר מ-36 — לא קורס, ומתחיל לחזור רק אחרי שהכול נלקח", over.length === 40 && new Set(over).size === 36);
}

console.log("\nדטרמיניזם ויציבות\n");
{
  const a = colorsForGuards(team(30));
  const b = colorsForGuards([...team(30)].reverse());
  check("אותו צוות, סדר אחר ברשימה — אותם צבעים", [...a].every(([id, c]) => b.get(id) === c));
  const before = colorsForGuards(team(29));
  const after = colorsForGuards(team(30));
  const changed = [...before].filter(([id, c]) => after.get(id) !== c).length;
  check("צירוף חייל לצוות של 29 משנה מעט אחרים", changed <= 10, `${changed} מתוך 29 השתנו`);
}

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
