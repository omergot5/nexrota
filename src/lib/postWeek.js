// ============================================================
// בניית שבוע לפי עמדות — מנוע טהור (בלי React ובלי רשת).
//
// buildResourceRows (resourceView.js) מקבץ לפי *קטגוריה*, ולכן כל המשמרות
// של "עמדת שמירה 1" ו-"עמדת שמירה 2" נערמו באותה שורה, עם שעה בכל תא, ולא
// היה ברור מה שייך למה. כאן העמדה היא כותרת, ומתחתיה שורה לכל משמרת שלה
// (בוקר 06–12, צהריים 12–18 ...). השעה כתובה פעם אחת, בראש השורה, והתאים
// נשארים קטנים — כך כל השבוע נכנס לרוחב המסך.
//
// "היום מתחיל בבוקר": משמרת שמתחילה בין 00:00 ל-05:00 היא הלילה של היום
// הקודם — "24–06 של ראשון" היא ליל ראשון→שני — ולכן היא מוצגת בעמודה של
// היום הקודם ובשורה האחרונה של העמדה. זו הצגה בלבד: המשמרת עצמה נשארת
// בתאריך שבו היא מתחילה, כמו בכל מקום אחר במערכת (מנוע, פרסום, המשתתף).
// בקצה השבוע: ליל שבת→ראשון הוא משמרת של יום ראשון הבא (מוצגת אם השבוע הבא
// כבר נבנה), וה-00:00 של יום ראשון הזה הוא ליל השבת הקודמת.
// ============================================================

import { addDays, fromISODate, minutesOfTime, shiftPartName, splitShiftLabel } from "./dates.js";
import { foldersFor } from "./categories.js";
import { buildDivisionRows } from "./positions.js";

/** משמרת שמתחילה לפני השעה הזו היא הלילה של היום הקודם. */
export const DAY_START_MINUTES = 5 * 60;

const minutes = (t) => minutesOfTime(t || "00:00");

/** "00:00"–"04:59" → true: הלילה שאחרי היום הקודם. */
export const isAfterMidnight = (startTime) => Boolean(startTime) && minutes(startTime) < DAY_START_MINUTES;

/** היום שאליו המשמרת שייכת בעין המפקד. */
export const opDayOf = (shift) => (isAfterMidnight(shift.startTime) ? addDays(shift.date, -1) : shift.date);

/** מפתח מיון בתוך עמדה: מהבוקר, והלילה אחרון. */
const dayOrder = (startTime) => (minutes(startTime) - DAY_START_MINUTES + 1440) % 1440;

const weekdayOf = (iso) => fromISODate(iso).getDay();

/**
 * העמדות של השבוע, כל אחת עם המשמרות שלה, ולכל משמרת תא לכל יום.
 *
 * מקור העמדות הוא gs_positions (התבנית), ומקור התאים הוא המשמרות שכבר נוצרו
 * בשבוע (gs_work_items). משמרת שלא נוצרה מעמדה (נוספה ידנית) מקובצת לפי
 * השם שלה ושעותיה, כך שגם היא מוצגת ולא נעלמת.
 *
 * תא: { date, state, shifts } — state הוא:
 *   "shift"     יש משמרת ביום הזה (shifts לא ריק)
 *   "off"       העמדה לא פעילה ביום הזה
 *   "next-week" ליל שבת→ראשון שעוד לא נוצר (שייך לשבוע הבא)
 *   "empty"     העמדה אמורה לפעול אבל אין משמרת (לא נוצרה / בוטלה ליום הזה)
 *
 * @returns {{post, category, weekdays, requiredGuards, blocks: object[], positionIds: string[]}[]}
 */
