---
phase: 07-colors-and-shift-order
plan: 02
subsystem: ui
tags: [canvas, accessibility, share-image, dead-code-audit]

# Dependency graph
requires:
  - "07-01 — byStartTime, POSITION_LABEL_BG black label, scripts/verify-share-image.mjs canvas-stub harness"
provides:
  - "renderWeekCanvas exports the WhatsApp share image at 2x logical resolution (2160px wide) with a safe-fallback canvas-size guard (COLOR-01)"
  - "[07] consumer-state comment above categoryColor in ui.jsx, plus a permanent recursive consumer audit wired into npm test (D-07)"
affects: []

# Actuals (#2632)
actuals:
  tokens: 4023
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed export-resolution factor with a content-driven safety fallback (not devicePixelRatio-driven): scale by a constant, but drop to 1x when the *content* (not the exporting device) would push canvas dimensions past the browser's ~16384px side limit."
    - "Self-excluding recursive dead-code-consumer audit: a Node script that scans src/+scripts/ for real usages of a pair of exported functions, wired into the same npm test suite it lives in, with the audit script's own literal mentions of the function names excluded from its own scan."

key-files:
  modified:
    - src/lib/shareImage.js
    - scripts/verify-share-image.mjs
    - src/components/ui.jsx

key-decisions:
  - "J-4 (from plan, applied as specified): the ×2 export scale is conditioned on the *logical height* fitting within MAX_CANVAS_PX=16384 when doubled, not on the exporting device's devicePixelRatio. A 7-day/14-shift-per-day week measured at a 9568px logical height — doubling to 19136px would exceed the browser ceiling and return a blank canvas — so the busy fixture falls back to factor 1 instead."
  - "J-5 (from plan, applied as specified): the background fillRect and the footer signature's y-coordinate were the two remaining reads of canvas.width/canvas.height inside drawing code. Both now read the explicit logical-height variable H instead, so they stay correct in logical units after ctx.scale(2,2) — the pre-fix code would have drawn a 4x-oversized background rect (wasted, not visibly broken) and pushed the signature to y = 2*H - 34, off the bottom of a canvas whose logical height is only H (signature invisible)."
  - "D-07 self-exclusion (new, not explicitly in plan): the permanent consumer-audit check added to verify-share-image.mjs necessarily mentions 'categoryColor'/'positionColorKey' in its own regex pattern, check description, and console.log label. Without excluding its own file from the scan, the audit would permanently flag itself as a false consumer and never pass. Fixed by resolving the running script's own path via fileURLToPath(import.meta.url) and filtering it out of the scanned file list — a file 'talking about' the names in an audit string is not the same as a file 'using' them for coloring."
  - "[07] comment placement (deviation from a literal reading of the plan, not from its intent): the plan says to put the consumer-record comment 'above categoryColor'. The full record text plus the array-length CATEGORY_COLORS declaration in between pushed the [07] marker more than 600 chars from the categoryColor export, failing the plan's own inline verification regex (/\\[07\\][\\s\\S]{0,600}export const categoryColor/). Restructured so the [07] record sits directly above `export const categoryColor` (replacing the old one-line 'Stable colour...' comment there), and the updated historical-rationale comment stays above CATEGORY_COLORS. Verified against the plan's exact check command."

requirements-completed: [COLOR-01, COLOR-02, COLOR-03, COLOR-04]

