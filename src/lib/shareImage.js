// ============================================================
// הסידור השבועי כתמונה.
//
// למה בכלל: הצוות חי בוואטסאפ. גם כשכולם מותקנים באפליקציה, האחמ"ש רוצה
// להדביק את השבוע בקבוצה, והחלופות גרועות — צילום מסך נחתך ומגיע קטן, ו-PDF
// נפתח באפליקציה אחרת ורובם לא יפתחו אותו. תמונה נפתחת בתצוגה המקדימה של
// השיחה, בלי לחיצה אחת.
//
// שתי החלטות שמכתיבות את כל השאר:
//   1. רוחב 1080 ולא רוחב המסך. הרינדור לא תלוי בגודל החלון של מי שלחץ, אז
//      אותו שבוע מפיק אותה תמונה מטלפון וממחשב.
//   2. פלטה קבועה ובהירה, גם כשהאפליקציה במצב כהה. התמונה נצפית בתוך שיחה,
//      לא בתוך האפליקציה, ומסך כהה על רקע וואטסאפ בהיר נראה כמו תקלה.
//   3. הקנבס נוצר בפי-שניים מהמידות הלוגיות, עם ctx.scale תואם מיד אחרי
//      יצירת ההקשר — כל קוד הציור ממשיך לחיות ביחידות לוגיות ולא מרגיש את
//      ההגדלה (Phase 7, COLOR-01). הפקטור קבוע ולא נגזר מ-devicePixelRatio
//      של המכשיר המייצא: התמונה נוצרת אצל האחמ"ש ונצפית אצל חייל, לרוב
//      בטלפון אחר לגמרי, ולכן צפיפות הפיקסלים של המייצא אינה הנתון
//      שקובע חדות אצל הצופה (D-05). יש גבול צלע שמעליו הפקטור נופל ל-1,
//      כדי ששבוע עמוס לא יחזיר קנבס ריק (J-4).
// ============================================================

import { byStartTime, DAYS_HE, fromISODate, rangeLabelHe } from "./dates.js";

const W = 1080;
const PAD = 48;

// גבול הצלע שמעליו דפדפנים מחזירים קנבס ריק (תמונה לבנה) במקום שגיאה —
// ראה תנאי ה-scale ב-renderWeekCanvas (J-4).
const MAX_CANVAS_PX = 16384;

// פקטור הגדלה קבוע במכוון — לא devicePixelRatio (D-05). התמונה נוצרת
// במכשיר אחד ונצפית במכשיר אחר, לרוב טלפון של חייל, ולכן ה-DPR של המכשיר
// שמייצא אינו הנתון הרלוונטי לחדות שהצופה יראה.
const EXPORT_SCALE = 2;

const C = {
  bg: "#f6f8fb",
  card: "#ffffff",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  brand: "#2563eb",
};

// זהות העמדה/המשימה מסומנת מעתה בתווית שחורה אחידה וקריאה, לא בגוון
// שנגזר מהעמדה (Phase 7, COLOR-02, D-01) — קשת הגוונים הקודמת יצרה לוח
// שנראה צבעוני ולא אמר דבר: מנהל עם כמה עמדות קיבל צבע אקראי-למראה לכל
// אחת, בלי שהצבע קידד משהו שאפשר לפעול לפיו. הצבע נשמר לערוץ אחד בלבד —
// מי מבצע (`guardColor`, D-02/COLOR-03) — ולא נוגע כאן.
//
// ליטרל שש-ספרות מכוון (D-03), לא token מ-`tokens.css`: הכוונה כאן היא
// יציבות בין-ערכות-נושא, והקנבס בכלל לא מכיר משתני CSS. אותו ליטרל בדיוק
// קיים גם ב-`views.jsx` (ScheduleMgmt) — הבדיקה (`verify-share-image.mjs`)
// אוכפת ששני העותקים לא נסחפים זה מזה.
const POSITION_LABEL_BG = "#0A0A0A";

import { colorLookup } from "./guardColors.js";

const F = (size, weight = 400) => `${weight} ${size}px Rubik, Arial, sans-serif`;

