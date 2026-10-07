// ============================================================
// האם אירוע realtime שייך לצוות שעל המסך — מנוע טהור (בלי React ובלי רשת).
//
// Supabase לא מחיל RLS על אירועי DELETE: כל מחיקה בכל צוות במערכת מגיעה
// לכל לקוח מחובר, עם המפתח הראשי בלבד (נבדק חי ב-QA, ממצא 8 ב-
// docs/qa/2026-10-07-qa-report.md). כל אירוע כזה הפעיל טעינה מלאה של הצוות
// אצל כל משתמש — מחיקת שבוע אחד במקום אחד הייתה מרעננת את כולם.
//
// INSERT ו-UPDATE כבר מסוננים ב-RLS, ולכן עוברים תמיד. DELETE עובר רק אם
// המפתח שלו מוכר בנתונים שעל המסך. אירוע שאי אפשר לזהות (אין מפתח מוכר
// בכלל) עובר — רענון מיותר עדיף על פספוס.
// ============================================================

/**
 * @param {{eventType?: string, table?: string, old?: object}} payload
 * @param {{shifts?: object[], tasks?: object[], members?: object[], guards?: object[], swapRequests?: object[]}} data
 * @returns {boolean} true = לרענן
 */
export function isRelevantChange(payload, data = {}) {
  if (payload?.eventType !== "DELETE") return true;
  const old = payload.old || {};
  const items = new Set([...(data.shifts || []), ...(data.tasks || [])].map((x) => String(x.id)));
  const people = new Set([...(data.members || []), ...(data.guards || [])].map((x) => String(x.id)));
  const swaps = new Set((data.swapRequests || []).map((x) => String(x.id)));

  switch (payload.table) {
    case "gs_work_items":
      return old.id == null || items.has(String(old.id));
    case "gs_work_item_assignments":
      return old.work_item_id == null || items.has(String(old.work_item_id));
    case "gs_availability":
      return old.shift_id == null || items.has(String(old.shift_id));
    case "gs_profiles":
      return old.id == null || people.has(String(old.id));
    case "gs_swap_requests":
      return old.id == null || swaps.has(String(old.id));
    default:
      return true;
  }
}
