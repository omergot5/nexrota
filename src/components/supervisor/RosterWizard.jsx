// ============================================================
// בניית שבוע — צבא. גם הלוח של השבוע (המסך "תמונת מצב שבועית" התמזג לכאן).
//
// המסך הוא השבוע עצמו, ברוחב מלא: כל עמדה היא כותרת, ומתחתיה המשמרות שלה
// על פני שבעה ימים (PostWeekGrid). המפקד רואה את כל האירוע בתמונה אחת,
// בלי גלילה הצידה ובלי משפטים שמסיחים את הדעת. עמדה נפתחת לעריכה בלחיצה
// על השם שלה (PostEditor); יום בודד — בלחיצה על התא שלו (DayShiftEditor), שם
// גם מסירים ומוסיפים אנשים. גרירת שם בין תאים מעבירה אותו (moveAssignment).
// משימות שאינן עמדה (TaskMgmt) מופיעות מתחת לגריד, כדי שמשמרות ומשימות
// יישארו באותו מסך ולא יחזרו להיות שני עולמות עיוורים זה לזה.
//
// לא מנוע חדש: שכבת UI מעל gs_positions (התבנית שחוזרת כל שבוע) ו-
// gs_work_items (מה שנוצר בשבוע הזה בפועל). "הכול חוסם הכול" ממשיך לקרות
// במנוע לבד (conflicts.js/autoAssign.js) — אין מה להגדיר כאן ואין צורך
// להסביר אותו על המסך.
// ============================================================

import { useMemo, useState, useSyncExternalStore } from "react";
import { Alert, Badge, Btn, Card, ConfirmDialog } from "../ui.jsx";
import { Icon } from "../icons.jsx";
import PostWeekGrid from "./PostWeekGrid.jsx";
import PostEditor from "./PostEditor.jsx";
import DayShiftEditor from "./DayShiftEditor.jsx";
import { foldersFor } from "../../lib/categories.js";
import { buildPostWeek, countMissing } from "../../lib/postWeek.js";
import { boardItemsForDates, shortDate } from "../../lib/dates.js";
import { People } from "./views.jsx";
import { checkAssignment, teamRules } from "../../lib/autoAssign.js";
import { subscribeTerms, termProfile } from "../../lib/terms.js";

// נקודות פתיחה לצוות שעוד לא הגדיר כלום — לחיצה פותחת את העורך כבר מלא.
// לא רשימה סגורה: "עמדה חדשה" מוסיפה כל דבר אחר.
const SUGGESTIONS = [
  { title: "עמדת שמירה 1", category: "תורנות שמירה", perDay: 4, requiredGuards: 1 },
  { title: "סיור", category: "סיור", perDay: 3, requiredGuards: 2 },
  { title: "כוננות", category: "כוננות", perDay: 2, requiredGuards: 3 },
  {
    title: "תורנות מטבח",
    category: "תורנות מטבח",
    perDay: 1,
    startTime: "06:30",
    endTime: "14:30",
    weekdays: [0, 1, 2, 3, 4, 5],
    requiredGuards: 2,
  },
];

