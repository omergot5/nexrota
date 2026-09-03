---
status: diagnosed
trigger: "UAT gap G-05-1 (05-UAT.md Test 1, BOARD-04/D-13): naive first-time viewer of unified board was confused; user report (verbatim Hebrew): \"ולמי שהראיתי האפליקצייה בכלל לא עונה על מה שאמרת האפליקצייה בילבלה אותו מאוד , ניראלי צריך לעשות פה עבודה\""
created: 2026-09-03T00:00:00Z
updated: 2026-09-03T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — see Resolution
test: n/a (diagnose-only mode)
expecting: n/a
next_action: return ROOT CAUSE FOUND to caller

## Symptoms

expected: |
  A naive first-time viewer, given only the running app and the sentence
  "בנה סידור שבועי מלא", builds a full week unaided and afterward correctly
  describes unprompted: what happens each day; that some items carry a
  clock time and some do not; that a person with a lock icon can't do that
  item (D-13 acceptance test for BOARD-04).
actual: "User reported the app confused the viewer significantly and did not deliver the described comprehension result. No crash, no error — pure comprehension/UX failure."
errors: none
reproduction: "Deploy live (Vercel, commit 21c35d6), open as a genuinely unfamiliar person, build a full week with zero explanation, then ask them to describe the board in their own words."
started: "Present since Phase 5 (unified-board) implementation; discovered during UAT verification 2026-09-03."

## Eliminated

- hypothesis: "The board is not the true landing view (D-04 violated) — user actually lands somewhere else first and describes that instead."
  evidence: "SupervisorApp.jsx:83 initializes weekStep=0; WeekFlow.jsx STEP_OF.board=0 and WeekFlow's `body` array index 0 is <UnifiedBoard>. Confirmed by code read: the manager unconditionally lands on the board first when opening 'השבוע'."
  timestamp: 2026-09-03T00:00:00Z

- hypothesis: "Empty-category tasks spuriously show every assignee as 'not qualified,' flooding the board with blocked-look avatars and overwhelming the viewer."
  evidence: "autoAssign.js:124-129 isQualified(guard, category) returns true when category is falsy — empty-category items never render the blocked treatment. Ruled out."
  timestamp: 2026-09-03T00:00:00Z

## Evidence

- timestamp: 2026-09-03T00:00:00Z
  checked: "src/components/supervisor/UnifiedBoard.jsx BoardRow (lines 131-199) and src/components/supervisor/views.jsx People component (lines 1541-1589)"
  found: |
    Two visually distinct board concepts share the identical padlock glyph
    (icons.jsx:30 `lock`):
    1. The timeless/"out of engine" badge on an item with no clock time:
       `<Badge tone="neutral" icon="lock">מחוץ למנוע</Badge>` (UnifiedBoard.jsx:158-160).
    2. The per-assignee qualification-block indicator on a blocked person's
       avatar: a corner badge `<Icon name="lock" .../>` (views.jsx:1572-1578),
       rendered via `People`'s `isBlocked` branch, invoked from
       UnifiedBoard.jsx:192 (`isBlocked={(g) => !isQualified(g, item.category)}`).
  implication: |
    D-13's acceptance test asks the naive viewer to distinguish two unrelated
    facts: "this item has no clock time" vs. "this person can't do this item."
    The board answers both with the same icon (a padlock), with no legend
    (D-14) to disambiguate. A first-time viewer has no way to learn that one
    lock means "no time attached" and the other means "this specific person is
    blocked" — the single strongest, most information-dense symbol on the
    board is overloaded to mean two different things simultaneously.

