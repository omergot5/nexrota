// סוג ה-MIME שגרירת שם של אדם נושאת (BOARD-05): `${guardId}::${shiftId}`.
// בקובץ משלו כדי שגם הלוח, גם היומן וגם הגריד לפי עמדות ייבאו אותו בלי
// לייבא זה את זה (UnifiedBoard מייבא את views.jsx, ו-views.jsx מציג את
// הגריד — ייבוא ישיר היה סוגר מעגל).
export const DRAG_MIME = "application/x-nexrota-guard";
