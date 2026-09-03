# Deferred Items — Phase 04 (עמדות קבועות)

## Out-of-scope: intermittent `permission denied for function gs_join_team` in `npm run test:backend`

**Discovered during:** 04-01, Task 2 (extending `scripts/verify-backend.mjs` for `gs_positions`).

**What happened:** Across several `npm run test:backend` runs in quick succession (needed to validate the new `gs_positions` RLS/idempotency section against the live schema), the pre-existing "returning guard" and "preferences" sections — unrelated to this phase's `gs_positions` work — intermittently failed with `permission denied for function gs_join_team`, `Request rate limit reached`, and cascading downstream failures (null profile references, etc.).

**Root cause (not investigated further, per scope boundary):** Most likely Supabase Auth rate-limiting from repeated anonymous sign-ins / email signups within a short window, caused by re-running the full backend suite several times back-to-back while debugging the `gs_positions` addition. Every run that included enough of a gap between it and the previous one passed cleanly on all pre-existing sections; the failures only appeared on rapid-fire reruns.

**Why deferred, not fixed:** `scripts/verify-backend.mjs`'s "returning guard"/"preferences" sections were not touched by this plan (`04-01`), and the failure is not reproducible in isolation (confirmed via a throwaway single-supervisor/single-guard debug script that exercised the exact same `gs_positions` RLS path cleanly). Per the executor's scope boundary, only issues directly caused by this task's changes are auto-fixed; this is pre-existing test flakiness unrelated to `gs_positions`.

**Evidence the new `gs_positions` section itself is not flaky:** the final clean run of `npm run test:backend` (after `0008_positions_index_fix.sql` was applied live) shows all 8 `gs_positions` checks passing (`ok`), while the unrelated sections show the intermittent failures described above.

**Recommended follow-up (not blocking this phase):** If this recurs outside of rapid manual reruns, consider spacing out `npm run test:backend` invocations in CI, or investigating whether `gs_join_team`'s underlying RPC grant is itself sensitive to Supabase's connection/rate limits under burst load.

## Out-of-scope: intermittent `permission denied for function gs_my_team` in the `gs_positions` section, post-0009

**Discovered during:** Phase-level `gsd-verifier` re-run of `npm run test:backend` after the orchestrator's `0009_positions_rls_use_helpers.sql` RLS fix (see 04-01-SUMMARY.md's "Post-Merge Finding").

**What happened:** Four independent `npm run test:backend` runs, spaced 20–60s apart, each showed the `standing positions` section's `guard can read their own team's position` check failing with `permission denied for function gs_my_team` — the same check that a clean isolated reproduction (fresh supervisor + fresh guard, no prior script traffic, same live database, same migration state) passed twice in a row.

**Root cause (working theory, not fully confirmed):** `gs_my_team()`/`gs_is_supervisor()` have `EXECUTE` granted to the `authenticated` role but explicitly **not** to `anon` (verified directly: `has_function_privilege('anon', 'gs_my_team', 'EXECUTE')` = `false`, `'authenticated'` = `true` — this is deliberate, existing project policy: an unauthenticated client should never be able to resolve team membership). `scripts/verify-backend.mjs` creates `guardA`'s Supabase client session near the top of a long script (`persistSession:false, autoRefreshToken:false`) and reuses it many sections and real-world minutes later in the `standing positions` section. If that JWT expires or is otherwise rejected by PostgREST before then, the request likely falls back to the `anon` API key for that call — which cannot execute `gs_my_team()`, producing exactly this error. A real browser session (Supabase JS client with default `autoRefreshToken: true`, as used by the actual app) would not hit this.

**Why deferred, not fixed:** The underlying RLS content (`0009_positions_rls_use_helpers.sql`) is demonstrably correct — proven both by the clean isolated reproduction and by extensive live browser regression testing (real anonymous demo sessions, multiple never-visited weeks, no reload) performed by the orchestrator, which never hit this error. The failure is specific to `verify-backend.mjs`'s own session-lifecycle choice (`autoRefreshToken:false`, long script, stale reused client), not to the migration or application code. Hardening the script (e.g. re-creating or refreshing `guardA`'s session immediately before the `standing positions` section) is a reasonable follow-up but is out of scope for the plans that shipped the feature.

**Decision:** Accepted as this same pre-existing class of test-harness flakiness (long-running `verify-backend.mjs` session + auth staleness), not a functional regression. Phase 4 verification (`04-VERIFICATION.md`) treats this as resolved for closure purposes on that basis.

**Recommended follow-up (not blocking):** Add an explicit session refresh (or a fresh client) immediately before the `standing positions` section in `scripts/verify-backend.mjs`, so this section's own long-running-script exposure matches the isolated reproduction that passes cleanly.