// צבע החייל נקבע לפי הצוות כולו (lib/guardColors.js) — אותו צבע בדיוק כמו על המסך, כדי
// שחייל שמזהה את עצמו לפי צבע יזהה אותו גם בתמונה שנשלחה בוואטסאפ. הקובץ טהור (בלי
// React ובלי משתני CSS), ולכן מותר לייבא אותו גם לקנבס.
const toLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * toLinear((n >> 16) & 255) +
    0.7152 * toLinear((n >> 8) & 255) +
    0.0722 * toLinear(n & 255)
  );
};
const INK_DARK = "#1C3B37";
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const readableInk = (hex) => {
  const l = luminance(hex);
  return ratio(l, 1) >= ratio(l, luminance(INK_DARK)) ? "#FFFFFF" : INK_DARK;
};

/**
 * מצייר קטע בכיוון שמאל־לימין בתוך ציור ימין־לשמאל.
 *
 * בלי זה "07:00–19:00" יוצא הפוך: אלגוריתם הדו־כיווניות רואה מקף ניטרלי בין
 * שני רצפי ספרות בהקשר ימין־לשמאל, ומסדר את הרצפים מימין לשמאל. משמרת בוקר
 * שנקראת כמשמרת לילה היא בדיוק סוג הטעות שסידור לא יכול להרשות לעצמו.
 *
 * החלפת `ctx.direction` ולא תווי בידוד (U+2066): הקנבס של Chrome מתעלם מהם.
 * `textAlign: "right"` ממשיך לעגן באותה נקודה, אז הפריסה לא זזה.
 */
function drawLtr(ctx, text, x, y) {
  ctx.direction = "ltr";
  ctx.fillText(text, x, y);
  ctx.direction = "rtl";
}

/**
 * מצייר שורת טקסט עברית שיש בה מספרים ("11–17 באוקטובר", "28 באוקטובר – 3
 * בנובמבר") מילה אחר מילה, מימין לשמאל. ציור שלם בהקשר ימין־לשמאל הופך את
 * הספרות ("17–11 באוקטובר") — אלגוריתם הדו־כיווניות מסדר את שני המספרים
 * סביב המקף הניטרלי מהסוף להתחלה. טווח תאריכים הפוך בראש סידור הוא בדיוק סוג
 * הטעות ש-drawLtr נולד כדי למנוע, אז כל מילה נבחרת בנפרד: מילה עם ספרה
 * נציירת שמאל־לימין, כל השאר כרגיל, והסדר בין המילים נשמר מימין לשמאל.
 * מעגנת את הקצה הימני ב-x, כמו fillText עם textAlign "right".
 */
function drawRtlWords(ctx, text, x, y) {
  const gap = ctx.measureText(" ").width || 8;
  let cursor = x;
  for (const word of String(text).split(" ")) {
    const w = ctx.measureText(word).width;
    if (/[0-9]/.test(word)) drawLtr(ctx, word, cursor, y);
    else ctx.fillText(word, cursor, y);
    cursor -= w + gap;
  }
}

/**
 * שובר רשימת שמות לשורות של "שבבים" (כמו בכרטיסי האפליקציה), בלי לחצות
 * רוחב נתון. כל שם נשאר יחידה שלמה עם הצבע שלו, ולא מוזג לטקסט אחד — כדי
 * שאפשר יהיה לזהות "מי" מהצבע לבד, גם בלי לקרוא את השם.
 */
