-- Phase 13 (BUG-03): the `supabase_realtime` publication had zero tables in
-- it (verified via `select * from pg_publication_tables where
-- pubname='supabase_realtime'` — empty result). useGuardian.js's realtime
-- effect subscribes to postgres_changes on these five tables and expects
-- write-from-elsewhere to trigger a refresh() for every connected client —
-- that has never fired, on any table, since the project's inception. This is
-- the deeper reason a guard's "התורנויות שלי" view could sit stale after a
-- supervisor publishes/unpublishes: not a rate-limit disconnect losing
-- events, but no events ever leaving the DB in the first place. The
-- visibilitychange/SUBSCRIBED-triggered refresh() added in useGuardian.js
-- (Phase 13) papers over this by re-reading on reconnect/resume regardless,
-- but live in-foreground updates need the tables actually published.
alter publication supabase_realtime add table
  public.gs_work_items,
  public.gs_work_item_assignments,
  public.gs_availability,
  public.gs_profiles,
  public.gs_swap_requests;
