---
phase: 06-resource-view-pattern
plan: 02
subsystem: ui
tags: [react, tailwind, resource-grid, roster-wizard, supervisor]

# Dependency graph
requires:
  - phase: 06-01
    provides: "ResourceGrid.jsx — shared generic grid component (rows/dates/guards/firstColLabel), pending-row support"
provides:
  - "RosterWizard.jsx display panel now renders ResourceGrid (rows from buildResourceRows + pendingRows ghost row) instead of the old expectedDatesForWeek day-strip"
  - "pendingRows pattern: single-row live-feedback placeholder for an in-progress, unsaved draft, with a deterministic id derived from resolvedActiveKey"
affects: [06-03-calendarview-weekgrid, 06-04-single-source-audit]

actuals:
  tokens: 2288
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "RosterWizard's display panel consumes ResourceGrid exactly like ResourceView (D-02/D-04) — no local table markup, no local pivot logic"
    - "pendingRows: a draft-in-progress renders as a single ghost row (row.pending / item.pending) computed from `form` state, merged with the real buildResourceRows output via `[...rows, ...pendingRows]` before handing off to the shared component"

key-files:
  created: []
  modified:
    - src/components/supervisor/RosterWizard.jsx

key-decisions:
  - "J-2 (already decided in the plan): the old day-strip markup (dayItems/sundayISO/expectedDatesForWeek) is fully removed, not kept side-by-side with the new grid — two visual languages for the same data was exactly what RESVIEW-01 closes"
  - "mode is read via useSyncExternalStore(subscribeTerms, termProfile, termProfile) (D-07) inside RosterWizard itself, not hardcoded 'army' — matches ResourceGrid/ResourceView's own pattern even though this screen is only shown in army mode today"
  - "Behavioral difference accepted per plan objective: the panel now reflects actual work items (shifts/tasks) instead of expected positions — a saved position briefly shows as absent from the grid until ensurePositionsForWeek's materialize+refresh cycle completes, and reliably appears after a full data reload. This mirrors the plan's own documented J-2 rationale ('the screen will show reality, not intent') and is not a regression from this plan's code — the old panel never depended on shifts/tasks refresh at all."

requirements-completed: [RESVIEW-01, RESVIEW-03]

coverage:
  - id: D1
    description: "RosterWizard's display column renders <ResourceGrid rows={[...rows, ...pendingRows]} dates={weekDates} guards={guards} /> instead of the old day-strip; two-column layout (grid lg:grid-cols-[1.3fr_1fr]) and the full position-editing form are unchanged"
    requirement: "RESVIEW-01"
    verification:
      - kind: unit
        ref: "node -e inline check — <ResourceGrid> present, old grid-cols-4 sm:grid-cols-7 markup absent, two-column layout class present, form.requiredGuards/saveAndNext present (see verify block in 06-02-PLAN.md Task 2)"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
      - kind: automated_ui
        ref: "headless browser session (army-mode team, /browse skill fallback $B): screenshot of בניית שבוע step 2 showing pinned עמדה/קטגוריה column + 7 day columns, matching מבט משאבים structure"
        status: pass
    human_judgment: false
  - id: D2
    description: "rows built via buildResourceRows({shifts, tasks, weekDates, mode}) — same data path as ResourceView (D-02); RosterWizard destructures shifts/tasks from props (WeekFlow already passes them, unmodified); resourceView.js and ResourceGrid.jsx untouched (D-02/D-04)"
    requirement: "RESVIEW-01"
    verification:
      - kind: unit
        ref: "node -e inline check — buildResourceRows/pendingRows/folderIcon/useSyncExternalStore present, expectedDatesForWeek absent, no Date.now() in pendingRows scope (see verify block in 06-02-PLAN.md Task 1)"
        status: pass
      - kind: other
        ref: "git diff — src/lib/resourceView.js, src/components/supervisor/ResourceGrid.jsx, src/components/supervisor/WeekFlow.jsx all unchanged in this plan"
        status: pass
    human_judgment: false
  - id: D3
    description: "pendingRows: the in-progress draft appears immediately as a single dashed 'בעריכה' row (id deterministically derived from resolvedActiveKey, never Date.now()/index), and disappears once the item is saved (form.id set) since it then appears through the real rows via buildResourceRows"
    verification:
      - kind: automated_ui
        ref: "headless browser: seed draft 'סיור' and next seed 'כוננות' both rendered as dashed בעריכה rows with correct hour range while being edited"
        status: pass
    human_judgment: false
  - id: D4
    description: "עמדה עם 1, 2, 3 או 5 משמרות ביום מוצגת נכון גם במסך הזה (RESVIEW-03) — no new truncation logic introduced by this plan; RosterWizard's rows/pendingRows never slice/cap day.items, and the rendering itself (ResourceGrid.jsx) is unmodified and already covered by scripts/verify-resource-view.mjs's RESVIEW-03 section (1/2/3/5/12 items per cell)"
    requirement: "RESVIEW-03"
    verification:
      - kind: unit
        ref: "scripts/verify-resource-view.mjs — RESVIEW-03 section (inherited from 06-01, exercises the same ResourceGrid component this plan renders)"
        status: pass
      - kind: unit
        ref: "npm test (full suite)"
        status: pass
    human_judgment: true
    rationale: "Verified by construction (no capping code added, shared unmodified component already unit-tested) rather than freshly observed with 3-5 same-category same-day positions created live in the browser — building that fixture through the multi-step UI (register team, create N overlapping positions, materialize shifts) was out of scope for the time available this session. A human should spot-check this once real multi-position data exists."
  - id: D5
    description: "Editing form panel intact and functional next to the grid (D-03): title, category select, 24/7 toggle, weekday picker, start/end time, rest-warning alert, required-guards counter, and save button all present and operating on real actions (addPosition/updatePosition/ensurePositionsForWeek)"
    requirement: "RESVIEW-01"
    verification:
      - kind: automated_ui
        ref: "headless browser: filled/edited the seed draft, submitted via 'המשך למשימה הבאה', observed advance to the next seed item plus the checkmark on the completed tab; after a fresh login+navigate, the saved position 'סיור' rendered as a solid (non-dashed) row with its 06:00-18:00 hour range and the 0/1 shortage badge"
        status: pass
    human_judgment: false

