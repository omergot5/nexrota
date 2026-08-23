# Phase 1: כיול ההוגנות — Research

**Researched:** 2026-08-21
**Domain:** Recalibrating a deterministic, pure-JS scheduling engine's fairness metric from shift-count units to weighted-load units, across the engine, the admin screen, the participant screen, and PWA cache invalidation.
**Confidence:** HIGH — every claim in this document is grounded in a direct `Read` of the five source files listed below (`autoAssign.js`, `fairness.js`, `GuardApp.jsx`, `SmartAssign.jsx`, `public/sw.js`, `verify-scheduler.mjs`, `verify-planning.mjs`, `dates.js`, `tokens.css`) plus the project's own prior pitfalls research (`PITFALLS.md` Pitfalls 6–7). No external library research was needed or performed: this phase touches zero third-party packages — it is a pure arithmetic/logic recalibration inside code that already exists and already ships.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

| הכרעה | נימוק |
|---|---|
| נטל הוא המדד היחיד להוגנות | שקיפות שמדווחת מספר שגוי גרועה מאי-שקיפות — היא קונה אמון שאינה יכולה לכבד |
| המקדמים נגזרים מחדש, לא מוחלפים | `gapSize < 2` ו-`× 15` כוילו ליחידות של **ספירת משמרות**. בנטל הסולם שונה לגמרי |
| המשתתף רואה את אותו מספר שהמנוע חילק לפיו | `shiftLoad()` היא יחידת ההוגנות היחידה במוצר |
| דטרמיניזם מוחלט | אין `Math.random()`, אין תלות בשעון ובסדר שורות מה-DB |

### Design constraints — mandatory, not advisory (from 01-CONTEXT.md)

Phase 1 touches two screen surfaces: the supervisor's fairness score (FAIR-02) and the participant's fairness row (FAIR-05). Both are fully subject to the design system:

- **Every colour goes through a token in `src/design/tokens.css`. A component never names a colour** (`blue-600`, `#4C9585`) **— only a role** (`brand`, `warn`). A new hex value in a component file is a bug.
- **WCAG AA (4.5:1) on all text.** Verified token contrast ratios (read directly from `src/design/tokens.css`, light theme, `:root`):
  - `--text: 28 59 55` (`#1C3B37`) — comment states 11.0:1
  - `--text-muted: 74 106 100` (`#4A6A64`) — comment states 5.4:1
  - `--text-faint: 86 115 108` (`#56736C`) — comment states 4.7:1
  - `--brand: 46 115 101` (`#2E7365`) — comment states "4.7:1 על הקרם, 5.6:1 על לבן"
  - `--brand-strong: 30 91 80` (`#1E5B50`) — comment states 7.9:1
  - `--warn: 158 88 6` — comment states 5.1:1
  - `--danger: 176 42 33` — comment states 5.9:1
  - **Trap:** `--brand-soft: 76 149 133` (`#4C9585`, logo turquoise) is 3.5:1 — decoration only (gradients, glows, chip fills). **Never under text.** Same rule for `--mint: 128 198 181`.
- **Critical status is never colour alone.** A "above average" / "needs more" tag must carry text or shape too. This is already the pattern in `fairnessHint()` — it returns `{tone, text}`, never `tone` alone. Preserve it.
- Two display modes (light "cream", dark "forest") get equal finish; light is default.
- Opaque colours are stored as space-separated RGB channels so Tailwind's `bg-brand/20` works; glass surfaces are stored as finished `rgba()` — their alpha *is* the design.
- Radii 12–16px, white cards on cream, full RTL.
- Typography: Assistant/Rubik/Heebo for Hebrew.

### Claude's Discretion

Not explicitly separated from Locked Decisions in 01-CONTEXT.md — the whole document reads as locked (it was derived from `PROJECT.md`/`REQUIREMENTS.md`/code, not a `discuss-phase` session, per its own header: "לא הורץ discuss-phase"). Treat all of the above as locked. The one area with genuine latitude, per the phase's own framing, is the **exact numeric derivation** of the two constants (§FAIR-03) — the CONTEXT explicitly asks that they be re-derived from the roster rather than specifies what number to use.

### Deferred Ideas (OUT OF SCOPE)

- לא נוגעים במשקלי `LOAD_WEIGHTS` עצמם (night 1.4 / weekend 1.25) — הם נכונים, רק לא מיושמים בכל מקום.
- לא מפצלים את `useGuardian.js`.
- לא מוסיפים כשירויות, שעות למשימות, או עמדות — אלה פאזות 2–4.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FAIR-01 | מעבר האיזון מעביר משמרת מהעמוס לפנוי לפי **נטל**, ולא לפי ספירת משמרות | §Standard Stack / §Code Examples — exact `balanceWorkload` sort-key and `gapSize`→`gapLoad` change identified at `src/lib/autoAssign.js:522-532` |
| FAIR-02 | ציון ההוגנות שהמנהל רואה על המסך מחושב מנטל, ולא מספירת משמרות | §Code Examples — `buildResult`'s `perGuard`/`fairnessScore` at `src/lib/autoAssign.js:616-643`; consuming UI at `src/components/SmartAssign.jsx:359-365` and `:433-460` |
| FAIR-03 | סף העצירה (`gapSize < 2`) ומקדם השונות (`× 15`) נגזרים מחדש ליחידות נטל | §Common Pitfalls Pitfall A — full arithmetic derivation with the phase's own repro numbers |
| FAIR-04 | `npm test` נכשל אם ציון ההוגנות המדווח סותר את פיזור הנטל בפועל | §Validation Architecture — independent-recomputation test pattern, matches existing `check()`/`ok`/`FAIL` shape in `scripts/verify-scheduler.mjs` |
| FAIR-05 | המספר שהמשתתף רואה בשורת ההוגנות שלו הוא אותו מספר שהמנוע חילק לפיו | §Architecture Patterns — `GuardApp.jsx`'s `FairnessLine` already reads `teamAverages(...).load`, which already calls the same `shiftLoad()`; documented as **already-correct, needs a pinning test, not a rewrite** |
| FAIR-06 | גרסת ה-service worker מוגדלת בשחרור | §Code Examples — `public/sw.js:20` `VERSION` constant identified as the exact lever |
</phase_requirements>

