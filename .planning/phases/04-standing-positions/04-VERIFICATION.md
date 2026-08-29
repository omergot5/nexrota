---
phase: 04-standing-positions
verified: 2026-08-30T00:00:00Z
status: human_needed
score: 8/8 must-haves verified (code + unit-test layer); 1 live-backend reliability item and 4 visual/UAT items routed to human verification
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Live-backend reliability of gs_positions RLS (`npm run test:backend`, '=== standing positions ===' section)"
    expected: "All 8 checks print `ok` on a normal run, matching 04-01-SUMMARY.md's claimed 8/8 pass and the Post-Merge Finding's claimed fix (migration 0009)."
    why_human: "The verifier ran `npm run test:backend` three times against the live Supabase project (with adequate spacing to rule out simple rate-limiting). In all three runs, `guard can read their own team's position` failed with `permission denied for function gs_my_team`, and in two of the three the follow-on `gs_shifts` idempotency checks (`ignoreDuplicates:true is a no-op`, `exactly one shift row exists`) also failed with `new row violates row-level security policy for table gs_shifts`. A separate, minimal isolated reproduction script (single supervisor + single fresh guard, no intervening traffic) exercising the identical sequence — create position as supervisor, read it as guard, insert a position-tagged shift, verify idempotency — passed cleanly and consistently. This strongly suggests the underlying migration 0009 fix (`gs_my_team()`/`gs_is_supervisor()`) is logically correct, and the failure is a harness artifact of the existing `verify-backend.mjs` script (candidate cause: `guardA`'s session is created early in the script and reused ~9 sections later without `autoRefreshToken`, by which point many other network calls have run) rather than a defect real users would hit — but this could not be confirmed with certainty from source review alone, and the plan's own explicit acceptance bar (`npm run test:backend` prints ok on the section) is not being met reproducibly as claimed. A human should either (a) re-run `npm run test:backend` in isolation/spaced out and confirm a clean pass, accepting this as the same class of pre-existing flakiness already logged in `deferred-items.md`, or (b) harden `scripts/verify-backend.mjs`'s positions section (e.g. re-authenticate `guardA` immediately before use) and confirm a clean run before treating POS-01/POS-05's backend proof as solid."
  - test: "04-01 Task 3 human-check: define a template position via `actions.addPosition` (React DevTools or the 04-02 form), confirm materialized shift rows carry `position_id` in the Supabase dashboard, and confirm a second `ensurePositionsForWeek` call on the same week adds nothing."
    expected: "Shift rows appear with `position_id` set; repeat run adds zero rows."
    why_human: "Visual/dashboard confirmation, not gate-able by grep. Partially covered by the orchestrator's own Post-Merge live-browser regression test (position created, 3+ never-visited weeks navigated, materialization confirmed on-screen and via direct query) — but that check was scoped to the RLS regression, not a full run-through of this exact human-check script."
  - test: "04-02 Task 1 human-check: as a supervisor, open 'עוד' → 'עמדות קבועות', define a template position (weekdays + hours), switch forward and back a week, and confirm shift rows appear with no extra click and no duplicates on repeat navigation."
    expected: "Rows materialize automatically on week view; no duplicate rows after repeated back-and-forth navigation."
    why_human: "Requires a live authenticated browser session; 04-02-SUMMARY.md explicitly records this as `not_run` (no browser automation tool or Supabase credentials in that worktree). Partially covered by the orchestrator's Post-Merge regression test."
  - test: "04-02 Task 2 human-check: open a position card with both qualified and working guards. (1) Screenshot in greyscale — the two lists remain distinguishable. (2) Cover both headings with a hand — still distinguishable from icon + item shape alone. (3) Reduce a working guard's qualification and confirm they move to the working-only list, disappearing from qualified."
    expected: "Both perceptual tests pass; the qualification change relocates the guard between lists correctly."
    why_human: "Perceptual/visual judgment call — code review confirms the four independent channels (heading, icon, item shape, per-item text) are structurally present and driven by two separate pure functions over two separate source fields, but whether they read clearly to a human eye is not machine-verifiable. 04-02-SUMMARY.md records this as `not_run`."
  - test: "04-02 Task 3 human-check: log in as a guard who is qualified for a position's category but not scheduled on it this week. Confirm the position appears under 'העמדות שאני כשיר/ה להן' (not among the shift list), with no date/time, and ask a person unfamiliar with the screen to read it aloud and state in their own words whether they are working that position this week — the answer must be 'no, I'm only allowed to.'"
    expected: "The naive reader correctly concludes 'qualified, not scheduled.'"
    why_human: "This is precisely the anti-confusion test the phase exists to pass (ROADMAP Success Criterion 4) and is inherently a human-comprehension check. 04-02-SUMMARY.md records this as `not_run`."
