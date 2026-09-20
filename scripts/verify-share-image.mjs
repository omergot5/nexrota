// ============================================================
// רשת ביטחון עצמאית לתמונת השיתוף (renderWeekCanvas, Phase 7).
//
// אין בפרויקט runner בדיקות ואין דפדפן ב-CI, אז קנבס אמיתי לא קיים כאן —
// אבל התמונה היא בדיוק מה שהצוות רואה בפועל בוואטסאפ, ובלי בדיקה כלשהי
// שינוי בקוד הציור יכול לשבור אותה בשקט ולא ידע אף אחד עד שמישהו יתלונן.
// הסקריפט בונה קנבס-דמה שמתעד כל קריאת ציור ליומן פעולות (מי צויר, באיזה
// צבע, באיזה טקסט), מייבא את המודול הנבדק רק אחרי שהדמה מותקן (ייבוא
// סטטי היה רץ לפני ההתקנה), ומריץ עליו את כל טענות COLOR-02/COLOR-03/
// COLOR-04 של 07-01-PLAN.md — במספרים, לא בהערכה.
//
//   node scripts/verify-share-image.mjs

import { byStartTime } from "../src/lib/dates.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

// ============================================================
console.log("\nCOLOR-04 · dates.js — byStartTime (יחידה טהורה)\n");
// ============================================================

{
  const shuffled = [
    { id: "a3", startTime: "22:00" },
    { id: "a1", startTime: "06:00" },
    { id: "a2", startTime: "14:00" },
  ];
  const sorted = [...shuffled].sort(byStartTime).map((x) => x.id);
  check(
    "ממיין משמרות מעורבבות לפי startTime, לא לפי סדר הקלט",
    JSON.stringify(sorted) === JSON.stringify(["a1", "a2", "a3"]),
    `got=${sorted.join(",")}`
  );
}

{
  const withEmpty = [
    { id: "b2", startTime: "10:00" },
    { id: "b1", startTime: "" },
    { id: "b3", startTime: null },
  ];
  let sorted = null;
  let threw = false;
  try {
    sorted = [...withEmpty].sort(byStartTime).map((x) => x.id);
  } catch {
    threw = true;
  }
  check("startTime ריק/null לא זורק", !threw);
  check(
    "startTime ריק/null נדחף לסוף, שבור-תיקו לפי id",
    JSON.stringify(sorted) === JSON.stringify(["b2", "b1", "b3"]),
    `got=${(sorted || []).join(",")}`
  );
}

{
  const tieForward = [
    { id: "c2", startTime: "08:00" },
    { id: "c1", startTime: "08:00" },
  ];
  const tieBackward = [...tieForward].reverse();
  const sortedForward = [...tieForward].sort(byStartTime).map((x) => x.id);
  const sortedBackward = [...tieBackward].sort(byStartTime).map((x) => x.id);
  check(
    "שני פריטים באותה startTime מסודרים לפי id, יציב ללא תלות בסדר הקלט (דטרמיניזם)",
    JSON.stringify(sortedForward) === JSON.stringify(["c1", "c2"]) &&
      JSON.stringify(sortedBackward) === JSON.stringify(["c1", "c2"]),
    `forward=${sortedForward.join(",")} backward=${sortedBackward.join(",")}`
  );
}

// ============================================================
console.log("\nCOLOR-02/03/04 · shareImage.js — renderWeekCanvas (קנבס-דמה)\n");
// ============================================================

// יומן פעולות: כל קריאת ציור נרשמת עם הערכים הפעילים באותו רגע
// (fillStyle/strokeStyle/textAlign) — הוא הבסיס לכל הטענות שלמטה.
const drawLog = [];

function makeCtx() {
  const ctx = {
    font: "",
    direction: "ltr",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
  };
  // רוחב דטרמיניסטי לא-אפס, כדי ששבירת השורות ב-wrapPills לא תתנוון.
  ctx.measureText = (text) => ({ width: String(text).length * 11 });
  ctx.fillRect = (...args) => drawLog.push({ action: "fillRect", args, fillStyle: ctx.fillStyle });
  ctx.fillText = (...args) =>
    drawLog.push({ action: "fillText", args, fillStyle: ctx.fillStyle, textAlign: ctx.textAlign, font: ctx.font });
  ctx.beginPath = () => drawLog.push({ action: "beginPath" });
  ctx.moveTo = (...args) => drawLog.push({ action: "moveTo", args });
  ctx.lineTo = (...args) => drawLog.push({ action: "lineTo", args });
  ctx.arcTo = (...args) => drawLog.push({ action: "arcTo", args });
  ctx.closePath = () => drawLog.push({ action: "closePath" });
  ctx.fill = () => drawLog.push({ action: "fill", fillStyle: ctx.fillStyle });
  ctx.stroke = () => drawLog.push({ action: "stroke", strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth });
  ctx.scale = (...args) => drawLog.push({ action: "scale", args });
  return ctx;
}

globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`verify-share-image: unexpected createElement("${tag}")`);
    return {
      width: 0,
      height: 0,
      getContext(type) {
        return type === "2d" ? makeCtx() : null;
      },
    };
  },
};

// פיקסצ'ר במכוון לא 4×6 (COLOR-04, REQUIREMENTS): עמדה אחת בת שלוש
// משמרות שמונה-שעתיות, עמדה שנייה בת שתי משמרות חמש-שעתיות, ויום שני עם
// משמרת שתים-עשרה-שעתית בודדת. שש משמרות, שלושה כפופים. סדר האיברים
// מעורבב במכוון ושונה מהסדר הכרונולוגי — אחרת הבדיקה הייתה עוברת גם בלי
// מיון בכלל. משמרת אחת בלי משובצים (מסלול "לא מאויש"), ואחת עם שניים
// (ריבוי שבבים).
function buildFixture() {
  const guards = [
    { id: "g1", name: "דנה" },
    { id: "g2", name: "רון" },
    { id: "g3", name: "מאיה" },
  ];
  const shifts = [
    {
      id: "s4", date: "2025-01-06", label: "עמדה 2", category: "תורנות שמירה",
      startTime: "09:00", endTime: "14:00", requiredGuards: 1, assignedGuards: ["g1", "g2"], color: "#fca5a5",
    },
    {
      id: "s6", date: "2025-01-07", label: "עמדה 1", category: "תורנות שמירה",
      startTime: "08:00", endTime: "20:00", requiredGuards: 1, assignedGuards: ["g1"], color: "#fca5a5",
    },
    {
      id: "s1", date: "2025-01-06", label: "עמדה 1", category: "תורנות שמירה",
      startTime: "06:00", endTime: "14:00", requiredGuards: 1, assignedGuards: ["g1"], color: "#fde68a",
    },
    {
      id: "s5", date: "2025-01-06", label: "עמדה 2", category: "תורנות שמירה",
      startTime: "19:00", endTime: "00:00", requiredGuards: 1, assignedGuards: ["g3"], color: "#c4b5fd",
    },
    {
      id: "s3", date: "2025-01-06", label: "עמדה 1", category: "תורנות שמירה",
      startTime: "22:00", endTime: "06:00", requiredGuards: 2, assignedGuards: ["g2", "g3"], color: "#93c5fd",
    },
    {
      id: "s2", date: "2025-01-06", label: "עמדה 1", category: "תורנות שמירה",
      startTime: "14:00", endTime: "22:00", requiredGuards: 1, assignedGuards: [], color: "#fde68a",
    },
  ];
  const dates = ["2025-01-06", "2025-01-07"];
  return { dates, shifts, guards, teamName: "צוות בדיקה" };
}

// ייבוא דינמי — אחרי שהדמה כבר מותקן על globalThis.document, אחרת ייבוא
// סטטי היה רץ ראשון ומייבא מודול שרואה document לא-מוגדר.
const { renderWeekCanvas } = await import("../src/lib/shareImage.js");

drawLog.length = 0;
renderWeekCanvas(buildFixture());
const log1 = JSON.parse(JSON.stringify(drawLog));

drawLog.length = 0;
renderWeekCanvas(buildFixture());
const log2 = JSON.parse(JSON.stringify(drawLog));

check(
  "שני רינדורים רצופים של אותו קלט מייצרים יומן פעולות זהה בתו (דטרמיניזם, עקרון ברזל 1)",
  JSON.stringify(log1) === JSON.stringify(log2)
);

// סדר טקסטי השעות: נגזר מהפיקסצ'ר עצמו כליטרל, לא מהפונקציה הנבדקת.
const TIME_PATTERN = /^(\d{2}:\d{2})\D+(\d{2}:\d{2})$/;
const timeTexts = log1
  .filter((e) => e.action === "fillText" && typeof e.args[0] === "string" && TIME_PATTERN.test(e.args[0]))
  .map((e) => e.args[0].match(TIME_PATTERN)[1]);
const expectedTimeOrder = ["06:00", "09:00", "14:00", "19:00", "22:00", "08:00"];
check(
  "layout() ממיין דרך byStartTime — סדר טקסטי השעות המצוירים הוא בדיוק הסדר הכרונולוגי (COLOR-04)",
  JSON.stringify(timeTexts) === JSON.stringify(expectedTimeOrder),
  `got=${timeTexts.join(",")}`
);