function wrapPills(ctx, entries, maxWidth, padX = 14, gap = 8) {
  if (!entries.length) return [];
  const withWidth = entries.map((e) => ({ ...e, w: ctx.measureText(e.name).width + padX * 2 }));
  const lines = [];
  let line = [];
  let lineWidth = 0;
  for (const e of withWidth) {
    const add = line.length ? e.w + gap : e.w;
    if (line.length && lineWidth + add > maxWidth) {
      lines.push(line);
      line = [e];
      lineWidth = e.w;
    } else {
      line.push(e);
      lineWidth += add;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * מודדים לפני שמציירים: גובה הקנבס תלוי בכמה שורות ייקחו שמות המשובצים,
 * ואי אפשר לדעת את זה בלי הקשר ציור. לכן שני מעברים על אותו מבנה.
 */
function layout(ctx, dates, shifts, nameOf) {
  const days = [];
  let y = 0;
  for (const date of dates) {
    const rows = shifts
      .filter((s) => s.date === date)
      .sort(byStartTime)
      .map((s) => {
        const entries = (s.assignedGuards || []).map((id) => ({ id, name: nameOf(id) }));
        ctx.font = F(22, 700);
        const pillLines = wrapPills(ctx, entries, W - PAD * 2 - 300);
        const rows = Math.max(1, pillLines.length);
        return { shift: s, pillLines, height: Math.max(84, 46 + rows * 44) };
      });
    const height = 54 + (rows.length ? rows.reduce((a, r) => a + r.height, 0) : 70);
    days.push({ date, rows, y, height });
    y += height + 16;
  }
  return { days, total: y };
}

/** מצייר את השבוע ומחזיר קנבס. סינכרוני — הפונטים כבר נטענו. */
export function renderWeekCanvas({ dates, shifts, guards, teamName }) {
  const measure = document.createElement("canvas").getContext("2d");
  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "לא ידוע";
  const guardColor = colorLookup(guards);
  const { days, total } = layout(measure, dates, shifts, nameOf);

  const HEAD = 150;
  const FOOT = 60;
  // גובה לוגי — כל קוד הציור שמתחת ממשיך לעבוד ביחידות האלה, גם אחרי ההגדלה.
  const H = HEAD + total + FOOT + PAD;
  // הפקטור בפועל: EXPORT_SCALE כשהגובה הלוגי כפול בו נכנס בגבול הדפדפן,
  // ואחרת נופל ל-1 (J-4). קנבס שחורג מ-MAX_CANVAS_PX חוזר ריק — תמונה
  // לבנה במקום סידור — וזו תקלה חמורה יותר מהטשטוש שהשינוי הזה בא לתקן.
  // הרוחב (1080×2=2160) תמיד בטוח ואינו חלק מהתנאי.
  const scale = H * EXPORT_SCALE <= MAX_CANVAS_PX ? EXPORT_SCALE : 1;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  // מיד אחרי יצירת ההקשר, לפני כל הגדרה/ציור אחרים: הצבה ל-canvas.width
  // מאפסת את מצב ההקשר, ולכן scale חייבת לבוא אחריה ולפני כל השאר.
  ctx.scale(scale, scale);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const right = W - PAD;

  // כותרת
  ctx.fillStyle = C.ink;
  ctx.font = F(46, 800);
  ctx.fillText(teamName || "סידור השבוע", right, 82);
  ctx.fillStyle = C.brand;
  ctx.font = F(30, 600);
  drawRtlWords(ctx, rangeLabelHe(dates), right, 124);

  let y = HEAD;
  for (const day of days) {
    roundRect(ctx, PAD, y, W - PAD * 2, day.height, 22);
    ctx.fillStyle = C.card;
    ctx.fill();

    ctx.fillStyle = C.ink;
    ctx.font = F(28, 700);
    const d = fromISODate(day.date);
    ctx.fillText(DAYS_HE[d.getDay()], right - 24, y + 44);
    ctx.fillStyle = C.faint;
    ctx.font = F(24, 500);
    drawLtr(ctx, `${d.getDate()}/${d.getMonth() + 1}`, right - 130, y + 44);

    let ry = y + 54;
    if (!day.rows.length) {
      ctx.fillStyle = C.faint;
      ctx.font = F(26);
      ctx.fillText("אין משמרות", right - 24, ry + 34);
    }

    for (const row of day.rows) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD + 24, ry);
      ctx.lineTo(W - PAD - 24, ry);
      ctx.stroke();

      // פס הצבע — שחור קבוע, לא עוד גוון-לפי-עמדה (J-1, COLOR-02): להשאיר
      // אותו צבעוני היה משאיר בתמונה בדיוק את קידוד-הצבע-לפי-עמדה שהמסך
      // כבר לא מציג, ואז המסך והתמונה חוזרים לומר שני דברים שונים.
      roundRect(ctx, right - 24 - 6, ry + 18, 6, row.height - 36, 3);
      ctx.fillStyle = POSITION_LABEL_BG;
      ctx.fill();

      ctx.fillStyle = C.ink;
      ctx.font = F(28, 700);
      const timeText = `${row.shift.startTime}–${row.shift.endTime}`;
      drawLtr(ctx, timeText, right - 44, ry + 46);
      const timeWidth = ctx.measureText(timeText).width;

      // שם העמדה/המשימה כשבב שחור אחיד (J-1, COLOR-02) — לא עוד גוון-לפי-
      // עמדה כמו קודם, כדי שאותה עמדה תיראה אותו דבר תמיד, בכל יום ובכל
      // שבוע. צבע הטקסט נגזר מ-readableInk על הרקע (D-04) ולא קשיח.
      const labelText = row.shift.label || "";
      if (labelText) {
        ctx.font = F(22, 700);
        const labelInk = readableInk(POSITION_LABEL_BG);
        const labelPadX = 14;
        const labelW = ctx.measureText(labelText).width + labelPadX * 2;
        const labelRight = right - 44 - timeWidth - 16;
        roundRect(ctx, labelRight - labelW, ry + 26, labelW, 32, 16);
        ctx.fillStyle = POSITION_LABEL_BG;
        ctx.fill();
        ctx.fillStyle = labelInk;
        ctx.textAlign = "center";
        ctx.fillText(labelText, labelRight - labelW / 2, ry + 48);
        ctx.textAlign = "right";
      }

      if (!row.pillLines.length) {
        ctx.fillStyle = C.faint;
        ctx.font = F(26);
        ctx.fillText("— לא מאויש —", right - 44, ry + 82);
      } else {
        ctx.font = F(22, 700);
        row.pillLines.forEach((line, li) => {
          let x = right - 44;
          const yy = ry + 70 + li * 44;
          for (const pill of line) {
            const pillColor = guardColor(pill.id);
            const pillInk = readableInk(pillColor);
            roundRect(ctx, x - pill.w, yy - 24, pill.w, 32, 16);
            ctx.fillStyle = pillColor;
            ctx.fill();
            ctx.fillStyle = pillInk;
            ctx.textAlign = "center";
            ctx.fillText(pill.name, x - pill.w / 2, yy - 2);
            ctx.textAlign = "right";
            x -= pill.w + 8;
          }
        });
      }

      ry += row.height;
    }

    y += day.height + 16;
  }

  ctx.fillStyle = C.faint;
  ctx.font = F(22, 500);
  ctx.textAlign = "center";
  drawLtr(ctx, "NexRota", W / 2, H - 34);

  return canvas;
}

// ============================================================
// השבוע לפי עמדות (צבא) — אותה תמונה שהמפקד בנה במסך "בניית שבוע".
//
// שורה לכל משמרת, מקובצת תחת כותרת העמדה, ועמודה לכל יום; השמות המלאים בתוך
// התאים. הנתונים מגיעים מוכנים מ-buildPostWeek (postWeek.js) — אותו מקור
// שהגריד שעל המסך קורא, כך שהתמונה והמסך לא יכולים להציג שני סידורים.
// מקום שעוד פנוי מצויר כשבב ריק ("פנוי"), לא נעלם: מי שקורא בוואטסאפ צריך
// לדעת שחסר מישהו, לא לחשוב שהשורה קצרה.
// ============================================================

const GRID_PAD = 32;
const LABEL_W = 152;
const PILL_H = 30;
const PILL_GAP = 6;
const ROW_PAD = 10;
const MIN_ROW = 54;
const POST_HEAD = 50;
const DAYS_HEAD = 66;

/** מקצר שם שלא נכנס בעמודה, עם שלוש נקודות — עדיף שם חתוך מטקסט שגולש לעמודה השכנה. */
function ellipsize(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function layoutPosts(ctx, posts, nameOf) {
  const itemH = (item) => (item.kind === "time" ? 22 : PILL_H) + PILL_GAP;
  const stackH = (items) => items.reduce((n, it) => n + itemH(it), 0) - (items.length ? PILL_GAP : 0);

  let y = 0;
  const sections = posts.map((post) => {
    const rows = post.blocks.map((block) => {
      if (block.weekly) {
        const entries = (block.task?.assignees || []).map((id) => ({ id, name: nameOf(id) }));
        ctx.font = F(17, 700);
        const lines = wrapPills(ctx, entries, W - GRID_PAD * 2 - LABEL_W - 24, 12, 8);
        const n = Math.max(1, lines.length);
        return { block, weekly: true, lines, height: Math.max(MIN_ROW, ROW_PAD * 2 + n * (PILL_H + PILL_GAP) - PILL_GAP) };
      }
      const cells = block.cells.map((cell) => {
        if (cell.state !== "shift") return { state: cell.state, items: [] };
        const items = [];
        for (const shift of cell.shifts) {
          // שעות שונות מהתבנית — כתובות מעל השמות, כמו בגריד שעל המסך.
          if (shift.startTime !== block.startTime || shift.endTime !== block.endTime) {
            items.push({ kind: "time", text: `${shift.startTime}–${shift.endTime}` });
          }
          const ids = shift.assignedGuards || [];
          for (const id of ids) items.push({ kind: "name", id, name: nameOf(id) });
          for (let i = ids.length; i < Math.max(1, shift.requiredGuards || 1); i++) items.push({ kind: "open" });
        }
        return { state: "shift", items };
      });
      const tallest = Math.max(0, ...cells.map((c) => stackH(c.items)));
      return { block, cells, height: Math.max(MIN_ROW, ROW_PAD * 2 + tallest) };
    });
    const section = { post, rows, y, height: POST_HEAD + rows.reduce((n, r) => n + r.height, 0) };
    y += section.height + 14;
    return section;
  });
  return { sections, total: y };
}

/**
 * מצייר את השבוע לפי עמדות ומחזיר קנבס. סינכרוני — הפונטים כבר נטענו.
 * @param {{posts: object[], dates: string[], guards: object[], teamName?: string}} p
 *   posts — הפלט של buildPostWeek
 */
export function renderPostWeekCanvas({ posts, dates, guards, teamName }) {
  const measure = document.createElement("canvas").getContext("2d");
  const nameOf = (id) => guards.find((g) => g.id === id)?.name || "לא ידוע";
  const guardColor = colorLookup(guards);
  const colW = (W - GRID_PAD * 2 - LABEL_W) / Math.max(dates.length, 1);
  const { sections, total } = layoutPosts(measure, posts, nameOf);

  const HEAD = 150;
  const FOOT = 60;
  const H = HEAD + DAYS_HEAD + 12 + total + FOOT;
  const scale = H * EXPORT_SCALE <= MAX_CANVAS_PX ? EXPORT_SCALE : 1;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const right = W - GRID_PAD;
  const colRight = (i) => right - LABEL_W - i * colW;

  ctx.fillStyle = C.ink;
  ctx.font = F(46, 800);
  ctx.fillText(teamName || "סידור השבוע", right, 82);
  ctx.fillStyle = C.brand;
  ctx.font = F(30, 600);
  drawRtlWords(ctx, rangeLabelHe(dates), right, 124);

  // שורת הימים
  let y = HEAD;
  roundRect(ctx, GRID_PAD, y, W - GRID_PAD * 2, DAYS_HEAD, 18);
  ctx.fillStyle = C.card;
  ctx.fill();
  dates.forEach((date, i) => {
    const d = fromISODate(date);
    const cx = colRight(i) - colW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = C.ink;
    ctx.font = F(22, 700);
    ctx.fillText(DAYS_HE[d.getDay()], cx, y + 30);
    ctx.fillStyle = C.faint;
    ctx.font = F(18, 500);
    drawLtr(ctx, `${d.getDate()}/${d.getMonth() + 1}`, cx, y + 54);
  });
  ctx.textAlign = "right";
  y += DAYS_HEAD + 12;

  for (const section of sections) {
    const top = y + section.y;
    roundRect(ctx, GRID_PAD, top, W - GRID_PAD * 2, section.height, 18);
    ctx.fillStyle = C.card;
    ctx.fill();

    // שם העמדה — שבב שחור אחיד, כמו בכל מקום אחר (COLOR-02).
    ctx.font = F(24, 800);
    const title = section.post.post;
    const titleW = ctx.measureText(title).width + 32;
    roundRect(ctx, right - 16 - titleW, top + 8, titleW, 34, 17);
    ctx.fillStyle = POSITION_LABEL_BG;
    ctx.fill();
    ctx.fillStyle = readableInk(POSITION_LABEL_BG);
    ctx.textAlign = "center";
    ctx.fillText(title, right - 16 - titleW / 2, top + 33);
    ctx.textAlign = "right";

    let ry = top + POST_HEAD;
    for (const row of section.rows) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(GRID_PAD + 16, ry);
      ctx.lineTo(W - GRID_PAD - 16, ry);
      ctx.stroke();

      // שם המשמרת והשעות פעם אחת, בראש השורה — לא בכל תא.
      ctx.fillStyle = C.ink;
      ctx.font = F(22, 700);
      ctx.fillText(row.block.part || "משמרת", right - 16, ry + 32);
      if (row.block.startTime) {
        ctx.fillStyle = C.muted;
        ctx.font = F(17, 500);
        drawLtr(ctx, `${row.block.startTime}–${row.block.endTime}`, right - 16, ry + 54);
      }

      if (row.weekly) {
        if (!row.lines.length) {
          ctx.fillStyle = C.faint;
          ctx.font = F(20);
          ctx.fillText("עוד לא שובץ", right - LABEL_W, ry + 34);
        }
        ctx.font = F(17, 700);
        row.lines.forEach((line, li) => {
          let x = right - LABEL_W;
          const yy = ry + ROW_PAD + li * (PILL_H + PILL_GAP);
          for (const pill of line) {
            const color = guardColor(pill.id);
            roundRect(ctx, x - pill.w, yy, pill.w, PILL_H, 15);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.fillStyle = readableInk(color);
            ctx.textAlign = "center";
            ctx.fillText(pill.name, x - pill.w / 2, yy + 21);
            ctx.textAlign = "right";
            x -= pill.w + 8;
          }
        });
      } else {
        row.cells.forEach((cell, i) => {
          const cx = colRight(i) - colW / 2;
          const pillW = colW - 10;
          if (cell.state !== "shift") {
            ctx.fillStyle = C.faint;
            ctx.font = F(cell.state === "next-week" ? 14 : 20, 500);
            ctx.textAlign = "center";
            ctx.fillText(cell.state === "next-week" ? "שבוע הבא" : "—", cx, ry + 34);
            ctx.textAlign = "right";
            return;
          }
          let yy = ry + ROW_PAD;
          for (const item of cell.items) {
            if (item.kind === "time") {
              ctx.fillStyle = C.muted;
              ctx.font = F(15, 700);
              ctx.textAlign = "center";
              drawLtr(ctx, item.text, cx, yy + 15);
              ctx.textAlign = "right";
              yy += 22 + PILL_GAP;
              continue;
            }
            roundRect(ctx, cx - pillW / 2, yy, pillW, PILL_H, 15);
            ctx.textAlign = "center";
            if (item.kind === "name") {
              const color = guardColor(item.id);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.fillStyle = readableInk(color);
              ctx.font = F(16, 700);
              ctx.fillText(ellipsize(ctx, item.name, pillW - 14), cx, yy + 21);
            } else {
              ctx.strokeStyle = C.faint;
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = C.muted;
              ctx.font = F(16, 600);
              ctx.fillText("פנוי", cx, yy + 21);
            }
            ctx.textAlign = "right";
            yy += PILL_H + PILL_GAP;
          }
        });
      }
      ry += row.height;
    }
  }

  ctx.fillStyle = C.faint;
  ctx.font = F(22, 500);
  ctx.textAlign = "center";
  drawLtr(ctx, "NexRota", W / 2, H - 34);

  return canvas;
}

const toBlob = (canvas) =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

/**
 * משתף את התמונה, ואם אין שיתוף — מוריד אותה.
 *
 * `canShare({files})` נבדק ולא רק `share`: בדסקטופ יש `navigator.share` שלא
 * מקבל קבצים, וקריאה אליו שם נכשלת אחרי שהמשתמש כבר לחץ.
 *
 * @returns {"shared"|"downloaded"|"cancelled"}
 */
export async function shareWeekImage({ dates, shifts, guards, teamName, posts }) {
  // הכותרת מצוירת ב-Rubik. בלי ההמתנה, לחיצה ראשונה מייצרת תמונה בפונט
  // ברירת המחדל של המערכת.
  if (document.fonts?.ready) await document.fonts.ready;

  // עם posts (צבא) — התמונה לפי עמדות, כמו בניית השבוע; בלי — כרטיסי ימים.
  const canvas = posts?.length
    ? renderPostWeekCanvas({ posts, dates, guards, teamName })
    : renderWeekCanvas({ dates, shifts, guards, teamName });
  const blob = await toBlob(canvas);
  if (!blob) throw new Error("לא הצלחנו ליצור את התמונה");

  const fileName = `סידור ${rangeLabelHe(dates)}.png`.replace(/[\\/:*?"<>|]/g, "-");
  const file = new File([blob], fileName, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      // ביטול של המשתמש אינו תקלה ואסור שיציג שגיאה.
      if (e.name === "AbortError") return "cancelled";
      /* כל כשל אחר — נופלים להורדה */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
