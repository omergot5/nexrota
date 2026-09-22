---
phase: 09-rest-time-demo-button
plan: 01
subsystem: ui
tags: [react, supervisor-views, team-settings]

# Dependency graph
requires: []
provides:
  - "RestHoursSettings({ team, actions, busy }) as a standalone TeamView sibling component, matching the FairnessWindowSettings/CategoryWeightSettings/CategoryConflictSettings pattern"
  - "SupDashboard no longer renders any team-settings content — only dashboard-scoped summary content"
affects: [09-02, team-settings, dashboard]

# Actuals (#2632)
actuals:
  tokens: 1469
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Team-settings Card components live in TeamView as flat siblings, each reading one team field and writing through actions.updateTeamSettings — RestHoursSettings now follows this pattern first (hard constraint before soft criteria)"

key-files:
  created: []
  modified:
    - src/components/supervisor/views.jsx

key-decisions:
  - "RestHoursSettings placed immediately before FairnessWindowSettings in file order (and rendered first among team-settings in TeamView, before FairnessWindowSettings) — mirrors autoAssign.js's hard-constraint-before-soft-criteria ordering"
  - "Old dashboard-specific rationale comment removed entirely rather than left orphaned; a new JSDoc comment was written from scratch above RestHoursSettings explaining the new location"

patterns-established:
  - "Team-settings components (RestHoursSettings, FairnessWindowSettings, CategoryWeightSettings, CategoryConflictSettings) are defined above TeamView in file order and rendered as flat <Component team={team} actions={actions} busy={busy} /> siblings inside TeamView's return block"

requirements-completed: [REST-01, REST-02]

coverage:
  - id: D1
    description: "SupDashboard no longer renders the 'מנוחה מינימלית' rest-hours card in any state (isNew or returning user)"
    requirement: REST-01
    verification:
      - kind: other
        ref: "node -e script asserting SupDashboard body (export function SupDashboard .. export function ShiftMgmt) excludes 'מנוחה מינימלית'"
        status: pass
      - kind: manual_procedural
        ref: "Coordinator live-browser verification: dashboard confirmed to no longer show the card anywhere"
        status: pass
    human_judgment: false
  - id: D2
    description: "TeamView renders RestHoursSettings as a direct sibling between DeadlineSettings and FairnessWindowSettings, with identical title/subtitle/10-12h toggle content and the same actions.updateTeamSettings write path"
    requirement: REST-02
    verification:
      - kind: other
        ref: "node -e script asserting exactly one `[10, 12].map` block exists file-wide, and RestHoursSettings is defined before TeamView with <RestHoursSettings rendered inside it"
        status: pass
      - kind: manual_procedural
        ref: "Coordinator live-browser verification: TeamView shows the card correctly positioned with both 10/12h buttons; clicking 12h activated it and persisted across a full page refresh"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stale dashboard-specific rationale comment removed, replaced with a freshly-written JSDoc comment above RestHoursSettings explaining the new team-screen location"
    verification:
      - kind: other
        ref: "Manual code review of the diff in commit 71dde28"
        status: pass
    human_judgment: false
  - id: D4
    description: "Neighboring team-settings components (fairness window, category weights, category conflicts) untouched and still functional"
    verification:
      - kind: manual_procedural
        ref: "Coordinator live-browser verification: neighboring components still render and work unchanged"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-09-22
status: complete
---

# Phase 9 Plan 1: Rest-Hours Card Relocation Summary