export function buildPostWeek({ shifts = [], positions = [], tasks = [], weekDates = [], mode = "army" } = {}) {
  const inWeek = new Set(weekDates);
  const lastDate = weekDates[weekDates.length - 1];

  const posts = new Map();
  const postFor = (name, category) => {
    if (!posts.has(name)) posts.set(name, { post: name, category: category || "", blocks: new Map() });
    const entry = posts.get(name);
    if (!entry.category && category) entry.category = category;
    return entry;
  };

  // עמדה "כל השבוע בלי שעות" (shape weekly) — שורה אחת שמתפרשת על כל
  // השבוע, עם מי שמחזיק בה. היא מתממשת כמשימה (gs_work_items kind task).
  const weekly = [];
  for (const p of positions) {
    if (p.active === false || p.shape !== "weekly") continue;
    const task = tasks.find((tk) => tk.positionId === p.id && inWeek.has(tk.dueDate)) || null;
    weekly.push({
      post: p.title,
      category: p.category || "",
      weekdays: null,
      requiredGuards: p.requiredGuards || 1,
      positionIds: [p.id],
      weekly: true,
      blocks: [
        {
          key: `pos:${p.id}`,
          positionId: p.id,
          position: p,
          title: p.title,
          startTime: null,
          endTime: null,
          requiredGuards: p.requiredGuards || 1,
          part: "כל השבוע",
          afterMidnight: false,
          weekly: true,
          task,
          cells: [],
        },
      ],
    });
  }

  const blockByPosition = new Map();
  for (const p of positions) {
    if (p.active === false || p.shape !== "template") continue;
    const { post } = splitShiftLabel(p.title);
    const block = {
      key: `pos:${p.id}`,
      positionId: p.id,
      position: p,
      title: p.title,
      startTime: p.startTime,
      endTime: p.endTime,
      requiredGuards: p.requiredGuards || 1,
      weekdays: p.weekdays || [],
      byDay: new Map(),
    };
    postFor(post, p.category).blocks.set(block.key, block);
    blockByPosition.set(p.id, block);
  }

  for (const s of shifts) {
    const day = opDayOf(s);
    if (!inWeek.has(day)) continue;
    let block = s.positionId ? blockByPosition.get(s.positionId) : null;
    if (!block) {
      // משמרת בלי עמדה פעילה: לפי שם העמדה בתווית ולפי השעות שלה.
      const { post } = splitShiftLabel(s.label || "");
      const entry = postFor(post || s.label || "משמרת", s.category);
      const key = `t:${entry.post}|${s.startTime}-${s.endTime}`;
      if (!entry.blocks.has(key)) {
        entry.blocks.set(key, {
          key,
          positionId: null,
          position: null,
          title: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
          requiredGuards: s.requiredGuards || 1,
          weekdays: null,
          byDay: new Map(),
        });
      }
      block = entry.blocks.get(key);
    }
    if (!block.byDay.has(day)) block.byDay.set(day, []);
    block.byDay.get(day).push(s);
  }

  const known = foldersFor(mode).map((f) => f.name);
  const categoryRank = (c) => {
    const i = known.indexOf(c);
    return i >= 0 ? i : known.length;
  };

  const timed = [...posts.values()]
    .map((entry) => {
      const blocks = [...entry.blocks.values()]
        .sort((a, b) => dayOrder(a.startTime) - dayOrder(b.startTime) || String(a.key).localeCompare(String(b.key)))
        .map((block) => ({
          key: block.key,
          positionId: block.positionId,
          position: block.position,
          title: block.title,
          startTime: block.startTime,
          endTime: block.endTime,
          requiredGuards: block.requiredGuards,
          part: shiftPartName({ startTime: block.startTime, endTime: block.endTime }),
          afterMidnight: isAfterMidnight(block.startTime),
          cells: weekDates.map((date) => cellFor(block, date, lastDate)),
        }));
      const counts = [...new Set(blocks.map((b) => b.requiredGuards))];
      const days = blocks.find((b) => b.position)?.position.weekdays || null;
      return {
        post: entry.post,
        category: entry.category,
        weekdays: days,
        requiredGuards: counts.length === 1 ? counts[0] : null,
        positionIds: blocks.filter((b) => b.positionId).map((b) => b.positionId),
        blocks,
      };
    });

  return [...timed, ...weekly].sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.category.localeCompare(b.category, "he") ||
      a.post.localeCompare(b.post, "he", { numeric: true })
  );
}

