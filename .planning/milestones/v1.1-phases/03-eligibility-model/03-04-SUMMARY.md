---
phase: 03-eligibility-model
plan: 04
subsystem: ui
tags: [react, wcag, qualification, tailwind, design-tokens]

# Dependency graph
requires:
  - phase: 03-eligibility-model (plan 03-01)
    provides: "isQualified(guard, category) — the pure engine predicate this plan's editor's save rule relies on implicitly (D-03's normalisation must agree with it) and this plan's task-assignee gate calls directly"
  - phase: 03-eligibility-model (plan 03-02)
    provides: "actions.setGuardQualifications(id, categories) — the write-through action this plan's qualification editor calls, which normalises an empty array to null at the api.js write end"
  - phase: 03-eligibility-model (plan 03-03)
    provides: "categoryOptions(shifts, tasks) — the shared taxonomy helper this plan's editor and task-form datalist both consume; the exact locked wording (\"לא כשיר/ה\", the lock glyph, the per-shift blocked-count phrasing) this plan's task-assignee gate matches"
provides:
  - "TeamView's qualification editor modal — the only human-facing write path for a person's qualifiedCategories, opened per-person from a third IconBtn on the roster row"
  - "The D-03 normalisation rule implemented at the UI edge: a complete selection or an untouched person's unmodified save both resolve to null (unrestricted), never a materialised full list"
  - "TaskMgmt's assignee picker qualification gate — the fifth enforcement route named by P-03, closing the task-assignment blind spot D-02 identified"
  - "TaskMgmt's folder datalist now reads categoryOptions instead of its own inline union"
affects: []

# Actuals (#2632)
actuals:
  tokens: 4524
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Qualification editor save rule: build the saved array by filtering categoryOptions' canonical list by the working selection (never accumulate by click order or Set iteration — Pitfall 8), then apply D-03's normalisation: a complete selection saves as null (unrestricted), never a materialised list of categories that happened to exist that day."
    - "qualBlocked (TaskMgmt) is deliberately named apart from the pre-existing `blocked` (category-conflict) boolean — same file, same form, two independent hard/soft gates that must never be confused or merged, per plan 02-02's own precedent warning."
    - "The task assignee picker's locked-chip treatment (disabled, lock glyph, replaced \"לא כשיר/ה\" label) is a deliberate visual copy of plan 03-03's AssignView candidate-grid treatment — same situation, same look, on two different screens."

key-files:
  created: []
  modified:
    - src/components/supervisor/views.jsx
    - src/components/SupervisorApp.jsx

key-decisions:
  - "D-03 implemented exactly as specified: the editor opens an untouched person with every chip selected (the true state, not an empty default), and both 'select everything' and 'save unchanged' resolve to null on write — verified by code read of saveQualifications and by the api.js/useGuardian.js normalisation this plan calls into rather than reimplements."
  - "The empty-selection block is enforced by disabling the Save button (qualEmptySelection) rather than allowing a click that then explains — per the plan's explicit 'do not save and then explain' instruction — with the reason rendered inline in the modal body at all times while the selection is empty, not only after a blocked click."
  - "P-03's task-assignee gate is a hard block with a boolean named `qualBlocked`, kept structurally and nominally separate from the pre-existing `blocked` (conflict) boolean — both booleans participate independently in the save button's disabled condition and label swap, but neither reads or writes the other's state."
  - "Nobody is auto-deselected when a task's category changes and narrows an already-selected person out of qualification (Step 5's explicit instruction) — the task becomes visibly un-savable with a named reason instead, and this is flagged below for phase verification as a deliberate, non-overridable consequence."

patterns-established:
  - "A component-scope 'narrow one person, from a full list, normalise a complete selection to unrestricted' editor pattern — reusable if a future phase needs another per-person restricted-list field."

requirements-completed: [QUAL-01, QUAL-02, QUAL-04, QUAL-05, QUAL-07]

