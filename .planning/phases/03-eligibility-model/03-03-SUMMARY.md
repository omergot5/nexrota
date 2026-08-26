---
phase: 03-eligibility-model
plan: 03
subsystem: ui
tags: [react, wcag, qualification, tailwind, design-tokens]

# Dependency graph
requires:
  - phase: 03-eligibility-model (plan 03-01)
    provides: "isQualified(guard, category)/checkQualification({guard, shift}) — the pure engine functions this plan's grid and header read directly; the exact Hebrew wording locked for the per-candidate refusal and the aggregate 'unqualified' label"
  - phase: 03-eligibility-model (plan 03-02)
    provides: "guard.qualifiedCategories / shift.category — the exact field names now present on every app-layer object loadTeam returns; toggleAssignment's pre-write gate that this plan's disabled state now telegraphs before the click"
provides:
  - "categoryOptions(shifts, tasks) — the single shared taxonomy helper (module scope in views.jsx), consumed by ShiftMgmt's category field now and available for plan 03-04's task form / qualification editor"
  - "ShiftMgmt renders a category field (datalist-backed, empty-by-default) and carries it through the copy-a-day path"
  - "AssignView renders per-candidate qualification (lock glyph, replaced label, neutral-token ring, tooltip) and a per-shift blocked-count line, both derived from isQualified"
  - "GuardApp's MySwaps resolves the real guard record before calling checkAssignment — QUAL-04 route 4 closed"
affects: [03-04-qualification-editor]

# Actuals (#2632)
actuals:
  tokens: 5789
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "categoryOptions(shifts, tasks): shortcut names in declared order, then every other in-use name sorted — never raw Set iteration order, to keep a future determinism assertion (plan 03-04's qualification editor) from flaking (03-RESEARCH.md Pitfall 8)."
    - "A blocked candidate carries three independent, redundant signals (disabled control, replaced word, lock glyph) plus a per-shift count line and a tooltip — never a colour-only distinction, matching the file's own pre-existing rule (comments at the availability ring branches and the deadline-exempt badge)."
    - "The category chip on the shift-card header is a bespoke ink-inheriting pill (bg-black/20, matching the pre-existing requiredGuards counter), not the generic Badge component — Badge's TONES are fixed token colours and would not stay readable against an arbitrary supervisor-chosen shift colour."

key-files:
  created: []
  modified:
    - src/components/supervisor/views.jsx
    - src/components/GuardApp.jsx

key-decisions:
  - "D-01 confirmed as implemented: categoryOptions is the one function the shift form's suggestion list draws from; it returns the six shortcut names in full (not filtered to in-use, unlike TaskMgmt's folders grouping) because it is an input suggestion list, not a display grouping of real rows."
  - "D-03 confirmed as implemented: a shift with no category renders no header badge, no candidate is disabled, no label is replaced, no lock appears, and the blocked-count line does not render — every derived value in AssignView collapses to the pre-existing appearance when isQualified's default-allow rule is never triggered."
  - "The locked candidate's ring/background is drawn from the neutral token family the pre-existing 'unknown status' fallback branch already uses (ring-hairline-strong / bg-surface-sunken), not from ring-danger — reusing the danger ring for both 'unavailable' and 'unqualified' would have collapsed exactly the distinction QUAL-08 exists to create."
  - "The per-candidate bottom label uses the short form \"לא כשיר/ה\" (matching the file's existing terse AVAIL labels — \"זמין\", \"אולי\", \"לא הגיש\"); the tooltip and the per-shift count line instead reuse plan 03-01's locked, verbatim engine wording — a short label and a full explanation are different jobs and were not forced into one string."
  - "MySwaps' legality function now matches SwapMgmt's refusal shape and wording exactly ('המשמרת או המאבטח כבר לא קיימים'), so the two screens' refusals are interchangeable to any code that reads them, per the plan's own instruction."

