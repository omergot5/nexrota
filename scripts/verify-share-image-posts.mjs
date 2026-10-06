// רשת ביטחון לתמונת "השבוע לפי עמדות" (renderPostWeekCanvas, shareImage.js).
//   node scripts/verify-share-image-posts.mjs
//
// כמו verify-share-image.mjs: אין דפדפן ב-CI, אז קנבס-דמה מתעד כל קריאת ציור,
// והבדיקה טוענת עליו את מה שהצוות באמת יראה בוואטסאפ — שמות מלאים, סדר עמדות
// ומשמרות כמו בבניית השבוע, מקומות פנויים מסומנים, ושום דבר לא גולש מהתמונה.

import { ARMY_DEMO_POSITIONS } from "../src/lib/armyDemo.js";
import { plannedRowsForWeek } from "../src/lib/positions.js";
import { buildPostWeek, countMissing } from "../src/lib/postWeek.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const drawLog = [];
function makeCtx() {
  const ctx = { font: "", direction: "ltr", textAlign: "left", textBaseline: "alphabetic", fillStyle: "#000", strokeStyle: "#000", lineWidth: 1 };
  ctx.measureText = (text) => ({ width: String(text).length * 11 });
  ctx.fillRect = (...args) => drawLog.push({ action: "fillRect", args });
  ctx.fillText = (...args) => drawLog.push({ action: "fillText", args, fillStyle: ctx.fillStyle, textAlign: ctx.textAlign, direction: ctx.direction });
  ctx.beginPath = () => {};
  ctx.moveTo = () => {};
  ctx.lineTo = () => {};
  ctx.arcTo = () => {};
  ctx.closePath = () => {};
  ctx.fill = () => drawLog.push({ action: "fill", fillStyle: ctx.fillStyle });
  ctx.stroke = () => drawLog.push({ action: "stroke" });
  ctx.scale = (...args) => drawLog.push({ action: "scale", args });
  return ctx;
}
globalThis.document = {
  createElement(tag) {
    if (tag !== "canvas") throw new Error(`unexpected createElement("${tag}")`);
    return { width: 0, height: 0, getContext: (type) => (type === "2d" ? makeCtx() : null) };
  },
};
const { renderPostWeekCanvas } = await import("../src/lib/shareImage.js");

// ---- פיקסצ'ר: מבנה ההדגמה של הצבא, עם שיבוצים ידועים
const week = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
let pid = 0;
let sid = 0;
const positions = ARMY_DEMO_POSITIONS.map((p) => ({ ...p, id: `p${++pid}`, shape: "template", active: true }));
let shifts = positions
  .flatMap((p) => plannedRowsForWeek(p, week[0]))
  .map((r) => ({ ...r, id: `s${++sid}`, assignedGuards: [] }));

const guards = [
  { id: "g1", name: "דנה אלון" },
  { id: "g2", name: "רועי כהן" },
  { id: "g3", name: "מאיה סבג" },
  { id: "g4", name: "אברהם יעקב המלך מנחם בן-עמי" }, // ארוך מדי לעמודה
];
const first = (label) => shifts.find((s) => s.label.startsWith(label) && s.date === week[0]);
const sh1 = first("עמדת שמירה 1 – משמרת 1");
sh1.assignedGuards = ["g1"];
first("עמדת שמירה 1 – משמרת 2").assignedGuards = ["g2"];
first("סיור – משמרת 1").assignedGuards = ["g1", "g3"]; // סיור צריך 3 → מקום אחד פנוי
first("עמדת שמירה 2 – משמרת 1").assignedGuards = ["g4"];
// יום עם שעות שונות מהתבנית
const odd = shifts.find((s) => s.label.startsWith("עמדת שמירה 1 – משמרת 1") && s.date === week[2]);
odd.startTime = "08:00";
odd.endTime = "13:00";
odd.assignedGuards = ["g3"];

const posts = buildPostWeek({ shifts, positions, tasks: [], weekDates: week, mode: "army" });
const render = () => {
  drawLog.length = 0;
  const canvas = renderPostWeekCanvas({ posts, dates: week, guards, teamName: "פלוגת בדיקה" });
  return { canvas, log: JSON.parse(JSON.stringify(drawLog)) };
};
const { canvas, log } = render();
const texts = log.filter((e) => e.action === "fillText").map((e) => e.args[0]);

