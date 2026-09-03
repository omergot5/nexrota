---
phase: 05-unified-board
plan: 05
subsystem: ui
tags: [react, jsx, accessibility, icons, board-04, d-13]

# Dependency graph
requires:
  - phase: 05-unified-board
    provides: "UnifiedBoard.jsx, People (views.jsx), BOARD-01/03/04 baseline that this plan's UAT gap G-05-1 was found against"
provides:
  - "A distinct clock-off glyph reserved to the out-of-engine/timeless meaning; the padlock reserved exclusively to per-person qualification blocking"
  - "People's blocked branch rendering the disambiguating לא כשיר/ה label at the board's own 11px label size, outside the avatar circle"
  - "A self-consistent board empty state that names no action absent from the screen showing it"
  - "scripts/verify-board-signals.mjs — a deterministic npm-test gate for all three, proven to fail before the fix"
affects: [05-unified-board, gsd-audit-uat]

# Actuals (#2632)
actuals:
  tokens: 4853
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Source-level Node gate for JSX components that can't be imported directly (readFileSync + comment-stripped line-window assertions), sibling to the existing verify-board.mjs pattern"

key-files:
  created:
    - scripts/verify-board-signals.mjs
  modified:
    - src/components/icons.jsx
    - src/components/supervisor/UnifiedBoard.jsx
    - src/components/supervisor/views.jsx
    - src/components/supervisor/WeekFlow.jsx
    - package.json

key-decisions:
  - "New clock-off glyph is the plain clock geometry (circle + hands) with a shortened hand path and a corner-to-corner cancel diagonal across the circle's bounding box, matching the set's existing offline cancel-stroke convention — chosen over a fresh icon because it makes the timed/timeless glyph pair self-teaching without a legend (D-14 stays untouched)."
  - "People's blocked circle now shows the person's initials (like a normal avatar) instead of the לא כשיר/ה words crammed inside it; the words move to a single label rendered once per stack, at the board's own 11px size, outside every circle."
  - "Two deliberate UI-SPEC deviations, both justified by gap G-05-1 (see below): the out-of-engine badge's icon prop, and the manager empty-state body wording."

requirements-completed: [BOARD-03, BOARD-04]

coverage:
  - id: D1
    description: "The out-of-engine timeless badge (מחוץ למנוע) and the per-person qualification block never share a glyph — clock-off vs lock, in both UnifiedBoard.jsx and TaskRow (views.jsx)"
    requirement: BOARD-04
    verification:
      - kind: unit
        ref: "scripts/verify-board-signals.mjs (checks 1-3)"
        status: pass
    human_judgment: true
    rationale: "The gate only proves the source-text invariant (which icon name is wired where). Whether a 12px struck-through clock actually reads as distinct from a padlock at a glance, in both themes, is a visual judgment CLAUDE.md iron rule 6 reserves for a human who has seen it in a browser — not available in this isolated worktree."
  - id: D2
    description: "The qualification-block words (לא כשיר/ה) render at the board row's own 11px label size, outside the avatar circle, with no font size derived from the avatar's pixel size"
    requirement: BOARD-03
    verification:
      - kind: unit
        ref: "scripts/verify-board-signals.mjs (checks 4-5)"
        status: pass
    human_judgment: true
    rationale: "The gate proves the source no longer computes size * decimal and that blockedLabel sits near the 11px class token. Actual on-screen legibility at normal zoom is a visual judgment not available without a browser in this worktree."
  - id: D3
    description: "The board's empty state names no action absent from the screen showing it; the manager's step-0 empty state names the on-screen primary action instead"
    requirement: BOARD-04
    verification:
      - kind: unit
        ref: "scripts/verify-board-signals.mjs (check 6)"
        status: pass
    human_judgment: true
    rationale: "The gate proves the nav.smart term key is gone from UnifiedBoard.jsx. Whether the new WeekFlow.jsx copy reads naturally next to the actual button is a visual/copy judgment not available without a browser in this worktree."
  - id: D4
    description: "People called without isBlocked (TaskRow, TaskMgmt folder header, position lists) renders byte-identical to before"
    verification:
      - kind: unit
        ref: "npm test (verify-board.mjs, verify-scheduler.mjs, verify-planning.mjs, verify-positions.mjs all still pass unchanged)"
        status: pass
    human_judgment: true
    rationale: "No automated test directly diffs TaskRow's rendered DOM before/after. Confirmed by code review that the isBlocked-absent path is unreachable in the new anyBlocked/visible logic (anyBlocked stays false), but a pixel-level 'unchanged' claim needs a human's eyes."

duration: ~35min
completed: 2026-09-03
status: complete
---

