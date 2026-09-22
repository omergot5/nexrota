---
phase: 08-weekbuild-status
plan: 01
subsystem: ui
tags: [terms, vocabulary, i18n, army-mode, hebrew]

# Dependency graph
requires: []
provides:
  - "army-mode nav.shifts vocabulary aligned with the generic profile's wording ('בניית שבוע' everywhere, both profiles)"
affects: [08-02, 08-03]

# Actuals (#2632)
actuals:
  tokens: 255
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/lib/terms.js

key-decisions:
  - "Only PROFILE_TERMS.army[\"nav.shifts\"] changed — BASE[\"nav.shifts\"] (the generic/non-army value, with the definite article ה') stays untouched per the locked 08-CONTEXT.md decision."

patterns-established: []

requirements-completed: [WEEKBUILD-01]

coverage:
  - id: D1
    description: "Army-mode nav.shifts label reads 'בניית שבוע' everywhere t(\"nav.shifts\") is consumed (main nav, WeekFlow step tabs, continue-button copy, RosterWizard/CalendarView page headers), instead of the old 'בניית סד\"כ'."
    requirement: WEEKBUILD-01
    verification:
      - kind: unit
        ref: "npm test (scripts/verify-terms.mjs — army/BASE key-parity + non-empty-value assertions)"
        status: pass
      - kind: automated_ui
        ref: "headless browser ($B/browse skill) against npm run dev — guest-demo team, switched team mode to army in team-settings, confirmed nav drawer item and WeekFlow step-tab both render 'בניית שבוע'"
        status: pass
    human_judgment: false
  - id: D2
    description: "No unrelated army override regressed (action.publish='הפץ סד\"כ', nav.smart='בנה לי סד\"כ', unit.shifts='תורנויות', nav.board='תמונת מצב שבועית', etc.) and BASE['nav.shifts'] generic value ('בניית השבוע') is unchanged."
    requirement: WEEKBUILD-01
    verification:
      - kind: unit
        ref: "node one-off check (anchor-corrected version of the plan's verify script) confirming BASE['nav.shifts'] === 'בניית השבוע' and army-block still contains action.publish/nav.smart/unit.shifts/nav.board keys"
        status: pass
      - kind: automated_ui
        ref: "same browser session — screenshot of the WeekFlow step-tab row showing unchanged 'הפץ סד\"כ' and 'בנה לי סד\"כ' labels alongside the fixed 'בניית שבוע' tab"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-22
status: complete
---

# Phase 8 Plan 1: Army-mode nav.shifts vocabulary fix Summary

**One-line string swap in `src/lib/terms.js` — army profile's shift-building label now reads "בניית שבוע" (matching the generic profile) instead of "בניית סד\"כ", live-verified in-browser after switching a demo team to army mode.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-22T12:20:00Z (approx)
- **Completed:** 2026-09-22T12:36:40Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `PROFILE_TERMS.army["nav.shifts"]` changed from `"בניית סד\"כ"` to `"בניית שבוע"` — the sole edit in the plan.
- Confirmed via `npm test` and `npm run build` (both pass, no regressions).
- Confirmed live in a headless browser: created a guest-demo team, switched team mode to army in "הצוות שלי" settings (label itself flipped to "הכפופים לי" as expected for army), then verified the WeekFlow step-tab and the "המשך ל..." continue-button both read "בניית שבוע", while all other army-specific labels ("הפץ סד\"כ", "בנה לי סד\"כ", "מי דיווח", "תמונת מצב שבועית") stayed unchanged.
- Confirmed all UI consumers of the label (`SmartAssign.jsx`, `CalendarView.jsx`, `WeekFlow.jsx`, `RosterWizard.jsx`, `views.jsx`) derive it via `t("nav.shifts")` — no parallel hardcoded string existed anywhere, so the single-source-of-truth fix propagated automatically to every screen.

## Task Commits

Each task was committed atomically:

1. **Task 1: army nav.shifts override — "בניית סד\"כ" → "בניית שבוע"** - `d877ae8` (feat)

## Files Created/Modified
- `src/lib/terms.js` - `PROFILE_TERMS.army["nav.shifts"]` value changed; no other key touched.

## Decisions Made
- No new decisions — executed exactly per the locked 08-CONTEXT.md decision (only the army override changes; `BASE["nav.shifts"]` keeps the definite article and stays untouched).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, scoped to verification tooling only] Plan's literal `<automated>` grep-style verify command has a false-positive anchor**
- **Found during:** Task 1 verification step
- **Issue:** The plan's first `<automated>` check does `s.indexOf('PROFILE_TERMS')` to find where `BASE` ends, expecting to hit `export const PROFILE_TERMS = {`. But `terms.js` has an earlier mention of the literal string `PROFILE_TERMS` inside a comment on line 21 (explaining why `BASE` is exported: "כדי ש-scripts/verify-terms.mjs יוכל לוודא ש-PROFILE_TERMS לא דורס..."). `indexOf` matches that comment first, slicing the `BASE` search window down to ~490 chars — well before line 37 where `nav.shifts` actually lives — so the script's own check for the unchanged generic value always throws, on both the pre-change and post-change file.
- **Fix:** No code fix needed (this is a bug in the plan's disposable verify snippet, not in `terms.js`). Ran an anchor-corrected version of the same logic (`s.indexOf('export const PROFILE_TERMS')` instead of `s.indexOf('PROFILE_TERMS')`) which confirms both assertions pass: army value is exactly `"בניית שבוע"`, BASE value is exactly `"בניית השבוע"` (unchanged), and all other army keys (`action.publish`, `nav.smart`, `unit.shifts`, `nav.board`) are present. Also independently confirmed via `Grep` on the file.
- **Files modified:** None (verification-only; `src/lib/terms.js` itself was not touched beyond the intended single-line edit).
- **Verification:** Corrected node one-liner run against the actual file; also `npm test` (full suite, including `scripts/verify-terms.mjs`, which uses correct logic and passed) and `npm run build`.
- **Committed in:** N/A (no commit needed — nothing in the repo required changing).

---

**Total deviations:** 1 auto-fixed (1 verification-tooling false-positive, no functional/security issue)
**Impact on plan:** None on the shipped code. The actual `terms.js` change is correct and fully verified through `npm test`'s real `verify-terms.mjs` script plus live browser confirmation. Only the plan's inline disposable verify snippet had a self-referential matching bug.

## Issues Encountered
- The dev server's account-creation guest flow ("הפעל הדגמה ללא הרשמה") only persists the created session within the same browser navigation context — a `goto` reload dropped back to the landing page and required re-running the guest-demo flow once. Not a product bug (session is real anonymous Supabase auth + localStorage snapshot); just a quirk of the headless browser tool's storage handling across explicit `goto` calls. Worked around by completing the whole verification flow (guest login → team mode switch → nav check) without an intermediate full page reload.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WEEKBUILD-01 fully delivered and live-verified. `src/lib/terms.js` is now internally consistent for `nav.shifts` between profiles (differing only by the definite article, as intended).
- Ready for 08-02 (next plan in this phase, WEEKBUILD-02 per 08-CONTEXT.md) which builds on this unified vocabulary.
- No blockers.

---
*Phase: 08-weekbuild-status*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `src/lib/terms.js`
- FOUND: `.planning/phases/08-weekbuild-status/08-01-SUMMARY.md`
- FOUND: commit `d877ae8` in `git log --oneline --all`
