---
phase: 06-resource-view-pattern
reviewed: 2026-09-17T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/components/supervisor/ResourceGrid.jsx
  - src/components/supervisor/ResourceView.jsx
  - src/components/supervisor/RosterWizard.jsx
  - src/components/supervisor/CalendarView.jsx
  - src/components/supervisor/UnifiedBoard.jsx
  - src/design/categoryPalette.js
  - scripts/verify-resource-view.mjs
  - docs/architecture/system-overview.md
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-09-17
**Depth:** standard
**Files Reviewed:** 8 (WeekTimeGrid.jsx / WeekTimeGrid.css reviewed as deletions, not as changed files)
**Status:** issues_found

## Summary

The extraction of `ResourceGrid.jsx` as a shared "category × day" presentational component is clean and faithful to the pre-existing markup (`ResourceView.jsx`'s old inline table was moved almost verbatim). The D-02 constraint — "`ResourceGrid` must not import `lib/resourceView.js`" — genuinely holds: `ResourceGrid.jsx` has zero references to `resourceView.js` or `buildResourceRows`; all three callers (`ResourceView.jsx`, `RosterWizard.jsx`, `CalendarView.jsx`) compute `rows`/`weekRows` themselves and pass them in as a prop. `npm test` and `npm run build` both pass.

However, the new `RosterWizard.jsx` integration (06-02) introduces a real React key-collision bug that breaks the "live preview" feature this sub-phase exists to deliver, under a very common (in fact, default) usage path. There is also incomplete cleanup after the `WeekTimeGrid.jsx`/react-big-calendar removal (06-03): a now-fully-dead pure module plus two now-fully-dead npm dependencies were left in place, and a genuine UX signal (`continuesBefore` marking for midnight-crossing shifts) that the deleted component rendered explicitly is silently dropped in the new `CalendarView` week view. Docs also introduce a wording ambiguity that risks eroding the exact architectural boundary (D-02) this phase worked hard to establish.

## Critical Issues

### CR-01: Duplicate row keys in RosterWizard when the in-progress draft shares a category with an already-materialized row

**File:** `src/components/supervisor/RosterWizard.jsx:325-357` (constructs `pendingRows`/`allRows`), consumed by `src/components/supervisor/ResourceGrid.jsx:65` (`<tr key={row.category}>`)

**Issue:**
`RosterWizard` builds `allRows = [...rows, ...pendingRows]` (line 357) and hands the merged array straight to `ResourceGrid`, which keys each `<tr>` by `row.category` alone (`ResourceGrid.jsx:65`). `rows` comes from `buildResourceRows` (real, already-saved work items for the week) and `pendingRows` is a single synthetic "ghost" row for whatever draft is currently open in the form (`RosterWizard.jsx:330-334`), using `category: form.category || "משימה חדשה"`.

Nothing prevents `form.category` from being the same string as a category that already has a real row in `rows`. This is not an edge case — it is the *default* path:

- `addBlank()` (line 287-294) always seeds new drafts with `category: categories[0] || ""`, i.e. `foldersFor("army")[0].name === "תורנות שמירה"`.
- The wizard's own seed list (`SEED_POSITIONS`, line 32-37) includes `"עמדת שמירה 1"` with `category: "תורנות שמירה"` — once that position is saved (the very first thing a new team is nudged to do) and `ensurePositionsForWeek` materializes its shifts, `rows` already contains a `"תורנות שמירה"` row.
- Clicking "הוסף משימה" to add a *second* post in that same category (a completely ordinary action — "עמדת שמירה 2") produces `pendingRows[0].category === "תורנות שמירה"`, identical to the existing row's category.

`allRows` then contains two objects with `category === "תורנות שמירה"`, and `ResourceGrid` renders two `<tr>` elements with the same React key. This is exactly the "React correctness / keys" class of bug this review was asked to check for: React's reconciler builds its old-children lookup by key, so a duplicate key causes the second element to fail to match its own previous fiber (a fresh DOM node is mounted, the console logs "Encountered two children with the same key"), and on every subsequent re-render (every keystroke in the draft's title/time fields re-creates `pendingRows` via the `useMemo` at line 325) the two `<tr>`s can have their fibers/DOM nodes swapped between the real, already-saved row and the dashed "בעריכה" ghost row. The one feature this whole panel exists to provide — "מה שאני מקליד עכשיו מופיע בגריד" (comment at `RosterWizard.jsx:161-163`, restated at `421-423`) — breaks precisely when editing a second item in a category that already has data, which will be routine usage once a team has more than one post per category.

