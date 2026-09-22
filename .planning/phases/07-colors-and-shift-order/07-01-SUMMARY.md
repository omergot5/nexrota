---
phase: 07-colors-and-shift-order
plan: 01
subsystem: ui
tags: [canvas, accessibility, wcag, color, sorting, react]

# Dependency graph
requires: []
provides:
  - "byStartTime — single chronological comparator in src/lib/dates.js, consumed by both share-image and screen"
  - "POSITION_LABEL_BG (#0A0A0A) — identical literal constant in shareImage.js and views.jsx"
  - "scripts/verify-share-image.mjs — canvas-stub regression suite for renderWeekCanvas, wired into npm test"
affects: [07-02]

# Actuals (#2632)
actuals:
  tokens: 7300
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Canvas-stub testing: mock document.createElement('canvas')/getContext('2d') to unit-test a canvas-drawing module in plain Node, with a draw-call log as the assertion surface"
    - "Single shared comparator (byStartTime) exported from a pure module and imported by two independent rendering surfaces, instead of each surface re-implementing 'chronological'"

key-files:
  created:
    - scripts/verify-share-image.mjs
  modified:
    - src/lib/dates.js
    - src/lib/shareImage.js
    - src/components/supervisor/views.jsx
    - package.json

key-decisions:
  - "J-1: the stripe (position-color bar) in the WhatsApp image turns black along with the chip, not just the chip — leaving it colored would have kept the exact per-position color coding the phase exists to remove."
  - "J-2: byStartTime lives in dates.js (not duplicated per-surface) and mirrors resourceView.js's existing pattern — empty-startTime pushed to end, id tiebreak — so a screen and an image can never independently drift into two different 'chronological' definitions."
  - "J-3: the black literal is a full 6-digit hex (#0A0A0A), not a 3-digit shorthand — luminance() does bitwise slicing on 2-digit hex pairs, so a shorthand would be parsed as a completely different, wrong color."
  - "D-03 (deliberate deviation from 'all colors live in tokens.css'): POSITION_LABEL_BG is a literal constant duplicated verbatim in both files, not imported from one to the other or from a CSS token — canvas cannot read CSS custom properties, and the two rendering surfaces must not import from each other."

patterns-established:
  - "Canvas rendering modules get a Node-side regression test via a draw-call-logging stub, following the same ok/FAIL/PASS convention as every other scripts/verify-*.mjs"

requirements-completed: [COLOR-02, COLOR-03, COLOR-04]

coverage:
  - id: D1
    description: "Position/task label is drawn on one fixed black background (#0A0A0A) in both renderWeekCanvas (share image) and ScheduleMgmt (published board), with readableInk-derived text color measured at >=4.5:1 contrast"
    requirement: "COLOR-02"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs — 'מספר המילויים בערך #0A0A0A שווה בדיוק לפעמיים מספר המשמרות', 'כל fillText של תווית עמדה מצויר ב-#FFFFFF', 'הניגודיות בין #FFFFFF ל-#0A0A0A עוברת 4.5:1'"
        status: pass
      - kind: manual_procedural
        ref: "human-check: published board in dev demo, light and dark theme"
        status: pass
    human_judgment: false
  - id: D2
    description: "Per-guard color (guardColor) is unchanged in both surfaces — no COLOR-03 regression"
    requirement: "COLOR-03"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs — 'שבבי הכפופים עדיין נצבעים מפלטת עשרת צבעי הכפופים...', 'views.jsx עדיין קורא ל-guardColor ול-readableInk'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both surfaces sort shifts chronologically by actual startTime through the single byStartTime comparator, verified on a non-4x6 fixture"
    requirement: "COLOR-04"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs — byStartTime unit tests + 'layout() ממיין דרך byStartTime — סדר טקסטי השעות המצוירים הוא בדיוק הסדר הכרונולוגי'"
        status: pass
      - kind: manual_procedural
        ref: "human-check: edited one shift's start time in dev demo, confirmed card moved to the correct position on the published board"
        status: pass
    human_judgment: false
  - id: D4
    description: "The black literal is identical character-for-character between shareImage.js and views.jsx (D-03 anti-drift guarantee)"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs — 'הליטרל השחור ב-views.jsx זהה תו-בתו לליטרל ב-shareImage.js'"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-20