---

# Phase 4: עמדות קבועות (Standing Positions) Verification Report

**Phase Goal:** עמדה שנכנסת לכל שבוע לבד ומתממשת באותן שורות בכל הרצה, ושיוך אדם אליה נקרא על המסך כהצהרת כשירות ולא כשיבוץ
**Verified:** 2026-08-30
**Status:** human_needed
**Re-verification:** No — initial verification

## Method Note

ROADMAP.md marks this phase `Mode: mvp`, but the phase goal text is not in `As a ... I want ... so that ...` User Story form, so the narrow MVP-mode verification procedure does not apply here. Standard goal-backward verification was performed against ROADMAP's four stated Success Criteria (which double as the requirement-level truths) plus the two plans' `must_haves` frontmatter.

Per the orchestrator's explicit instruction, POS-01's backend fix (migration `0009_positions_rls_use_helpers.sql`) was independently re-verified live — not taken on the SUMMARY's word. See the "Live-backend reliability" section below; this is the one finding that moves this report from `passed` to `human_needed`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POS-01 · מנהל מגדיר עמדה פעם אחת, והיא מופיעה בשבוע הבא בלי שנגע בכלום | ✓ VERIFIED | `SupervisorApp.jsx` `useEffect` calls `actions.ensurePositionsForWeek(weekDates[0])` on every `weekDates[0]` change (src/components/SupervisorApp.jsx:99-105). `ensurePositionsForWeek` (src/hooks/useGuardian.js:712-720) is a genuine no-op (`{created:0}`, no write, no `refresh()`) when nothing is missing. `npm test` proves `missingRowsForWeek`'s idempotency at the pure-function layer (POS-04 section, 5/5 checks ok). Isolated live reproduction (see below) confirms `materializeTemplateShifts`'s upsert path against the real DB. |
| 2 | POS-04 · הרצה חוזרת על אותו שבוע מייצרת בדיוק אותן שורות — אין כפילויות, ואין מזהים משתנים | ✓ VERIFIED | `npm test` POS-04 section: 5 rows on first call, empty array on repeat, shuffled-`realized`-order stable, other-position row does not suppress (5/5 ok). Migration 0007/0008: non-partial unique index on `(position_id, date)`/`(position_id, due_date)` — `create unique index ... gs_shifts_position_date_idx on gs_shifts (position_id, date)`. Isolated live test: duplicate plain insert rejected by the unique index; `ignoreDuplicates:true` upsert returns empty array with no error; exactly one row survives — all confirmed against the real database in a clean, unburdened session. |
| 3 | 3. הרצת המנוע על אותם נתונים בסדר קלט מעורבב מחזירה סידור זהה; `npm test` מכסה זאת | ✓ VERIFIED | `npm test` "D-02 · מקצה לקצה" section: "הרצת אותו נתיב פעמיים כשמערך השומרים מעורבב מחזירה תוצאה זהה" — ok. Real, unmodified `autoAssign()` imported and exercised end-to-end against 5 materialized template rows; only qualified guards selected. |
| 4 | 4. POS-05 · משתתף שמשויך לעמדה מבין מהמסך שהוא כשיר לה ולא שהוא עובד בה השבוע — שתי רשימות נפרדות ומסומנות אחרת | ✓ VERIFIED (code + unit level; visual/perceptual confirmation is a human-verification item below) | `PositionsScreen.jsx`'s `PositionCard` calls `qualifiedGuardsForPosition(p, guards)` and `workingGuardIdsForWeek(p, {shifts, tasks}, sundayISO)` — two different pure functions over two different source fields (`qualifiedCategories` vs. `assignedGuards`/`assignees`), never one derived from the other. Four independent channels present in source: distinct `t()` headings (`positions.qualified`/`positions.working`), distinct icons (`name="key"` vs `name="calendar"`), distinct item shape (bordered chip vs. filled row with dates), distinct per-item text (qualification suffix vs. work date). Mirrored in `GuardApp.jsx`'s `positions.mine` block (read-only, no button, no date, `Icon name="key"`). `npm test` POS-05 section proves the two lists are field-independent at the pure-function layer (3/3 ok). |
| 5 | POS-03 · שורה שבועית זהותה היא `(positionId, date)` בלבד, נגזרת אך ורק מיום ראשון של שבוע היעד | ✓ VERIFIED | `grep -vE '^\s*(//|\*|/\*)' src/lib/positions.js \| grep -cE 'Math\.random\|Date\.now\|new Date\(\|todayISO\('` = 0 — no wall-clock/randomness dependency in the pure module. `npm test` POS-03 section: exact 5 dates, stable across 3 repeated calls, same offset for past and future weeks, weekly-shape returns exactly `addDays(sunday,6)` (4/4 ok). |
| 6 | D-02/D-04 · `autoAssign()`/`isQualified()` consumed unmodified | ✓ VERIFIED | `git log --oneline -- src/lib/autoAssign.js src/lib/fairness.js` shows no commits since Phase 3 (last touch `9b5ca51`, pre-dating Phase 4). `src/lib/positions.js` imports `isQualified` from `./autoAssign.js` and uses it unmodified. |
| 7 | Prohibition · new table shipped with RLS in the same migration; FK uses `on delete set null`, never `cascade` | ✓ VERIFIED | `supabase/migrations/0007_standing_positions.sql`: `create table` → `enable row level security` → 2× `create policy`, all in one file. `grep -c 'on delete set null'` = 2, `grep -c 'on delete cascade'` = 0 for `references gs_positions(id)`. |
| 8 | Prohibition · D-05 boundary: no rolling multi-week board view built in this phase | ✓ VERIFIED | `grep -ri "BOARD-02" src/` returns no matches. `PositionsScreen.jsx` shows only the current week's two lists; no forward-looking schedule view exists in the new files. |

