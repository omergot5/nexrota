---
status: complete
quick_id: 260903-wx1
date: 2026-09-03
---

# Quick Task 260903-wx1: Real center dividing line on AuthPage

## What changed

`src/components/AuthPage.jsx`:

- Grid changed from `lg:grid-cols-[1fr_minmax(0,24rem)] gap-10 lg:gap-16` to
  `lg:grid-cols-[1fr_auto_minmax(0,24rem)] gap-10 lg:gap-x-8` — a third `auto`
  track carries the divider, and two `2rem` gutters reproduce the original
  `4rem` gap exactly.
- New `aria-hidden` divider `<div>` between the story `<section>` and the
  login `<aside>`: `self-stretch w-0.5 bg-gradient-to-b from-transparent
  via-brand/45 to-transparent`, `hidden lg:block` so it never appears in the
  stacked mobile layout.
- `<aside>` moved `lg:order-2` → `lg:order-3` (divider now owns `lg:order-2`)
  so the story/divider/form order is preserved instead of swapping panels.
- Two Hebrew comment blocks that asserted "the separation is by material, not
  a dividing line" were rewritten to describe the line that now exists.

## Deviation from the plan as spawned

The plan was written and the first execution pass (subagent, isolated
worktree) happened against a stale snapshot of `AuthPage.jsx` — the worktree
forked before this session's in-progress, still-uncommitted work
(`AuthGradientBackdrop.jsx`, `RotatingLine`, `btn-glass-cta`, etc.) existed.
Merging that worktree branch back would have silently reverted those
uncommitted changes. Instead: the worktree's diff was reviewed, its technique
was ported by hand onto the actual current file, and the stale worktree
branch was deleted without merging (`git worktree remove --force` +
`git branch -D`).

## Escape hatch used

The plan pre-authorized strengthening the line's color if `via-hairline-strong`
(20% opacity) read too faint against the animated blurred backdrop. Verified
in-browser: at 20% opacity + 1px width the line was essentially invisible in
both themes. Used the sanctioned alternative — `via-brand/45` — and widened
`w-px` → `w-0.5` (2px), since a 1px line at any opacity was fragile under
Vite dev-server rendering/scaling. No new color was introduced; both are
existing tokens (`brand`) with an opacity modifier.

## Verification performed (in-browser, `npm run dev` on :3000)

- ✅ Desktop (1440×900): divider renders centered in the middle gutter, full
  height of the row, in both light and dark theme (toggled via the in-app
  theme switch, screenshotted both).
- ✅ Mobile (375×812): divider is absent (`hidden` below `lg`), panels stack
  login-card-first as before — unaffected by this change.
- ✅ `npm test` — all engine scripts (`ok`), no regressions.
- ✅ `npm run build` — clean, no new warnings.
- ✅ Login panel mode (`mode === "login"`) — also screenshotted (dark theme):
  divider and panel order hold. Register wizard, guard-join, and
  forgot-password panels were not individually screenshotted, but the
  grid/order change is structural and identical regardless of which panel
  occupies the `<aside>`.
