# 01-02 Summary — Screens and Release

**Plan:** 01-02
**Tasks:** 3/3 complete
**Requirements:** FAIR-02 (screen half), FAIR-05, FAIR-06

## What changed

1. **`5c9188a`** — `loadShareHint()` added to `src/lib/fairness.js`; `SmartAssign.jsx`'s "חלוקת העומס המוצעת" card now ranks, sizes and captions rows by `fairness.perGuard[].load` and `fairness.loadMax`/`loadMean` instead of shift count. `terms.js` gains `unit.load`/`unit.shifts`/`unit.nights` (army overrides `unit.shifts` to the duty noun). 7 new `FAIR-02 ·` assertions in `verify-planning.mjs`.
2. **`ea73d22`** — The fairness KPI tile's hint now reads `fairness.loadSpread` through `t("unit.load")`, closing the score/hint unit mismatch (Research Pitfall A). 6 new `FAIR-05 ·` assertions in `verify-scheduler.mjs`: cross-path equality between the participant-facing load (`teamAverages`) and the engine's `fairness.perGuard[].load`, independent recomputation from assigned shifts, a regression guard against the load row silently reverting to an hours row, average-of-same-values check, population-match check, determinism. `GuardApp.jsx` itself is untouched and pinned by gate — its `FairnessLine` already read the correct engine-derived load.
3. **`c6aa5a4`** — `public/sw.js` `VERSION` bumped `"v1"` → `"v2"`. Both cache names still derive from the one constant; the existing `activate()` cleanup removes any non-matching cache key with no further code change.

## Contract check against wave 1 (01-01)

01-01's actual delivered `stats.perShiftLoad`/`fairness.loadMax`/`loadMean`/`loadSpread`/`perGuard[].load` field names matched what this plan assumed — no adjustment was needed there.

**One value did diverge, and this plan absorbed it correctly.** 01-01's executor found the *researched* `gapThreshold` fraction of `perShiftLoad × 0.5` caused an infinite balance-pass oscillation on a production-shaped fixture, and corrected `balanceWorkload`'s threshold to `perShiftLoad × 1.0` in `autoAssign.js`. This plan's own `loadShareHint()` independently uses `perShiftLoad × 0.5` as its **noise floor** (`src/lib/fairness.js:140`) — a different constant, for a different purpose (display noise-floor for a screen hint, not the engine's balance-pass stopping threshold), so the two are not required to match and no inconsistency exists. Worth flagging for the record: if a future phase revisits `loadShareHint`'s noise floor, it should not assume it must track `balanceWorkload`'s threshold — they were derived and tested independently, against different fixtures, for different jobs.

## Final shipped shapes

**`loadShareHint({ load, meanLoad, perShiftLoad })`** → `{ tone: "warn"|"brand", text: string, level: "over"|"under" }` when `|load - meanLoad| >= perShiftLoad × 0.5`, else `null` (silent — no tag inside the noise floor, per D-05: never colour alone, and here not even a neutral tag when the difference isn't meaningful).
- over: `tone: "warn"`, `text: "מעל הממוצע בנטל ב-{gap}"`, `level: "over"`
- under: `tone: "brand"`, `text: "מתחת לממוצע בנטל ב-{gap}"`, `level: "under"`

**`terms.js` keys added:** `unit.load` ("נטל"), `unit.shifts` ("משמרות", army-mode override "תורנויות"), `unit.nights` ("לילות").

## FAIR-05 cross-path comparison

The 6 assertions added to `scripts/verify-scheduler.mjs` compare `teamAverages(guards, shifts)[guardId].load` (the participant-facing path, read by `GuardApp.jsx`'s existing `FairnessLine`) against `fairness.perGuard[].load` (the engine's own reported path) on the same fixture. **Tolerance used: exact equality (strict `===` after `round1`)**, not an approximate/epsilon comparison — both paths call the same underlying `shiftLoad()` per assignment and sum over the same assignment set, so there is no floating-point drift to accommodate; a tolerance would have masked a real divergence rather than catching one. All 6 passed.

## FAIR-06 — unverified, per Iron Principle 6

**The browser check was not performed.** This environment has no browser to inspect Cache Storage in. The code-level facts are confirmed: `VERSION` is `"v2"` in `public/sw.js`, both `shell-${VERSION}` and `assets-${VERSION}` cache names derive from it, and `activate()`'s existing cleanup loop deletes any cache key not matching the current version — but which cache namespaces are actually present, and which are actually gone, after a real activation cycle in a real browser holding the previous version, was never observed. **FAIR-06 is reported as unverified**, per CLAUDE.md's rule that what wasn't tested is reported as untested, not assumed working.

## Verification

`npm test` and `npm run build` both pass on the final commit (`c6aa5a4`), re-confirmed independently after this summary was written (not just at task-commit time).

## Note on how this SUMMARY was written

The executor agent that ran tasks 1–3 was interrupted by a network disconnection on the orchestrator side immediately after committing task 3, before it could write this file. All three task commits were verified complete and clean on disk (working tree clean, `npm test`/`npm run build` re-run and green) before this SUMMARY.md was written directly by the orchestrator from the commit diffs and current source — no task work was redone or guessed at.