**Fix:** Give `ResourceGrid` a way to disambiguate rows independent of the display category, and stop conflating "ghost row identity" with "category string". For example, let each row carry an explicit `key` and have `ResourceGrid` prefer it:

```jsx
// ResourceGrid.jsx
{rows.map((row) => {
  const tone = TONE_CLASSES[categoryTone(row.category, mode)];
  return (
    <tr key={row.key ?? row.category} className="border-t border-hairline">
```

```jsx
// RosterWizard.jsx — pendingRows
return [
  {
    key: `pending:${resolvedActiveKey}`,
    category: form.category || "משימה חדשה",
    icon: folderIcon(form.category),
    pending: true,
    ...
```

Alternatively (and arguably more correct product behavior), merge the pending draft's days into the *existing* row for that category instead of appending a second row with the same label — so a commander editing "עמדת שמירה 2" sees the dashed ghost item land inside the same "תורנות שמירה" row as "עמדת שמירה 1", not a confusing second row with an identical header.

## Warnings

### WR-01: Dead module and dead npm dependencies left behind after the WeekTimeGrid removal

**File:** `src/lib/calendarEvents.js` (whole file), `package.json:16,18`

**Issue:** `WeekTimeGrid.jsx` — deleted in this phase — was the only production consumer of `src/lib/calendarEvents.js` (`toCalendarEvents`) and, transitively, of the `react-big-calendar` and `dayjs` npm packages. After the deletion:

```
$ grep -rln "toCalendarEvents\|calendarEvents.js" src/ scripts/
src/lib/calendarEvents.js
src/lib/resourceView.js        # only in a comment, no import
scripts/verify-calendar-events.mjs

$ grep -rln "react-big-calendar\|dayjs" src/
(no matches)
```

`calendarEvents.js` is now a fully dead pure module with no production caller — only `scripts/verify-calendar-events.mjs` still imports it, and that script remains wired into `npm test` (`package.json:11`), so the suite spends cycles verifying logic nothing in the app exercises anymore. `react-big-calendar` (^1.20.0) and `dayjs` (^1.11.23) remain declared dependencies in `package.json` with zero remaining imports anywhere in `src/`.

**Fix:** As part of the same cleanup that removed `WeekTimeGrid.jsx`/`.css`, remove `src/lib/calendarEvents.js` and `scripts/verify-calendar-events.mjs` (drop it from the `test` script in `package.json`), and run `npm uninstall react-big-calendar dayjs`. If `calendarEvents.js` is being kept intentionally for a near-future reuse, say so in a header comment — as written it reads as an oversight, not a decision.

### WR-02: `continuesBefore` (midnight-crossing shift) marker is silently dropped in the CalendarView week view

**File:** `src/components/supervisor/ResourceGrid.jsx:141-152`, compare `src/components/supervisor/WeekTimeGrid.jsx:98-100` (deleted, via `git show 066b0d4`)

**Issue:** `buildResourceRows` marks the "second half" of a midnight-crossing shift with `continuesBefore: true` and rewrites its `startTime` to `"00:00"` (`src/lib/resourceView.js:73`) precisely so a caller can render it distinctly from a real shift that starts at midnight. The deleted `WeekTimeGrid.jsx` did exactly that — `EventContent` rendered `event.resource.continuesBefore ? "⋯" : hh:mm` and `eventPropGetter` squared off the connecting border corner (`WeekTimeGrid.jsx:78-100`).

