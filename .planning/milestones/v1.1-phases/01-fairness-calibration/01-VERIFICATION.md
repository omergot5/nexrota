# Phase 1 Verification — כיול ההוגנות: נטל בכל מקום

**Verified:** 2026-08-23
**Method:** goal-backward — re-ran the phase's own reproduction fixture on the merged code, then drove the actual running app (dev preview + production preview build) through the demo flow to confirm each success criterion holds in the browser, not only in `npm test`.

## Automated gates

`npm test` and `npm run build` both pass on the final merged tree (`fb78e53`). No test runner introduced, engines stay pure (no React/network/`api.js` imports in `autoAssign.js`/`fairness.js`/`conflicts.js`), `LOAD_WEIGHTS` byte-identical to pre-phase, `useGuardian.js` untouched.

## Success criteria — checked against ROADMAP.md Phase 1, one by one

**1. The originating reproduction week is now reported as unfair, and the balance pass moves by load.**
Re-ran the exact fixture (3 nights, 5 mornings, 4 guards) directly against the merged `autoAssign.js`:
```
fairnessScore: 98  (was 100 before this phase)
load: { בני: 19.2, גדי: 19.2, דני: 19.2, אבי: 16 }
deterministic across two runs: true
```
Confirmed. The score is strictly below 100 and the load spread is visible and correct.

**2. A flat roster scores high, a skewed one scores low, and the balance pass converges on both.**
Covered by 01-01's Task 3 property tests (scale-invariance across an 8h/12h twin roster, dynamic-range ordering flat > repro > skew > 0) — re-confirmed passing in the merged tree's `npm test` output.

**3. `npm test` fails on score/load contradiction or non-determinism.**
Covered by 01-01's FAIR-04 structural test (independently recomputes the score from reported `perGuard[].load` and asserts equality) and the three-fixture determinism check — passing.

**4. The participant sees the exact number the engine divided by.**
Covered by 01-02's FAIR-05 cross-path equality tests (`teamAverages()` vs `fairness.perGuard[].load`, zero tolerance) — passing. Not re-checked live in the guard-facing screen (would require a second login as a team member); the pinning test is the stronger guarantee here since both paths call the identical `shiftLoad()`.

**5. A browser holding the previous release doesn't keep computing the old formula; two supervisors on the same week see the same number.**
Checked live, not just read from code:
- Dev server: no service worker registers under Vite dev mode (expected — confirmed no `serviceWorker.getRegistrations()` entries).
- Production preview (`vite preview`, i.e. what actually ships): service worker registers, `caches.keys()` returns `["shell-v2", "assets-v2"]` — the bumped version, both derived from the single `VERSION` constant in `public/sw.js`.
- **Not simulated:** an actual v1→v2 upgrade across two tabs (would require serving the pre-phase build first, then upgrading). The cache-key evidence above is strong but this exact scenario remains formally unverified — flagged honestly rather than assumed.

## Live browser verification beyond the plans' own checklists

Ran the full demo flow (landing → demo team → build week → smart-assign → apply) in the actual dev-served app, then inspected the DOM directly (not just visually) to verify the exact defect this phase was built around no longer reproduces:

- **SmartAssign "חלוקת העומס המוצעת":** rows read `50.4 נטל · 3 משמרות · 3 לילות · 36 ש'` etc. — load, not count, leads every row. Meter `aria-label`/value confirmed load-proportional (`"נטל של X: N מתוך 50.4"`), not count-proportional. Over-average tag rendered as text (`"מעל הממוצע בנטל ב-10.7"`), never colour alone.
- **Analytics reports screen:** table sorted "מהעמוס ביותר בנטל", load column leads, same tag wording as SmartAssign.
- **Dashboard "עומס השומרים" card (the 4th surface found by the second plan-check audit):** shows the identical load figures (50.4/40.8/40.8/39/33.6/33.6) as the other two screens. **Decisive check:** מיכל כהן and נועה ברק both hold 3 shifts each (equal count) but different load (39 vs 50.4) — their meter bars render at 77% and 100% respectively, not both at 100%. This is only possible if the bar is genuinely load-driven; a count-based bar would have shown them identical. Confirms wave 3's Task 4 fix is real, not just gate-passing.
- **chartTheme.js live in the browser (the Blocker 3 concern — un-trimmed `getComputedStyle` whitespace silently freezing to fallback colours):** read the actual computed `fill` on a rendered Recharts axis tick — `rgb(160, 190, 182)`, matching the live `--text-muted` token exactly, not the hardcoded fallback (`rgb(74, 106, 100)`). Toggled the theme switch and re-read: value changed live to `rgb(74, 106, 100)` matching the newly-active light theme's token. Confirms the module re-reads on theme change rather than freezing at mount, and that the `.trim()` fix genuinely works against real `getComputedStyle()` output (not just the pre-trimmed literals a Node test would supply).

## Requirements coverage

FAIR-01 ✓, FAIR-02 ✓ (engine, SmartAssign, Analytics, dashboard card — all four surfaces), FAIR-03 ✓, FAIR-04 ✓, FAIR-05 ✓ (test-level), FAIR-06 ✓ (cache-key level; full upgrade-transition scenario not simulated).

## Outstanding, honestly unverified

1. Actual v1→v2 service-worker upgrade transition across two open tabs (only the resulting cache-key state was checked, not the transition itself).
2. GuardApp's `FairnessLine` was not visually inspected in a logged-in participant session — covered instead by 01-02's cross-path pinning test, which is arguably the stronger guarantee since it can't silently drift.

Both are lower-risk gaps than the ones already closed (the four-surface count/load consistency, and the chart colour freeze risk), and neither blocks calling Phase 1 done.