function cellFor(block, date, lastDate) {
  const list = (block.byDay.get(date) || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (list.length) return { date, state: "shift", shifts: list };
  if (!block.position) return { date, state: "off", shifts: [] };
  // היום הקלנדרי שבו המשמרת של היום הזה מתחילה בפועל (הלילה — למחרת).
  const calendarDate = isAfterMidnight(block.startTime) ? addDays(date, 1) : date;
  const runs = block.weekdays.includes(weekdayOf(calendarDate));
  if (!runs) return { date, state: "off", shifts: [] };
  if (date === lastDate && calendarDate !== date) return { date, state: "next-week", shifts: [] };
  return { date, state: "empty", shifts: [] };
}

/**
 * המשמרות של עמדה חדשה מתוך מה שהמפקד בחר: כמה משמרות ביום ומתי מתחילה
 * הראשונה (חלוקה שווה של 24 שעות), או משמרת אחת עם שעות חופשיות.
 * @returns {{title: string, startTime: string, endTime: string}[]}
 */
export function postBlocks({ name, perDay, firstStart = "06:00", start = "06:00", end = "14:00" }) {
  const title = String(name || "").trim();
  if (perDay <= 1) return [{ title, startTime: start, endTime: end }];
  return buildDivisionRows(title, 24 / perDay, firstStart);
}

/** "עמדת שמירה 1 – משמרת 3" → "עמדת שמירה 2 – משמרת 3": שינוי שם העמדה בלי לגעת בחלק. */
export function renamePostTitle(title, nextPost) {
  const { part } = splitShiftLabel(title);
  return part ? `${nextPost} – ${part}` : nextPost;
}

/**
 * כשמשנים תבנית של עמדה, המשמרות שכבר נוצרו ממנה (מהשבוע המוצג והלאה)
 * צריכות להשתנות איתה — אחרת המפקד מעלה את הסיור ל-3 חיילים והשבוע ממשיך
 * להציג 1. אבל יום שהמפקד שינה ידנית (DayShiftEditor) נשאר כמו שהוא: שדה
 * מתעדכן רק במשמרות שבהן הוא עדיין שווה לערך הישן של התבנית.
 *
 * ימים שהוסרו מהעמדה: משמרות בהם שעוד לא שובץ אליהן אף אחד נמחקות; משמרת
 * שכבר יש בה שיבוץ נשארת (מחיקה שלה היא החלטה של המפקד, לא תופעת לוואי).
 *
 * @returns {{update: {ids: string[], fields: object}[], remove: string[], keptAssigned: number}}
 */
export function planTemplateSync({ shifts = [], positionId, before, after, fromDate }) {
  const mine = shifts.filter((s) => s.positionId === positionId && s.date >= fromDate);
  const update = [];
  const remove = [];
  let keptAssigned = 0;

  const daysAfter = new Set(after.weekdays || []);
  const live = [];
  for (const s of mine) {
    if (!daysAfter.has(weekdayOf(s.date))) {
      if ((s.assignedGuards || []).length) {
        keptAssigned++;
        live.push(s);
      } else remove.push(s.id);
    } else live.push(s);
  }

  const push = (ids, fields) => {
    if (ids.length && Object.keys(fields).length) update.push({ ids, fields });
  };

  // שם, קטגוריה ומיקום הם זהות העמדה — תמיד מתעדכנים.
  const identity = {};
  if (after.title !== before.title) identity.label = after.title;
  if (after.category !== before.category) identity.category = after.category;
  const post = splitShiftLabel(after.title).post;
  if (splitShiftLabel(before.title).post !== post) identity.location = post;
  push(live.map((s) => s.id), identity);

  if (after.startTime !== before.startTime || after.endTime !== before.endTime) {
    push(
      live.filter((s) => s.startTime === before.startTime && s.endTime === before.endTime).map((s) => s.id),
      { startTime: after.startTime, endTime: after.endTime }
    );
  }
  if ((after.requiredGuards || 1) !== (before.requiredGuards || 1)) {
    push(
      live.filter((s) => (s.requiredGuards || 1) === (before.requiredGuards || 1)).map((s) => s.id),
      { requiredGuards: after.requiredGuards || 1 }
    );
  }

  return { update, remove, keptAssigned };
}