**Score:** 8/8 code-and-unit-test-layer truths verified. 1 additional live-backend reliability question and 4 plan-documented visual/UAT checks are routed to human verification below (none of these are FAILED — they are unresolved by static/programmatic means).

### Live-Backend Reliability Finding (the reason this is not `passed`)

04-01-SUMMARY.md's "Post-Merge Finding" claims migration `0009_positions_rls_use_helpers.sql` fully resolves the `gs_positions` RLS regression, backed by a live browser regression test. The verifier independently re-ran the phase's own designated backend-proof command three times against the live project (`biauxcgphdhwewszupsq`), with pauses between runs to control for the already-documented rate-limit flakiness in `deferred-items.md`:

| Run | Spacing | `standing positions (gs_positions)` result |
|-----|---------|---------------------------------------------|
| 1 | (cold) | 4/8 failed: guard read of `gs_positions` → `permission denied for function gs_my_team`; first position-tagged shift insert, `ignoreDuplicates` no-op, and row-count check all failed with `new row violates row-level security policy for table "gs_shifts"` |
| 2 | +20s | Broader cascading failures across unrelated sections too (rate-limit noise per `deferred-items.md`); positions section also failed |
| 3 | +60s | 4/8 failed: same signature as Run 1 |
| 4 | +45s | 3/8 failed: guard read still failed with the same `permission denied for function gs_my_team`; shift insert passed this time; `ignoreDuplicates`/row-count still failed |

