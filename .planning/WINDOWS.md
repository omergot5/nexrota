---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-27T08:14:31.385Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 04 | unrun-verify | .planning/phases/04-standing-positions/04-02-PLAN.md |  | Task 1 human-check not run: no chromium-cli/Playwright and no live-Supabase credentials in this worktree; POS-01 no-button materialization not observed in browser | open |  | 2026-08-27T08:14:25.005Z |  |
| 2 | 04 | unrun-verify | .planning/phases/04-standing-positions/04-02-PLAN.md |  | Task 2/3 human-check not run: POS-05 four-channel visual distinction (greyscale/hand-covering tests) not observed in a real browser on either the supervisor or guard screen | open |  | 2026-08-27T08:14:31.385Z |  |

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
  }
]
````
