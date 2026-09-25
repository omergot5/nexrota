-- Phase 13 follow-up (BUG-03 review finding): Supabase realtime's
-- postgres_changes evaluates each subscriber's RLS SELECT policy per event
-- for INSERT/UPDATE, using the row's new data — already correctly scoped
-- per-team since every RLS policy here keys off team_code. DELETE is
-- different: Postgres only sends the row's REPLICA IDENTITY columns for a
-- delete (default: primary key only), so if team_code isn't in the replica
-- identity, realtime cannot evaluate the RLS policy and — per Supabase's own
-- documented caveat — broadcasts the delete unfiltered to every connected
-- client on the table, not just the row's own team.
--
-- The 0023 migration put five tables on the realtime publication without
-- this in place, so today a delete in any team reaches every team's client
-- (the client only sees an opaque row id, not real content, since useGuardian
-- just triggers a scoped refresh() — but it's still needless cross-team
-- traffic and an unfiltered signal that leaves RLS's guarantee incomplete).
-- REPLICA IDENTITY FULL sends the whole pre-delete row, which is enough for
-- the RLS policy to filter deletes exactly like it already filters
-- inserts/updates.
alter table public.gs_work_items replica identity full;
alter table public.gs_work_item_assignments replica identity full;
alter table public.gs_availability replica identity full;
alter table public.gs_profiles replica identity full;
alter table public.gs_swap_requests replica identity full;
