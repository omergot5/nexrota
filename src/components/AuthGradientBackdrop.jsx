// ============================================================
// הרקע האטמוספרי של מסך הכניסה.
//
// שלושה כתמי צבע מטושטשים, נעים לאט בכיוונים מנוגדים — לא אנימציה
// שמבקשת תשומת לב, אלא רקע שמרגיש חי כשמסתכלים לרגע במקום אחר.
// כל צבע נשאב מ-`tokens.css` דרך `var(--x)`, ולכן ערכת הכהה מקבלת
// אותו רקע בגוונים שלה בלי שורת קוד נוספת כאן.
//
// `pointer-events-none` ו-`aria-hidden` כי זה קישוט טהור — קורא מסך
// לא אמור לדעת שהוא קיים, ועכבר לא אמור להתעכב עליו.
// ============================================================
export default function AuthGradientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute -top-32 -right-24 h-[34rem] w-[34rem] rounded-full blur-3xl opacity-80 animate-float1 motion-reduce:animate-none"
        style={{ background: "rgb(var(--brand-soft) / 0.5)" }}
      />
      <div
        className="absolute top-1/3 -left-28 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-70 animate-float2 motion-reduce:animate-none"
        style={{ background: "rgb(var(--mint) / 0.45)" }}
      />
      <div
        className="absolute bottom-[-10rem] right-1/4 h-[26rem] w-[26rem] rounded-full blur-3xl opacity-60 animate-float1 motion-reduce:animate-none"
        style={{ background: "rgb(var(--accent) / 0.35)", animationDelay: "-9s" }}
      />
    </div>
  );
}
