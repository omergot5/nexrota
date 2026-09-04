// ============================================================
// AVAIL — תצוגת הזמינות כאייקון + מילה + צבע, אף פעם לא צבע לבד (WCAG 1.4.1).
//
// מקור יחיד: GuardApp.jsx ו-views.jsx (סופרוויזר) החזיקו כל אחד עותק משלו,
// ורק אחד מהם כלל "unknown" — הסטטוס ש-availStatus() (autoAssign.js) מחזיר
// למשבצת שהשומר עוד לא הגיש עליה. עותק חסר לא קורס (הרינדור מוגן ב-`meta &&`),
// אבל התג פשוט נעלם בלי שגיאה. מפה אחת ששני המסכים מייבאים לא יכולה לסטות.
// ============================================================

export const AVAIL = {
  preferred:   { icon: "star",         label: "מעדיף",    short: "מעדיף",   tone: "brand",    cls: "text-brand" },
  available:   { icon: "check-circle", label: "זמין",     short: "זמין",    tone: "accent",   cls: "text-accent" },
  maybe:       { icon: "help",         label: "אולי",     short: "אולי",    tone: "warn",     cls: "text-warn" },
  unavailable: { icon: "x-circle",     label: "לא זמין",  short: "לא",      tone: "danger",   cls: "text-danger" },
  unknown:     { icon: "info",         label: "לא הגיש",  short: "לא הגיש", tone: "neutral",  cls: "text-faint" },
};

/** הכפתורים שהשומר עצמו בוחר ביניהם — "unknown" אינו בחירה, הוא ברירת המחדל לפני שנבחר משהו. */
export const AVAIL_CHOICES = ["preferred", "available", "maybe", "unavailable"];