coverage:
  - id: T1
    description: "renderWeekCanvas creates the canvas at 2x logical dimensions with a matching ctx.scale(2,2) called immediately after getContext, before any other context setup or draw call"
    requirement: "COLOR-01"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs — 'canvas.width שווה בדיוק לרוחב הלוגי...', 'הפעולה הראשונה ביומן היא scale...', 'scale נקראת פעם אחת בדיוק בכל רינדור'"
        status: pass
      - kind: unit
        ref: "node -e inline source check from 07-02-PLAN.md Task 1 <verify> — confirms ctx.scale( present, no devicePixelRatio anywhere, no canvas.width/height read after the scale call"
        status: pass
      - kind: manual_procedural
        ref: "human-check (7 points, 07-02-PLAN.md Task 1) — NOT RUN by the executor; see Deviations/Issues below"
        status: not_run
    human_judgment: true
  - id: T2
    description: "Browser-side canvas-size ceiling (~16384px/side) is guarded: content whose doubled logical height would exceed it falls back to a 1x export factor instead of returning a blank canvas"
    requirement: "COLOR-01"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs busy fixture (7 dates x 14 shifts, deterministic hours, 1 assignee per shift) — measured logical height 9568px, factor falls back to 1, both canvas sides <=16384, signature stays inside the logical height"
        status: pass
    human_judgment: false
  - id: T3
    description: "Background fillRect and the footer signature draw using the logical height H, not the device-pixel canvas.height, on both the regular and busy fixtures"
    requirement: "COLOR-01"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs — 'fillRect של רקע התמונה מצויר ברוחב 1080 ובגובה הלוגי', two signature-position checks (regular + busy fixture)"
        status: pass
    human_judgment: false
  - id: T4
    description: "categoryColor/positionColorKey have zero real consumers outside src/components/ui.jsx; the functions stay exported and unchanged; the audit is permanent in npm test"
    requirement: "D-07 (deferred decision in 07-CONTEXT.md, not a numbered requirement)"
    verification:
      - kind: unit
        ref: "scripts/verify-share-image.mjs recursive audit — 'אין צרכן של categoryColor/positionColorKey מחוץ ל-src/components/ui.jsx' — prints the file list every run"
        status: pass
      - kind: unit
        ref: "node -e inline check from 07-02-PLAN.md Task 2 <verify> — [07] record present above categoryColor, both functions still exported, guardColor undamaged"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-09-22
status: complete
---

# Phase 7 Plan 2: Double-resolution share image + categoryColor/positionColorKey consumer audit Summary

**`renderWeekCanvas` now exports the WhatsApp share image at 2160px (2x the 1080px logical width) with a fixed, device-independent scale factor and a safe fallback to 1x when a busy week's content would cross the browser's ~16384px canvas-side ceiling; `categoryColor`/`positionColorKey` in `ui.jsx` are confirmed to have zero real consumers left, documented in place with a `[07]` record, and left exported per the deferred-deletion decision — with the audit made permanent in `npm test`.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-09-22
- **Tasks:** 2
- **Files modified:** 3 (`src/lib/shareImage.js`, `scripts/verify-share-image.mjs`, `src/components/ui.jsx`)
- **Commits:** 2 (`9e77434` feat, `ab17b61` docs)

## Accomplishments

### Task 1 — double-resolution canvas with a safety-limit fallback (COLOR-01, D-05, J-4, J-5)