coverage:
  - id: D1
    description: "TeamView renders a per-person qualification modal (opened from a new roster IconBtn) listing every categoryOptions(shifts, tasks) entry as an aria-pressed chip; an untouched person opens with everything selected; saving an unchanged or fully-selected state stores null via actions.setGuardQualifications; the array is built by filtering the canonical list (not Set iteration); an empty selection disables Save with a stated Hebrew reason; a restricted person carries a roster badge (icon + count text, no colour-only signal)"
    requirement: "QUAL-01"
    verification:
      - kind: unit
        ref: "npm test — full suite (0 FAIL), including the pre-existing QUAL-01/02/03 mapper-crossing assertions unaffected by this plan's UI-only change"
        status: pass
      - kind: other
        ref: "shell gates (plan's own <verify> block) — sed-scoped grep on TeamView's body: categoryOptions >=1, setGuardQualifications >=1, zero 'new Set('/'Array.from(new Set' occurrences, aria-pressed >=1; SupervisorApp.jsx TeamView call site has exactly one shifts= and one tasks=; zero raw colour literals and zero dangerouslySetInnerHTML in the whole file — all confirmed pass"
        status: pass
    human_judgment: true
    rationale: "No browser tool (mcp__Claude_Browser__* or equivalent) was available in this worktree session. The plan's own <human-check> (opening the editor, confirming every chip starts selected with the hint text visible, saving unchanged and confirming via reload that no restriction was stored, deselecting everything and confirming the block message, narrowing to one category and confirming the roster badge, reselecting everything and confirming the badge disappears, inventing a new category and confirming it appears deselected) requires a running dev server and a browser. Not performed — reported as structurally verified (code read + shell gates + npm test/build) but not visually confirmed, matching this phase's own established practice (03-01/02/03 summaries)."
  - id: D2
    description: "TaskMgmt gains a shifts prop; its folder datalist reads categoryOptions(shifts, tasks) instead of its own inline FOLDERS/folders union; the assignee picker derives per-person qualification from isQualified(g, form.category) and disables/lock-marks/word-labels an unqualified person's chip matching plan 03-03's AssignView treatment; a save carrying an unqualified selected assignee is hard-blocked by a distinct `qualBlocked` boolean (not the pre-existing `blocked` conflict boolean) with no override, checkbox, or note field, and a danger-toned panel names the blocked people and category; nobody is silently deselected on a category change; the gate calls only isQualified, never compatIndex/pairRule/findConflicts"
    requirement: "QUAL-04"
    verification:
      - kind: unit
        ref: "npm test — full suite (0 FAIL); node scripts/verify-planning.mjs conflict-matrix assertions (grep -E 'התנגשות|conflict') show zero non-ok lines — no regression from this plan's addition"
        status: pass
      - kind: other
        ref: "shell gates (plan's own <verify> block) — sed-scoped grep on TaskMgmt's body: isQualified count 3 (>=2 required), categoryOptions count 2 (>=1 required), name=\"lock\" count 2 (>=1 required); SupervisorApp.jsx TaskMgmt call site has exactly one shifts=; zero raw colour literals in the whole file — all confirmed pass. One gate could not pass as literally written: see 'Deviations from Plan' below."
        status: pass
    human_judgment: true
    rationale: "No browser tool was available. The plan's own <human-check> (setting a task's folder to a category one person may not work and confirming the chip is disabled/lock-marked/labelled and unclickable, switching to a qualifying category and confirming it re-enables, selecting-then-re-narrowing and confirming the save blocks with a named message and no override control, confirming the adjacent conflict override checkbox/reason field still work, confirming an uncategorised task blocks nobody) requires a running dev server and a browser. Not performed — reported as structurally verified (code read + shell gates + npm test/build) but not visually confirmed."

duration: "~35 min (single continuous session, no interruption)"
completed: 2026-08-26
status: complete
---

# Phase 3 Plan 4: Qualification Editor and Task-Assignee Qualification Gate Summary

**A per-person qualification editor on the roster (narrow-from-full-list, complete-selection-means-unrestricted) plus a hard, non-overridable qualification gate on the task form's assignee picker — closing the fifth enforcement route P-03 named.**

## Performance