**Moved the "מנוחה מינימלית בין {משמרות}" rest-hours Card out of `SupDashboard` into a new `RestHoursSettings({ team, actions, busy })` component rendered in `TeamView`, as the first sibling among the existing team-settings components.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-09-22T19:10:00Z (approx.)
- **Completed:** 2026-09-22T19:25:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `SupDashboard` no longer renders the minimum-rest-hours card in any state — the dashboard now only shows content that belongs to it
- New `RestHoursSettings({ team, actions, busy })` component added, positioned immediately before `FairnessWindowSettings` in file order (matching the sibling settings-component pattern) and rendered first among team-settings in `TeamView` (hard constraint before soft criteria, mirroring `autoAssign.js`'s priority order)
- Card content preserved byte-identical (icon, title, subtitle, 10h/12h toggle buttons writing through `actions.updateTeamSettings({ restHours })`) — no information lost, no write-path change
- The stale dashboard-specific rationale comment was removed entirely (not left orphaned) and replaced with a newly-written JSDoc comment explaining the component's new home on the team screen

## Task Commits

Each task was committed atomically:

1. **Task 1: הוצאת כרטיס "מנוחה מינימלית" מ-SupDashboard ל-RestHoursSettings ב-TeamView** - `71dde28` (feat)

**Plan metadata:** (this commit — see below)

## Files Created/Modified
- `src/components/supervisor/views.jsx` - Removed rest-hours Card + stale comment from `SupDashboard`; added `RestHoursSettings` component (with new JSDoc) before `FairnessWindowSettings`; rendered `<RestHoursSettings />` in `TeamView` between `DeadlineSettings` and `FairnessWindowSettings`

## Decisions Made
- `RestHoursSettings` positioned as the first team-settings sibling (both in file definition order and in `TeamView`'s render order), ahead of `FairnessWindowSettings`, reflecting that minimum rest is a hard constraint while fairness window is a soft criterion — same priority ordering already established in `autoAssign.js`
- The old comment explaining why the card lived on the dashboard was deleted rather than repurposed; a new comment was authored from scratch for the new location, per the plan's explicit requirement that no orphaned/copied rationale survive the move

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking script bug, not a code bug] Plan's first automated verify script contains a self-contradictory assertion**
- **Found during:** Task 1 verification
- **Issue:** The plan's first `<automated>` verify script requires `RestHoursSettings` to be defined *before* `export function TeamView` (matching the mandated sibling-component ordering and the plan's own acceptance criteria), but then also asserts that `s.slice(teamStart)` — the substring from `TeamView`'s declaration onward — contains the literal text "מנוחה מינימלית". Since the component (and its card text) is, by design, defined above `TeamView`, exactly like the three pre-existing siblings (`FairnessWindowSettings`, `CategoryWeightSettings`, `CategoryConflictSettings`), that text never appears in the post-`TeamView` slice. Running the script verbatim throws `Error: rest-hours card text missing from TeamView region`.
- **Fix:** No code change — the implementation matches the plan's explicit prose instructions and the established sibling pattern. Verified the actual underlying intent by decomposing the check: `RestHoursSettings` is defined before `TeamView` (confirmed), `<RestHoursSettings` renders inside `TeamView`'s body (confirmed), and the card text exists exactly once, attached to the `RestHoursSettings` definition (confirmed). The plan's second automated script (`[10, 12].map` count === 1) and both `npm test`/`npm run build` passed as written, unmodified.
- **Files modified:** None (PLAN.md was not edited; this is a disposable verify script, not project source)
- **Verification:** Manually ran each sub-assertion of the broken script in isolation to confirm the real requirement (ordering + single rendering + single text occurrence) is satisfied
- **Committed in:** N/A (no code fix required)

---

**Total deviations:** 1 flagged (script bug in plan's verify step, no code impact)
**Impact on plan:** None on the implementation — REST-01/REST-02 fully satisfied, byte-identical content preserved, no scope creep.

## Issues Encountered
- No live browser/MCP tooling was available in the executing worktree session to perform the `human-check` verification directly. The coordinating agent performed the live-browser verification independently and confirmed all four `human-check` points passing (dashboard card removed everywhere; TeamView shows the card correctly positioned with working 10/12h toggles that persist across refresh; neighboring settings components unaffected).
- The coordinator merged commit `71dde28` into `main` (fast-forward) ahead of this SUMMARY/docs commit, in order to run a live server against it for verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- REST-01 and REST-02 are both satisfied; the rest-hours card now lives exclusively on the team screen alongside the other team-settings components
- Phase 9 Plan 02 (demo confirmation dialog) is unaffected by this change and can proceed independently

---
*Phase: 09-rest-time-demo-button*
*Completed: 2026-09-22*

## Self-Check: PASSED

- FOUND: `src/components/supervisor/views.jsx`
- FOUND: commit `71dde28`
- FOUND: `.planning/phases/09-rest-time-demo-button/09-01-SUMMARY.md`
