// ============================================================
// השבוע לפי עמדות — הגריד של בניית השבוע.
//
// כל עמדה היא כותרת (שם, כמה משמרות, כמה חיילים), ומתחתיה שורה לכל משמרת
// שלה: "בוקר 06:00–12:00", ואז שבעה תאים. השעה כתובה פעם אחת בראש השורה
// ולא בכל תא — זה מה שמכניס את כל השבוע לרוחב המסך בלי גלילה הצידה.
//
// התא שקט: בלוק בצבע הקטגוריה ביום שהעמדה פעילה, "—" ביום שלא. שמות מופיעים
// רק כשכבר יש שיבוץ, והשעות/הכמות מופיעות בתא רק כשהיום הזה שונה מהתבנית —
// כלומר, כשיש משהו שהמפקד צריך לשים לב אליו.
//
// השבוע הזה הוא גם הלוח (במקום "תמונת מצב שבועית" שהייתה מסך נפרד): כשמוסרים
// onMove אפשר לגרור שם של אדם מתורנות לתורנות, ומקום שחסר מסומן בתא עצמו
// (אייקון + מספר, לא צבע בלבד). בלי onMove הגריד נשאר לקריאה בלבד — כך אפשר
// להשתמש בו גם בפרסום ובמסך של המשתתף בלי לדעת על עריכה.
//
// הנתונים מגיעים מוכנים מ-buildPostWeek (postWeek.js); כאן רק ציור.
// ============================================================

import { useState, useSyncExternalStore } from "react";
import { Icon } from "../icons.jsx";
import { DAYS_HE, DAYS_HE_SHORT, fromISODate, isToday } from "../../lib/dates.js";
import { folderIcon } from "../../lib/categories.js";
import { COMMAND_DEFAULTS, isQualified } from "../../lib/autoAssign.js";
import { COMMAND_MARK, dutyRoleLabel, isCommander } from "../../lib/dutyRoles.js";
import { DRAG_MIME } from "./dragMime.js";
import { subscribeTerms, t, termProfile } from "../../lib/terms.js";
import { categoryTone, TONE_CLASSES } from "../../design/categoryPalette.js";

