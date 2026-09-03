// Standalone source-level gate for the two board comprehension signals named
// in UAT gap G-05-1 (BOARD-04 / D-13, see .planning/debug/board04-comprehension-confusion.md).
//   node scripts/verify-board-signals.mjs
//
// Pure source-text check — the components are JSX and cannot be `import`ed
// by Node, so this reads them with `readFileSync` and asserts structural
// invariants instead. Sibling of verify-board.mjs, not an edit to it: that
// file's header declares itself pure-module-only, and this script keeps
// that contract by never importing anything from src/.
//
// Scope is locked to exactly three files: icons.jsx, UnifiedBoard.jsx,
// views.jsx. This script must NEVER read itself and must NEVER scan a
// directory (no globbing) — if it did, the literals it searches for inside
// its own body (the very Hebrew strings and prop names below) could satisfy
// or invalidate its own checks, making the gate silently vacuous. Do not
// "helpfully" widen this to a glob; add a fourth named path instead.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
// Comment stripping — non-negotiable, this codebase comments heavily in
// Hebrew. A perfectly correct fix that leaves a comment explaining what
// glyph was removed must never fail the check that verifies the removal.
// Every check below runs against this stripped copy; line indices stay
// aligned with the original (a comment line becomes "", not a deleted
// line), so window-based checks still line up.
// ============================================================
function stripCommentLines(text) {
  const lines = text.split("\n");
  let inBlock = false;
  let closer = "*/";
  return lines.map((line) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes(closer)) inBlock = false;
      return "";
    }
    if (trimmed.startsWith("//")) return "";
    if (trimmed.startsWith("{/*")) {
      if (!trimmed.includes("*/}")) {
        inBlock = true;
        closer = "*/}";
      }
      return "";
    }
    if (trimmed.startsWith("/*")) {
      if (!trimmed.includes("*/")) {
        inBlock = true;
        closer = "*/";
      }
      return "";
    }
    if (trimmed.startsWith("*/")) return "";
    if (trimmed.startsWith("*")) return "";
    return line;
  });
}

// ============================================================
// Load the three named files, and only these three. No Math.random(), no
// Date, no filesystem walking, no network — same source in, same output
// out, always (CLAUDE.md iron rule 1).
// ============================================================
const ICONS_PATH = fileURLToPath(new URL("../src/components/icons.jsx", import.meta.url));
const BOARD_PATH = fileURLToPath(
  new URL("../src/components/supervisor/UnifiedBoard.jsx", import.meta.url)
);
const VIEWS_PATH = fileURLToPath(new URL("../src/components/supervisor/views.jsx", import.meta.url));

const iconsRaw = readFileSync(ICONS_PATH, "utf8");
const boardRaw = readFileSync(BOARD_PATH, "utf8");
const viewsRaw = readFileSync(VIEWS_PATH, "utf8");

const iconsLines = stripCommentLines(iconsRaw);
const boardLines = stripCommentLines(boardRaw);
const viewsLines = stripCommentLines(viewsRaw);

const OUT_OF_ENGINE_TEXT = "מחוץ למנוע";

// ============================================================
console.log("\nG-05-1 · board-signals — הפרדת הגלף הטיימלס מן המנעול, וקריאות חסימת הכשירות\n");
// ============================================================