// פלטת הקטגוריות הישנה (עשרה גוונים) — מועתקת לכאן כליטרלים, לא מיובאת:
// המודול הנבדק כבר לא מחזיק אותה אחרי Task 1, וזו בדיוק הנקודה.
const OLD_CATEGORY_COLORS = [
  "#C97A3D", "#3E8FA8", "#8E5FA0", "#5E9E5A", "#B0555F",
  "#7A8E3E", "#4F6FA8", "#A87A4F", "#5F9E8E", "#9E5F8E",
];
const allFillStyles = log1
  .filter((e) => e.action === "fillRect" || e.action === "fillText" || e.action === "fill")
  .map((e) => e.fillStyle);
check(
  "אף צבע מילוי בפלט הרינדור אינו אחד מעשרת גווני פלטת הקטגוריות הישנה",
  allFillStyles.every((c) => !OLD_CATEGORY_COLORS.includes(c)),
  `נמצא=${allFillStyles.find((c) => OLD_CATEGORY_COLORS.includes(c))}`
);

const POSITION_LABEL_BG = "#0A0A0A";
const labelBgFills = log1.filter((e) => e.action === "fill" && e.fillStyle === POSITION_LABEL_BG);
const shiftCount = buildFixture().shifts.length;
check(
  `מספר המילויים בערך ${POSITION_LABEL_BG} שווה בדיוק לפעמיים מספר המשמרות (פס + שבב לכל משמרת, J-1)`,
  labelBgFills.length === shiftCount * 2,
  `expected=${shiftCount * 2} got=${labelBgFills.length}`
);

// כל fillText שהטקסט שלו הוא שם עמדה מהפיקסצ'ר מצויר בדיו הלבן ש-
// readableInk בוחר מול רקע כמעט-שחור (D-04).
const positionLabels = ["עמדה 1", "עמדה 2"];
const labelTextEntries = log1.filter(
  (e) => e.action === "fillText" && positionLabels.includes(e.args[0])
);
check(
  "יש לפחות ציור אחד לכל תווית עמדה בפיקסצ'ר",
  positionLabels.every((label) => labelTextEntries.some((e) => e.args[0] === label))
);
check(
  "כל fillText של תווית עמדה מצויר ב-#FFFFFF (readableInk על הרקע השחור)",
  labelTextEntries.length > 0 && labelTextEntries.every((e) => e.fillStyle === "#FFFFFF"),
  `צבעים=${[...new Set(labelTextEntries.map((e) => e.fillStyle))].join(",")}`
);

// נוסחת WCAG עצמאית — בדיקה שמייבאת את החישוב שהיא בודקת לא בודקת דבר.
const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const relLuminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * toLinear((n >> 16) & 255) +
    0.7152 * toLinear((n >> 8) & 255) +
    0.0722 * toLinear(n & 255)
  );
};
const contrastRatio = (hexA, hexB) => {
  const la = relLuminance(hexA);
  const lb = relLuminance(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const labelContrast = contrastRatio("#FFFFFF", POSITION_LABEL_BG);
check(
  `הניגודיות בין #FFFFFF ל-${POSITION_LABEL_BG} עוברת 4.5:1 (WCAG AA) — בפועל ${labelContrast.toFixed(2)}:1`,
  labelContrast >= 4.5
);

// שבבי הכפופים (COLOR-03 — אי-רגרסיה): פלטת עשרת צבעי הכפופים, ללא שינוי.
const GUARD_COLORS = [
  "#4C9585", "#3E7C9B", "#7A6FA8", "#A85F7A", "#B0763C",
  "#5E8C5A", "#9A6250", "#4F7FA8", "#8A6B9E", "#2F7A6B",
];
const guardPillFills = log1.filter((e) => e.action === "fill" && GUARD_COLORS.includes(e.fillStyle));
const totalAssignments = buildFixture().shifts.reduce((sum, s) => sum + s.assignedGuards.length, 0);
check(
  "שבבי הכפופים עדיין נצבעים מפלטת עשרת צבעי הכפופים, ומספרם שווה לסך השיבוצים בפיקסצ'ר (D-02/COLOR-03)",
  guardPillFills.length === totalAssignments,
  `expected=${totalAssignments} got=${guardPillFills.length}`
);
check(
  "לפחות שני גוונים נבדלים בין שבבי הכפופים",
  new Set(guardPillFills.map((e) => e.fillStyle)).size >= 2
);

// קישור-מקור: הליטרל השחור קיים בפועל בקובץ הנבדק.
const shareImageSrc = await (await import("node:fs/promises")).readFile(
  new URL("../src/lib/shareImage.js", import.meta.url),
  "utf8"
);
check(
  "src/lib/shareImage.js מכיל השמה ל-POSITION_LABEL_BG בליטרל בן שש ספרות הקסה",
  /POSITION_LABEL_BG\s*=\s*"#[0-9A-Fa-f]{6}"/.test(shareImageSrc)
);

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
