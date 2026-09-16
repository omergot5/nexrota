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
// ============================================================

import { DAYS_HE, fromISODate, rangeLabelHe } from "./dates.js";

const W = 1080;
const PAD = 48;

const C = {
  bg: "#f6f8fb",
  card: "#ffffff",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  brand: "#2563eb",
};

const F = (size, weight = 400) => `${weight} ${size}px Rubik, Arial, sans-serif`;

// אותם שני פלטות זהות בדיוק ל-ui.jsx (guardColor/categoryColor) — משוכפלות
// ולא מיובאות, כי קנבס הוא אחד משלושת המקומות (עם ה-DB ו-Recharts) ש-
// shiftPalette.js כבר מתעד ש-`rgb(var(--x))` לא מגיע אליהם. בלי הזיהוי
// הכפול הזה (מי בצבע-שומר, מה בצבע-קטגוריה) התמונה המשותפת בוואטסאפ
// חוזרת להיות "הכל אותו צבע" — בדיוק התלונה שהובילה לשינוי.
const GUARD_COLORS = [
  "#4C9585", "#3E7C9B", "#7A6FA8", "#A85F7A", "#B0763C",
  "#5E8C5A", "#9A6250", "#4F7FA8", "#8A6B9E", "#2F7A6B",
];
const CATEGORY_COLORS = [
  "#C97A3D", "#3E8FA8", "#8E5FA0", "#5E9E5A", "#B0555F",
  "#7A8E3E", "#4F6FA8", "#A87A4F", "#5F9E8E", "#9E5F8E",
];
const hashColor = (key, palette) => {
  const s = String(key || "");
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};
const guardColor = (id) => hashColor(id, GUARD_COLORS);
const categoryColor = (key) => hashColor(key, CATEGORY_COLORS);

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
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
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
  const { days, total } = layout(measure, dates, shifts, nameOf);

  const HEAD = 150;
  const FOOT = 60;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = HEAD + total + FOOT + PAD;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const right = W - PAD;

  // כותרת
  ctx.fillStyle = C.ink;
  ctx.font = F(46, 800);
  ctx.fillText(teamName || "סידור השבוע", right, 82);
  ctx.fillStyle = C.brand;
  ctx.font = F(30, 600);
  ctx.fillText(rangeLabelHe(dates), right, 124);

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

      // פס הצבע — צבע הקטגוריה/העמדה (לא שעת היום), כדי ש"מה" יהיה נבדל
      // במבט אחד בדיוק כמו באפליקציה עצמה (categoryColor, ui.jsx).
      const catColor = categoryColor(row.shift.category || row.shift.label);
      roundRect(ctx, right - 24 - 6, ry + 18, 6, row.height - 36, 3);
      ctx.fillStyle = catColor;
      ctx.fill();

      ctx.fillStyle = C.ink;
      ctx.font = F(28, 700);
      const timeText = `${row.shift.startTime}–${row.shift.endTime}`;
      drawLtr(ctx, timeText, right - 44, ry + 46);
      const timeWidth = ctx.measureText(timeText).width;

      // שם העמדה/הקטגוריה כשבב צבעוני — לא טקסט אפור שטוח כמו קודם —
      // כדי שאותה עמדה תיראה אותו דבר תמיד, גם בין ימים שונים.
      const labelText = row.shift.label || "";
      if (labelText) {
        ctx.font = F(22, 700);
        const labelInk = readableInk(catColor);
        const labelPadX = 14;
        const labelW = ctx.measureText(labelText).width + labelPadX * 2;
        const labelRight = right - 44 - timeWidth - 16;
        roundRect(ctx, labelRight - labelW, ry + 26, labelW, 32, 16);
        ctx.fillStyle = catColor;
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
  drawLtr(ctx, "NexRota", W / 2, canvas.height - 34);

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
export async function shareWeekImage({ dates, shifts, guards, teamName }) {
  // הכותרת מצוירת ב-Rubik. בלי ההמתנה, לחיצה ראשונה מייצרת תמונה בפונט
  // ברירת המחדל של המערכת.
  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = renderWeekCanvas({ dates, shifts, guards, teamName });
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
