# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## unpublish-fails-after-publish — guard's "התורנויות שלי" stays stale after publish/unpublish until a cold reload (realtime publication empty)
- **Date:** 2026-09-25
- **Error patterns:** unpublish, ביטול הפצה, בטל פרסום, publish, stale view, guard does not update, needs reload, realtime not firing, postgres_changes, no events, intermittent, supervisor board reverts, optimistic patch overwritten, refresh race
- **Root cause(s):** supabase_realtime publication had zero public tables (never tracked by a migration), so no postgres_changes event ever reached any client, AND the client had no resync on resume/(re)join, so a running guard stayed on its app-open snapshot until a cold reload; latent RC1 race (not operative pre-fix, live after 0023): useGuardian.optimistic() did not invalidate refresh() calls in flight and publish never re-read after writing, so a pre-write loadTeam could repaint published=true (reproduced in Node); supervisor-side pre-fix mechanism not determined (not reproduced live)
- **Fix:** sequenceGuard.optimisticWrite `reconcile` (bump the token before painting, await a post-write refresh) used by publish; channel.subscribe(SUBSCRIBED -> refresh) and visibilitychange -> refresh in useGuardian.js; scripts/verify-publish-sync.mjs in npm test; migration 0023 adds the 5 subscribed tables to supabase_realtime
- **Files changed:** package.json, src/hooks/useGuardian.js, src/lib/sequenceGuard.js, scripts/verify-publish-sync.mjs, supabase/migrations/0023_realtime_publication.sql
- **Why not caught:** no gate existed for this class. npm test is Node-only and cannot see realtime, and nothing checked publication membership. Phase 12's live check read only the supervisor's optimistic paint, never a running second (guard) session.
- **Recurrence guard:** supabase/migrations/0023_realtime_publication.sql (membership tracked in the repo); resync on SUBSCRIBED/visibilitychange in src/hooks/useGuardian.js; scripts/verify-publish-sync.mjs (17 checks, npm test); qa_checklist_BUG04 in .planning/debug/resolved/unpublish-fails-after-publish.md. Open gap: no automated subscribed-tables vs pg_publication_tables check. Hazards now live after 0023: DELETE events bypass RLS and fan out to all teams; N-row writes cause N refreshes per client.
---

