// ============================================================
// תפקידי פלוגה: סמל, מפקץ, מפקד כיתה.
//
// בכוננות ובסיור חייב להיות בכל משמרת לפחות אחד מהם (autoAssign.js,
// commandCategories). טהור — בלי React ובלי רשת, כדי שנבדק ב-Node.
// ============================================================

export const DUTY_ROLES = [
  { id: "sergeant", label: "סמל" },
  { id: "platoon", label: "מפקץ" },
  { id: "squad", label: "מפקד כיתה" },
];

/** האם האדם בעל תפקיד פיקוד (כל אחד משלושת התפקידים נחשב). */
export const isCommander = (guard) => DUTY_ROLES.some((r) => r.id === guard?.dutyRole);

export const dutyRoleLabel = (id) => DUTY_ROLES.find((r) => r.id === id)?.label || "";