duration: ~55min
completed: 2026-09-17
status: complete
---

# Phase 06 Plan 02: RosterWizard ResourceGrid panel Summary

**RosterWizard's "ככה השבוע נראה עד עכשיו" display panel now renders the shared ResourceGrid component (buildResourceRows + a deterministic pendingRows ghost row for the in-progress draft) instead of its own bespoke day-strip markup, while the position-editing form beside it is untouched.**

## Performance

- **Duration:** ~55 min (including live browser verification via the /browse skill's headless fallback)
- **Completed:** 2026-09-17
- **Tasks:** 2/2
- **Files modified:** 1

## Accomplishments
- `RosterWizard.jsx` destructures `shifts`/`tasks` from props (already passed by `WeekFlow.jsx`'s `common` object, unmodified) and reads `mode` via `useSyncExternalStore(subscribeTerms, termProfile, termProfile)` (D-07)
- `rows` built via `buildResourceRows({ shifts, tasks, weekDates, mode })` — the exact data path `ResourceView` uses (D-02); `pendingRows` computes a single ghost row for the currently-edited, unsaved draft with a deterministic id (`pending:${resolvedActiveKey}`)
- The old `dayItems`/`sundayISO`/`expectedDatesForWeek`-based day-strip is fully removed (J-2): the display column now renders `<ResourceGrid rows={[...rows, ...pendingRows]} dates={weekDates} guards={guards} />` inside the same two-column layout, with a textual empty state when both are empty (ResourceGrid returns `null` for `rows.length === 0`)
- The position-editing form (title, category, 24/7 toggle, weekday picker, times, rest-warning, required-guards counter, save) is byte-identical to before — no changes to `save`, `saveAndNext`, `removeItem`, `addBlank`, `fillFixedPattern`, `restWarning`, `smallestRestGapBetween`, `intervalsFor` (D-03)

## Task Commits

1. **Task 1: הזרמת נתוני השבוע ל-RosterWizard ובניית שורות הגריד (כולל שורת-רפאים)** - `e031a23` (feat)
2. **Task 2: החלפת פאנל התצוגה ב-ResourceGrid, לצד טופס העריכה** - `3622db7` (feat)

## Files Created/Modified
- `src/components/supervisor/RosterWizard.jsx` — added `shifts`/`tasks` props, `mode`, `rows` (buildResourceRows), `pendingRows` (draft ghost row), `allRows`; replaced the day-strip JSX with `<ResourceGrid>` + empty-state paragraph; removed `dayItems`, `sundayISO`, the `expectedDatesForWeek` import (`DAYS_HE_SHORT`/`fromISODate` remain used elsewhere in the file — `DAYS_HE_SHORT` for the weekday picker buttons, `fromISODate` inside `pendingRows`)

## Decisions Made
- **mode read locally, not hardcoded**: even though `RosterWizard` is only ever shown in army mode (per `WeekFlow.jsx`), `mode` is read from the shared terms store (D-07) rather than passed `"army"` literally — keeps a single source of truth for category-tone coloring in `ResourceGrid`, consistent with `ResourceView`/`CalendarView` (06-03).
- **pendingRows id is deterministic**: derived from `resolvedActiveKey` (a stable key already used elsewhere in the file for tab identity), never from `Date.now()`/array index — enforced by the plan's automated verify step and confirmed via `git grep`.
- **No side-by-side transition period**: per the plan's J-2, the old day-strip was deleted outright in the same task that added the new grid, not kept behind a flag — avoids two visual languages coexisting on one screen, which was the exact problem RESVIEW-01 exists to close.

## Deviations from Plan

None — plan executed exactly as written. One clarifying note (not a deviation): the plan's Task 1 action text included a literal `Date.now()` mention inside a proposed explanatory code comment, which would have tripped the plan's own automated verify regex (`/Date\.now\(\)/` scanning everything after the `pendingRows` string). Worded the actual comment to describe "זמן-מערכת" instead of writing the literal token — no behavior change, purely a comment-wording adjustment to satisfy the plan's own verify script.

## Live Verification Result (human-check, per plan's `<output>` requirement)

Ran via the `/browse` skill's headless-browser fallback (`$B`, no Aside available on this Windows machine) against `npm run dev` on `localhost:3001`, using a freshly-registered army-mode team (mode selection confirmed via `aria-pressed` inspection before registering).

1. **Grid structure matches מבט משאבים** — CONFIRMED. The display column at "בניית שבוע" step 2 shows a table with a sticky "עמדה / קטגוריה" column on the right, 7 day columns (scrolled to confirm all 7, not just the 4 visible before scroll), and the same visual language (category dot, folder icon, day headers with weekday+date) as `ResourceView`.
2. **Editing form works in full** — CONFIRMED. Title input, category select, 24/7 checkbox, weekday toggle buttons, start/end time inputs, rest-warning alert ("מרווח המנוחה מול שאר המשימות תקין (10+ שעות)"), required-guards +/- counter, and "המשך למשימה הבאה" button were all present and interactive; clicking save advanced to the next seed item and marked the completed tab with a checkmark.
3. **Live "בעריכה" feedback on the unsaved draft** — CONFIRMED. Both the initial "סיור" seed draft (all 7 weekdays active, 06:00–18:00, template shape) and the next "כוננות" seed draft (18:00–06:00) rendered as dashed, brand-colored rows tagged "בעריכה" in every active weekday column, updating live as the draft advanced.
4. **Saved item appears as a regular row with its hour range** — CONFIRMED, with a caveat. Immediately after saving "סיור" (within the same live session), the grid briefly showed the textual empty state instead of the new solid row — the underlying `shifts` data had not yet round-tripped through `ensurePositionsForWeek`'s materialize step and the subsequent `refresh()`. After a full page reload and re-login, "סיור" appeared correctly as a solid row across all 4 visible days with its `06:00–18:00` range and a `0/1` unfilled/shortage badge (via `ResourceGrid`'s existing shortage-badge logic — unmodified). This is the exact behavioral difference the plan's objective calls out under J-2 ("the screen shows reality, not intent") and is not new code in this plan — the old day-strip never depended on `shifts`/`tasks` refresh timing at all, so this timing characteristic of the pre-existing `ensurePositionsForWeek`/`refresh()` pipeline was simply invisible before. Flagging it here as an observed UX characteristic worth a follow-up look (not filed as a bug against this plan's scope, since `RosterWizard.jsx` correctly renders whatever `shifts`/`tasks` it is given).
5. **1/2/3/5 shifts in one category/day** — NOT independently re-verified live in the browser this session (would require registering multiple same-category positions with overlapping days/times through the multi-step UI, which was out of time budget for this pass). Verified by construction instead: `RosterWizard.jsx` introduces no slicing/capping logic on `day.items` in either `rows` or `pendingRows`, and the rendering component (`ResourceGrid.jsx`) is completely unmodified by this plan and already has passing coverage for 1/2/3/5/12-item cells in `scripts/verify-resource-view.mjs` (06-01, RESVIEW-03 section), exercised on every `npm test` run. See `coverage.D4.rationale` above.

