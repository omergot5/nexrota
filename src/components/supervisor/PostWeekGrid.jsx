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
// הנתונים מגיעים מוכנים מ-buildPostWeek (postWeek.js); כאן רק ציור.
// ============================================================

import { useSyncExternalStore } from "react";
import { Icon } from "../icons.jsx";
import { DAYS_HE, DAYS_HE_SHORT, fromISODate, isToday } from "../../lib/dates.js";
import { folderIcon } from "../../lib/categories.js";
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

export default function PostWeekGrid({ posts = [], dates = [], guards = [], onEditPost, onEditShift }) {
  const mode = useSyncExternalStore(subscribeTerms, termProfile, termProfile);
  const firstName = (id) => (guards.find((g) => g.id === id)?.name || "?").split(" ")[0];

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
                  <button
                    type="button"
                    onClick={() => onEditPost?.(post)}
                    aria-label={`עריכת העמדה ${post.post}`}
                    className="group w-full flex items-center gap-2 px-3 py-2 text-right cursor-pointer
                      hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tone.dot}`} aria-hidden="true" />
                    <Icon name={folderIcon(post.category)} size={15} className="text-muted flex-shrink-0" />
                    <span className="font-extrabold text-content text-[14px]">{post.post}</span>
                    <span className="text-[12px] text-faint font-semibold truncate">· {postMeta(post)}</span>
                    <Icon
                      name="pencil"
                      size={13}
                      className="text-faint group-hover:text-brand mr-auto flex-shrink-0 transition-colors"
                    />
                  </button>
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
                          onEditShift={onEditShift}
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

function Cell({ cell, block, post, tone, firstName, onEditShift }) {
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
      {cell.shifts.map((shift) => {
        const names = (shift.assignedGuards || []).map(firstName);
        const need = shift.requiredGuards || 1;
        const timesDiffer = shift.startTime !== block.startTime || shift.endTime !== block.endTime;
        const countDiffers = need !== block.requiredGuards;
        const partial = names.length > 0 && names.length < need;
        const label = `${post.post} ${block.part}, ${block.afterMidnight ? `ליל ${dayLong(cell.date)}` : `יום ${dayLong(cell.date)}`}: ${
          names.length ? names.join(", ") : "עוד לא שובץ"
        } — לחצו לעריכת היום הזה`;
        return (
          <button
            key={shift.id}
            type="button"
            onClick={() => onEditShift?.(shift)}
            aria-label={label}
            title={label}
            className={`block w-full min-h-[2rem] text-right rounded-md border-r-[3px] px-1.5 py-1 cursor-pointer
              ${tone.bg} ${tone.border}
              hover:ring-1 hover:ring-inset hover:ring-brand/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 transition-shadow`}
          >
            {(timesDiffer || countDiffers || partial) && (
              <span className="flex items-center justify-between gap-1">
                {timesDiffer ? (
                  <span className="text-[10px] font-extrabold text-warn" dir="ltr" data-numeric>
                    {shift.startTime}–{shift.endTime}
                  </span>
                ) : (
                  <span />
                )}
                {(countDiffers || partial) && (
                  <span
                    className={`text-[10px] font-black px-1 rounded bg-bg ${partial ? "text-warn" : "text-content"}`}
                    data-numeric
                  >
                    {partial ? `${names.length}/${need}` : `×${need}`}
                  </span>
                )}
              </span>
            )}
            {names.length > 0 && (
              <span className="block text-[11px] font-semibold text-content leading-tight truncate">{names.join(", ")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