// ---- 1. גלף טיימלס קיים ----
const CLOCK_OFF_KEY_RE = /["']clock-off["']\s*:/;
const hasClockOffKey = iconsLines.some((l) => CLOCK_OFF_KEY_RE.test(l));
check("icons.jsx מגדיר מפתח גיאומטריה בשם clock-off", hasClockOffKey);

// ---- 2. תג "מחוץ למנוע" לא חולק את גלף המנעול ----
// חיפוש ממוקד ל-icon="lock" / name="lock" (לא לתת-מחרוזת "lock" גולמית —
// "clock-off" מכיל "lock" כתת-מחרוזת, וחיפוש נאיבי היה נכשל אחרי התיקון).
const PADLOCK_REF_RE = /(icon|name)\s*=\s*["']lock["']/;

function padlockNearBadgeText(lines, fileLabel) {
  const hits = [];
  lines.forEach((line, i) => {
    if (!line.includes(OUT_OF_ENGINE_TEXT)) return;
    const windowStart = Math.max(0, i - 2);
    const windowEnd = Math.min(lines.length - 1, i + 1);
    for (let w = windowStart; w <= windowEnd; w++) {
      if (PADLOCK_REF_RE.test(lines[w])) hits.push(`${fileLabel}:${w + 1}`);
    }
  });
  return hits;
}

const padlockHits = [
  ...padlockNearBadgeText(boardLines, "UnifiedBoard.jsx"),
  ...padlockNearBadgeText(viewsLines, "views.jsx"),
];
check(
  "התג 'מחוץ למנוע' לא חולק גלף עם המנעול באף אחד מהקבצים",
  padlockHits.length === 0,
  padlockHits.join(", ")
);

// ---- 3. תג "מחוץ למנוע" משתמש בגלף clock-off, בדיוק בשני מקומות ----
const CLOCK_OFF_BADGE_RE = /<Badge[^>]*icon\s*=\s*["']clock-off["']/;

function clockOffBadgeSites(lines) {
  let sites = 0;
  lines.forEach((line, i) => {
    if (!line.includes(OUT_OF_ENGINE_TEXT)) return;
    const windowStart = Math.max(0, i - 2);
    let found = false;
    for (let w = windowStart; w < i && !found; w++) {
      if (CLOCK_OFF_BADGE_RE.test(lines[w])) found = true;
    }
    if (found) sites++;
  });
  return sites;
}

const totalClockOffSites = clockOffBadgeSites(boardLines) + clockOffBadgeSites(viewsLines);
check(
  "התג 'מחוץ למנוע' נושא את גלף clock-off בדיוק בשני מקומות (הלוח + TaskRow) — לא פחות ולא יותר",
  totalClockOffSites === 2,
  `נמצאו ${totalClockOffSites} מקומות`
);

// ---- חיתוך הרכיב People לבדיקות 4 ו-5 ----
function sliceExport(lines, startMarker) {
  const startIdx = lines.findIndex((l) => l.includes(startMarker));
  if (startIdx === -1) return [];
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^export\s/.test(lines[i].trim())) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx);
}

const peopleSlice = sliceExport(viewsLines, "export const People");

// ---- 4. אין גודל גופן שנגזר מ-size בענף החסום ----
// Avatar's own ratio (size * 0.38) חי ב-ui.jsx, מחוץ לחיתוך הזה, ולא נגעו בו.
const SIZE_DECIMAL_RE = /size\s*\*\s*\d*\.\d+/;
const sizeDerivedFontSize = peopleSlice.some((l) => SIZE_DECIMAL_RE.test(l));
check(
  "הענף החסום של People לא מחשב גודל גופן מ-size (בלי size * מספר עשרוני)",
  !sizeDerivedFontSize
);

// ---- 5. blockedLabel מוצג בגודל התווית של הלוח (11px), לא בתוך העיגול ----
const BLOCKED_LABEL_NODE_RE = /\{blockedLabel\}/;
const LABEL_SIZE_CLASS = "text-[11px]";

function blockedLabelIsLegible(slice) {
  const idx = slice.findIndex((l) => BLOCKED_LABEL_NODE_RE.test(l));
  if (idx === -1) return false;
  const windowStart = Math.max(0, idx - 3);
  for (let w = windowStart; w <= idx; w++) {
    if (slice[w].includes(LABEL_SIZE_CLASS)) return true;
  }
  return false;
}

check(
  "המילים 'לא כשיר/ה' (blockedLabel) מוצגות בגודל התווית של שורת הלוח (11px)",
  blockedLabelIsLegible(peopleSlice)
);

// ---- 6. מצב ריק לא מפנה לפעולה שלא נמצאת על המסך ----
const noNavSmartInBoard = !boardRaw.includes("nav.smart");
check(
  "UnifiedBoard.jsx כבר לא מפנה למונח nav.smart בגוף מצב הריק ברירת המחדל",
  noNavSmartInBoard
);

console.log(`\n${failures === 0 ? "PASS" : `FAIL — ${failures} failing check(s)`}\n`);
process.exit(failures === 0 ? 0 : 1);