export default function RosterWizard({
  positions = [], guards = [], weekDates = [], actions, busy, team, shifts = [], tasks = [],
  availability = {}, onNavigate,
}) {
  // תחום הפעילות מוחל מ-subscribeTerms/termProfile (D-07) — אותו מקור אמת
  // שצביעת הקטגוריות בגריד קוראת ממנו.
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const categories = foldersFor("army").map((f) => f.name);
  // קטגוריות שמותרת בהן משמרת ארוכה (הגדרות הצוות) — בלי אזהרת "יותר מ-12" עליהן.
  const longShiftCategories = teamRules(team).longShiftCategories;

  const [editorTarget, setEditorTarget] = useState(null); // null = סגור; {} = עמדה חדשה; {seed}; {post} = עריכה
  const [dayEditId, setDayEditId] = useState(null); // תורנות של יום אחד שנפתחה מהגריד
  const [confirmState, setConfirmState] = useState(null); // CONFIRM-05: מחיקת עמדה או משמרות שלה
  const [moveNotice, setMoveNotice] = useState(null); // גרירה שנדחתה — למה

  const posts = useMemo(
    () => buildPostWeek({ shifts, positions, tasks, weekDates, mode }),
    [shifts, positions, tasks, weekDates, mode]
  );
  // חוסרים מוצגים רק אחרי ששובץ מישהו בשבוע — עד אז כל התאים ריקים וסימון כולם
  // כחסרים הוא רעש. אותו מספר בדיוק שהתאים מציגים (countMissing), לא חישוב שני.
  const { missing, assigned } = useMemo(() => countMissing(posts), [posts]);
  const showMissing = assigned > 0;

  // משימות שאינן עמדה: אלה שנוצרו ב-TaskMgmt. משימה שנולדה מעמדה שבועית כבר
  // מוצגת בגריד כשורה "כל השבוע", ולא תופיע פעמיים.
  const looseTasks = useMemo(() => {
    const board = boardItemsForDates([], tasks.filter((tk) => !tk.positionId), weekDates);
    return board.days.flatMap((d) => [...d.timeless, ...d.timed]);
  }, [tasks, weekDates]);

  // נגזר מ-shifts בכל רינדור — אחרי שמירה העורך מציג את הנתונים הטריים.
  const dayEditShift = dayEditId ? shifts.find((s) => s.id === dayEditId) || null : null;

  // גרירת שם בין תורנויות. actions.moveAssignment בודקת כשירות בלבד, אבל כאן
  // ההוספה עוברת בדיקה מלאה (חפיפה, מנוחה, רצף, זמינות, תקרה) — וגרירה היא
  // אותה פעולה בעטיפה אחרת, אז היא נבדקת באותו אופן. האדם מוסר מהתורנות
  // שממנה גוררים לפני הבדיקה: תורנות צמודה אליה היא לא התנגשות בעצמו.
  const moveGuard = (fromShiftId, toShiftId, guardId) => {
    const guard = guards.find((g) => g.id === guardId);
    const target = shifts.find((s) => s.id === toShiftId);
    if (!guard || !target) return;
    const without = shifts.map((s) =>
      s.id === fromShiftId ? { ...s, assignedGuards: (s.assignedGuards || []).filter((g) => g !== guardId) } : s
    );
    const legality = checkAssignment({
      guard, shift: target, shifts: without, availability, tasks, rules: teamRules(team),
    });
    if (!legality.ok) {
      setMoveNotice(`לא ניתן להעביר את ${guard.name}: ${legality.reason}`);
      return;
    }
    setMoveNotice(null);
    return actions.moveAssignment(fromShiftId, toShiftId, guardId);
  };

  const send = async (plan) => {
    await actions.savePost({ ...plan, weekDates });
    setEditorTarget(null);
  };

  // מחיקת עמדה, או של משמרות מתוכה, היא ברשימת הפרה-אישור (עקרון ברזל 3) —
  // אותו ConfirmDialog, לא UndoBar. שמירה בלי מחיקות יוצאת מיד.
  const submit = async (plan) => {
    if (plan.remove.length) {
      setConfirmState({
        title: `למחוק ${plan.remove.length === 1 ? "משמרת אחת" : `${plan.remove.length} משמרות`} מ"${plan.summary}"?`,
        body: "המשמרות יימחקו מהעמדה, יחד עם התורנויות שלהן מהשבוע הזה והלאה — כולל מי שכבר שובץ אליהן.",
        confirmLabel: "מחק ושמור",
        tone: "danger",
        onConfirm: () => send(plan),
      });
      return;
    }
    try {
      await send(plan);
    } catch {
      // השגיאה כבר מוצגת בבאנר הכללי (run); העורך נשאר פתוח עם מה שהוקלד.
    }
  };

  const deletePost = (post) =>
    setConfirmState({
      title: `למחוק את "${post.post}"?`,
      body: "העמדה וכל המשמרות שלה יימחקו מהשבוע הזה והלאה, כולל מי שכבר שובץ אליהן. שבועות שעברו לא משתנים.",
      confirmLabel: "מחק עמדה",
      tone: "danger",
      onConfirm: () => send({ create: [], update: [], remove: post.positionIds }),
    });

  return (
    <div className="space-y-3">
      {posts.length === 0 ? (
        <Card className="p-6 sm:p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
            <Icon name="calendar" size={22} />
          </div>
          <h3 className="text-[16px] font-extrabold text-content">עוד אין עמדות לשבוע הזה</h3>
          <p className="text-[13px] text-muted mt-1">עמדה מוגדרת פעם אחת, וחוזרת לבד כל שבוע.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => setEditorTarget({ seed: s })}
                className="h-10 px-3.5 rounded-xl text-[13px] font-bold cursor-pointer ring-1 ring-inset ring-hairline
                  bg-surface-sunken text-muted hover:text-content hover:ring-hairline-strong transition-colors flex items-center gap-1.5"
              >
                <Icon name="plus" size={14} /> {s.title}
              </button>
            ))}
          </div>
          <Btn className="mt-4" icon="plus" onClick={() => setEditorTarget({})}>
            עמדה חדשה
          </Btn>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-muted flex items-center gap-2 flex-wrap">
              <span>
                {`${posts.length} עמדות · לחיצה על עמדה — עריכה · על תורנות — שעות ואנשים`}
                {showMissing ? " · גרירת שם — העברה" : ""}
              </span>
              {showMissing && (
                <Badge tone={missing > 0 ? "warn" : "accent"} icon={missing > 0 ? "alert" : "check"}>
                  <span data-numeric>{missing > 1 ? `${missing} מקומות לא מאוישים` : missing === 1 ? "מקום אחד לא מאויש" : "הכול מאויש"}</span>
                </Badge>
              )}
            </p>
            <Btn size="sm" icon="plus" onClick={() => setEditorTarget({})}>
              עמדה חדשה
            </Btn>
          </div>
          {moveNotice && (
            <Alert tone="warn" onClose={() => setMoveNotice(null)}>
              {moveNotice}
            </Alert>
          )}
          <Card className="p-0 overflow-hidden">
            <PostWeekGrid
              posts={posts}
              dates={weekDates}
              guards={guards}
              onEditPost={(post) => setEditorTarget({ post })}
              onEditShift={(shift) => setDayEditId(shift.id)}
              onMove={moveGuard}
              showMissing={showMissing}
            />
          </Card>
        </>
      )}

      {looseTasks.length > 0 && (
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-[13px] font-extrabold text-content">
              משימות נוספות בשבוע · <span data-numeric>{looseTasks.length}</span>
            </h3>
            {onNavigate && (
              <Btn size="sm" variant="ghost" onClick={() => onNavigate("tasks")}>
                לניהול המשימות
              </Btn>
            )}
          </div>
          <ul className="divide-y divide-hairline/60">
            {looseTasks.map((item) => (
              <li key={`${item.timeless ? "t" : "s"}-${item.id}`} className="flex items-center gap-3 py-1.5 text-[12.5px]">
                <span className="font-bold text-content truncate flex-1">{item.label}</span>
                <span className="text-muted flex-shrink-0" data-numeric>
                  {shortDate(item.date)}
                  {!item.timeless && item.startTime ? ` · ${item.startTime}–${item.endTime}` : ""}
                </span>
                <People ids={item.assignedGuards || []} guards={guards} size={20} max={3} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <PostEditor
        target={editorTarget}
        onClose={() => setEditorTarget(null)}
        onSubmit={submit}
        onDelete={deletePost}
        categories={categories}
        longShiftCategories={longShiftCategories}
        busy={busy}
      />

      <DayShiftEditor
        shift={dayEditShift}
        onClose={() => setDayEditId(null)}
        onSave={(next) => actions.updateShift(next.id, next)}
        onCancelDay={(shift) => actions.deleteShift(shift.id)}
        longShiftCategories={longShiftCategories}
        guards={guards}
        shifts={shifts}
        availability={availability}
        tasks={tasks}
        team={team}
        onToggleAssignment={actions.toggleAssignment}
        busy={busy}
      />

      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title}
        body={confirmState?.body}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        busy={busy}
      />
    </div>
  );
}