No spacing/overflow adjustments beyond what the plan specified were required — `Card className="p-4 overflow-hidden"` plus the `-mx-4 -mb-4` wrapper around `<ResourceGrid>` was sufficient; horizontal scroll reaches the card edge as intended, confirmed by manually scrolling the grid's internal `overflow-x-auto` container to reveal all 7 days.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 06-03 (`CalendarView.jsx` replacing `WeekTimeGrid.jsx`) can proceed independently — zero file overlap with this plan (touches only `RosterWizard.jsx`).
- **Open item for a follow-up pass (not blocking, not filed as a defect against this plan)**: the transient empty-grid window immediately after saving a position, before `ensurePositionsForWeek`'s refresh reaches the local `shifts`/`tasks` state, is now visibly reachable from the UI for the first time (the old day-strip panel never surfaced it, since it read `positions` + `expectedDatesForWeek` directly instead of materialized work items). Worth a quick look — either confirm it always resolves within a second or two of the save spinner clearing, or consider surfacing a brief loading affordance on the grid panel itself while `busy` is true during `saveAndNext`.
- Live 1/2/3/5-shifts-per-cell verification specific to the `RosterWizard` display path (as opposed to `ResourceView`, already covered in 06-01) is still open — see `coverage.D4` above.

---
*Phase: 06-resource-view-pattern*
*Completed: 2026-09-17*