# Phase 5 Plan 05: Board Signal Comprehension Gap Closure (G-05-1) Summary

**Split the board's overloaded padlock into a dedicated clock-off glyph for "no clock time," moved the qualification-block label out of a 6px-illegible avatar circle to a normal-sized row label, defanged the empty-state's dead-end CTA reference, and locked all three behind a new deterministic npm-test gate proven to fail before the fix.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 5 (+ 1 created)

## Accomplishments

- **New `clock-off` icon** (`src/components/icons.jsx`): plain-clock geometry with shortened hands, struck through by a cancel diagonal across the circle's own bounding box — legible at the 12px size `Badge` renders icons at.
- **Padlock now means exactly one thing app-wide.** The `מחוץ למנוע` out-of-engine badge in both `UnifiedBoard.jsx`'s `BoardRow` and `views.jsx`'s `TaskRow` now names `icon="clock-off"` instead of `icon="lock"`. Text, tone (`neutral`), and tooltip are byte-identical to before. Every remaining `icon="lock"`/`name="lock"` site in the codebase (`views.jsx` lines ~1148, ~1185, ~1590, ~2176, ~2194, ~2591) is a qualification-blocking statement — verified by grep after the change.
- **`People`'s blocked branch reworked** (`views.jsx`): the blocked circle no longer squeezes `לא כשיר/ה` into a font size computed as `size * 0.24` (≈6px at the board's `size={24}` call site). It now shows the person's initials, like a normal avatar in the same stack, with a fixed small type class instead of a size-derived one. The disambiguating `לא כשיר/ה` label moves outside every circle, rendered **once per stack** (not once per blocked person) at the board's own `text-[11px]` label size, following the `+N` overflow chip's placement convention. The corner padlock badge, the neutral (never danger) ring, `aria-disabled`, and the per-person `title` refusal sentence are all unchanged — QUAL-08's four channels are intact, just relocated.
- **`People` called without `isBlocked` is unchanged.** `anyBlocked` derives from `isBlocked ? visible.some(...) : false`, so the label block never renders and the avatar-stack path is identical to before for `TaskRow`, the `TaskMgmt` folder header, and the position lists.
- **Empty-state copy corrected** (`UnifiedBoard.jsx`): the default body no longer quotes the `nav.smart` step label — a reference to a button that isn't on screen wherever this default renders (יומן week view, GuardApp's team-schedule card). `WeekFlow.jsx`'s step-0 board mount now supplies its own `empty.body` naming the actual on-screen action, `"המשך לבניית השבוע"`.
- **New deterministic gate** (`scripts/verify-board-signals.mjs`): six source-level checks (comment-stripped, three fixed file reads only, no self-read, no globbing) asserting all of the above. Proven to fail on all six checks against the unmodified source before any fix was applied; wired into `npm test` only after the fixes landed, so no single commit in this plan ever left `npm test` red.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the board-signals gate and prove it fails on today's code** - `b7010df` (test)
2. **Task 2: Separate the two signals, make the block legible, and settle the empty state** - `00067fc` (fix)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `scripts/verify-board-signals.mjs` - New deterministic Node gate for the two board comprehension signals (six checks, Hebrew labels, `ok`/`FAIL` output, exit code)
- `src/components/icons.jsx` - New `clock-off` geometry key in the time & schedule section
- `src/components/supervisor/UnifiedBoard.jsx` - Out-of-engine badge now uses `clock-off`; default empty-state body no longer names `nav.smart`
- `src/components/supervisor/views.jsx` - `People`'s blocked branch reworked (initials in circle, label outside); `TaskRow`'s out-of-engine badge now uses `clock-off`; `initials` added to the `ui.jsx` import
- `src/components/supervisor/WeekFlow.jsx` - Step-0 `UnifiedBoard` mount supplies its own `empty.body` naming the on-screen primary action
- `package.json` - `test` script now runs `verify-board-signals.mjs` after `verify-board.mjs`

## Decisions Made

- **`clock-off` glyph design:** reused the existing `clock` geometry (circle + two hands) with hands shortened for legibility at `Badge`'s 12px render size, struck by a cancel diagonal spanning exactly the circle's own bounding box (`m4 4 16 16` against a `circle: [12, 12, 8]`) — the same negation convention `offline` already establishes in this icon set, rather than inventing a new visual language.
- **Blocked-circle content:** rather than compute a new font-size ratio for the crammed-in label text (the original bug), the circle's content changed to what a normal avatar shows — initials — and the interpretive text moved to its own row-level label. This was the only way to satisfy the plan's constraint that `People`'s blocked-branch slice contain zero `size * <decimal>` expressions while keeping the blocked person visually identifiable in the stack.
- **`ui.jsx` (`Avatar`) was not modified**, per `files_modified` scope — the blocked circle is manually styled in `views.jsx` rather than delegating to `Avatar`, because `Avatar` has no hook to override its guard-color background with the neutral `blockedClassName` treatment.