- Added two module-level constants to `src/lib/shareImage.js`: `MAX_CANVAS_PX = 16384` (the browser side-length ceiling above which canvases silently return blank) and `EXPORT_SCALE = 2` (the requested export factor, fixed — never `devicePixelRatio`, per D-05: the image is exported on one device and viewed on another, usually a guard's phone, so the exporter's pixel density is not the relevant number for the viewer's sharpness).
- `renderWeekCanvas` now computes an explicit logical height `H` (identical expression to the old direct `canvas.height` assignment), then computes the actual `scale` — `EXPORT_SCALE` when `H * EXPORT_SCALE <= MAX_CANVAS_PX`, else `1` (J-4). `canvas.width`/`canvas.height` are set to the logical dimensions times `scale`, and `ctx.scale(scale, scale)` is called immediately after `getContext("2d")`, before `ctx.direction`/`textAlign`/`textBaseline` are set (canvas dimension assignment resets context state, so `scale` must come after it and before everything else).
- Fixed the two remaining reads of device pixel dimensions inside drawing code (J-5): the background `fillRect(0, 0, canvas.width, canvas.height)` now reads `fillRect(0, 0, W, H)`, and the footer signature's y-coordinate (`canvas.height - 34`) now reads `H - 34`. No other coordinate, font size, or helper function (`layout`, `wrapPills`, `roundRect`, `drawLtr`, palette, black position label, guard chips) was touched.
- Added a third paragraph to the file header documenting the new decision, mirroring the existing two.
- `scripts/verify-share-image.mjs`: extracted the render-and-capture flow into `renderAndCapture(fixture)` (returns `{canvas, log}`) so the same code drives both the existing regular fixture and a new deterministic "busy" fixture (7 dates × 14 shifts/day, hour derived from index — no `Math.random()` — exactly 1 assignee per shift so every row hits full height). Added 9 new checks covering: canvas.width = 2160, canvas.height even and logical height > 0, `scale` is the first log entry with args `[2,2]`, `scale` called exactly once, background `fillRect` uses logical dimensions, footer signature y-coordinate is inside the logical height and within 60px of the bottom — all on the regular fixture — plus the busy-fixture factor-falls-back-to-1 check, the both-sides-≤16384 check, and the busy-fixture signature-still-inside-height check.
- **TDD:** wrote the 9 new checks first, ran the suite (RED — 5 of the 9 new regular-fixture checks failed as expected; the 3 busy-fixture checks and the source-literal check passed trivially since pre-fix behavior is already factor-1-equivalent), then implemented the source change until GREEN.

### Task 2 — `categoryColor`/`positionColorKey` consumer audit and in-place record (D-07)

- **Step 1 audit (before any edit):** grepped `src/` and `scripts/` for `categoryColor`/`positionColorKey`. Result: the only matches are the two `export const` definitions and their own doc comments inside `src/components/ui.jsx` itself. No import, call, or JSX usage exists anywhere else in the codebase (07-01 already confirmed and removed the last two real consumers — `shareImage.js`'s private copy and `views.jsx`'s import — in Phase 7 Plan 1). Since there was no real consumer outside `ui.jsx`, proceeded to Step 2/3 per the plan.
- **Step 2 (permanent audit):** added a recursive scan to `scripts/verify-share-image.mjs` that walks `src/` and `scripts/` (`.js`/`.jsx`/`.mjs`, paths built from `new URL("..", import.meta.url)` — not `process.cwd()`), strips block and line comments before testing, and collects every file where `categoryColor` or `positionColorKey` still appears in live code. One necessary addition beyond the plan's literal wording: the audit script's own file was excluded from its own scan (`fileURLToPath(import.meta.url)` filtered out of the file list) — without this, the check's own regex pattern and description strings (which necessarily mention both names) would make it permanently flag itself as a false consumer and never pass. The check prints the file list on every run and asserts it equals exactly `["src/components/ui.jsx"]`.
- **Step 3 (record, not delete):** replaced the terse `/** Stable colour per category/position name... */` one-liner directly above `export const categoryColor` with a `[07]` record: both historical consumers (ScheduleMgmt board, share image) moved to the fixed black label in Phase 7 and no longer call these; the functions stay exported and unchanged because deletion was explicitly deferred in `07-CONTEXT.md` and requires approval; and what's needed to remove them safely in the future (re-confirm the audit reports "no consumer", then delete `CATEGORY_COLORS` and both functions together). Updated the original `shiftTone`-rationale comment above `CATEGORY_COLORS` to note in one sentence that the conclusion flipped (ten hues on one screen made a colorful board that said nothing; the fix is a uniform readable label), instead of leaving a comment arguing for a product decision Phase 7 reversed.
- **Placement deviation from a literal plan reading:** the plan's own inline verification regex (`/\[07\][\s\S]{0,600}export const categoryColor/`) requires the `[07]` marker within 600 characters of the export. Putting the full record above `CATEGORY_COLORS` (as an initial draft did) put ~900 characters between the marker and the export once the array declaration sat in between, and the plan's own check failed. Fixed by moving the `[07]` record to sit directly above `export const categoryColor` and keeping the updated historical-rationale comment (no `[07]` marker) above `CATEGORY_COLORS`. Re-ran the plan's exact check command to confirm.
- **Not touched:** `categoryColor`, `positionColorKey`, `guardColor`, `readableInk`, `INK_DARK`, `luminance`, and every other component in `ui.jsx` — verified by diff (comment-only changes) and by the plan's inline `node -e` check.

## Task Commits

1. **Task 1: Double-resolution canvas with safety-limit fallback** — `9e77434` (feat)
2. **Task 2: categoryColor/positionColorKey consumer audit + in-place record** — `ab17b61` (docs)

_Task 1 was TDD (RED → GREEN, described above). Task 2 was not TDD — it is comment/audit-code-only with no behavior under test._

## Files Created/Modified

- `src/lib/shareImage.js` — `MAX_CANVAS_PX`/`EXPORT_SCALE` constants, `renderWeekCanvas` computes logical `H` and actual `scale` with the J-4 fallback, `ctx.scale()` called right after `getContext`, background `fillRect` and footer signature switched from `canvas.width`/`canvas.height` to `W`/`H`, third file-header paragraph documenting D-05/J-4.
- `scripts/verify-share-image.mjs` — `renderAndCapture(fixture)` extraction, 9 new COLOR-01 checks (regular + deterministic busy fixture), new self-excluding recursive `categoryColor`/`positionColorKey` consumer audit (D-07) wired into the same `npm test` run.
- `src/components/ui.jsx` — comment-only: `[07]` consumer-state record above `categoryColor`, updated historical-rationale comment above `CATEGORY_COLORS`. No exports, signatures, or behavior changed.

## Measured values (required by plan `<output>`)

**Regular fixture** (the existing 6-shift/2-day fixture from 07-01):
- `canvas.width = 2160`, `canvas.height = 1876` → logical `1080 × 938`, factor `2`.

**Busy fixture** (new: 7 dates × 14 shifts/day, 1 assignee per shift, deterministic hours):
- Logical height measured at **9568px** (`HEAD 150 + total 9310 + FOOT 60 + PAD 48`) — crosses half of `MAX_CANVAS_PX` (8192), so doubling to 19136px would exceed the 16384px ceiling.
- `canvas.width = 1080`, `canvas.height = 9568` → factor **1** (fallback engaged), both sides ≤ 16384.
- Footer signature still draws inside the logical height in both fixtures (verified by both new checks).

**Downloaded PNG dimensions/file size in a real browser:** NOT MEASURED — see Deviations below.

**Consumer-audit output (Task 2, verbatim from the test run):**
```
D-07 · ביקורת צרכנים קבועה — categoryColor/positionColorKey (Task 2, 07-02)

  קבצים שמכילים categoryColor/positionColorKey מחוץ להערות: ["src/components/ui.jsx"]
  ok   אין צרכן של categoryColor/positionColorKey מחוץ ל-src/components/ui.jsx (D-07)
```

## Deviations from Plan

**1. [Rule 3 — blocking-issue workaround, documented] Consumer-audit self-exclusion.** The permanent audit added to `verify-share-image.mjs` necessarily contains the literal strings `categoryColor`/`positionColorKey` in its own regex pattern, check label, and console.log line. Without excluding the audit script's own file path from the file list it scans, the check would find itself as a "consumer" and never pass — a self-referential false positive the plan text didn't anticipate. Fixed by resolving the running script's own path via `fileURLToPath(import.meta.url)` and filtering it out before scanning. This does not weaken the audit: every other file in `src/` and `scripts/` is still scanned in full, including all other `scripts/verify-*.mjs` files.

**2. [Rule 1 — bug fix during TDD, documented] `[07]` comment placement.** Covered above under Task 2 — the plan's literal instruction ("above `categoryColor`") combined with the plan's own 600-character verification window meant the full record had to sit immediately above the `export const categoryColor` line itself, not above the `CATEGORY_COLORS` array a few lines earlier as an initial draft placed it. Content and intent (all three required points: who stopped consuming, why not deleted, what's needed to delete safely) are unchanged from the plan's specification — only the exact line position moved to satisfy the plan's own check.

**3. [Environment constraint, not a Rule 1-4 deviation — reported per CLAUDE.md iron principle 6] Task 1's `human-check` (7 live-browser verification points) was NOT run by the executor.** The plan requires: `npm run dev`, click the demo, navigate to publish, click "share as image," inspect the downloaded PNG's pixel width (2160, not 1080) and sharpness, confirm the footer signature is inside the frame, confirm the position label and guard-name chips, confirm chronological order, and send the image to WhatsApp and read it on an actual phone at chat-preview size.
   - The dev server was started successfully (`npm run dev`, port 3000, confirmed ready).
   - No browser automation tool was reachable from this execution environment: `aside` (the primary driver the `/browse` skill uses) is not installed (macOS-only, this is Windows), and gstack's own headless-browser fallback binary (`$B`, confirmed present on disk at `~/.claude/skills/gstack/browse/dist/browse`) could not be invoked — this worktree-isolated agent's Bash tool refuses to execute *any* absolute-path binary as the leading command (confirmed by testing with an unrelated system binary, `whoami.exe`, which was refused with the identical "cannot be shown not to be git" guard). This is a hard sandbox boundary of the worktree-isolated execution environment, not a workaround-able blocker — no further bypass was attempted.
   - **What IS verified, automatically:** all seven points have a machine-checkable proxy that passed — canvas pixel width (2160, asserted in `verify-share-image.mjs` and independently measured above), scale-before-draw ordering, absence of `devicePixelRatio`, absence of any post-scale `canvas.width`/`canvas.height` read in drawing code, footer signature inside the logical frame on both a normal and an artificially oversized fixture, position-label contrast (inherited unchanged from 07-01, still asserted), and guard-chip color variety (inherited unchanged from 07-01, still asserted). What is **not** verified is the purely perceptual claim — "the downloaded PNG genuinely looks sharp at WhatsApp phone-preview size to a human eye" — which by its nature requires a human with a phone.
   - **Recorded in `.planning/WINDOWS.md`** as ledger entry #6 (`kind: unrun-verify`, phase 07) so it stays visible at ship time.
   - **Action needed from the user:** run `npm run dev`, click "הפעל הדגמה", reach the publish step, click "שתף כתמונה", and walk the 7 points in `07-02-PLAN.md` Task 1's `<human-check>` — in particular point 7 (opening the downloaded image inside an actual WhatsApp chat preview on a phone), which no automated check can substitute for.

No other deviations. Both tasks otherwise executed exactly as planned, including J-4 and J-5 applied as specified.

## Issues Encountered

- Sandboxed worktree environment blocks all browser-automation tooling (see Deviation 3 above). No other tooling or dependency issues.

## User Setup Required

**Live browser verification (Task 1 `human-check`, 7 points) — not yet performed.** Run `npm run dev`, walk through the demo to the roster publish step, click "שתף כתמונה" to download the PNG, and confirm:
1. Downloaded file is 2160px wide (not 1080px) — check file properties or an image viewer.
2. Hebrew text edges are sharp at 100% zoom, not blurred.
3. The "NexRota" footer signature is visible at the bottom of the image, not cut off.
4. Every row's position label is a solid black, legible chip.
5. Guard-name chips are visually distinct per person, consistent for the same person throughout.
6. Rows within each day are ordered earliest-to-latest.
7. Send the image to yourself on WhatsApp and open it at chat-preview size on a phone — confirm the position label and hours are readable without zooming.

Report back what was actually seen, not what was expected, per this project's CLAUDE.md verification principle.

## Next Phase Readiness

- This was the last plan of Phase 7 per the phase's stated scope (COLOR-01 through COLOR-04, all four requirements now marked complete in the automated suite).
- `.planning/WINDOWS.md` carries one open `unrun-verify` entry (#6) for this plan's live-browser human-check — should be resolved (or explicitly waived) before `/gsd-ship` if the ship gate enforces the ledger.
- `src/design/categoryPalette.js`, `src/components/supervisor/ResourceGrid.jsx`, and `src/lib/resourceView.js` were not touched, as scoped (D-01).
- `categoryColor`/`positionColorKey` remain exported from `ui.jsx` with a permanent zero-consumer audit in `npm test`; a future phase can safely delete them by re-running the audit and removing `CATEGORY_COLORS` + both functions together, per the `[07]` comment's own instructions.

## Self-Check: PASSED

All modified files found on disk (`src/lib/shareImage.js`, `scripts/verify-share-image.mjs`, `src/components/ui.jsx`, this SUMMARY). Both task commits (`9e77434`, `ab17b61`) confirmed present in `git log`. `npm test` (9 scripts including `verify-share-image.mjs`) and `npm run build` both pass as of the final commit.

---
*Phase: 07-colors-and-shift-order*
*Completed: 2026-09-22*