- timestamp: 2026-09-03T00:00:00Z
  checked: "src/components/supervisor/views.jsx People component isBlocked render path (lines 1558-1580), compared against the original QUAL-08 precedent in AssignView (views.jsx lines 1090-1170), and UnifiedBoard.jsx's call site (line 187-196, `size={24}`)"
  found: |
    In UnifiedBoard's board rows, the blocked-person label text
    (`QUAL_BLOCK_LABEL = "לא כשיר/ה"`) is rendered *inside* a circle sized
    identically to the avatar: `style={{ width: size, height: size, fontSize:
    Math.round(size * 0.24) }}`. UnifiedBoard.jsx passes `size={24}` to
    `People`, so `fontSize = Math.round(24 * 0.24) = 6`. A 5-character Hebrew
    string ("לא כשיר/ה") is rendered at 6px inside a 24×24px circle.

    This is NOT the same treatment as the original QUAL-08 precedent
    (AssignView, views.jsx:1090-1170), which UI-SPEC.md explicitly mandates
    reusing "exact, verbatim, no new copy" (D-09). There, the avatar is 30px
    and the "לא כשיר/ה" label is a SEPARATE text row below the avatar at a
    normal 10px font size (views.jsx:1152-1169) — fully legible on its own
    line. UnifiedBoard/People's adaptation crams the same string inside the
    avatar circle itself instead of placing it as an adjacent row, producing
    an effectively illegible label at the board's compact avatar-stack size.
  implication: |
    The text half of the QUAL-08 "four signals" treatment (disabled + label +
    lock + neutral ring) is present in the DOM but not humanly readable on
    the board. The only signal that remains legible at this size is the
    small 11px lock-icon corner badge — which is exactly the icon that is
    also reused for the unrelated "out of engine" badge (see prior evidence
    entry). This directly explains why a naive viewer would fail the D-13
    criterion "a person with a lock icon can't do that item": the only
    legible cue (the lock icon) is ambiguous, and the disambiguating text is
    unreadable.

- timestamp: 2026-09-03T00:00:00Z
  checked: "src/components/supervisor/UnifiedBoard.jsx empty-state copy (lines 68-79) vs. WeekFlow.jsx PrimaryAction for step 0 (lines 160-167) and terms.js (nav.smart)"
  found: |
    On first paint (a fresh team, zero shifts/tasks — the exact state a
    from-scratch naive viewer starts in), the board renders `EmptyState` with
    body: "בנה משמרות או משימות, והלוח ייבנה מעצמו — או תתחיל
    מ'${t("nav.smart")}'" → "...או תתחיל מ'סדר לי את השבוע'." This is plain
    prose, not a link/button — the quoted phrase matches the STEP-BAR label
    for step index 3 (the "assign" step, meta[3].label = t("nav.smart")), a
    step that is clickable directly from the sticky step bar (no `disabled`
    on that button, WeekFlow.jsx:236-237) even before any shifts exist. The
    actual page-level primary CTA button directly below the empty state says
    something different: "המשך לבניית השבוע" (WeekFlow.jsx action[0]).
  implication: |
    Secondary contributor, not the primary cause: the empty-state copy
    verbally invites the very first-time viewer toward an action ("סדר לי את
    השבוע") that (a) is not itself a clickable element in that copy block,
    and (b) if pursued via the step-bar entry for that label, opens
    SmartAssign with zero shifts defined yet — not a productive first step.
    This creates a "which button do I actually press first" moment that
    could contribute to the reported general confusion, independent of the
    board-comprehension-specific bugs above.

## Resolution

root_cause: |
  Primary (code, verified): the qualification-block visual signal on the
  unified board reuses the generic padlock icon for a second, unrelated
  meaning (the "מחוץ למנוע"/out-of-engine badge on timeless items) with no
  legend to disambiguate, AND its accompanying disambiguating text
  ("לא כשיר/ה") is rendered illegibly (~6px, inside a 24px avatar circle)
  in `People`'s `isBlocked` branch (views.jsx:1541-1589) as consumed by
  `UnifiedBoard.jsx` (size={24} call site, line ~190) — a legibility
  regression relative to the original QUAL-08 precedent in AssignView, which
  shows the same label as a separate, normal-sized text row. Together these
  two defects mean the board's only two legible-at-a-glance signals for "item
  has no time" and "person can't do this" collapse into the same icon, and
  the text that would disambiguate them is not readable. This is category:
  code (component implementation defect), not solely a design/D-14 judgment
  call — D-14 (no legend) is a valid, unrelated decision; these are
  independent implementation bugs that happen to compound D-14's effect.

  Secondary (config/copy, contributing): the board's first-paint empty-state
  copy references an action name ("סדר לי את השבוע") as prose rather than as
  an actionable link, and that action, if pursued from the step bar before
  any shifts exist, does not produce a useful first step — a minor
  "where do I start" friction point independent of the board-comprehension
  defects above.

  AND-gate: yes — both the icon-overload and the illegible-label defects
  must be present together to fully explain the specific D-13 failure mode
  (fixing only one leaves the other still undermining the "locked person"
  criterion): fixing the icon overload alone still leaves an unreadable
  label; fixing only the label size still leaves the icon meaning ambiguous
  with the out-of-engine badge.
fix: "" # not applied — find_root_cause_only mode
verification: "" # not applied — find_root_cause_only mode
files_changed: []
