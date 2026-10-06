import { useState } from "react";
import { Btn } from "../ui.jsx";

/**
 * שיתוף השבוע כתמונה.
 *
 * הצוות חי בוואטסאפ, ולכן זו הדרך שבה סידור באמת מגיע לאנשים — גם אחרי
 * שפורסם באפליקציה. הקוד של הרינדור נטען רק בלחיצה: הוא מיותר לחלוטין
 * לכל מי שרק בונה סידור ולא משתף אותו. משמש את מסך הפרסום ואת היומן.
 */
export default function ShareWeekBtn({ dates, shifts, guards, posts, teamName }) {
  const [state, setState] = useState("idle");
  const run = async () => {
    setState("working");
    try {
      const { shareWeekImage } = await import("../../lib/shareImage.js");
      const how = await shareWeekImage({ dates, shifts, guards, posts, teamName });
      setState(how === "downloaded" ? "downloaded" : "idle");
    } catch {
      setState("failed");
    }
  };
  return (
    <Btn
      variant="outline"
      icon="image"
      onClick={run}
      loading={state === "working"}
      title="תמונה שאפשר לשלוח בוואטסאפ"
    >
      {state === "downloaded" ? "התמונה הורדה" : state === "failed" ? "נסה שוב" : "שתף כתמונה"}
    </Btn>
  );
}