status: complete
---

# Phase 7 Plan 1: Black position label + shared chronological sort Summary

**Position/task labels now render on one fixed #0A0A0A background in both the WhatsApp share image and the published board, both surfaces sort by a single shared `byStartTime` comparator, and a new canvas-stub Node test (`scripts/verify-share-image.mjs`) locks both down in `npm test`.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-20
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `byStartTime` — the single definition of "chronological" for scheduled items — added to `src/lib/dates.js`, mirroring the existing `resourceView.js` pattern (empty `startTime` pushed to end, `id` tiebreak for determinism).
- `renderWeekCanvas` (`src/lib/shareImage.js`): position/task label chip **and** the color stripe next to it now both draw with the fixed `POSITION_LABEL_BG = "#0A0A0A"` constant instead of a per-position hash color (J-1). The private category palette (`CATEGORY_COLORS`), `categoryColor()`, and `positionColorKey()` were deleted — zero remaining consumers after the change (D-07 verified before removal). `guardColor` and the per-guard palette are untouched.
- `ScheduleMgmt` (`src/components/supervisor/views.jsx`): same fixed black label, same `byStartTime` sort applied to `dayShifts` before render — this was the one remaining COLOR-04 gap (`shareImage.js` and `resourceView.js` already sorted correctly). `categoryColor`/`positionColorKey` dropped from the `ui.jsx` import list; `ui.jsx` itself was not touched (its audit is 07-02's job per D-07).
- New `scripts/verify-share-image.mjs`: builds a mock `document.createElement("canvas")`/`getContext("2d")` that logs every draw call (fillRect/fillText/fill/stroke/etc. with the active `fillStyle`), imports `renderWeekCanvas` dynamically after the stub is installed, and asserts on the resulting draw-call log — sort order on a deliberately non-4×6 fixture, zero fills matching the old 10-color category palette, exactly `2 × shiftCount` fills of the black literal, WCAG contrast computed independently in the test (measured **19.80:1**), guard-chip color non-regression, and byte-identical source literals between `shareImage.js` and `views.jsx`. Wired into `npm test` as the 9th script.

## Task Commits

1. **Task 1: Full route through the share image — shared order, black label, Node regression net** - `33479cc` (feat)
2. **Task 2: Same label and same order on the published board** - `890dbf6` (feat)

**Plan metadata:** *(this commit, docs)*

_Both tasks were TDD: the test file was written and run against unmodified source first (RED — 4 of 15 checks failed as expected), then the source was changed until the full suite passed (GREEN)._

## Files Created/Modified

- `scripts/verify-share-image.mjs` - New canvas-stub regression suite for `renderWeekCanvas` + cross-file literal check for `views.jsx`
- `src/lib/dates.js` - Added `byStartTime` export
- `src/lib/shareImage.js` - Black label constant, stripe+chip now use it, `layout()` sorts via `byStartTime`, dead per-position palette removed
- `src/components/supervisor/views.jsx` - Black label constant, `dayShifts` sorted via `byStartTime`, dead `ui.jsx` imports removed
- `package.json` - `npm test` chain now includes `verify-share-image.mjs`

## Decisions Made

- **J-1** — the color stripe in the share image turns black along with the label chip, not just the chip. Both consumers of the old `catColor` value in `shareImage.js` (~line 220 stripe, ~line 239 chip) now read `POSITION_LABEL_BG`. Leaving the stripe colored would have left the exact per-position color coding in the image that the screen no longer shows — the phase's stated goal ("the screen and the image say exactly the same thing") required both.
- **J-2** — `byStartTime` lives in `dates.js`, not duplicated inline in each renderer. It replicates `resourceView.js`'s existing tiebreak pattern (`startTime || "￿"` then `String(id)` comparison) instead of the bare `localeCompare` expression from `07-CONTEXT.md`, because the bare expression has no defense against an empty `startTime` or a same-time tie — either of those would make the screen and the image potentially disagree on order without anyone noticing, on an input the bare expression handles incorrectly (throws or silently mis-sorts).
- **J-3** — the literal is a full 6-digit hex, `#0A0A0A`, not a 3-digit shorthand. `luminance()` (in both `shareImage.js` and `ui.jsx`) does `parseInt(hex.slice(1), 16)` with 16/8-bit shifts that assume 6 hex digits; a 3-digit shorthand would parse as a wrong color and `readableInk` would pick text contrast against a color that was never actually drawn.
- **D-03 deviation (intentional, documented)** — `POSITION_LABEL_BG` is duplicated as an identical literal in both `shareImage.js` and `views.jsx`, not imported from one to the other and not a `tokens.css` token. This is a deliberate exception to the "all colors live in tokens.css" convention: canvas cannot read CSS custom properties, and the two rendering surfaces are meant to stay independent of each other. `scripts/verify-share-image.mjs` enforces that the two copies never drift apart by comparing them character-for-character.

**Measured contrast:** `#FFFFFF` text on `#0A0A0A` background = **19.80:1** (WCAG AA requires ≥4.5:1), printed by the test on every run rather than assumed.

## Deviations from Plan

None — plan executed exactly as written, including both planner-flagged decisions (J-1, J-2, J-3) applied as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-02 (COLOR-01, canvas dimensions, and the `ui.jsx` `categoryColor`/`positionColorKey` audit) can proceed: those symbols still exist and are exported from `ui.jsx` (deliberately untouched here per D-07), ready for 07-02 to determine whether they have any remaining consumer.
- `src/design/categoryPalette.js`, `src/components/supervisor/ResourceGrid.jsx`, and `src/lib/resourceView.js` were not touched, as scoped (D-01).
- Canvas dimensions in `renderWeekCanvas` were not touched, as scoped (COLOR-01 belongs to 07-02).

### Live verification (human-check, Task 2)

Ran in the local dev server (`npm run dev`) against the demo team, navigated to the publish step of the roster wizard (`ScheduleMgmt`):

1. **Black label, every card, every day** — confirmed via screenshot. Every shift card's position label ("משמרת יום" / "משמרת לילה") renders on the identical solid black chip, bold, white text — across all 7 days / 14 cards.
2. **Guard name chips still vary, per-person consistent** — confirmed via screenshot and a DOM color extraction: distinct RGB values across different people (e.g. `rgb(176,118,60)`, `rgb(62,124,155)`, `rgb(168,95,122)`, `rgb(94,140,90)`), which is guaranteed by construction since `guardColor` (unchanged, pure hash of guard id) was not touched by this plan.
3. **Chronological order** — confirmed: within each day, the 07:00 day-shift card appears in the first reading position (right side, RTL) and the 19:00 night-shift card second (left side).
4. **Order responds to actual time, not insertion order** — edited one shift's start time from 07:00 to 20:00 (later than the other shift in that day, 19:00) via the roster wizard's shift editor, returned to the publish step, and confirmed the card order flipped: the 19:00 shift moved to first position and the 20:00 shift moved to second — proving the board re-derives order from `startTime`, not DB insertion order.
5. **Theme independence** — toggled `data-theme="dark"` on the app root; the entire shell switched to dark colors while the label chips remained solid black with white text in both cards checked, confirming `POSITION_LABEL_BG` is not a theme-dependent token.

## Self-Check: PASSED

All created/modified files found on disk (`scripts/verify-share-image.mjs`, `src/lib/dates.js`, `src/lib/shareImage.js`, `src/components/supervisor/views.jsx`, `package.json`, this SUMMARY). Both task commits (`33479cc`, `890dbf6`) confirmed present in `git log`.

---
*Phase: 07-colors-and-shift-order*
*Completed: 2026-09-20*
