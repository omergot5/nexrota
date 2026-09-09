// ============================================================
// טקסונומיית הקטגוריות המשותפת (D-01) — מנוע טהור, בלי React.
//
// עברה לכאן מ-views.jsx (שם חייתה כי הייתה הראשונה שהזדקקה לה) כי
// ResourceView (מבט-משאבים שבועי) צריך אותה מתוך src/lib/resourceView.js,
// שנבדק ישירות ב-node (scripts/verify-*.mjs) בלי שרשרת JSX — ייבוא views.jsx
// לתוך מודול טהור היה גורר את React לתוך סקריפט הבדיקה. views.jsx ממשיך
// לייבא מכאן, כדי שלא תיווצר טקסונומיה כפולה.
// ============================================================

export const FOLDERS_BY_MODE = {
  security: [
    { name: "שמירות", icon: "shield" },
    { name: "סיור", icon: "target" },
    { name: "עמדה קבועה", icon: "pin" },
    { name: "ציוד אבטחה", icon: "wrench" },
    { name: "דוח משמרת", icon: "clipboard" },
    { name: "כללי", icon: "clipboard" },
  ],
  restaurant: [
    { name: "מטבח", icon: "inbox" },
    { name: "הגשה", icon: "users" },
    { name: "בר", icon: "star" },
    { name: "קופה", icon: "briefcase" },
    { name: "מלאי והזמנות", icon: "trending" },
    { name: "ניקיון", icon: "sparkles" },
    { name: "כללי", icon: "clipboard" },
  ],
  army: [
    { name: "תורנות שמירה", icon: "shield" },
    { name: "סיור", icon: "target" },
    { name: "תורנות מטבח", icon: "inbox" },
    // כוננות היא זמינות, לא נוכחות פיזית — יחסי החסימה שלה מול שאר
    // הקטגוריות (gs_role_compatibility, כללים מובנים) כבר יודעים את זה:
    // כוננות לא חוסמת מטבח/שמירה כי אפשר להיות בכונן תוך כדי עבודה.
    { name: "כוננות", icon: "bell" },
    { name: "אימונים", icon: "zap" },
    { name: "ניקיון", icon: "sparkles" },
    { name: "כללי", icon: "clipboard" },
  ],
};
export const DEFAULT_MODE = "security";
export const foldersFor = (mode) => FOLDERS_BY_MODE[mode] || FOLDERS_BY_MODE[DEFAULT_MODE];

export const UNFILED = "כללי";
// מחפש בכל הרשימות ולא רק בזו של התחום הפעיל: קטגוריה שמישהו הקליד ביד
// (או שהגיעה מתחום אחר לפני שהצוות עבר פרופיל) עדיין צריכה אייקון סביר,
// לא רק "clipboard" גנרי כברירת מחדל.
export const folderIcon = (name) => {
  for (const list of Object.values(FOLDERS_BY_MODE)) {
    const hit = list.find((f) => f.name === name);
    if (hit) return hit.icon;
  }
  return "clipboard";
};

/**
 * טקסונומיית הקטגוריות המשותפת (D-01).
 *
 * טופס המשמרת, טופס המשימה, עורך הכשירות ומבט-המשאבים כולם שואבים את
 * רשימת ההצעה שלהם מכאן ובלבד — כדי שמנהל שממציא קטגוריה על משמרת יראה
 * אותה מוצעת בכל מסך אחר, ושהמסכים לא ייסחפו לשתי טקסונומיות ששתיהן רק
 * *נראות* דומות.
 *
 * קריאה: `categoryOptions(shifts, tasks, mode)` — שלושת הארגומנטים ברירת
 * מחדל (מערך ריק, מערך ריק, "security"), והפונקציה שורדת גם ערך לא-מערך
 * (`null`/`undefined`) ב-shifts/tasks, כי היא נקראת ממספר רכיבים עם מספר
 * זמינויות פרופס שונות. `mode` קובע איזו רשימת הצעה (FOLDERS_BY_MODE)
 * פותחת את הרשימה — לא אילו קטגוריות מותרות: קטגוריה שנוצרה תחת תחום אחד
 * ממשיכה להופיע (דרך `used`) גם אם הצוות עבר תחום אחר כך.
 *
 * הסדר קבוע ואינו סדר איטרציה גולמי של Set: קודם התיקיות המוצעות לפי
 * סדרן המוצהר, ואחריהן כל שם שנמצא בפועל במשמרות/משימות ואינו אחת מהן,
 * לפי א"ב. שני נתיבי קוד שבונים את אותה רשימה לוגית בשני סדרים שונים
 * מייצרים מערכים ששווי-ערך JSON שלהם שונה — וזה בדיוק מה שהופך בדיקת
 * דטרמיניזם עתידית לפעימית (03-RESEARCH.md, Pitfall 8).
 *
 * הרשימה מחזירה את שמות התיקיות המוצעות **במלואן**, גם אם עדיין לא נעשה
 * בהן שימוש בפועל — זו רשימת הצעה לקלט, לא קיבוץ של שורות אמיתיות.
 */
export const categoryOptions = (shifts = [], tasks = [], mode = DEFAULT_MODE) => {
  const used = new Set();
  for (const item of shifts || []) {
    if (item?.category) used.add(item.category);
  }
  for (const item of tasks || []) {
    if (item?.category) used.add(item.category);
  }
  const known = foldersFor(mode).map((f) => f.name);
  const custom = [...used].filter((n) => !known.includes(n)).sort();
  return [...known, ...custom];
};