## Summary

The defect is real and precisely as `01-CONTEXT.md` describes: `src/lib/autoAssign.js` computes the correct load-weighted number (`shiftLoad()`, exported, used everywhere it *should* be used — `scoreCandidate`'s fairness dimension, `fairness.js`, `teamAverages()`) but two places still measure and report **shift count**: `balanceWorkload`'s guard-ranking (`load.get(id).count`, line 524) and `buildResult`'s `fairnessScore` (built from `perGuard.map(p => p.shifts)`, lines 633–642). `01-CONTEXT.md`'s own repro (3 nights, 5 mornings, 4 guards → reported `fairnessScore: 100, spread: 0` while real load ranges 16.0–19.2) is exactly reproducible from the code: with 8h shifts, a night = 11.2 load and a morning = 8.0 load, and a roster where one guard takes 2 mornings (load 16.0, count 2) while three guards each take 1 night + 1 morning (load 19.2, count 2) produces **identical counts (2 each) but divergent load** — the textbook case this whole phase exists to catch (worked arithmetic in §Common Pitfalls).

The fix is not a `.count`→`.load` token swap (Pitfall 6, already flagged in the project's own `PITFALLS.md`). Both constants must be re-derived in load units, and the correct anchor for that derivation is a value the codebase **already computes**: `perShiftLoad` — the roster's own mean load-per-shift, which `fairness.js`'s `fairnessPlan()` already calculates the same way (`all.reduce((a,s)=>a+shiftLoad(s),0)/all.length`). Deriving both constants as a function of `perShiftLoad` rather than as new hardcoded numbers means the recalibration self-adjusts to any team's actual shift-type mix, and is exactly analogous to how `fairness.js` already avoids inventing "a fake shift of weight 1" when translating a load deficit back into a shift count (`needs: Math.round(deficit / (perShiftLoad || 1))`, `fairness.js:102`).

One finding changes the shape of the plan: **FAIR-05 is very likely already satisfied.** `GuardApp.jsx`'s `FairnessLine` component (the participant's fairness row) does not read anything from `autoAssign.js`'s broken `fairnessScore`/`perGuard.shifts` — it computes its own numbers via `teamAverages(guards, publishedAll)` (`GuardApp.jsx:141-144`), and `teamAverages()` (`autoAssign.js:768-795`) already sums `shiftLoad(s)` per guard and displays it as the "נטל" row (`GuardApp.jsx:100`). This is structurally guaranteed to stay in sync with the engine because both paths import the same `shiftLoad` from the same file — there is no second formula to diverge. FAIR-05's real work is a **pinning test**, not new code, unless the planner finds during implementation that some other participant-facing surface also claims to show fairness (none was found in this research — `GuardApp.jsx`/`fairness.js`/`views.jsx` are the only three files in the repo that import `fairnessHint`/`fairnessPlan`/`teamAverages`).

**Primary recommendation:** Re-derive `gapSize`'s stopping threshold and `fairnessScore`'s variance coefficient both as functions of `perShiftLoad` (computed once per `autoAssign()` call, the same way `fairness.js` already does it) — `gapThreshold = perShiftLoad × 0.5` and `fairnessCoefficient = 15 / perShiftLoad` — add `load` to `buildResult`'s `perGuard` rows, and add a self-checking test to `scripts/verify-scheduler.mjs` that independently recomputes the expected `fairnessScore` from `perGuard[].load` and asserts it equals `summary.fairnessScore`, so any future edit that reintroduces a count/load unit mismatch fails `npm test` by construction (this is what FAIR-04 is actually asking for — not a fixture pinned to one magic number, but a structural check that can never silently drift).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Load computation (`shiftLoad`) | Browser / Client (pure JS module) | — | Already correct, already exported; no tier change, just wider use within the same tier |
| Balance-pass guard selection (FAIR-01) | Browser / Client (`autoAssign.js`) | — | Pure function, no I/O; runs entirely in-browser as part of the PWA bundle |
| Fairness score computation (FAIR-02/03) | Browser / Client (`autoAssign.js`) | — | Same module; the score is a derived statistic over in-memory `load` state, never touches the network |
| Admin fairness display | Browser / Client (React, `SmartAssign.jsx`) | — | Renders `plan.summary.fairnessScore`/`plan.fairness.perGuard` computed client-side; no SSR in this app |
| Participant fairness row | Browser / Client (React, `GuardApp.jsx`) | — | Reads `teamAverages()`, itself pure client-side |
| Regression tests (FAIR-04) | Browser / Client (Node script, not a browser runtime, but same source tree) | — | `scripts/verify-scheduler.mjs` imports the engine directly and runs under plain `node`, no test framework, no DOM |
| Cache invalidation (FAIR-06) | CDN / Static delivery (service worker) | Browser / Client (the SW itself runs in a browser-hosted worker context) | `public/sw.js` controls which bundle version a given browser serves; this is the only capability in the phase that is *not* a pure-function change — it's a deploy-time cache-versioning action |

No capability in this phase touches API/Backend or Database/Storage tiers — confirmed by `Grep` across `src/lib/autoAssign.js` and `src/lib/fairness.js`: neither imports `fetch`, `supabase`, or anything from `src/lib/api.js`. This matches the "engines are pure" iron constraint from `CLAUDE.md`.

## Standard Stack

Not applicable in the conventional sense — this phase adds no dependency. Confirmed: `package.json`'s `dependencies` are `@supabase/supabase-js`, `react`, `react-dom`, `recharts`; `devDependencies` are Vite/Tailwind/PostCSS/autoprefixer/`@vitejs/plugin-react`. None of these are touched by a fairness-formula recalibration. `npm test` runs two standalone Node scripts (`scripts/verify-scheduler.mjs && scripts/verify-planning.mjs`) with **no test runner** — there is no Jest, no Vitest, and the plan must not introduce one (`CLAUDE.md`, `01-CONTEXT.md` both state this explicitly).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deriving `gapThreshold`/`fairnessCoefficient` from `perShiftLoad` (roster-relative) | A fixed load-unit constant (e.g. "stop once gap < 5.0 load") | Fails on a team whose shifts are mostly 4h (perShiftLoad ≈ 4–6) vs. mostly 12h nights (perShiftLoad ≈ 14–17) — a fixed constant is either too loose for short-shift teams or too strict for long-shift ones. Roster-relative scaling is what `fairness.js` already does for the identical problem (`perShiftLoad`), so this is precedent, not a new idea. |
| Recomputing `fairnessScore` from `perGuard[].load` independently in the test (FAIR-04) | Pinning the test to one hardcoded expected number for one fixture | A pinned number only catches "the formula changed"; it does not catch "the formula still measures the wrong unit but happens to produce a plausible number for this one fixture" — exactly the failure mode Pitfall 6 warns about. Recomputing from the reported `load` values checks the *relationship*, not a snapshot. |

**Installation:** none — no new packages for this phase.

## Package Legitimacy Audit

Not applicable. This phase installs zero external packages (verified: no `package.json` diff is implied by any requirement FAIR-01…06; all six requirements are satisfied by editing `src/lib/autoAssign.js`, `scripts/verify-scheduler.mjs`, `src/components/SmartAssign.jsx` (display only), and `public/sw.js`). The Package Legitimacy Gate is skipped per its own trigger condition ("whenever this phase installs external packages").

## Architecture Patterns

### Recommended Change Map
```
src/lib/autoAssign.js
├── balanceWorkload()      # FAIR-01, FAIR-03 — sort key .count → .load; gapSize → gapLoad vs. derived threshold
└── buildResult()          # FAIR-02, FAIR-03 — perGuard rows gain `.load`; fairnessScore derived from load variance

src/components/SmartAssign.jsx
└── "חלוקת העומס המוצעת"   # optional, see Pitfall B — currently renders p.shifts/p.count, mislabeled as load

public/sw.js
└── VERSION = "v1"          # FAIR-06 — bump at release; forces cache-key rotation via existing activate() cleanup

scripts/verify-scheduler.mjs
└── new "נטל (FAIR-04)" block  # FAIR-04 — extends the existing load-assertions block already present at line ~305
```

### Pattern: derive, don't hardcode (the whole phase in one line)

`fairness.js` already solves "how do I turn a load number into something roster-relative" — twice. Once for converting a load deficit into a shift-count recommendation (`needs`), and once implicitly via `perShiftLoad` itself:

```javascript
// Source: src/lib/fairness.js:82-87 (read this session)
// כמה "שווה" משמרת ממוצעת אצל הצוות הזה. בלי זה החוב היה מתורגם ליחידות
// מדומות שלא מתאימות לתמהיל האמיתי.
const all = [...history, ...planned];
const perShiftLoad = all.length
  ? all.reduce((a, s) => a + shiftLoad(s), 0) / all.length
  : 1;
```

This is the exact quantity Pitfall 6 in `PITFALLS.md` implicitly asks the planner to find: a roster-derived "what does one shift cost, on average, for *this* team" value that both the stopping threshold and the score coefficient should scale against, instead of a new invented magic number.

### Anti-Patterns to Avoid

- **Token substitution disguised as recalibration.** Changing `load.get(id).count` → `load.get(id).load` and `p.shifts` → `p.load` while leaving `gapSize < 2` and `× 15` untouched produces code that *looks* like the fix (small diff, `npm test` still exits 0 if the tests aren't updated) but is a different, unvalidated miscalibration — flagged explicitly as Pitfall 6 in this project's own prior research.
- **Pinning FAIR-04's test to one snapshot number.** A test asserting `fairnessScore === 87` for one fixture catches a regression in that one fixture's arithmetic but not a unit regression that happens to also produce a plausible-looking number. Recompute independently from `perGuard[].load` instead (see §Validation Architecture).
- **Treating the participant fairness row as needing a rewrite.** It already reads load (`teamAverages().load`, same `shiftLoad` import). Rewriting it risks *introducing* a divergent second formula where none exists today.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "What does one shift cost this team, on average" | A new constant, a config field, or a second average-shift calculation local to `autoAssign.js` | The same `perShiftLoad` computation `fairness.js` already uses (`all.reduce((a,s)=>a+shiftLoad(s),0)/all.length`) | Two independently-maintained "average shift" numbers in the same product is precisely the kind of drift this phase exists to eliminate — mirror the existing one, don't parallel-invent a second |
| Verifying formula honesty | A snapshot/fixture test with a hardcoded expected score | Independent recomputation from the same `perGuard[].load` values the engine itself reports (property-style check) | A snapshot only proves "this one number didn't change"; recomputation proves "the reported score is actually derivable from the reported load data," which is what FAIR-04 literally asks for |

**Key insight:** there is nothing to hand-roll in this phase — every building block the fix needs (`shiftLoad`, `perShiftLoad`'s derivation pattern, the `check()`/`ok`/`FAIL` test harness) already exists in the codebase. The risk in this phase is not "missing a library," it's "re-deriving the same wrong shortcut Pitfall 6 already named."

## Common Pitfalls

### Pitfall A: The two constants are calibrated to a different unit than the one you're about to feed them

**What goes wrong:** `gapSize < 2` in `balanceWorkload` (line 532) and `× 15` in `buildResult`'s `fairnessScore` (line 642) were tuned against integer shift *counts*. Feeding them `load` values (floats roughly in the 8–17 range per shift, per `shiftHours(shift) * LOAD_WEIGHTS[...]`) without rescaling produces a threshold that's off by roughly an order of magnitude in each direction — `gapSize < 2` in load units means "stop once nobody is more than 2 *load-hours* ahead," which is under 20% of a single average shift, an unreasonably tight bar that will make the balance loop attempt many more passes than before (risking the `balancePasses: 40` ceiling); `× 15` applied to load-unit variance (which is numerically much larger than count-unit variance, since load values are 8–17 vs. counts of 0–6) will make `fairnessScore` collapse toward 0 for even mild real imbalance.

**Full worked arithmetic on the phase's own repro case** (3 nights, 5 mornings, 4 guards — from `01-CONTEXT.md`):

Assume 8-hour shifts (this reproduces the CONTEXT numbers exactly): `shiftLoad(morning) = 8h × 1.0 = 8.0`, `shiftLoad(night) = 8h × 1.4 = 11.2` (weekday, non-weekend — `LOAD_WEIGHTS = { night: 1.4, weekend: 1.25, day: 1, default: 1 }`, `src/lib/autoAssign.js:66,80-86`, read this session).

Roster that produces the exact CONTEXT numbers:
- Guard A: 2 mornings → `count = 2`, `load = 2 × 8.0 = 16.0`
- Guards B, C, D: 1 night + 1 morning each → `count = 2`, `load = 11.2 + 8.0 = 19.2`

Totals: 3 nights + 5 mornings = 8 shifts ✓; every guard has `count = 2` (tied) ✓; loads are `16.0, 19.2, 19.2, 19.2` — matching `01-CONTEXT.md`'s "אחד נושא 16.0 נטל, שלושה נושאים 19.2" exactly.

**Today's formula (count-based):** `counts = [2,2,2,2]` → `variance = 0` → `fairnessScore = 100 - sqrt(0)×15 = 100`; `spread = max(2) - min(2) = 0`. This is the literal bug: the screen reports "perfect fairness" while a real 3.2-load gap exists.

**Re-derived formula, worked on this same roster:**

1. `perShiftLoad` — the roster's own mean load-per-shift, computed the same way `fairness.js:85-87` already computes it, over the 8 shifts actually scheduled: `(3×11.2 + 5×8.0) / 8 = (33.6 + 40.0) / 8 = 73.6 / 8 = 9.2`.

2. **`gapThreshold` for `balanceWorkload`'s stopping check** — proposed: `gapThreshold = perShiftLoad × 0.5 = 9.2 × 0.5 = 4.6`. Rationale for the `0.5` fraction: `balanceWorkload` moves exactly *one* shift per pass (`removeFromLoad`/`addToLoad`, `src/lib/autoAssign.js:554-558`), which changes the heaviest–lightest gap by `2 × shiftLoad(movedShift)` (heavy guard loses X, light guard gains X). Since real shift loads in this roster range 8.0–11.2, any single legal move changes the gap by 16.0–22.4 — far more than a 4.6 threshold — so the threshold's only real job is to stop the loop from attempting a move when the remaining gap is *already smaller than half of what any single swap could possibly move*, i.e. a move that could only overshoot and widen the gap the other way. On this roster: `gapLoad = 19.2 - 16.0 = 3.2`, which is **less than** `4.6` → the loop correctly does *not* attempt a swap. This is provably the right call here: the smallest available move (giving Guard A's morning to a B/C/D guard, or vice versa) changes the gap by at least `2 × 8.0 = 16.0`, which would blow *past* zero and re-create a gap in the other direction — there is no legal move that improves this particular roster, and the threshold correctly recognizes that.
   *(0.5 is the concrete number this research proposes; it is `[ASSUMED]` in the sense that no external source justifies "0.5" specifically — see §Assumptions Log. It is bounded on both sides by the reasoning above: too large and genuinely fixable gaps get skipped; too close to zero and the loop wastes passes on swaps that can only overshoot. The planner should pressure-test this with the regression tests in §Validation Architecture before locking it.)*

3. **`fairnessCoefficient` for `fairnessScore`** — proposed: `fairnessCoefficient = 15 / perShiftLoad = 15 / 9.2 ≈ 1.630`. Rationale: the original `15` meant "one full shift's worth of *count* standard deviation costs 15 points." To preserve that same qualitative meaning in load units — "one full *average* shift's worth of *load* standard deviation costs ~15 points" — divide the old constant by the load-per-shift conversion factor, `perShiftLoad`. This is dimensionally exact: `points = stdDev[load] × (points_per_shift / load_per_shift)`.

   Compute on this roster: `mean load = (16.0 + 19.2×3) / 4 = 73.6 / 4 = 18.4`. `variance = ((16.0-18.4)² + 3×(19.2-18.4)²) / 4 = ((-2.4)² + 3×(0.8)²) / 4 = (5.76 + 1.92) / 4 = 1.92`. `stdDev = √1.92 ≈ 1.386`. `fairnessScore = round(100 - 1.386 × 1.630) = round(100 - 2.26) = round(97.74) = 98`.

   **Result: `fairnessScore: 98`, not `100`.** The screen no longer claims perfect fairness. It also does not collapse to a misleadingly low number for what is, in load terms, a genuinely modest imbalance (17% below the mean for the lightest guard) — the person who avoided the night shift was in fact compensated with almost-equivalent extra day load, which is philosophically consistent with "load is the only fairness metric" (a locked decision): the *total burden* is close, even though *night-specific* rotation (a separate, softer concern already handled by `scoreCandidate`'s dedicated night-fairness dimension, `autoAssign.js:286-299`) is not this metric's job.

**Sanity check that the derivation doesn't saturate or collapse (§ the phase's own instruction to verify this):**
   - **Perfectly flat roster** (e.g. 4 nights + 4 mornings, 4 guards, each exactly 1 night + 1 morning): all loads `= 19.2`, `variance = 0` → `fairnessScore = 100`. Confirms the formula still reports a clean 100 for genuine flatness, not just for tied counts.
   - **Severe skew** (one guard carries all 8 shifts alone, three carry zero — same roster, `total load = 73.6`): `mean = 18.4`, `variance = ((73.6-18.4)² + 3×(0-18.4)²)/4 = (3047.04+1015.68)/4 = 1015.68`, `stdDev ≈ 31.87`, `fairnessScore = round(100 - 31.87×1.630) ≈ round(48.05) = 48`. Distinctly below the flat case, distinctly above 0 — the formula has real dynamic range and does not collapse.
   - **Cross-check against the pre-recalibration formula:** when all shifts in a roster carry equal load (the special case where load-count and shift-count are proportional), the re-derived formula is numerically identical to the original — e.g. the severe-skew case above, translated to shift counts (8 shifts, one guard holds all 8, three hold 0), gives `mean=2`, `variance=12`, `stdDev≈3.464`, old-formula `score = round(100 - 3.464×15) = round(48.04) = 48` — matching the load-based result exactly. This is strong internal evidence the re-derivation is unit-consistent, not an accidental new curve shape.

**Why it happens:** the diff for a naive fix is genuinely tiny (`.count` → `.load`, `.shifts` → `.load`), which reads as "obviously correct" — but the surrounding constants were tuned by feel against a completely different numeric scale and don't travel with the rename. `PITFALLS.md`'s Pitfall 6 already documents this exact trap for this exact phase.

**How to avoid:** derive both constants from `perShiftLoad`, as shown above; add the FAIR-04 recomputation test (§Validation Architecture) so any future edit that reverts to hardcoded, unscaled constants fails `npm test` rather than merely "looking done."

**Warning signs:** the diff touches only `.count`/`.shifts` tokens with `2` and `15` left as literal numbers; `balancePasses` starts hitting the 40-iteration cap on rosters that converged in a handful of passes before the change; `fairnessScore` values cluster near 0 or near 100 far more often than the pre-change distribution did, on the same kinds of rosters.

### Pitfall B: The admin "load breakdown" widget is already mislabeled — this phase's own screen has a second, smaller version of the same bug

**What goes wrong:** `SmartAssign.jsx`'s "חלוקת העומס המוצעת" ("proposed load distribution") card (`src/components/SmartAssign.jsx:433-460`) is *named* load but *renders* shift count: the `Meter` uses `value={p.shifts}` / `max={plan.fairness.max}` (both count-based), and the caption text reads `"{p.shifts} משמרות · {p.nights} לילות · {p.hours} ש'"` — hours are shown, but not load. Once `buildResult`'s `perGuard` rows gain a `.load` field (needed for FAIR-02 anyway), this widget is one field-rename away from actually matching its own label. It is not named in FAIR-01…06 individually, but it sits on the exact screen FAIR-02 targets ("ציון ההוגנות שהמנהל רואה על המסך") and the phase's own goal line is "נטל, בכל מנוע **ובכל מסך**" (load, in every engine **and every screen**).

**Why it happens:** the widget was built when `count` was the only fairness signal available; nobody revisited its label when `shiftLoad()` was introduced elsewhere in the same file.

**How to avoid:** once `perGuard[].load` exists (needed for FAIR-02's score itself), switch this Meter's `value`/`max` to `p.load`/`max(...loads)` and add the load number to the caption. This is a small, contained change using the same `Meter` component already in use (`src/components/ui.jsx:292`, takes plain numeric `value`/`max`, no interface change required) and the same design tokens already applied via `guardColor(p.guardId)`.

**Warning signs / verification:** if the plan ships FAIR-02 (score fix) without touching this widget, a supervisor will see a correct 98% "ציון הוגנות" KPI directly above a "חלוקת העומס" breakdown still ranked and sized by shift count — internally inconsistent on one screen. Flag this to the planner as in-scope-by-the-phase's-own-stated-goal, not as scope creep; final call belongs to the plan, not this research.

### Pitfall C (inherited from PITFALLS.md #7, re-verified against `public/sw.js` this session): stale cache serves the old formula next to the new one

**What goes wrong:** `public/sw.js` computes cache namespaces from a single `VERSION` constant (`const VERSION = "v1"; const SHELL = \`shell-${VERSION}\`; const ASSETS = \`assets-${VERSION}\`;`, lines 20-22, read this session). The `activate` handler already deletes any cached key that doesn't match the current `SHELL`/`ASSETS` names (lines 24-32), and `install` already calls `self.skipWaiting()` (line 20 region) while `activate` calls `self.clients.claim()` (line 30) — so the *mechanism* for forcing a stale client onto the new bundle already exists and is already correct. **The only failure mode is forgetting to bump `VERSION` as part of this phase's commit.** If `VERSION` stays `"v1"`, a browser with the old bundle cached under `shell-v1`/`assets-v1` will keep matching those same cache keys after a fetch of `/` (network-first for navigations) succeeds and re-populates the *same* cache name with new content — but any tab that doesn't get a fresh navigation fetch (e.g. one that's merely resumed from a service-worker-served offline state) can keep running old, cached JS that computes the pre-recalibration formula, while a colleague's freshly-loaded tab computes the new one, for the identical underlying roster.

**How to avoid:** bump `VERSION` (e.g. `"v1"` → `"v2"`) in the same commit/PR that ships the formula change. This is a one-line, deploy-adjacent change — the existing `activate` cleanup logic requires no further code change to do the right thing once the version string changes. No new mechanism needs to be built.

**Verification:** this is not unit-testable by a Node script (it requires actual Cache Storage / Service Worker behavior in a browser). Per `CLAUDE.md`'s Iron Principle 6 ("אימות בדפדפן — 'עובד' נאמר רק אחרי שראית את זה עובד"), this must be a manual browser verification step: load the app, confirm the SW registers under the new cache names (DevTools → Application → Cache Storage), and confirm no `shell-v1`/`assets-v1` entries survive an `activate` cycle. Document this as a manual-only Validation Architecture item, not skip it.

## Code Examples

### FAIR-01 + FAIR-03: `balanceWorkload`'s guard-selection and stopping condition

```javascript
// Source: src/lib/autoAssign.js:518-532 (current — read this session)
function balanceWorkload({ openShifts, activeGuards, availability, rules, stats, load, assignments, byShift }) {
  const moves = [];
  const shiftById = new Map(openShifts.map((s) => [s.id, s]));

  for (let pass = 0; pass < rules.balancePasses; pass++) {
    const sorted = [...activeGuards].sort((a, b) => {
      const d = load.get(a.id).count - load.get(b.id).count;        // FAIR-01: count-based
      return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
    });
    const lightest = sorted[0];
    const heaviest = sorted[sorted.length - 1];
    if (!lightest || !heaviest) break;

    const gapSize = load.get(heaviest.id).count - load.get(lightest.id).count; // count-based
    if (gapSize < 2) break; // FAIR-03: uncalibrated for load units
    // ...
```

Proposed direction (illustrative — not a mandated diff; the planner owns the exact implementation):

```javascript
// perShiftLoad computed once, before the pass loop — same derivation fairness.js
// already uses (src/lib/fairness.js:85-87), so there is exactly one formula for
// "what does an average shift cost this team" in the whole codebase.
const perShiftLoad = openShifts.length
  ? openShifts.reduce((sum, s) => sum + shiftLoad(s), 0) / openShifts.length
  : 1;
const gapThreshold = perShiftLoad * 0.5; // see PITFALLS.md #6 derivation, RESEARCH.md Pitfall A

for (let pass = 0; pass < rules.balancePasses; pass++) {
  const sorted = [...activeGuards].sort((a, b) => {
    const d = load.get(a.id).load - load.get(b.id).load;             // FAIR-01: load-based
    return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
  });
  const lightest = sorted[0];
  const heaviest = sorted[sorted.length - 1];
  if (!lightest || !heaviest) break;

  const gapLoad = load.get(heaviest.id).load - load.get(lightest.id).load;
  if (gapLoad < gapThreshold) break; // FAIR-03: derived from the roster's own perShiftLoad
  // ...
```

`shiftLoad` is already imported at the top of `autoAssign.js`... no — it is *defined* in `autoAssign.js` (exported at line 80) and imported by `fairness.js`, so no new import is needed here; `perShiftLoad` can be computed directly against the already-in-scope `shiftLoad` function.

### FAIR-02 + FAIR-03: `buildResult`'s `perGuard` and `fairnessScore`

```javascript
// Source: src/lib/autoAssign.js:616-643 (current — read this session)
const perGuard = activeGuards
  .map((g) => {
    const l = load.get(g.id);
    return {
      guardId: g.id,
      name: g.name,
      shifts: l.count,
      nights: l.nights,
      hours: round(l.hours),
      // no `load` field today
    };
  })
  .sort((a, b) => b.shifts - a.shifts || String(a.guardId).localeCompare(String(b.guardId)));

const counts = perGuard.map((p) => p.shifts);        // FAIR-02: count-based
// ... variance over counts ...
const fairnessScore = Math.max(0, Math.round(100 - Math.sqrt(variance) * 15)); // FAIR-03: uncalibrated
```

Proposed direction:

```javascript
const perGuard = activeGuards
  .map((g) => {
    const l = load.get(g.id);
    return {
      guardId: g.id,
      name: g.name,
      shifts: l.count,
      nights: l.nights,
      hours: round(l.hours),
      load: round(l.load),                              // FAIR-02: new field, same rounding convention as `hours`
    };
  })
  .sort((a, b) => b.load - a.load || String(a.guardId).localeCompare(String(b.guardId)));
  // sort key also moves to load — a supervisor scanning this list top-to-bottom
  // should see it ranked by the thing the score is actually about.

const loads = perGuard.map((p) => p.load);
const meanLoad = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
const loadVariance = loads.length
  ? loads.reduce((a, b) => a + (b - meanLoad) ** 2, 0) / loads.length
  : 0;

const perShiftLoad = openShifts.length
  ? openShifts.reduce((sum, s) => sum + shiftLoad(s), 0) / openShifts.length
  : 1;
const fairnessCoefficient = 15 / Math.max(perShiftLoad, 0.001); // guard against a degenerate all-zero-hour roster

const fairnessScore = Math.max(0, Math.round(100 - Math.sqrt(loadVariance) * fairnessCoefficient));
```

Note: `spread` (currently `max(counts) - min(counts)`) is a legitimate secondary metric (a literal shift-count gap) and does not itself need to disappear — but consider also exposing `loadSpread: round(Math.max(...loads) - Math.min(...loads))` so the SmartAssign KPI hint ("פער של X משמרות") can be reworded to reference load, avoiding the confusing juxtaposition of "0 משמרות פער" next to a 98% score (see Pitfall A's worked example — that is precisely the scenario that would otherwise look self-contradictory on screen).

### FAIR-06: the exact lever

```javascript
// Source: public/sw.js:20 (read this session)
const VERSION = "v1";
```
Bump this string in the same commit that ships the fairness recalibration. No other code change to `sw.js` is required — `SHELL`/`ASSETS` derive from it, and `activate`'s existing cleanup (lines 24-32) already deletes any cache key that doesn't match the current names.

## State of the Art

Not applicable — no external ecosystem shift is relevant here (this is an in-repo constant recalibration, not a library upgrade). Omitted per template guidance for phases with no such history.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gapThreshold = perShiftLoad × 0.5` is the right fraction for `balanceWorkload`'s stopping condition | Pitfall A, Code Examples | If too large: the loop stops before attempting swaps that could genuinely narrow a fixable gap (a regression vs. today's `< 2`-shift tolerance, which already lets some real imbalance through — this must not get *worse*). If too small: more balance passes attempted per run (bounded by `balancePasses: 40` and the `!moved: break` safety valve, so not a correctness risk, only a performance one on larger rosters). Mitigate by adding the regression tests in §Validation Architecture that assert typical rosters converge in well under 40 passes, and by testing against at least one roster where a real fixable gap exists to confirm the threshold doesn't suppress a legitimate swap. |
| A2 | `fairnessCoefficient = 15 / perShiftLoad` (dimensional rescale of the original `15`) is the right way to preserve the original formula's intent | Pitfall A, Code Examples | This is the most defensible derivation found (it collapses to the exact pre-existing formula when all shifts carry equal load, per the cross-check in Pitfall A), but "15 points per shift of imbalance" was itself a `[CITED: code comment]` design choice never independently re-validated against user perception of fairness. If the resulting scores feel miscalibrated in practice (e.g. supervisors report 98% "feels wrong" for the repro case), the fix is to adjust the base `15`, not the `/ perShiftLoad` structure. |
| A3 | The 8-hour shift length used to reproduce `01-CONTEXT.md`'s exact numbers (16.0 / 19.2) is the actual shift length in the real repro the orchestrator ran | Pitfall A worked example | Low risk — the arithmetic independently reproduces the stated numbers exactly (73.6 total, 16.0/19.2 split, 3 nights + 5 mornings), which is strong internal evidence of correctness regardless of the exact source data, but the planner should not assume 8h is a hardcoded shift length anywhere in the app — shift length is always derived from `startTime`/`endTime` per shift (`shiftHours()`, `dates.js:133-136`), never fixed. |
| A4 | No participant-facing surface other than `GuardApp.jsx`'s `FairnessLine` displays a fairness-related number | Summary, FAIR-05 | Verified via `Grep` for `fairnessHint`, `fairnessPlan`, `teamAverages`, `fairnessScore`, `fairness.score`, `fairness.spread` across `src/` — only `GuardApp.jsx`, `src/components/supervisor/views.jsx`, and the two `src/lib/*.js` engines matched. If a component was missed (e.g. dynamically composed or not matching these exact identifiers), FAIR-05 could have a second, unaudited surface. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should `spread` (count-based) be removed, renamed, or kept alongside a new `loadSpread`?**
   - What we know: `spread` currently feeds `verify-scheduler.mjs`'s existing check `"workload spread <= 2 shifts"` (line 137) and `SmartAssign.jsx`'s KPI hint text.
   - What's unclear: whether product wants the shift-count gap concept to disappear entirely (since "load is the only fairness metric" is a locked decision) or to persist as a secondary, clearly-labeled stat.
   - Recommendation: keep `spread` (it's not wrong, just incomplete on its own) and add `loadSpread` alongside it; update the KPI hint text to reference load so the two numbers on screen (score + hint) never look contradictory, per Pitfall A's worked example.

2. **Does re-sorting `perGuard` by `load` instead of `shifts` (proposed in the FAIR-02 code example) have any downstream consumer that assumes the current count-based sort order?**
   - What we know: `SmartAssign.jsx` iterates `plan.fairness.perGuard` in the order the engine returns it (`.map((p) => ...)`, line 439) with no independent re-sort.
   - What's unclear: whether any other component or test relies on this array's order specifically (vs. just its contents).
   - Recommendation: `Grep` for `.fairness.perGuard` and `.perGuard` across `src/` and `scripts/` before changing the sort key, to confirm no order-dependent consumer exists beyond what this research found.

3. **Is `balancePasses: 40` still sufficient once selection is load-driven?**
   - What we know: each successful move changes the gap by `2 × shiftLoad(movedShift)`, typically 16–22 in load units on an 8h-shift roster — large relative to a `~4.6` threshold, so convergence should typically take *fewer* passes than the count-based version, not more.
   - What's unclear: whether a pathological roster (e.g. many guards, highly heterogeneous shift lengths) could cause the `sorted`-by-load heaviest/lightest pair to change every pass without net convergence (a form of low-amplitude oscillation), consuming many passes before `!moved` finally breaks.
   - Recommendation: add a regression test asserting `balanceMoves.length` (or an instrumented pass-count) stays well under 40 for the existing `verify-scheduler.mjs` fixture and for the Pitfall A repro roster, so a future change that introduces oscillation is caught immediately rather than silently eating the full 40-pass budget on every run.

## Environment Availability

Skipped — this phase has no external tool, service, runtime, or CLI dependency beyond what's already installed and verified working in this repo (Node, for the existing `npm test` scripts). No new environment probes are needed.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — standalone Node scripts, `check()`/`ok`/`FAIL` pattern (see `scripts/verify-scheduler.mjs:13-20`) |
| Config file | none |
| Quick run command | `node scripts/verify-scheduler.mjs` |
| Full suite command | `npm test` (runs `verify-scheduler.mjs && verify-planning.mjs`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FAIR-01 | Balance pass moves a shift from the load-heaviest guard, not the count-heaviest, when the two diverge | unit (Node script) | `node scripts/verify-scheduler.mjs` | ✅ existing file, ❌ this specific assertion — Wave 0 |
| FAIR-02 | `perGuard` rows carry a `.load` field; `fairnessScore` is derived from load, not count | unit (Node script) | `node scripts/verify-scheduler.mjs` | ✅ existing file, ❌ new assertion — Wave 0 |
| FAIR-03 | `gapThreshold`/`fairnessCoefficient` are computed from `perShiftLoad`, not hardcoded, and reproduce the Pitfall A worked numbers | unit (Node script) | `node scripts/verify-scheduler.mjs` | ✅ existing file, ❌ new assertion — Wave 0 |
| FAIR-04 | Reported `summary.fairnessScore` is never derivable-inconsistent with `perGuard[].load` | unit (Node script), **independent-recomputation pattern** — recompute `fairnessScore` from the *returned* `perGuard[].load` values using the same public formula and assert equality with `result.summary.fairnessScore` | `node scripts/verify-scheduler.mjs` | ❌ new — Wave 0 |
| FAIR-05 | `teamAverages(...).perGuard[id].load` (what `GuardApp.jsx` displays) matches the sum of `shiftLoad(s)` over that guard's assigned shifts, for a shared fixture | unit (Node script) — pinning test, confirms the already-correct behavior stays correct | `node scripts/verify-scheduler.mjs` | ❌ new — Wave 0 (function already correct, test is new) |
| FAIR-06 | A stale cached client cannot keep serving the pre-recalibration formula after deploy | **manual, browser-only** — not automatable by a Node script (requires real Cache Storage / SW lifecycle) | DevTools → Application → Cache Storage, verify `shell-v1`/`assets-v1` are absent after an `activate` cycle post-deploy | N/A — manual verification step, justified in Pitfall C |

### Sampling Rate
- **Per task commit:** `node scripts/verify-scheduler.mjs`
- **Per wave merge:** `npm test` (adds `verify-planning.mjs`, which already covers `fairness.js` and is untouched by this phase — confirms no regression in the reference implementation)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the FAIR-06 manual browser check (cannot be part of the automated gate)

### Wave 0 Gaps
- [ ] New assertions in `scripts/verify-scheduler.mjs` for FAIR-01 through FAIR-05 (extends the existing "נטל (FR-3.2)" block at line ~305 — same file, same pattern, no new file needed)
- [ ] No framework install needed — the existing `check()`/`ok`/`FAIL` harness (lines 13-20) is reused as-is

*(No `conftest.py`-equivalent needed — this test style has no shared-fixture mechanism beyond plain JS `const` declarations at module scope, already the pattern in the file.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase touches no auth code |
| V3 Session Management | No | Phase touches no session code |
| V4 Access Control | No | Phase touches no authorization code; fairness numbers are informational, not access-gating |
| V5 Input Validation | Marginal | `rules.balancePasses`, and any new derived constants, are computed from already-validated `DEFAULT_RULES`/`ruleOverrides` (numeric, bounded by the existing `RulesPanel` UI in `SmartAssign.jsx` with `min`/`max` on its `<Input type="number">` fields) — no new user-supplied input surface is introduced |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

None applicable — this phase is a client-side arithmetic recalibration with no new input surface, no new data storage, and no change to what data crosses the `api.js` boundary. The one adjacent, already-known-and-explicitly-deferred issue is that all hard constraints (including, after this phase, the fairness numbers) are enforced only in client-side pure JS with no server-side/RLS backstop — already documented in `PITFALLS.md` Pitfall 3 and explicitly out of scope for this phase (it concerns *eligibility* enforcement in Phase 2/3, not fairness *reporting* in Phase 1). No STRIDE-relevant threat pattern is introduced by recalibrating a display number.

## Sources

### Primary (HIGH confidence — direct `Read` this session)
- `src/lib/autoAssign.js` — full file, all line numbers cited above verified against this read
- `src/lib/fairness.js` — full file
- `src/lib/dates.js` — full file (`shiftHours`, `shiftInterval`)
- `src/components/GuardApp.jsx` — lines 1-160 (imports, `FairnessLine`, `MySchedule`'s `teamAverages` call)
- `src/components/SmartAssign.jsx` — full file
- `src/components/supervisor/views.jsx` — grep for `fairnessHint`/`fairnessPlan` usage (lines 15, 875-886, 930, 1035)
- `public/sw.js` — full file
- `scripts/verify-scheduler.mjs` — full file
- `scripts/verify-planning.mjs` — grep for fairness-related imports/assertions (confirms no overlap with this phase's changes)
- `src/design/tokens.css` — lines 1-100 (light theme `:root` token values and stated contrast ratios)
- `package.json` — full file (confirms no test framework, confirms `npm test` composition)
- `.planning/phases/01-fairness-calibration/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/config.json` — full read

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` Pitfalls 6 and 7 — this project's own prior research, itself grounded in direct reads of the same source files (cross-checked, not contradicted, by this session's independent reads)

### Tertiary (LOW confidence)
- None used. No web search was performed for this phase — it required no external library, framework, or ecosystem knowledge; every claim traces to a file read this session or to the project's own prior grounded research.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no dependency change
- Architecture / constants derivation: HIGH for the diagnosis (exact line numbers, exact reproduced numbers), MEDIUM for the specific proposed constants (`0.5`, `15/perShiftLoad`) — these are defensible derivations, not externally-verified values, and are flagged `[ASSUMED]` in the Assumptions Log pending the regression tests this research proposes
- Pitfalls: HIGH — grounded in direct reads plus the project's own pre-existing, independently-researched `PITFALLS.md`

**Research date:** 2026-08-21
**Valid until:** No expiry driver — this is in-repo logic with no external version dependency; re-research only if the underlying `LOAD_WEIGHTS`/`shiftLoad()` design changes (explicitly out of scope for this phase and phases 2-4 per `01-CONTEXT.md`'s "מה זה לא").
