import { createClient } from "@supabase/supabase-js";

// The publishable key is safe in client code — it only ever grants what the
// row-level security policies allow. Env vars win so the project can be
// repointed (e.g. at a staging project) without touching source.
const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || "https://biauxcgphdhwewszupsq.supabase.co";
const SUPABASE_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_k6r9g9MSDCgRcrjwEQiZ3A_mjwNXv8H";

/**
 * שעון מכשיר שסוטה מהשרת (נפוץ: טלפון/מחשב עם אזור זמן או שעה ידנית שגויים)
 * שובר את ההתחברות: supabase-js משווה את `expires_at` של השרת לשעון המקומי,
 * ולכן טוקן תקף נראה "פג" — כל בקשה מרעננת, עד שמגבלת הקצב מנתקת את הסשן
 * והמסך מתרוקן באמצע עבודה. כאן `expires_at` מחושב מחדש לפי השעון המקומי
 * (מ-`expires_in`, שאינו תלוי שעון), כך שהלקוח עקבי עם עצמו בכל סטייה.
 */
async function skewSafeFetch(input, init) {
  const res = await fetch(input, init);
  const url = typeof input === "string" ? input : input?.url || "";
  if (!res.ok || !/\/auth\/v1\/(token|signup)/.test(url)) return res;
  try {
    const body = await res.clone().json();
    if (body && body.access_token && typeof body.expires_in === "number") {
      body.expires_at = Math.floor(Date.now() / 1000) + body.expires_in;
      return new Response(JSON.stringify(body), {
        status: res.status,
        statusText: res.statusText,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    /* תשובה שאינה JSON — עוברת כמו שהיא */
  }
  return res;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: { fetch: skewSafeFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Required for the password-recovery link: the token arrives in the URL
    // fragment and has to be exchanged for a session before the user can set
    // a new password.
    detectSessionInUrl: true,
    storageKey: "gs-auth",
  },
});