### Deliberate UI-SPEC deviations (gap-driven, justified by G-05-1)

**1. Out-of-engine badge glyph.** UI-SPEC line 99 (and the equivalent copywriting-contract language for the `מחוץ למנוע` badge) specified the padlock icon for this badge. This plan changes that icon to the new `clock-off` glyph, while leaving the badge's text, tone, and tooltip untouched. Justification: `.planning/debug/board04-comprehension-confusion.md` root-caused G-05-1 as an AND-gate of two defects, the first being this exact icon reused for two unrelated meanings (timeless item vs. blocked person) with no legend to disambiguate (D-14 forbids adding one). The glyph half of the spec's original instruction is superseded by this fix; the copy half is unchanged.

**2. Manager empty-state body wording.** UI-SPEC's locked copywriting contract for the board's empty state specified the sentence that quoted the `nav.smart` step label ("...או תתחיל מ'סדר לי את השבוע'"). This plan removes that clause from the shared default (since the referenced step isn't on screen in the יומן/participant contexts that also render this default) and instead has `WeekFlow.jsx` pass a step-0-specific `empty.body` naming the button actually rendered below the board. Justification: the debug report's contributing-defect finding — the empty state invited the viewer toward an action that wasn't itself clickable in that copy block and, if pursued via the step bar before any shifts existed, wasn't a productive first step.

## Deviations from Plan

None beyond the two UI-SPEC deviations documented above, both explicitly anticipated and required by the plan itself (`<output>` section) as gap-driven, non-optional changes. No Rule 1-4 auto-fixes were needed; the plan's own scope already covered every defect encountered.

## Human-Check Verification Status (Task 2)

This execution ran in an isolated git worktree with no browser access. **None of the six `<human-check>` observations in the plan's Task 2 `<verify>` block were independently verified in this session.** Per CLAUDE.md iron rule 6 ("עובד" is said only after it was seen working), all six are reported as **not verified** here and must be confirmed in a browser (both themes, normal zoom) before G-05-1 is marked closed, per the plan's own `<verification>` section:

1. **NOT VERIFIED** — Timeless item shows the struck-clock glyph beside `מחוץ למנוע`, distinguishable at a glance from a timed row's plain clock, in both light and dark theme.
2. **NOT VERIFIED** — A narrowed-away person shows a neutral (never red) circle, corner padlock, and readable `לא כשיר/ה` words without zooming.
3. **NOT VERIFIED** — No padlock appears anywhere on the board except on a blocked person.
4. **NOT VERIFIED** — Clearing the week to empty shows a worded invitation naming no off-screen button; the manager's step-0 empty state points at the button directly beneath it.
5. **NOT VERIFIED** — Nothing was added that explains the board — no legend, no key, no tour (D-14).
6. **NOT VERIFIED** — The יומן tab's week mode and the participant's own board show the same treatment.

What **was** verified in this session: `node scripts/verify-board-signals.mjs` exits 0 with all six structural checks passing (proven failing against unmodified source first, per Task 1); `npm test` exits 0 across all five scripts including the new gate; `npm run build` exits 0. A source-level gate can prove the wiring is correct — it cannot prove the pixels read as intended. That gap is the explicit purpose of this section.

## Issues Encountered

None. The plan's structural guidance (exact regex-window semantics for each check, exact placement of the new label, exact scope of `files_modified`) was precise enough that no ambiguity required a judgment call outside what the plan itself specified.

## Next Phase Readiness

- G-05-1's two code root causes and one contributing copy defect are closed at the source level, gated by `npm test`.
- **Blocking follow-up before G-05-1 can be marked fully closed:** a live browser UAT pass against the six `<human-check>` observations above (both themes, normal zoom), per this plan's own `<verification>` requirement. This should be the next action taken on this gap — either by the user directly, or by a future `/gsd-verify-work` / UAT session with browser access.
- No other phase-5 work is blocked by this plan; `UnifiedBoard.jsx`'s public contract (`shifts`, `tasks`, `guards`, `dates`, `scopeGuardId`, `empty`) is unchanged except for the new optional `empty.body` override path, which is backward-compatible (falls back to the same default body minus the `nav.smart` clause).

---
*Phase: 05-unified-board*
*Completed: 2026-09-03*

## Self-Check: PASSED

All files listed in Files Created/Modified confirmed present on disk. Both task commits (`b7010df`, `00067fc`) confirmed present in `git log --oneline`.