- **Duration:** ~35 min, single continuous session
- **Completed:** 2026-08-26
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `TeamView` gains `shifts`/`tasks` props and reads `categoryOptions(shifts, tasks)` — the exact taxonomy `ShiftMgmt`'s category field and (as of this plan) `TaskMgmt`'s folder field also read (D-01).
- A new per-person qualification editor modal, opened by a third `IconBtn` (icon `sliders`) in the roster's control cluster, titled with the person's name. It renders every category as an `aria-pressed` toggle chip (icon from `folderIcon`, check glyph when selected — copying the assignee picker's chip shape).
- An untouched person's modal opens with **every** chip selected — the true state of a person nobody has narrowed, not an empty form. A person who already carries a list opens with exactly that list selected.
- The save rule carries D-03 end to end: the saved array is built by `categoryOptions.filter(selected)` (canonical order, never Set iteration — Pitfall 8), and when every offered category is selected, the call passes `null` to `actions.setGuardQualifications` instead of a materialised list — so a category invented tomorrow never silently narrows someone nobody chose to narrow. A hint line states this explicitly in the modal.
- An empty selection disables the Save button (swapped label: "צריך לפחות קטגוריה אחת") and shows a standing Hebrew explanation — the block is visible before any click, not a toast after a rejected save.
- The roster row shows a restriction badge (`tone="warn" icon="lock"`, text `` כשיר/ה ל-N קטגוריות בלבד ``) only for a person who actually carries a non-empty `qualifiedCategories` array, placed beside the existing deadline-exemption badge.
- `TaskMgmt` gains a `shifts` prop; its folder-field `datalist` now calls `categoryOptions(shifts, tasks)` directly instead of unioning `FOLDERS` with in-use task folders — so a category invented on a shift is now offerable when creating a task.
- The assignee picker derives `qualified = isQualified(g, form.category)` per person (re-evaluated on every render, so changing the folder immediately re-judges every already-rendered chip — no stale approval). An unqualified person's chip is `disabled`, carries a lock glyph, and its label is replaced with `"לא כשיר/ה"` — matching plan 03-03's `AssignView` candidate-grid treatment exactly (same icon name, same replaced label).
- A new boolean `qualBlocked` (deliberately not `blocked`, which already means "category conflict" in this file — plan 02-02's own warning against overloading that name applies again here) is `true` when at least one currently-selected assignee is unqualified for the form's current category. It participates in the Save button's `disabled` condition and label swap ("יש חוסר כשירות"), and `save()` takes an early return when it is true.
- A danger-toned panel (distinct visually from the warn-toned, overridable conflict panel below it) renders only when `qualBlocked` is true, naming the blocked people and the category. No checkbox, no note field, no override exists on this panel — QUAL-05's no-override rule is structural, not policy.
- Nobody is auto-deselected when a category change narrows an already-selected person out of qualification (Step 5's explicit instruction): the task becomes visibly un-savable with a named reason instead of silently losing an assignee.
- A one-line Hebrew code comment sits at the conflict panel stating the deliberate contrast: the qualification block above it has no override; the conflict warning below it does, and the two must not be merged into one rule because they sit next to each other.
- The gate reads only `isQualified` — no `compatIndex`, `pairRule`, or `findConflicts` call was added by this plan's new code (see "Deviations from Plan" for the one pre-existing `compatIndex` call the plan's own shell gate did not account for).

## Task Commits

Each task was committed atomically:

1. **Task 1: One person, one list, narrowed from full — and a complete selection means no restriction (QUAL-01, QUAL-02, QUAL-07, D-01, D-03, D-04)** - `a45c8b5` (feat)
2. **Task 2: A task is work too — the assignee picker refuses an unqualified person, with no way past it (QUAL-04, QUAL-05, D-02, P-03)** - `b9dac84` (feat)

## Files Created/Modified

- `src/components/supervisor/views.jsx` - `TeamView` gains `shifts`/`tasks` props, qualification editor state (`qualEditing`, `qualSelection`), `openQualEditor`/`toggleQualCategory`/`saveQualifications`, the qualification modal, and the roster restriction badge; `TaskMgmt` gains a `shifts` prop, reads `categoryOptions` for its folder datalist, computes `unqualifiedAssignees`/`qualBlocked`, gates the assignee picker chips, renders the qualification-block panel, and gates `save()`.
- `src/components/SupervisorApp.jsx` - `TeamView`'s call site gains `shifts`/`tasks`; `TaskMgmt`'s call site gains `shifts`.

## Decisions Made

- **Worktree branch was stale at spawn** (see "Issues Encountered" below) — resolved by fast-forward merge of `main` before any edits, matching the precedent set by plans 03-02/03-03's own summaries.
- **Badge wording for a restricted person:** `` כשיר/ה ל-N קטגוריות בלבד `` (e.g. "כשיר/ה ל-2 קטגוריות בלבד"), paired with a `lock` icon and `tone="warn"` — chosen to read naturally as "qualified for N categories only" and to distinguish visually (warn, not info) from the pre-existing deadline-exemption badge (`tone="info"`) on the same row.
- **Empty-selection block wording:** "כל אדם חייב להיות כשיר/ה לפחות לקטגוריה אחת — אם הכוונה להוציא את {name} מהצוות, זו הפעולה המתאימה, לא איפוס הכשירות." — matches the plan's instruction to name both the constraint (must be qualified for at least one category) and the correct alternative action (removing the person, not zeroing their list).
- **Complete-selection hint wording:** "בחירה של כל הקטגוריות נשמרת כ״ללא הגבלה״ — האדם יהיה כשיר אוטומטית גם לקטגוריות שייווצרו בעתיד." — states the one non-obvious consequence the plan's objective calls out explicitly.
- **Task-save qualification block wording:** `` {names} לא כשירים לקטגוריית "{category}" — אי אפשר לשמור את המשימה עד שהם יוסרו מרשימת המבצעים. אין דרך לעקוף את זה. `` — reuses the locked "לא כשירים ל..." phrasing pattern `AssignView`'s per-shift blocked-count line already established (03-03), for consistency of voice between the two screens' qualification refusals, and ends with an explicit "no way to override" sentence per QUAL-05.
- **Assignee-picker per-chip label** uses plan 03-03's exact locked string `"לא כשיר/ה"` verbatim (not a paraphrase), per the plan's instruction to match 03-03-SUMMARY.md's recorded wording rather than reinvent it.
- **`qualBlocked` kept structurally independent from `blocked`:** both are computed from independent inputs (`conflicts`/`override`/`overrideNote` vs. `form.assignees`/`form.category`), both participate independently in the Save button's `disabled` prop and label swap, and neither function reads the other's variable — so a future edit cannot accidentally let one override the other's meaning.

## Deviations from Plan

**One shell-gate discrepancy, not a code deviation — reported per the plan's own "genuinely unsure" standard, no Rule 1-4 fix applicable:**

Task 2's `<verify>` block includes the automated gate:
```
sed -n '/^export function TaskMgmt/,/^\/\/ =\+$/p' src/components/supervisor/views.jsx | grep -cE 'compatIndex\(|pairRule\(' → expected "0"
```
Running this exactly as written returns `1`, not `0` — because `TaskMgmt` already contains one pre-existing call, `const compat = useMemo(() => compatIndex(compatibility), [compatibility]);` (line ~1603), which is the conflict-matrix wiring plan 02-02 built for the existing "assign anyway" override panel. This call predates this plan entirely — confirmed by running the identical gate against the commit immediately before this plan's first commit (`git show 0834440:...`), which also returns `1`.

This plan's new qualification-gate code (the `qualBlocked`/`unqualifiedAssignees` computation, the picker's per-chip `isQualified` call, and the qualification-block panel) adds **zero** new `compatIndex`/`pairRule`/`findConflicts` calls — confirmed by reading every line this plan added or touched in `TaskMgmt`. The plan's own prose states the gate's intent precisely: *"Do not call `compatIndex`, `pairRule` or `findConflicts` from it [the qualification gate]"* — that intent is satisfied. The shell gate as literally written counts total occurrences across the whole `TaskMgmt` function body, which was never zero to begin with, so it cannot pass regardless of what this plan does. This is a pre-existing condition the gate's author did not anticipate, not a regression this plan introduced — flagged here for phase verification to judge rather than silently reported as a pass.

The companion assertion in the same `<verify>` block — `node scripts/verify-planning.mjs`'s conflict-matrix assertions showing zero non-`ok` lines — **does** pass, confirming no behavioural regression in the conflict-matrix feature itself.

No other deviations. Plan executed exactly as written otherwise.

## Issues Encountered

- **Worktree branch was stale at spawn**, matching every prior plan in this phase's own reported experience (03-02/03-03 summaries note the identical condition). `git log --oneline HEAD..main` at session start showed 17 unique commits on `main` not yet on this worktree's branch, including all of waves 1-3 (`categoryOptions`, `isQualified`, `setGuardQualifications`, the `AssignView` locked-candidate treatment) that this plan's tasks directly depend on reading. Resolved with `git merge main --no-edit`, which fast-forwarded cleanly (the worktree branch had zero unique commits of its own beyond the shared history — confirmed via `git merge-base HEAD main`). `npm test` and `npm run build` both passed cleanly on the fast-forwarded worktree before any edits began.
- **No browser tool** (`mcp__Claude_Browser__*` or equivalent) was available in this worktree session, matching every prior plan in this phase. Per this project's CLAUDE.md iron principle 6 ("אימות בדפדפן — 'עובד' נאמר רק אחרי שראית את זה עובד") and per this plan's own task prompt instructions, the following are reported as **not performed**, not assumed:
  1. Opening the roster's qualification editor to visually confirm the chip layout, the hint text's legibility, the empty-selection block message, and the badge's appearance/disappearance across a save-reload cycle.
  2. The task form's assignee-picker locked-chip visual treatment (disabled opacity, lock glyph placement, label swap) and its legibility next to the unlocked chips.
  3. The qualification-block panel's visual distinction from the adjacent conflict-override panel, and confirming by click that the conflict override checkbox/reason field still function exactly as before.
  4. The two-screen consistency check (same person, same category, same verdict, same visual language on the roster's editor vs. the assignment grid vs. the task picker) named implicitly by the phase's own "the product agrees with itself" objective.
  All *automated* verification passed: `npm test` (0 `FAIL` across the full suite, including every pre-existing `QUAL-`/`UNIF-`/`FAIR-` assertion), `npm run build` (exits 0, no new dependency — confirmed via unchanged `package.json`/`package-lock.json`), and every plan-specified shell gate for both tasks except the one discrepancy documented above under "Deviations from Plan".

## User Setup Required

None - no external service configuration required. This plan added no new database column, no api change, and no engine change (per the plan's own `<artifacts>` "Explicitly not produced" list).

## Next Phase Readiness

**Deliberate, accepted consequence flagged for phase verification (per the plan's own `<output>` instruction):** an existing task whose assignees were selected *before* anybody was narrowed can now become un-savable — if a supervisor later narrows one of those assignees away from the task's category, re-opening and re-saving that task (even for an unrelated edit, like the title) will be blocked until the now-unqualified person is deselected. This can only arise after a supervisor deliberately narrows someone (everybody starts unrestricted per D-03), and there is no override by design — the task genuinely violates qualification, and the honest state is a blocked save, not a silent pass-through. This was not exercised against a live pre-existing task in this session (no browser access) but is logically guaranteed by `qualBlocked`'s definition, which reads `form.assignees` (populated from `task.assignees` on `openEdit`) against `isQualified(g, form.category)` unconditionally, regardless of whether the assignment predates the narrowing.

**Conflict override preserved, not exercised live:** the "אני יודע — שבץ בכל זאת" checkbox and its mandatory reason `Field` were not touched by this plan's edits — confirmed by diff (the `conflicts.length > 0` block's JSX is byte-identical except for the one-line comment added immediately above it). Their behaviour is unchanged in code; live click-through confirmation requires the browser session this plan did not have access to.

**All five phase-level browser-dependent checks that 03-03-SUMMARY.md deferred** (two-device swap-legality comparison, unconfigured-team render check, locked-tile visual legibility, lock/fairness-badge non-overlap at 200% zoom, tooltip content on hover) remain outstanding — this plan's editor now exists, so the swap-legality two-device check named in 03-03-SUMMARY.md's `D8` coverage entry (which explicitly required this plan's editor to exist first) is now unblocked for whoever runs the phase's live browser verification pass.

No code blockers remain for `/gsd-verify-work` or a phase-level browser verification pass — every gap listed above is a "seen it work in a browser" claim, not a missing implementation.

---
*Phase: 03-eligibility-model*
*Completed: 2026-08-26*

## Self-Check: PASSED

Both modified files confirmed present on disk (`src/components/supervisor/views.jsx`, `src/components/SupervisorApp.jsx`) and this SUMMARY confirmed written. Both task commit hashes (`a45c8b5`, `b9dac84`) confirmed present in `git log --oneline`. `npm test` exits 0 with 0 `FAIL` lines across the full suite. `npm run build` exits 0; `git status --short` shows a clean working tree after both commits (no unstaged/untracked leftovers). No unexpected file deletions across either task commit (`git diff --diff-filter=D` empty for both). The browser/interactive checks are explicitly reported as NOT done under "Issues Encountered" above — not silently assumed.