`ResourceGrid.jsx` never reads `item.continuesBefore` (confirmed: `grep -n "continuesBefore" ResourceGrid.jsx` → no matches). It always renders the raw `item.startTime`–`item.endTime` pair (lines 141-146), so a night shift that runs 19:00→07:00 now shows as an ordinary "00:00–07:00" block on the following day's column in the calendar's week view — visually indistinguishable from a genuine shift that starts at midnight. A commander scanning the week grid for "who starts at 00:00" can no longer tell a real midnight start from the tail end of last night's shift, which is exactly the ambiguity `continuesBefore` was introduced to prevent (and which the old `WeekTimeGrid` implementation explicitly solved).

Note: `ResourceView.jsx`'s pre-phase-6 table already had this same gap (it never consumed `continuesBefore` either), so this is not a *new* gap for that screen — but it is a genuine regression specifically for `CalendarView`'s week mode, which previously handled this correctly via `WeekTimeGrid`.

**Fix:** Surface `continuesBefore` in `ResourceGrid`'s item rendering, e.g.:

```jsx
{item.startTime && (
  <div className="text-[10px] font-bold text-muted leading-tight" data-numeric>
    {item.continuesBefore ? "⋯" : item.startTime}–{item.endTime}
  </div>
)}
```

### WR-03: Doc wording implies `ResourceGrid.jsx` depends on `resourceView.js`, contradicting the D-02 boundary the code enforces

**File:** `docs/architecture/system-overview.md` (new "🧩 דפוס תצוגה משותף" section, added in this diff)

**Issue:** The new section reads: "הדפוס ... חי ב-`ResourceGrid.jsx` **בלבד**, **ונזון** מהמנוע הטהור `resourceView.js`" ("...lives in `ResourceGrid.jsx` only, and is fed by the pure engine `resourceView.js`"). Taken at face value, this says `ResourceGrid.jsx` is fed by `resourceView.js` — i.e., implies a direct dependency between the two files. That is precisely the coupling `ResourceGrid.jsx`'s own header comment goes out of its way to rule out (`ResourceGrid.jsx:10-12`: "אין כאן buildResourceRows ואין ייבוא מהמנוע הטהור... הפיבוט קטגוריה×יום נשאר אצל הקורא" — "no `buildResourceRows` here, no import of the pure engine... the pivot stays with the caller"), and it is confirmed correct in code (no import of `resourceView.js` anywhere in `ResourceGrid.jsx`).

Docs are the first thing a future contributor reads before touching a shared component like this one. As worded, this section could lead someone to "fix" `ResourceGrid.jsx` by importing `buildResourceRows` directly (e.g., to add a fourth consumer without going through a caller), reintroducing the exact coupling D-02 forbids and that 06-04's "single-source audit" commits explicitly worked to prevent.

**Fix:** Attribute the `resourceView.js` dependency to the *callers*, not to `ResourceGrid.jsx` itself, e.g.:

```
הדפוס חי ב-ResourceGrid.jsx בלבד. הרכיב עצמו לא תלוי ב-resourceView.js —
כל קורא (ResourceView.jsx, RosterWizard.jsx, CalendarView.jsx) מריץ בעצמו
את buildResourceRows (המנוע הטהור ב-src/lib/resourceView.js) ומזין את
ResourceGrid ב-rows מוכן.
```

## Info

### IN-01: `ResourceGrid`'s `firstColLabel` prop is speculative generality — no current caller overrides it

**File:** `src/components/supervisor/ResourceGrid.jsx:25`

**Issue:** `firstColLabel = "עמדה / קטגוריה"` is a configurable prop, but none of the three current call sites (`ResourceView.jsx:68`, `RosterWizard.jsx:433`, `CalendarView.jsx:185`) ever pass it. This isn't a bug — just unexercised API surface added ahead of need. Not a blocker; flagging only so a future reviewer doesn't assume it's covered by any test or real usage.

**Fix:** No action required unless a fourth consumer with a different first-column label actually appears; otherwise consider dropping the parameter until it's needed.

---

_Reviewed: 2026-09-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