console.log("\nתוכן — שמות מלאים ומקומות פנויים\n");
check("שם מלא של חייל מצויר (לא שם פרטי בלבד)", texts.includes("דנה אלון") && texts.includes("רועי כהן") && texts.includes("מאיה סבג"));
check("חייל ששובץ שלוש פעמים בשבוע מצויר שלוש פעמים — פעם לכל שיבוץ",
  texts.filter((t) => t === "דנה אלון").length === 2, `${texts.filter((t) => t === "דנה אלון").length}`);
const longName = texts.find((t) => t.startsWith("אברהם"));
check("שם ארוך מקוצר עם שלוש נקודות במקום לגלוש", Boolean(longName) && longName.endsWith("…") && longName.length * 11 <= 113 - 14, longName);
const { missing } = countMissing(posts);
check("מספר השבבים 'פנוי' שווה בדיוק למקומות החסרים שהמסך מציג", texts.filter((t) => t === "פנוי").length === missing,
  `פנוי=${texts.filter((t) => t === "פנוי").length} חסרים=${missing}`);
check("שעות שונות מהתבנית כתובות מעל השמות באותו יום", texts.includes("08:00–13:00"));

console.log("\nסדר — כמו בגריד של בניית השבוע\n");
const postTitles = posts.map((p) => p.post);
const titleOrder = texts.filter((t) => postTitles.includes(t));
check("כותרות העמדות מצוירות בסדר הגריד", titleOrder.join() === postTitles.join(), titleOrder.join(" / "));
const parts = texts.slice(texts.indexOf(postTitles[0]), texts.indexOf(postTitles[1]));
const partsInOrder = ["בוקר", "צהריים", "ערב", "לילה"].map((p) => parts.indexOf(p));
check("בתוך עמדה: בוקר, צהריים, ערב, לילה", partsInOrder.every((i, k) => i >= 0 && (k === 0 || i > partsInOrder[k - 1])), partsInOrder.join());
const rangeNums = log.find((e) => e.action === "fillText" && e.args[0] === "11–17");
const rangeWord = log.find((e) => e.action === "fillText" && e.args[0] === "באוקטובר");
check("טווח התאריכים: הספרות מצוירות שמאל־לימין (לא הפוכות), מימין למילת החודש",
  Boolean(rangeNums) && Boolean(rangeWord) && rangeNums.args[1] > rangeWord.args[1] && rangeNums.direction === "ltr",
  `nums=${rangeNums?.args[1]} word=${rangeWord?.args[1]}`);
check("כותרת הימים: ראשון עד שבת, מימין לשמאל", ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"].every((d) => texts.includes(d)));

console.log("\nדטרמיניזם וגבולות\n");
check("שני רינדורים של אותו קלט זהים בתו", JSON.stringify(render().log) === JSON.stringify(log));
check("רוחב הקנבס 1080 כפול ההגדלה (2)", canvas.width === 2160, `${canvas.width}`);
const H = canvas.height / 2;
const sig = log.find((e) => e.action === "fillText" && e.args[0] === "NexRota");
check("החתימה בתוך הגובה, במרחק קצר מהתחתית", Boolean(sig) && sig.args[2] < H && H - sig.args[2] < 60, `y=${sig?.args[2]} H=${H}`);
check("אף טקסט לא מצויר מחוץ לרוחב התמונה",
  log.filter((e) => e.action === "fillText").every((e) => e.args[1] >= 0 && e.args[1] <= 1080));
check("אף טקסט לא מצויר מתחת לתחתית התמונה",
  log.filter((e) => e.action === "fillText").every((e) => e.args[2] <= H));
check("הרקע ממלא את כל התמונה", log.find((e) => e.action === "fillRect")?.args.join() === `0,0,1080,${H}`);

console.log("\nשבוע ריק — עדיין תמונה תקינה\n");
{
  const empty = buildPostWeek({ shifts: shifts.map((s) => ({ ...s, assignedGuards: [] })), positions, tasks: [], weekDates: week, mode: "army" });
  drawLog.length = 0;
  const c = renderPostWeekCanvas({ posts: empty, dates: week, guards, teamName: "x" });
  const t = drawLog.filter((e) => e.action === "fillText").map((e) => e.args[0]);
  check("בלי שיבוצים: כל מקום מצויר כפנוי", t.filter((x) => x === "פנוי").length === countMissing(empty).missing && c.height > 0);
}

console.log(failures === 0 ? "\nPASS\n" : `\n${failures} FAILURE(S)\n`);
process.exit(failures === 0 ? 0 : 1);
