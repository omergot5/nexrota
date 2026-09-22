---
phase: 07-colors-and-shift-order
reviewed: 2026-09-22T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/lib/dates.js
  - src/lib/shareImage.js
  - src/components/supervisor/views.jsx
  - src/components/ui.jsx
  - scripts/verify-share-image.mjs
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-09-22
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the black position-label unification, `byStartTime` comparator, double-resolution
canvas export with the 16384px safety fallback, and the `categoryColor`/`positionColorKey`
dead-code audit. `npm test` (including the new `scripts/verify-share-image.mjs`) and
`npm run build` both pass cleanly against the current tree.

Targeted checks requested by the reviewer all came back clean:

- **`#0A0A0A` byte-for-byte match** — confirmed identical (`grep` on both files, plus the
  regression test's own source-comparison check) between `src/lib/shareImage.js:57` and
  `src/components/supervisor/views.jsx:1358`.
- **`guardColor()` untouched in both files** — same `GUARD_COLORS` array, same hash loop,
  in both `src/components/ui.jsx:28-38` and `src/lib/shareImage.js:66-76`. Byte-for-byte
  identical algorithm.
- **Canvas ×2 scale on zero/empty-week input** — traced the math by hand: `dates: []`
  produces `total = 0`, `H = 258` (`HEAD 150 + FOOT 60 + PAD 48`); a date with zero shifts on
  it produces `H = 398`. Both are comfortably positive and well under `MAX_CANVAS_PX`, so
  `scale` resolves to `2` and no NaN/zero-dimension canvas is produced. No crash, no
  degenerate case. `renderWeekCanvas`'s only real caller (`ShareWeekBtn` in `views.jsx:1383`)
  is additionally gated behind `weekShifts.length > 0`, so this path isn't reachable from the
  UI today anyway.
- **`byStartTime` import/usage and empty-string handling** — imported and used correctly in
  both `src/lib/shareImage.js:159` (`layout()`) and `src/components/supervisor/views.jsx:1403`
  (`ScheduleMgmt`). The `a?.startTime || "￿"` sentinel (U+FFFF) reliably sorts after any
  `"HH:MM"` string under default `localeCompare` (verified empirically), and the function
  never throws on `null`/`undefined`/`""` `startTime`. This exactly mirrors the existing
  pattern in `src/lib/resourceView.js:91-93`, so it's a consistent, not novel, convention.
- **Dead code from the `categoryColor`/`positionColorKey` removal** — `shareImage.js` has
  zero remnants (`CATEGORY_COLORS`, `categoryColor`, `positionColorKey`, `catColor` are all
  gone; `grep` confirms no leftover references). `views.jsx`'s import list was correctly
  trimmed. The two functions are still exported from `ui.jsx` — deliberately, per
  `07-CONTEXT.md`'s deferred-deletion decision — and are covered by a permanent consumer
  audit in `verify-share-image.mjs` (D-07) that currently reports `ui.jsx` as the only file
  mentioning them. This is a documented, tested exception, not an oversight.

One inconsistency and one process gap surfaced during the deeper pass; see Warnings below.

## Warnings

### WR-01: `byStartTime`'s "single source of truth" claim is contradicted by a pre-existing duplicate in the same file

**File:** `src/lib/dates.js:158-177` (new `byStartTime`) vs. `src/lib/dates.js:406-410` (pre-existing, untouched by this phase)

**Issue:** The new doc comment on `byStartTime` states it is "the only source of 'chronological'
[order] anywhere shifts are displayed in order" (`המקור היחיד ל"כרונולוגי" בכל מקום שמציג
משמרות בסדר`), and that `ScheduleMgmt` and `shareImage.js` both route through it so two
independent "chronological" definitions can never drift apart silently. That claim is true for
those two call sites, but it is not true for the file it's written in: `boardItemsForDates`
(same file, a few dozen lines below, feeding `UnifiedBoard.jsx`, `CalendarView.jsx`,
`GuardApp.jsx`, `WeekFlow.jsx`, and `resourceView.js`) has its own inline sort comparator:

```js
const timed = timedPool
  .filter((item) => item.date === date)
  .sort(
    (a, b) =>
      String(a.startTime || "").localeCompare(String(b.startTime || "")) ||
      String(a.id).localeCompare(String(b.id))
  );
```

This comparator pushes items with empty/missing `startTime` to the **front** of the sort
(`"".localeCompare("06:00") === -1`), whereas `byStartTime` pushes them to the **back**
(confirmed by both tests in `verify-share-image.mjs`). In practice this is currently
harmless — every item in `timedPool` comes through `withEngineTasks`, which only emits items
that already passed `isTaskEngineEligible` (both `startTime` and `endTime` present), so the
`|| ""` branch is dead today. But the inconsistency is real, undocumented, and exactly the
kind of "two definitions of the same word that can silently diverge" this phase's own
rationale (and the project's stated milestone goal — "שהמוצר יסכים עם עצמו") calls out as the
problem to close. If a future change ever lets a timeless item into `timedPool` (or the
`isTaskEngineEligible` gate loosens), the unified board would order it oppositely to
`ScheduleMgmt`/the share image, with no test catching the divergence.

**Fix:** Either update `boardItemsForDates`'s inline sort to call `byStartTime` directly, or
narrow the doc comment on `byStartTime` to state it isn't (yet) used by the board merge path.
Preferred:

```js
const timed = timedPool.filter((item) => item.date === date).sort(byStartTime);
```

### WR-02: Live/perceptual verification of the share-image fix was never performed

**File:** `.planning/phases/07-colors-and-shift-order/07-02-SUMMARY.md:159-165` (self-reported)

**Issue:** The plan's `human-check` step for Task 1 (download the PNG from a real browser,
confirm it's actually 2160px wide and visually sharp, confirm the footer signature isn't cut
off, and — critically — open it inside an actual WhatsApp chat preview on a phone) was never
run. The summary is transparent about this (sandbox couldn't launch a browser) and logs it as
an open item in `.planning/WINDOWS.md`, but per this project's own iron rule #6
("אימות בדפדפן — 'עובד' נאמר רק אחרי שראית את זה עובד"), the perceptual claim this whole phase
exists to fix ("text on the shared image looks blurry on a phone") has only been verified by
proxy (pixel dimensions, draw-order assertions) and not by the human eye it's meant for.

**Fix:** Before shipping, run the manual verification listed in `07-02-SUMMARY.md`'s "User
Setup Required" section — in particular, sending the downloaded image to WhatsApp and viewing
it at chat-preview size on a phone.

## Info

### IN-01: `MAX_CANVAS_PX` fallback only covers the height axis and the realistic worst case, not the theoretical one

**File:** `src/lib/shareImage.js:184-191`

**Issue:** `scale` falls back from `2` to `1` when `H * EXPORT_SCALE > MAX_CANVAS_PX`, but if
the *unscaled* logical height `H` itself ever exceeds `16384` (a pathologically large team/week
— roughly 150+ shift-rows in a single render), `canvas.height` would still exceed the browser
ceiling even at `scale = 1`, silently producing a blank canvas with no error. The documented
worst case considered during planning (7 days × 14 shifts/day) measures at `H ≈ 9568`, comfortably
under `16384` even unscaled, so this is not a live bug against any realistic team size — just an
unhandled tail case worth a one-line comment (or a second guard) if team/shift limits ever grow.

**Fix:** Optional; if desired, clamp `H` itself or throw a descriptive error instead of silently
returning a canvas that will render blank when `H > MAX_CANVAS_PX`.

### IN-02: `readableInk(POSITION_LABEL_BG)` is recomputed on every row/render instead of hoisted as a constant

**File:** `src/lib/shareImage.js:261`, `src/components/supervisor/views.jsx:1443`

**Issue:** Since `POSITION_LABEL_BG` is a fixed literal, `readableInk(POSITION_LABEL_BG)`
always returns the same value (`#FFFFFF`, per the regression test). It's recomputed per shift
row in `shareImage.js` and per shift card render in `views.jsx` rather than hoisted to a
module-level constant alongside `POSITION_LABEL_BG`. Performance is out of review scope and the
cost here is trivial, but it's a minor missed opportunity for clarity (`POSITION_LABEL_INK`
would also self-document the WCAG guarantee the tests already assert).

**Fix (optional):**
```js
const POSITION_LABEL_BG = "#0A0A0A";
const POSITION_LABEL_INK = readableInk(POSITION_LABEL_BG); // "#FFFFFF" — asserted by verify-share-image.mjs
```

---

_Reviewed: 2026-09-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
