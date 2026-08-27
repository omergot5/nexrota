# Deferred Items — Phase 04 (עמדות קבועות)

## Out-of-scope: intermittent `permission denied for function gs_join_team` in `npm run test:backend`

**Discovered during:** 04-01, Task 2 (extending `scripts/verify-backend.mjs` for `gs_positions`).

**What happened:** Across several `npm run test:backend` runs in quick succession (needed to validate the new `gs_positions` RLS/idempotency section against the live schema), the pre-existing "returning guard" and "preferences" sections — unrelated to this phase's `gs_positions` work — intermittently failed with `permission denied for function gs_join_team`, `Request rate limit reached`, and cascading downstream failures (null profile references, etc.).

**Root cause (not investigated further, per scope boundary):** Most likely Supabase Auth rate-limiting from repeated anonymous sign-ins / email signups within a short window, caused by re-running the full backend suite several times back-to-back while debugging the `gs_positions` addition. Every run that included enough of a gap between it and the previous one passed cleanly on all pre-existing sections; the failures only appeared on rapid-fire reruns.

**Why deferred, not fixed:** `scripts/verify-backend.mjs`'s "returning guard"/"preferences" sections were not touched by this plan (`04-01`), and the failure is not reproducible in isolation (confirmed via a throwaway single-supervisor/single-guard debug script that exercised the exact same `gs_positions` RLS path cleanly). Per the executor's scope boundary, only issues directly caused by this task's changes are auto-fixed; this is pre-existing test flakiness unrelated to `gs_positions`.

**Evidence the new `gs_positions` section itself is not flaky:** the final clean run of `npm run test:backend` (after `0008_positions_index_fix.sql` was applied live) shows all 8 `gs_positions` checks passing (`ok`), while the unrelated sections show the intermittent failures described above.

**Recommended follow-up (not blocking this phase):** If this recurs outside of rapid manual reruns, consider spacing out `npm run test:backend` invocations in CI, or investigating whether `gs_join_team`'s underlying RPC grant is itself sensitive to Supabase's connection/rate limits under burst load.