const dayShort = (iso) => DAYS_HE_SHORT[fromISODate(iso).getDay()];
const dayLong = (iso) => DAYS_HE[fromISODate(iso).getDay()];
const dm = (iso) => {
  const d = fromISODate(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

/** "א'–ה'" / "א', ג', ה'" — ריק כשהעמדה פועלת כל השבוע. */
function daysLabel(weekdays) {
  if (!weekdays || weekdays.length === 7) return "";
  const sorted = [...weekdays].sort((a, b) => a - b);
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) return `${DAYS_HE_SHORT[sorted[0]]}–${DAYS_HE_SHORT[sorted[sorted.length - 1]]}`;
  return sorted.map((d) => DAYS_HE_SHORT[d]).join(" ");
}

function postMeta(post) {
  const parts = [];
  if (post.weekly) parts.push("כל השבוע, בלי שעות");
  else parts.push(post.blocks.length === 1 ? "משמרת אחת" : `${post.blocks.length} משמרות`);
  if (post.requiredGuards != null) {
    parts.push(
      `${post.requiredGuards} ${post.requiredGuards === 1 ? t("noun.member") : t("noun.memberPlural")}${
        post.blocks.length > 1 ? " בכל משמרת" : ""
      }`
    );
  }
  const days = daysLabel(post.weekdays);
  if (days) parts.push(days);
  return parts.join(" · ");
}

export default function PostWeekGrid({
  posts = [], dates = [], guards = [], onEditPost, onEditShift, onMove, showMissing = false, fullNames = false,
}) {
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  // שם פרטי בעריכה (תאים קטנים, והמפקד מכיר את הצוות); שם מלא בפרסום — מי שקורא
  // את הסידור צריך לדעת איזו דנה זו, וזו אותה תמונה שיוצאת לוואטסאפ.
  const firstName = (id) => {
    const name = guards.find((g) => g.id === id)?.name || "?";
    return fullNames ? name : name.split(" ")[0];
  };

  if (!posts.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-sm" dir="rtl">
        <colgroup>
          <col className="w-[11.5rem]" />
          {dates.map((d) => (
            <col key={d} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-surface-sunken">
            <th className="sticky right-0 z-10 bg-surface-sunken text-right px-3 py-2.5 text-xs font-bold text-muted">
              עמדה / משמרת
            </th>
            {dates.map((date) => (
              <th
                key={date}
                className={`px-1 py-2 text-center text-xs font-bold border-r border-hairline/60 ${
                  isToday(date) ? "text-brand" : "text-muted"
                }`}
              >
                <div>{dayShort(date)}</div>
                <div className="text-[10.5px] text-faint font-semibold" data-numeric>
                  {dm(date)}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {posts.map((post) => {
          const tone = TONE_CLASSES[categoryTone(post.category, mode)];
          return (
            <tbody key={post.post} className="border-t-2 border-hairline">
              <tr>
                <th colSpan={dates.length + 1} scope="rowgroup" className="text-right p-0 bg-surface-sunken/50">
                  <HeaderTag
                    editable={Boolean(onEditPost)}
                    onClick={() => onEditPost?.(post)}
                    aria-label={`עריכת העמדה ${post.post}`}
                    className="group w-full flex items-center gap-2 px-3 py-2 text-right"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tone.dot}`} aria-hidden="true" />
                    <Icon name={folderIcon(post.category)} size={15} className="text-muted flex-shrink-0" />
                    <span className="font-extrabold text-content text-[14px]">{post.post}</span>
                    <span className="text-[12px] text-faint font-semibold truncate">· {postMeta(post)}</span>
                    {onEditPost && (
                      <Icon
                        name="pencil"
                        size={13}
                        className="text-faint group-hover:text-brand mr-auto flex-shrink-0 transition-colors"
                      />
                    )}
                  </HeaderTag>
                </th>
              </tr>

              {post.blocks.map((block) => (
                <tr key={block.key} className="border-t border-hairline/60">
                  <th
                    scope="row"
                    className="sticky right-0 z-10 bg-surface text-right px-3 py-1.5 align-middle font-normal"
                    title={block.afterMidnight ? "הלילה שאחרי כל יום — מתחיל ב-00:00 של היום שלמחרת" : undefined}
                  >
                    <span className="text-[12.5px] font-bold text-content">{block.part || "משמרת"}</span>{" "}
                    {block.startTime && (
                      <span className="text-[11.5px] text-muted font-semibold" dir="ltr" data-numeric>
                        {block.startTime}–{block.endTime}
                      </span>
                    )}
                  </th>
                  {block.weekly ? (
                    // עמדה בלי שעות: תא אחד לכל השבוע, עם מי שמחזיק בה.
                    <td colSpan={dates.length} className="px-1 py-1 align-middle border-r border-hairline/60">
                      <span className={`block rounded-md border-r-[3px] px-2 py-1.5 text-[11.5px] font-semibold ${tone.bg} ${tone.border}`}>
                        {(block.task?.assignees || []).length
                          ? block.task.assignees.map(firstName).join(", ")
                          : <span className="text-faint">עוד לא שובץ</span>}
                      </span>
                    </td>
                  ) : (
                    block.cells.map((cell) => (
                      <td key={cell.date} className="px-1 py-1 align-middle border-r border-hairline/60">
                        <Cell
                          cell={cell}
                          block={block}
                          post={post}
                          tone={tone}
                          firstName={firstName}
                          guards={guards}
                          onEditShift={onEditShift}
                          onMove={onMove}
                          showMissing={showMissing}
                        />
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

/** כותרת עמדה: כפתור כשאפשר לערוך, אחרת טקסט רגיל — בלי "לחצו לעריכה" על מסך שלא עורכים בו. */
function HeaderTag({ editable, className, children, ...rest }) {
  if (!editable) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      className={`${className} cursor-pointer hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50`}
      {...rest}
    >
      {children}
    </button>
  );
}

function Cell({ cell, block, post, tone, firstName, guards, onEditShift, onMove, showMissing }) {
  if (cell.state === "off" || cell.state === "empty") {
    return (
      <span className="block text-center text-[12px] text-faint" aria-label={cell.state === "off" ? "לא פעילה ביום הזה" : "אין תורנות ביום הזה"}>
        —
      </span>
    );
  }
  if (cell.state === "next-week") {
    return (
      <span
        className="block text-center text-[10.5px] font-semibold text-faint border border-dashed border-hairline-strong rounded-md py-1.5"
        title="ליל שבת→ראשון מתחיל ביום ראשון של השבוע הבא, ויופיע כאן כשהשבוע הבא ייבנה"
      >
        שבוע הבא
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {cell.shifts.map((shift) => (
        <ShiftCell
          key={shift.id}
          shift={shift}
          block={block}
          post={post}
          tone={tone}
          cell={cell}
          firstName={firstName}
          guards={guards}
          onEditShift={onEditShift}
          onMove={onMove}
          showMissing={showMissing}
        />
      ))}
    </div>
  );
}

function ShiftCell({ shift, block, post, tone, cell, firstName, guards, onEditShift, onMove, showMissing }) {
  const [dragOver, setDragOver] = useState(false);
  const editable = Boolean(onEditShift); // לפני label: התווית תלויה בו
  const ids = shift.assignedGuards || [];
  const names = ids.map(firstName);
  const need = shift.requiredGuards || 1;
  const timesDiffer = shift.startTime !== block.startTime || shift.endTime !== block.endTime;
  const countDiffers = need !== block.requiredGuards;
  const partial = names.length > 0 && names.length < need;
  // בסיור ובכוננות חייב בעל תפקיד. מסומן רק כשכבר שובץ מישהו (כמו החוסר) ורק אם בצוות יש בעלי תפקיד בכלל.
  const commandRequired = (COMMAND_DEFAULTS[termProfile()] || []).includes(shift.category) && guards.some(isCommander);
  const lacksCommand =
    showMissing && commandRequired && ids.length > 0 && !ids.some((id) => isCommander(guards.find((x) => x.id === id)));
  // חוסר נראה רק אחרי ששובץ מישהו בשבוע (showMissing) — לפני כן כל התאים ריקים
  // וסימון כולם כחסרים הוא רעש. אייקון, מספר ומסגרת, לא צבע בלבד.
  const missing = Math.max(0, need - names.length);
  const flagged = showMissing && missing > 0;
  const label = `${post.post} ${block.part}, ${block.afterMidnight ? `ליל ${dayLong(cell.date)}` : `יום ${dayLong(cell.date)}`}: ${
    names.length ? names.join(", ") : "עוד לא שובץ"
  }${flagged ? (missing === 1 ? ", חסר מקום אחד" : `, חסרים ${missing}`) : ""}${lacksCommand ? ", בלי בעל תפקיד" : ""}${editable ? " — לחצו לעריכת היום הזה" : ""}`;

  const open = () => onEditShift?.(shift);
  const dropProps = onMove
    ? {
        onDragOver: (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        },
        onDragEnter: (e) => {
          if (e.dataTransfer.types.includes(DRAG_MIME)) setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop: (e) => {
          e.preventDefault();
          setDragOver(false);
          const raw = e.dataTransfer.getData(DRAG_MIME);
          if (!raw) return;
          const [guardId, fromShiftId] = raw.split("::");
          if (fromShiftId === shift.id) return;
          onMove(fromShiftId, shift.id, guardId);
        },
      }
    : {};

  // div ולא button: שם בתוך כפתור לא נגרר בכל הדפדפנים (Firefox), ושם הוא
  // בדיוק מה שנגרר. המקלדת מקבלת את אותו תפקיד דרך role + Enter/רווח.
  return (
    <div
      {...(editable
        ? {
            role: "button",
            tabIndex: 0,
            onClick: open,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open();
              }
            },
          }
        : { role: "group" })}
      aria-label={label}
      title={label}
      {...dropProps}
      className={`block w-full min-h-[2rem] text-right rounded-md border-r-[3px] px-1.5 py-1
        ${editable ? "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-brand/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60" : ""}
        ${tone.bg} ${tone.border} ${flagged ? "ring-1 ring-inset ring-warn" : ""} ${dragOver ? "ring-2 ring-inset ring-content" : ""}
        transition-shadow`}
    >
      {(timesDiffer || countDiffers || partial || flagged || lacksCommand) && (
        <span className="flex items-center justify-between gap-1">
          {timesDiffer ? (
            <span className="text-[10px] font-extrabold text-warn" dir="ltr" data-numeric>
              {shift.startTime}–{shift.endTime}
            </span>
          ) : (
            <span />
          )}
          {lacksCommand && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-black px-1 rounded bg-bg text-warn"
              title="בסיור ובכוננות חייב להיות בכל משמרת סמל, מפקץ או מפקד כיתה"
            >
              ללא {COMMAND_MARK}
            </span>
          )}
          {(countDiffers || partial || flagged) && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-black px-1 rounded bg-bg ${
                partial || flagged ? "text-warn" : "text-content"
              }`}
              data-numeric
            >
              {(partial || flagged) && <Icon name="alert" size={9} />}
              {partial || flagged ? `${names.length}/${need}` : `×${need}`}
            </span>
          )}
        </span>
      )}
      {ids.length > 0 && (
        <span className="flex flex-wrap gap-x-1 text-[11px] font-semibold text-content leading-tight">
          {ids.map((id) => {
            const g = guards.find((x) => x.id === id);
            const blocked = g ? !isQualified(g, shift.category) : false;
            return (
              <span
                key={id}
                draggable={Boolean(onMove)}
                onDragStart={onMove ? (e) => e.dataTransfer.setData(DRAG_MIME, `${id}::${shift.id}`) : undefined}
                title={blocked ? `לא מוגדר/ת כשיר/ה לקטגוריית "${shift.category}"` : undefined}
                className={onMove ? "cursor-grab active:cursor-grabbing" : undefined}
              >
                {blocked && <Icon name="lock" size={9} className="inline ml-0.5 -mt-0.5" />}
                {g && isCommander(g) && (
                  <span className="text-warn" title={dutyRoleLabel(g.dutyRole)} aria-label={dutyRoleLabel(g.dutyRole)}>
                    {COMMAND_MARK}
                  </span>
                )}
                {firstName(id)}
              </span>
            );
          })}
        </span>
      )}
    </div>
  );
}