patterns-established:
  - "isQualified(guard, shift.category) is called directly by every screen that needs to know whether a person may work a shift — the candidate grid derives its button's clickability from the same function the state layer's write-gate calls, so the two can never disagree (defense in depth, not the only guard — the write-gate from plan 03-02 remains authoritative)."

requirements-completed: [QUAL-03, QUAL-04, QUAL-06, QUAL-07, QUAL-08]

coverage:
  - id: D1
    description: "categoryOptions(shifts, tasks) exists exactly once at module scope, returns shortcut names in declared order followed by sorted in-use names, defaults both arguments to empty arrays, and survives a null/undefined entry in either array"
    requirement: "QUAL-03"
    verification:
      - kind: other
        ref: "shell gates — grep -c 'const categoryOptions' == 1; grep -c 'categoryOptions(' >= 2 (definition's JSDoc usage example + ShiftMgmt's datalist call)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ShiftMgmt accepts a tasks prop (already supplied by WeekFlow's shared prop bag, confirmed by reading WeekFlow.jsx rather than assumed), carries category: \"\" in blank (empty by default, not guessed — D-03), renders a datalist-backed category Field between the identity/timing grid and the shift-length summary with a hint stating both what the field is checked against and what leaving it empty means, and carries category through runSpread's copy-a-day path while fillWeek and applyTemplate remain untouched"
    requirement: "QUAL-03"
    verification:
      - kind: unit
        ref: "npm test — full suite (230 ok, 0 FAIL), including the pre-existing QUAL-01/02/03 mapper-crossing assertions from plan 03-02 that prove shift.category round-trips through api.js unaffected by this plan's form change"
        status: pass
      - kind: other
        ref: "shell gates — sed-scoped grep on ShiftMgmt's state block and on runSpread's body each show >=1 'category'; sed-scoped grep on fillWeek's body shows 0 'category'; grep confirms no gs_shifts table name and no wiring of categoryOptions into compatIndex/pairRule/findConflicts"
        status: pass
    human_judgment: true
    rationale: "All structural gates pass and npm test/build both exit 0, but this plan's own <human-check> (opening a new shift, confirming the field is present with the correct hint, typing a never-used category and confirming it survives a reload, leaving it empty and confirming nothing is auto-filled, spreading a categorised day and confirming the copy carries it, filling a week and confirming the pattern-created shifts carry none) requires a running dev server and a browser. No browser tool (mcp__Claude_Browser__* or equivalent) was available in this session — not exercised, not assumed working."
  - id: D3
    description: "AssignView derives qualification per candidate from isQualified(g, shift.category) — the same function the engine's checkHardConstraints and useGuardian's toggleAssignment gate call — so the button's appearance and the click's outcome cannot disagree"
    requirement: "QUAL-07"
    verification:
      - kind: unit
        ref: "npm test — full suite (230 ok, 0 FAIL); isQualified's own unit coverage from plan 03-01 (QUAL-01/02/05/06) is unchanged and still passes, proving the function this plan calls behaves as documented"
        status: pass
      - kind: other
        ref: "shell gate — sed-scoped grep on AssignView's body shows isQualified called 3 times (per-candidate qualified, per-candidate ownCategories guard, per-shift blockedCount filter)"
        status: pass
    human_judgment: true
    rationale: "The underlying predicate is unit-tested (03-01). Whether the grid visually renders correctly — a locked tile legible but dimmed, distinguishable from an unavailable tile without reading colour, the lock glyph readable at 200% zoom without overlapping the fairness badge — was not exercised in a browser this session. No browser tool was available."
  - id: D4
    description: "A blocked candidate is disabled (busy || !qualified), carries a lock glyph in the avatar's corner opposite the fairness badge, and has its bottom label unconditionally replaced with \"לא כשיר/ה\" instead of the availability word or check icon — never distinguished by colour/dimming alone"
    requirement: "QUAL-07"
    verification:
      - kind: other
        ref: "shell gates — grep -c 'name=\"lock\"' >= 1; grep -c 'disabled=' >= 1 and grep -c 'disabled={busy}' == 0 (no longer busy-only); grep for 'ring-danger.*qualified' or 'qualified.*ring-danger' == 0 (blocked ring does not reuse the unavailable danger ring — QUAL-08)"
        status: pass
    human_judgment: true
    rationale: "Structurally proven (the JSX unconditionally swaps the label text and adds the lock glyph whenever !qualified, independent of any colour class). Visual confirmation — that the swap is actually perceptible without colour, and that a colour-blind simulation or screen reader announces the change — was not performed in a browser this session."
  - id: D5
    description: "The blocked treatment's ring/background is drawn from the neutral token family (ring-hairline-strong / bg-surface-sunken) rather than danger, and no raw colour literal or dangerouslySetInnerHTML was introduced in either changed file"
    requirement: "QUAL-08"
    verification:
      - kind: other
        ref: "shell gates — grep for #[0-9a-fA-F]{6}|rgb\\([0-9] in non-comment lines of views.jsx == 0; grep -c dangerouslySetInnerHTML == 0 in both views.jsx and GuardApp.jsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "The shift-card header shows a category chip (briefcase icon + text, inheriting the shift's computed ink) only when the shift carries a category, and nothing when it does not; a person's own qualified-category list and the exact engine refusal sentence are exposed through the button's title attribute without navigating away; a line beneath the grid states the blocked count and names the category, reusing explainUnfilled's exact locked label \"לא כשירים לתפקיד\""
    requirement: "QUAL-07, QUAL-08"
    verification:
      - kind: other
        ref: "code read — header badge is gated on `shift.category &&`; title is built by joining [comment, ownCategories list, refusal] filtered for truthy parts; blocked-count line template is literally `${blockedCount} לא כשירים לתפקיד \"${shift.category}\"`, containing plan 03-01's locked label verbatim"
        status: pass
    human_judgment: true
    rationale: "The exact strings are grounded in plan 03-01's locked wording (reason string and explainUnfilled's labels.unqualified) and confirmed present by direct code read, but whether the tooltip is actually reachable/legible on hover, and whether the count line reads naturally on screen, was not confirmed in a browser this session."
  - id: D7
    description: "An unconfigured team (nobody narrowed, no categorised shifts) renders AssignView identically to before this plan: isQualified's default-allow (category falsy -> true) means qualified is always true, so no header badge, no disabled candidate, no replaced label, no lock glyph and no blocked-count line appear anywhere"
    requirement: "QUAL-07"
    verification:
      - kind: other
        ref: "code read — every new render branch is gated on `shift.category` (header badge) or `!qualified` (disabled/ring/label/lock/count), both of which are false/true-permissive respectively when no category exists anywhere; isQualified's own default-allow behaviour is unit-proven in plan 03-01 (QUAL-02)"
        status: pass
    human_judgment: true
    rationale: "Logically guaranteed by isQualified's proven default-allow rule and by every new branch being conditioned on its output, but not visually confirmed against a live, unconfigured team in a browser this session."
  - id: D8
    description: "MySwaps' legality function resolves the recipient from the guards prop and passes the full record to checkAssignment; the early refusal covers a missing shift OR a missing person, with SwapMgmt's exact Hebrew wording and object shape; no object literal built from a bare identifier is passed as the person argument to checkAssignment/checkQualification anywhere under src/components or src/hooks"
    requirement: "QUAL-04"
    verification:
      - kind: unit
        ref: "npm test — full suite (230 ok, 0 FAIL); checkAssignment's missing-guard/missing-shift branch and its qualification delegation are unit-proven in plans 03-01/03-02 and unaffected by this call-site change"
        status: pass
      - kind: other
        ref: "shell gates — sed-scoped grep on legality's body: guards.find present exactly once, guard: { id: ...} pattern absent; if (!shift || !guard) present exactly once; repo-wide grep for checkAssignment({...guard: {...}) across src/components returns 0 matches"
        status: pass
    human_judgment: true
    rationale: "The fix is structurally proven (grep gates) and the underlying qualification/checkAssignment logic is unit-tested. The plan's own <human-check> — narrowing a person, requesting them as a swap recipient, confirming their own device and the supervisor's SwapMgmt screen now show the same verdict and reason — requires plan 03-04's qualification editor (not yet built) plus a live two-session browser check. Not performed this session; explicitly deferred, matching plan 03-02's own summary."

duration: "~6 min commit window (12:46–12:52 UTC+2), plus prior file discovery/reading across a session that was interrupted by a hard session-limit reset and resumed from the same task list"
completed: 2026-08-26
status: complete
---

# Phase 3 Plan 3: Shift Category Field, Qualification Display in the Assignment Grid, and the Swap-Legality Fix Summary

**A shared `categoryOptions` taxonomy feeds a new category field on the shift form; `AssignView`'s candidate grid renders a lock glyph, a replaced label and a neutral-token ring for anyone `isQualified` refuses, plus a per-shift blocked-count line; and `GuardApp`'s `MySwaps` now resolves the real guard record instead of a synthetic `{id}` object before calling `checkAssignment`.**

## Performance

- **Duration:** ~6 min commit window (12:46–12:52 UTC+2 on 2026-08-26), plus prior file discovery/reading. This session was interrupted mid-Task-3-investigation by a hard session-limit reset and resumed from the coordinator's message with the same task list — the git history and the three commits below are the ground truth for what was actually done.
- **Completed:** 2026-08-26
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `categoryOptions(shifts, tasks)` — the one shared taxonomy helper (D-01) — added at module scope in `views.jsx`, immediately below `folderIcon`. Returns the six shortcut folder names in their declared order (in full, not filtered to in-use — it is a suggestion list, not a display grouping), followed by every other category actually in use across `shifts`/`tasks`, sorted. Both arguments default to `[]` and the function survives a null entry in either array.
- `ShiftMgmt` gains a `tasks` prop (already supplied by `WeekFlow`'s shared `common` object — confirmed by reading `WeekFlow.jsx` rather than assumed, so no call-site changed), a `category: ""` field in `blank` (empty by default — a guessed default would restrict people against a category no manager chose), and a datalist-backed category `Field` between the identity/timing grid and the shift-length summary. The hint states both what the field is checked against and what leaving it empty means, so a manager does not fill it defensively "to be safe."
- `runSpread` (copy-a-day) now carries `category` through as part of the shift's definition; `fillWeek` and `applyTemplate` are untouched — they describe times of day and must never invent a category nobody chose. `openEdit`'s existing `{ ...s }` spread already carries an existing category with no change needed.
- `AssignView` imports `isQualified` from `autoAssign.js` and calls it once per candidate (`isQualified(g, shift.category)`) and once for the per-shift blocked count — the exact same function `checkHardConstraints` and `toggleAssignment`'s write-gate already call, so the grid cannot show a clickable button over a write the state layer would refuse.
- The shift card header renders a category chip (briefcase icon + text) only when `shift.category` is truthy; it is a bespoke `bg-black/20` pill that inherits the header's already-computed readable ink (matching the pre-existing `requiredGuards` counter's treatment), not the generic `Badge` component, since `Badge`'s fixed token tones would not stay readable against an arbitrary shift colour.
- A blocked candidate: `disabled={busy || !qualified}` (QUAL-05 — no path past it); ring/background drawn from the neutral token family (`ring-hairline-strong bg-surface-sunken`) rather than the danger ring already used for `unavailable`, preserving QUAL-08's distinction; a lock glyph in the avatar's top-inline-end corner, opposite the fairness badge's top-inline-start corner, sized/ringed to match; and the bottom label unconditionally replaced with `"לא כשיר/ה"` instead of the availability word or check icon — never a colour-only change.
- The button's `title` now joins the availability comment, the person's own `qualifiedCategories` list (when they carry a narrowing one), and — when blocked — the exact refusal sentence plan 03-01 locked for `checkQualification` (`` לא מוגדר/ת כשיר/ה לקטגוריית "${category}" ``), verbatim, not a second phrasing.
- A line beneath the candidate grid, rendered only when at least one candidate is blocked, states the count and the category using `explainUnfilled`'s exact locked label verbatim: `` ${blockedCount} לא כשירים לתפקיד "${shift.category}" ``.
- `GuardApp.jsx`'s `MySwaps.legality` no longer builds a synthetic `{ id: r.toGuard }` object. It now resolves the recipient from the full `guards` prop `MySwaps` already receives, and refuses when either the shift or the person cannot be resolved — matching `SwapMgmt`'s exact refusal shape and Hebrew wording (`"המשמרת או המאבטח כבר לא קיימים"`) so the two screens' refusals are interchangeable.
- Grepped `src/components` and `src/hooks` for any other `checkAssignment`/`checkQualification` call site building the person argument as an object literal: none found. `views.jsx`'s `SwapMgmt` already resolves the full record; `useGuardian.js`'s `toggleAssignment` gate (plan 03-02) already resolves the guard from `dataRef.current.guards`.

## Task Commits

Each task was committed atomically:

1. **Task 1: One suggestion list for the whole product, and a shift that carries a work category (QUAL-03, D-01)** - `5d1266a` (feat)
2. **Task 2: The grid shows who may not work this shift, and why, without hovering and without leaving the screen (QUAL-07, QUAL-08, QUAL-06)** - `f7f95fb` (feat)
3. **Task 3: A guard's own device judges a swap against their real profile (QUAL-04 route 4)** - `219bb0f` (fix)

## Files Created/Modified

- `src/components/supervisor/views.jsx` - `categoryOptions` helper added; `ShiftMgmt` gains a `tasks` prop, a `category` field in `blank`, a datalist-backed category input, and category-carrying `runSpread`; `AssignView` imports `isQualified`, renders a category header chip, computes per-candidate qualification, renders the locked treatment (disabled/ring/label/lock/tooltip), and renders the per-shift blocked-count line.
- `src/components/GuardApp.jsx` - `MySwaps.legality` resolves the real guard record from the `guards` prop before calling `checkAssignment`, matching `SwapMgmt`'s refusal shape and wording.

## Decisions Made

- **Token evidence for the locked candidate's label text (per the plan's `<output>` instruction):** the label uses the file's existing `text-muted` class on `bg-surface-sunken` — the exact same pairing already used by the pre-existing "unknown/unfiled" fallback branch, not a new pairing. `src/design/tokens.css` documents `--text-muted` as `#4A6A64`, `5.4:1` against the light-mode cream background (`#F6F4E8`), and `#A0BEB6`, `7.6:1` in dark mode — both comfortably clear WCAG AA's 4.5:1 floor for normal text. `bg-surface-sunken` is a low-opacity dark overlay (`rgba(28,59,55,0.05)` light / `rgba(0,0,0,0.24)` dark) composited on top of the same base surface, which can only raise contrast for dark-on-light or keep it stable for light-on-dark text, so the documented ratios are a conservative floor, not an optimistic one.
- **Lock glyph / fairness badge non-overlap (per the plan's `<output>` instruction):** confirmed by code read rather than a live 200%-zoom screenshot (no browser tool available — see below). The fairness badge sits at `absolute -top-1 -left-1.5` (top-inline-start in RTL) and the new lock badge sits at `absolute -top-1 -right-1.5` (top-inline-end) — opposite corners of the same 30px avatar, both sized `min-w-[18px] h-[18px]` with the same `ring-2 ring-surface` treatment. They cannot render simultaneously colliding at any zoom level that preserves the avatar's own aspect ratio, since they anchor to opposite corners rather than overlapping offsets. Live confirmation at 200% zoom is listed as not performed below.
- **Verbatim Hebrew wording, confirmed matching plan 03-01's locked strings:** per-candidate tooltip refusal — `` לא מוגדר/ת כשיר/ה לקטגוריית "${category}" `` (identical to `checkQualification`'s own `reason`); per-shift count line — `לא כשירים לתפקיד` (identical to `explainUnfilled`'s `labels.unqualified`). The per-candidate *bottom label* (`"לא כשיר/ה"`) is deliberately a third, shorter string — matching the terseness of the file's existing `AVAIL` labels (`"זמין"`, `"אולי"`, `"לא הגיש"`) rather than reusing either of the two longer locked strings, which would not fit a two-line avatar caption.
- **Hover-only note (per the plan's `<output>` instruction):** the full per-person qualified-category list is exposed only through the button's `title` attribute (hover/long-press), while the pass/fail verdict itself (disabled state, replaced label, lock glyph, ring) is always visible without any interaction. This split is intentional per the plan's own step 4 instruction, and is flagged here explicitly so phase-level verification can judge whether hover-only is acceptable for the category-list half of QUAL-07, rather than discovering the split unannounced.
- **Other synthetic-person call sites found (per the plan's `<output>` instruction):** none, beyond the one fixed in this plan. `views.jsx`'s `SwapMgmt` (the template this fix copied) already resolves the full guard record; `useGuardian.js`'s `toggleAssignment` gate (plan 03-02) already resolves the guard from `dataRef.current.guards`. A repo-wide grep for `checkAssignment({...guard: {...)` / `checkQualification({...guard: {...)` across `src/components` and `src/hooks` returns zero matches after this plan's fix.
- **`MySwaps`' refusal wording matches `SwapMgmt`'s literal text** (`"המשמרת או המאבטח כבר לא קיימים"`), not the paraphrase `03-RESEARCH.md`'s own code example used (`"המשמרת או השומר כבר לא קיימים"`) — the plan's instruction was to match `SwapMgmt` exactly, and `SwapMgmt`'s actual source (not the research doc's illustrative diff) is the ground truth.

## Deviations from Plan

None - plan executed exactly as written. One structural note, not a Rule 1-4 deviation: the plan's `<verify>` gate for Task 1 counts occurrences of the literal substring `categoryOptions(` and requires at least 2; the helper's own JSDoc includes a one-line usage example (`` `categoryOptions(shifts, tasks)` ``) documenting its call signature for plan 03-04's future consumers, which is what supplies the second occurrence alongside `ShiftMgmt`'s one real call site. This is genuine API documentation, not a gate-satisfying no-op — plan 03-04 (the qualification editor and task-form wiring) will read that same JSDoc before adding its own call sites.

## Issues Encountered

- **No browser tool (`mcp__Claude_Browser__*`, `preview_start`, or equivalent) was available in this session**, matching plans 02-03, 03-01 and 03-02's own reported experience. Per the task instructions and CLAUDE.md's iron principle 6 ("אימות בדפדפן — 'עובד' נאמר רק אחרי שראית את זה עובד"), the following were **not performed** and are reported as unverified rather than assumed:
  1. Opening the shift form to confirm the category field, its hint, the datalist suggestions, and the empty-vs-filled persistence behaviour.
  2. Opening the assignment grid to confirm the locked tile's visual legibility, its distinction from an unavailable tile without reading colour, the lock/fairness-badge non-overlap at 200% zoom, and the tooltip content on hover.
  3. The two-device swap-legality comparison (narrowed guard's own device vs. supervisor's `SwapMgmt`) named in Task 3's `<human-check>` — this additionally requires plan 03-04's qualification editor, which does not exist yet, so it could not be exercised even with browser access this session.
  4. Confirming an unconfigured team's assignment screen renders with zero visible change (logically guaranteed by `isQualified`'s proven default-allow rule and by every new render branch being conditioned on its output — see coverage `D7` — but not visually confirmed).
  All *automated* verification passed: `npm test` (230 `ok`, 0 `FAIL` across `QUAL-01` through `QUAL-08`, plus all pre-existing `UNIF-`/`FAIR-` assertions), `npm run build` (exits 0, no new dependency), and every plan-specified shell gate for all three tasks (`categoryOptions` singularity/consumption, `ShiftMgmt`/`runSpread`/`fillWeek` category presence/absence, no conflict-matrix wiring, no `gs_shifts` name leak, `isQualified` call count in `AssignView`, lock glyph presence, disabled-condition widening, no danger-ring reuse, no raw colour literal, no `dangerouslySetInnerHTML`, `MySwaps`' `guards.find`/no-synthetic-object/dual-missing-refusal, and zero remaining synthetic-person call sites repo-wide).
- **Worktree branch was stale at spawn**, matching plans 02-01/02-02/02-03's own reported experience: `git merge-base HEAD main` showed zero unique commits on the worktree's branch, predating all of `.planning/`, phases 1-2, and this phase's own plan/context/research/prior summaries. Verified the zero-unique-commits condition first (`git log main..HEAD --oneline | wc -l` == 0), then fast-forwarded (`git merge main --ff-only`) — a lossless ref move, not a destructive reset. `npm test` and `npm run build` both passed cleanly on the fast-forwarded worktree before any edits began.
- **Session interruption mid-task:** this session hit a hard session-limit reset while reading `GuardApp.jsx`'s `MySwaps` section during Task 3 planning (all of Task 1 and Task 2 were already committed by that point). Resumed from the coordinator's message with the exact same task list; no work was redone, no commit was duplicated — confirmed by `git log` before continuing.

## User Setup Required

None - no external service configuration required. (The `0006_qualification.sql` migration from plan 03-02 was already confirmed applied per the phase's most recent commit — `7c6123a`, "confirm 0006_qualification migration applied" — before this plan started.)

## Next Phase Readiness

**For plan 03-04 (qualification editor and task-form wiring, per `03-CONTEXT.md`'s Decision 4 and `03-RESEARCH.md`'s Open Question 3):** `categoryOptions(shifts, tasks)` is ready to be imported/reused as the shared source for the task form's folder input and the new qualification editor — both should read from the same helper this plan wired the shift form to, per D-01. `isQualified`/`guard.qualifiedCategories` are already displayed correctly by `AssignView` for any team that gets narrowed by plan 03-04's editor; no further wiring is needed on the assignment-grid side.

**Outstanding before this phase can be called fully verified, not just structurally correct:**
- All five browser-dependent checks listed under "Issues Encountered" above need a human or a session with browser access to confirm — this is the honest gap this plan is reporting, matching the rigor of `02-03-SUMMARY.md`'s and `03-02-SUMMARY.md`'s own honest gaps.
- The Task 2 `<human-check>` and the Task 3 `<human-check>` both explicitly note in the plan itself that they should be run "at the end of the phase," once plan 03-04's qualification editor exists to actually narrow someone's categories in the live UI — this plan's own scope could not have closed that gap even with browser access this session, since no UI to narrow a person's qualifications exists yet.

No code blockers for plan 03-04 or for a phase-level `/gsd-verify-work` pass; the blockers are exclusively "seen it work in a browser" claims that remain unverified in this environment, plus the one browser-only check that structurally requires plan 03-04 to exist first.

---
*Phase: 03-eligibility-model*
*Completed: 2026-08-26*

## Self-Check: PASSED

Both modified files confirmed present on disk (`src/components/supervisor/views.jsx`, `src/components/GuardApp.jsx`, this SUMMARY). All three task commit hashes (`5d1266a`, `f7f95fb`, `219bb0f`) confirmed present in `git log`. `npm test` exits 0 with 0 `FAIL` lines (230 `ok` assertions across both scripts, including all pre-existing `QUAL-`/`UNIF-`/`FAIR-` assertions from plans 03-01/03-02 and prior phases). `npm run build` exits 0; `package.json`/`package-lock.json` unchanged (no new dependency, confirmed via empty `git diff` on both files). No unexpected file deletions across the three task commits. The browser/interactive checks are explicitly reported as NOT done, per "Issues Encountered" above — not silently assumed.
