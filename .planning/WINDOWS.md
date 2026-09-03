---
schema_version: 1
open_count: 5
waived_count: 0
fixed_count: 0
total_count: 5
last_updated: 2026-09-03T12:04:32.800Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 04 | unrun-verify | .planning/phases/04-standing-positions/04-02-PLAN.md |  | Task 1 human-check not run: no chromium-cli/Playwright and no live-Supabase credentials in this worktree; POS-01 no-button materialization not observed in browser | open |  | 2026-08-27T08:14:25.005Z |  |
| 2 | 04 | unrun-verify | .planning/phases/04-standing-positions/04-02-PLAN.md |  | Task 2/3 human-check not run: POS-05 four-channel visual distinction (greyscale/hand-covering tests) not observed in a real browser on either the supervisor or guard screen | open |  | 2026-08-27T08:14:31.385Z |  |
| 3 | 05 | unrun-verify | src/components/supervisor/UnifiedBoard.jsx |  | Task 2 human-check (6 items) not run in a live browser — no browser tool available to this parallel worktree agent; data-level coverage passes via verify-board.mjs, but visual/click confirmation is outstanding (see 05-01-SUMMARY.md) | open |  | 2026-09-02T13:02:04.780Z |  |
| 4 | 05 | unrun-verify | src/components/GuardApp.jsx |  | Task 2 human-check not run in this worktree agent session (no browser): task-in-duty-list ordering, timed-only hero selection, no duplication, QUAL-08 lock parity guard-vs-supervisor, worded empty state | open |  | 2026-09-02T19:24:12.259Z |  |
| 5 | 05 | unrun-verify | .planning/phases/05-unified-board/05-05-PLAN.md |  | Task 2 human-check items 1-6 (glyph legibility, blocked-label legibility, no-padlock-elsewhere, empty-state copy, no-legend D-14, יומן/participant parity) not verified in browser — isolated worktree, no browser access | open |  | 2026-09-03T12:04:32.800Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "04",
    "file": ".planning/phases/04-standing-positions/04-02-PLAN.md",
    "line": null,
    "description": "Task 1 human-check not run: no chromium-cli/Playwright and no live-Supabase credentials in this worktree; POS-01 no-button materialization not observed in browser",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T08:14:25.005Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": ".planning/phases/04-standing-positions/04-02-PLAN.md",
    "line": null,
    "description": "Task 2/3 human-check not run: POS-05 four-channel visual distinction (greyscale/hand-covering tests) not observed in a real browser on either the supervisor or guard screen",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T08:14:31.385Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "05",
    "file": "src/components/supervisor/UnifiedBoard.jsx",
    "line": null,
    "description": "Task 2 human-check (6 items) not run in a live browser — no browser tool available to this parallel worktree agent; data-level coverage passes via verify-board.mjs, but visual/click confirmation is outstanding (see 05-01-SUMMARY.md)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T13:02:04.780Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "05",
    "file": "src/components/GuardApp.jsx",
    "line": null,
    "description": "Task 2 human-check not run in this worktree agent session (no browser): task-in-duty-list ordering, timed-only hero selection, no duplication, QUAL-08 lock parity guard-vs-supervisor, worded empty state",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-02T19:24:12.259Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "05",
    "file": ".planning/phases/05-unified-board/05-05-PLAN.md",
    "line": null,
    "description": "Task 2 human-check items 1-6 (glyph legibility, blocked-label legibility, no-padlock-elsewhere, empty-state copy, no-legend D-14, יומן/participant parity) not verified in browser — isolated worktree, no browser access",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-03T12:04:32.800Z",
    "resolved_at": null
  }
]
````
