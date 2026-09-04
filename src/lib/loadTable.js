// ============================================================
// loadTable — הטבלה שמזינה את מסך הדוחות ואת כרטיס העומס בלוח הבקרה.
//
// המודול לא מבצע שום חשבון עומס משלו. כל מספר נטל, שעות, ספירה ולילות
// מגיע משיחה אחת ל-`teamAverages()` — אותה פונקציה שכבר מזינה את שורת
// ההוגנות של המשתתף (`GuardApp.jsx`) ואת כרטיס האיזון של השיבוץ החכם.
// המשקל הממוצע לתורנות מגיע מ-`meanShiftLoad()`, אותה הגדרה יחידה
// ש-`fairnessPlan` משתמשת בה. שני מסכים שמראים "עומס" לא יכולים לחלוק
// על אותו אדם, כי שניהם קוראים לאותו מקור.
//
// מה שהמודול כן מוסיף הוא עיצוב תצוגה גרידא, שאינו קיים ב-teamAverages:
// פיצול שם פרטי/מלא, ספירת המשבצות לפי סוג עבור התרשימים, וסדר השורות.
// ============================================================

import { teamAverages } from "./autoAssign.js";
import { meanShiftLoad } from "./fairness.js";

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * טבלת התצוגה למסך הדוחות (`Analytics.jsx`) ולכרטיס "עומס השומרים" בלוח
 * הבקרה (`views.jsx`'s `SupDashboard`, Task 4).
 *
 * @returns {{
 *   rows: Array<{guardId:string, name:string, fullName:string, count:number,
 *     nights:number, hours:number, load:number, morning:number, afternoon:number,
 *     evening:number}>,
 *   meanLoad: number,
 *   perShiftLoad: number,
 *   byType: Record<string, number>,
 *   totalAssigned: number,
 *   guardCount: number,
 * }}
 */
export function loadTable(guards = [], shifts = []) {
  const { perGuard, avg } = teamAverages(guards, shifts);

  // ספירת המשבצות לפי סוג — עובדה שקיימת גם ברמת הצוות (לתרשים העוגה,
  // `byType`) וגם ברמת האדם (לתרשים העמודות הערוך, `morning`/`afternoon`
  // על כל שורה). אף אחת מהן אינה נטל: זו סתם ספירה, בדיוק כמו `count`
  // ו-`nights` שכבר קיימים ב-`teamAverages`.
  const byType = {};
  const perGuardByType = {};
  for (const g of guards) perGuardByType[g.id] = { morning: 0, afternoon: 0, evening: 0 };

  let totalAssigned = 0;
  for (const s of shifts) {
    const assigned = s.assignedGuards || [];
    if (!assigned.length) continue;
    byType[s.type] = (byType[s.type] || 0) + assigned.length;
    totalAssigned += assigned.length;
    if (s.type === "morning" || s.type === "afternoon" || s.type === "evening") {
      for (const id of assigned) {
        const rec = perGuardByType[id];
        if (rec) rec[s.type] += 1; // שובץ ואז הוסר מהצוות — מתעלמים בשקט
      }
    }
  }

  const rows = guards
    .map((g) => {
      const src = perGuard[g.id] || { count: 0, nights: 0, hours: 0, load: 0 };
      const byTypeRow = perGuardByType[g.id] || { morning: 0, afternoon: 0, evening: 0 };
      const first = String(g.name || "").split(" ")[0] || g.name || "";
      return {
        guardId: g.id,
        name: first,
        fullName: g.name || "",
        count: src.count,
        nights: src.nights,
        hours: Math.round(src.hours),
        load: round1(src.load),
        morning: byTypeRow.morning,
        afternoon: byTypeRow.afternoon,
        evening: byTypeRow.evening,
      };
    })
    // ממוין מהעמוס ביותר לפי נטל — בדיוק כמו שהמנוע ממיין את ה-perGuard
    // שלו ב-01-01. שובר שוויון לקסיקוגרפי על מזהה השומר, לא על שם: שם
    // עשוי להתנגש (שני "דנה" בצוות), מזהה לעולם לא.
    .sort((a, b) => b.load - a.load || (a.guardId < b.guardId ? -1 : a.guardId > b.guardId ? 1 : 0));

  return {
    rows,
    meanLoad: avg.load,
    perShiftLoad: round1(meanShiftLoad(shifts)),
    byType,
    totalAssigned,
    guardCount: guards.length,
  };
}
