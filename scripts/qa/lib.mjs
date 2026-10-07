// כלים משותפים לסקריפטי ה-QA (מועתק מ-sim-engine.mjs: תרחישי עמדות + בודק חוקים בלתי תלוי במנוע).
import { armyDemoPositions } from "../../src/lib/armyDemo.js";
import { buildDivisionRows } from "../../src/lib/positions.js";
import { addDays, isNightShift } from "../../src/lib/dates.js";

export const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- scenarios (positions per mode) ----------
export const ALL = [0, 1, 2, 3, 4, 5, 6];
const div = (title, hours, category, requiredGuards) =>
  buildDivisionRows(title, hours).map((r) => ({ ...r, category, weekdays: ALL, requiredGuards }));

export function positionsFor(mode, n) {
  if (mode === "army") return armyDemoPositions(n);
  if (mode === "security") {
    // אבטחה: שער ראשי 24/7 ב-2 משמרות של 12 (2 אנשים), סיור 3×8 (1), קבלה ביום 08-16 א-ה (1)
    return [
      ...div("שער ראשי", 12, "שער", 2),
      ...div("סיור היקפי", 8, "סיור", 1),
      { title: "קבלה", category: "קבלה", weekdays: [0, 1, 2, 3, 4], startTime: "08:00", endTime: "16:00", requiredGuards: 1 },
    ];
  }
  // מסעדנות: בוקר 08-16 (2), ערב 16-00 (3), סגירה 00-03 ו-ו'/ש' (שבת בלבד פתוח עד מאוחר)
  return [
    { title: "משמרת בוקר", category: "אולם", weekdays: ALL, startTime: "08:00", endTime: "16:00", requiredGuards: 2 },
    { title: "משמרת ערב", category: "אולם", weekdays: ALL, startTime: "16:00", endTime: "00:00", requiredGuards: 3 },
    { title: "מטבח", category: "מטבח", weekdays: ALL, startTime: "10:00", endTime: "22:00", requiredGuards: 2 },
  ];
}

// ---------- independent validator ----------
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dayStart = (d) => new Date(`${d}T00:00:00Z`).getTime() / 60000;
const iv = (s) => {
  const a = dayStart(s.date) + mins(s.startTime);
  let b = dayStart(s.date) + mins(s.endTime);
  if (b <= a) b += 1440;
  return [a, b];
};
const opDay = (s) => (mins(s.startTime) / 60 < 5 ? addDays(s.date, -1) : s.date);

export function validate({ result, shifts, guards, availability, rest, longCats, oncePerDay, maxBlock = 12, weeklyCap = 6, nightCap = 3 }) {
  const bad = [];
  const sById = new Map(shifts.map((s) => [s.id, s]));
  const per = new Map(guards.map((g) => [g.id, []]));
  const perShift = new Map();
  for (const a of result.assignments) {
    const s = sById.get(a.shiftId);
    if (!s) { bad.push(`assignment to unknown shift ${a.shiftId}`); continue; }
    if (!per.has(a.guardId)) { bad.push(`assignment to unknown guard ${a.guardId}`); continue; }
    per.get(a.guardId).push(s);
    perShift.set(s.id, [...(perShift.get(s.id) || []), a.guardId]);
    const st = availability[`${a.guardId}-${s.id}`]?.status;
    if (st === "unavailable") bad.push(`${a.guardId} assigned to ${s.id} despite unavailable`);
    if (!a.parts?.length) bad.push(`assignment ${a.shiftId}/${a.guardId} has no reasoning parts`);
  }
  for (const [sid, gs] of perShift) {
    const s = sById.get(sid);
    if (new Set(gs).size !== gs.length) bad.push(`${sid}: same guard twice`);
    if (gs.length > Math.max(1, s.requiredGuards || 1)) bad.push(`${sid}: overfilled ${gs.length}/${s.requiredGuards}`);
  }
  for (const [gid, list] of per) {
    list.sort((a, b) => iv(a)[0] - iv(b)[0]);
    if (list.length > weeklyCap) bad.push(`${gid}: ${list.length} shifts > cap ${weeklyCap}`);
    const nights = list.filter(isNightShift).length;
    if (nights > nightCap) bad.push(`${gid}: ${nights} nights > cap ${nightCap}`);
    let bs = null, be = null, bc = 0, bl = false;
    const flush = () => {
      if (bs === null) return;
      const h = (be - bs) / 60;
      if (h > maxBlock && !(bc === 1 && bl)) bad.push(`${gid}: block ${h}h`);
    };
    for (let i = 0; i < list.length; i++) {
      const [s0, e0] = iv(list[i]);
      if (i > 0) {
        const prevEnd = Math.max(...list.slice(0, i).map((x) => iv(x)[1]));
        if (s0 < prevEnd) bad.push(`${gid}: overlap ${list[i - 1].id}/${list[i].id}`);
        else if (s0 > prevEnd && (s0 - prevEnd) / 60 < rest) bad.push(`${gid}: rest ${(s0 - prevEnd) / 60}h < ${rest}`);
      }
      if (bs !== null && s0 === be) { be = e0; bc++; bl = bl && longCats.includes(list[i].category); }
      else { flush(); bs = s0; be = e0; bc = 1; bl = longCats.includes(list[i].category); }
    }
    flush();
    for (const cat of oncePerDay) {
      const d = list.filter((x) => x.category === cat).map(opDay);
      if (new Set(d).size !== d.length) bad.push(`${gid}: two ${cat} on one op-day`);
    }
  }
  return bad;
}