`guard can read their own team's position` failed in **every** run, always with the identical error (`permission denied for function gs_my_team`).

**Isolated counter-evidence:** a minimal from-scratch reproduction (fresh supervisor + fresh guard, no prior traffic) exercising the exact same sequence — insert position as supervisor → read as guard → insert position-tagged shift → verify unique-index rejection and `ignoreDuplicates` no-op — passed cleanly and completely, twice in a row, against the same live database and the same migration state. This confirms the SQL in `0009_positions_rls_use_helpers.sql` is logically sound and does work.

**Working theory (not confirmed):** `scripts/verify-backend.mjs` creates `guardA`'s session near the start of the script (`persistSession:false, autoRefreshToken:false`) and reuses it ~9 sections and many awaited network round-trips later in the `standing positions` section — the first place a function-based (`gs_my_team()`) RLS policy is exercised by that stale session. This looks like a test-harness artifact (token/connection staleness under a long, un-refreshed script run) rather than a defect a real browser session (which does auto-refresh tokens) would hit. It could not be confirmed with certainty from static analysis, and it is exactly the kind of thing the plan's own acceptance bar (`npm run test:backend` prints ok on this section) is meant to catch — which it currently does not do reliably.

This is reported as a human-verification item rather than a hard gap, because the underlying mechanism (the migration content, and its behavior under a clean, isolated live test) is demonstrably correct — but the discrepancy between the SUMMARY's claimed 8/8 pass and three fresh, independent 4-8/8-fail runs is real and needs a human decision (accept as pre-existing harness flakiness vs. harden the script) before this is called solid.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0007_standing_positions.sql` | `gs_positions` table, RLS, FK columns, unique indexes | ✓ VERIFIED | Present, matches spec (table/RLS/FK/index all in one file) |
| `supabase/migrations/0008_positions_index_fix.sql` | Non-partial index fix (deviation, documented) | ✓ VERIFIED | Present; documented rationale in 04-01-SUMMARY.md matches content |
| `supabase/migrations/0009_positions_rls_use_helpers.sql` | RLS rewrite using `gs_my_team()`/`gs_is_supervisor()` | ✓ VERIFIED (content); ⚠️ reliability uncertain live (see above) | Content matches the described fix exactly |
| `src/lib/positions.js` | Pure module: `expectedDatesForWeek`, `plannedRowsForWeek`, `missingRowsForWeek`, `qualifiedGuardsForPosition`, `workingGuardIdsForWeek` | ✓ VERIFIED | All five exported; no wall-clock/randomness; imports `isQualified` unmodified |
| `src/lib/api.js` | `positionFromRow`/`positionToRow`, CRUD, `materializeTemplateShifts`, `positions` in `loadTeam` | ✓ VERIFIED | All present (src/lib/api.js:124-146, 311, 348, 686-733); `MIGRATION_HINT` names `0009` as latest |
| `src/hooks/useGuardian.js` | `positions: []` in `EMPTY`, 4 actions | ✓ VERIFIED | Present (lines 45, 684-720); `useMemo` deps unchanged (`[run, optimistic, deferred, refresh]`) |
| `scripts/verify-positions.mjs` | New standalone test wired into `npm test` | ✓ VERIFIED | Present; `npm test` runs it as the third script, all checks `ok`, exit 0 |
| `src/components/supervisor/PositionsScreen.jsx` | Form + list + two POS-05 lists | ✓ VERIFIED | Present, default export, all must-have behaviors confirmed by code read |
| `src/components/SupervisorApp.jsx` | Nav item, view wiring, `ensurePositionsForWeek` effect | ✓ VERIFIED | All three present |
| `src/components/GuardApp.jsx` | Read-only `positions.mine` block | ✓ VERIFIED | Present in `MySchedule`, no button/date, renders nothing when empty |
| `src/lib/terms.js` | 6 new keys + army overrides | ✓ VERIFIED | All present; `nav.positions`/`positions.working` overridden in `army`, others intentionally not (per plan's own instruction not to over-override) |
| `src/components/supervisor/views.jsx` | `categoryOptions` exported | ✓ VERIFIED | `export const categoryOptions` present, body unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `position.category` | `isQualified()` | direct import, no new qualification concept | ✓ WIRED | `src/lib/positions.js` imports and calls `isQualified` from `autoAssign.js` unmodified |
| `gs_shifts.position_id` row | `autoAssign()` | no special-casing | ✓ WIRED | `npm test` D-02 e2e section proves real `autoAssign()` fills template rows unmodified |
| `(position_id, date)` unique index | `upsert(..., {onConflict, ignoreDuplicates:true})` | idempotency | ✓ WIRED (unit); ⚠️ reliability uncertain in one live-script run mode (see above) | Confirmed via unit tests and an isolated live reproduction; not reliably reproducible via `npm run test:backend` as currently written |
| `loadTeam` → `positions` | `useGuardian` data spread | every screen that consumes positions | ✓ WIRED | `positions: (posRes.data \|\| []).map(positionFromRow)` in `loadTeam`; spread into hook's returned `data` |
| `weekDates[0]` | `actions.ensurePositionsForWeek` | week-change trigger | ✓ WIRED | `useEffect` in `SupervisorApp.jsx` keyed on `[weekDates[0], actions]` |
| `qualifiedGuardsForPosition` / `workingGuardIdsForWeek` | `PositionsScreen.jsx` / `GuardApp.jsx` | two distinct render paths | ✓ WIRED | Confirmed by direct source read; both functions called with correct arguments in both files |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `PositionsScreen.jsx` position list | `positions` prop | `useGuardian()` → `loadTeam` → `gs_positions` query | Yes | ✓ FLOWING |
| `PositionCard` qualified list | `qualified` | `qualifiedGuardsForPosition(p, guards)` over live `guards` state | Yes | ✓ FLOWING |
| `PositionCard` working list | `working` | `workingGuardIdsForWeek(p, {shifts, tasks}, sundayISO)` over live `shifts`/`tasks` state | Yes | ✓ FLOWING |
| `GuardApp.jsx` `positions.mine` block | `myPositions` | `positions.filter(...)` over live `positions` state, same `qualifiedGuardsForPosition` | Yes | ✓ FLOWING |

No hardcoded/mock data found in any rendered list — confirmed by anti-pattern scan below.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm test` full suite | `npm test` | All sections print `ok`, exit code 0 (includes QUAL-01..03, POS-01..05, D-02 e2e, round-trip mapping) | ✓ PASS |
| `npm run build` | `npm run build` | Vite build succeeds, no errors | ✓ PASS |
| Isolated live RLS/idempotency reproduction | ad-hoc script mirroring `verify-backend.mjs`'s `gs_positions` section, run against the live project with a fresh supervisor+guard | Supervisor inserts position and reads it back; guard reads own-team position; guard blocked from creating a position; supervisor inserts a position-tagged shift; duplicate insert rejected; `ignoreDuplicates` upsert is a clean no-op — all passed twice in a row | ✓ PASS |
| `npm run test:backend` (designated phase-level proof command) | `npm run test:backend`, ×4 with varying spacing | `standing positions` section: 1 check (`guard can read their own team's position`) failed in all 4 runs; 0-3 additional checks failed intermittently | ✗ FAIL (reliability concern — see Live-Backend Reliability Finding) |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` files and does not declare probe-based verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| POS-01 | 04-01, 04-02 | מנהל מגדיר עמדה שנכנסת לכל שבוע אוטומטית | ✓ SATISFIED (code); ⚠️ backend live-proof reliability flagged | See Truth #1 and Live-Backend Reliability Finding |
| POS-02 | 04-01, 04-02 | שיוך אדם לעמדה מצהיר כשירות, לא שיבוץ | ✓ SATISFIED | No write path for "assigning" a guard to a position exists anywhere in the codebase; `qualifiedGuardsForPosition` is read-only |
| POS-03 | 04-01 | מזהים דטרמיניסטיים לשורות השבועיות | ✓ SATISFIED | See Truth #5 |
| POS-04 | 04-01 | הרצה חוזרת ללא כפילויות | ✓ SATISFIED (unit + isolated live); ⚠️ full-suite live-proof reliability flagged | See Truth #2 and Live-Backend Reliability Finding |
| POS-05 | 04-02 | "מי כשיר" נפרד מ"מי עובד בה השבוע" | ✓ SATISFIED (code + unit); visual/perceptual confirmation pending | See Truth #4 |

**Orphaned requirements check:** `.planning/REQUIREMENTS.md` maps exactly POS-01 through POS-05 to Phase 4; all five appear in the two plans' `requirements` frontmatter (04-01: POS-01..04; 04-02: POS-01, POS-02, POS-05). No orphaned requirements found.

### Anti-Patterns Found

None. Scanned all phase-modified files (`positions.js`, `api.js`, `useGuardian.js`, `PositionsScreen.jsx`, `SupervisorApp.jsx`, `GuardApp.jsx`, `terms.js`, all three migrations) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns — no matches beyond ordinary HTML `placeholder=` input-hint attributes (not stub markers). No `console.log`-only implementations, no hardcoded empty-return stubs feeding rendered output.

### Human Verification Required

See frontmatter `human_verification` for full detail. Summary:

1. **Live-backend reliability of the `gs_positions` RLS fix** under the phase's own designated proof command (`npm run test:backend`) — reproducibly fails on 1 (sometimes up to 4) of 8 checks across 4 independent runs, despite a clean pass in an isolated reproduction. Needs a human decision: accept as pre-existing harness flakiness (extend `deferred-items.md`), or harden `scripts/verify-backend.mjs`.
2. **04-01 Task 3 human-check** (position → materialized shifts → repeat-run no-op), partially covered by the orchestrator's Post-Merge regression test but not the full original script.
3. **04-02 Task 1 human-check** (dev-server click-through: define position, switch weeks, confirm no duplicates), recorded `not_run` in 04-02-SUMMARY.md.
4. **04-02 Task 2 human-check** (greyscale/hand-covering perceptual test for the two-list distinction), recorded `not_run`.
5. **04-02 Task 3 human-check** (naive-reader comprehension test for the guard-side "qualified, not scheduled" block), recorded `not_run` — this is the phase's core anti-confusion test (ROADMAP Success Criterion 4).

### Gaps Summary

No code-level gaps. All artifacts exist, are substantive, are wired, and their data flows are live (not mocked). All unit tests (`npm test`) and the build pass cleanly. `autoAssign.js`/`fairness.js` are provably unmodified. RLS/FK/index migration content matches the spec exactly, including the Post-Merge RLS fix's SQL content.

The reason this report is `human_needed` rather than `passed` is a **discrepancy between SUMMARY claims and independently reproduced evidence**: 04-01-SUMMARY.md's Post-Merge Finding claims the `0009` migration was "verified live" with an 8/8 clean `npm run test:backend` pass, but the verifier's own four independent runs of that exact command each showed at least one failure in the `gs_positions` section, always the same `guard can read their own team's position` check. A clean isolated reproduction of the identical logic suggests the underlying fix is sound and this is most likely a pre-existing test-harness artifact rather than a functional regression — but that conclusion could not be confirmed with certainty, and per this verifier's mandate not to accept a claimed live-test pass without independent reproduction, this is surfaced for a human decision rather than silently waved through or silently failed.

---

*Verified: 2026-08-30*
*Verifier: Claude (gsd-verifier)*
