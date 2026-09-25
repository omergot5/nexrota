---
status: resolved
trigger: "Phase 13 (ROADMAP.md, BUG-01..04): after a supervisor publishes a week, 'ביטול הפצה' (unpublish) sometimes fails — shifts don't return to draft/unpublished state and/or the guard's 'התורנויות שלי' view keeps showing them as published. Intermittent: during Phase 12's own live verification, unpublish did NOT reproduce the bug in two separate attempts."
created: 2026-09-25
updated: 2026-09-25
---

## Symptoms

1. **Expected behavior**: Supervisor publishes a week (shifts become visible/published to guards). Supervisor then clicks "בטל הפצה" (unpublish). Shifts should return to draft state, and guards should stop seeing them as published in "התורנויות שלי".
2. **Actual behavior**: Sometimes unpublish does not work reliably — either the shifts stay marked as published in the DB, or the UI stays showing them as published, or the guard-side view lags/never updates. Exact failure mode (silent error / server error / nothing happens) not yet documented — reproduction is the first task.
3. **Error messages**: None observed yet in prior sessions; Phase 12 live-verification saw two clean successful unpublishes with no errors. The bug is intermittent/conditional, not a hard failure every time.
4. **Timeline**: Pre-existing, known bug flagged going into Phase 13 (ROADMAP.md notes on Phase 12 CONFIRM-04: "'ביטול הפצה' לא עובד — זה הבאג של Phase 13").
5. **Reproduction**: Publish a week as supervisor, then unpublish it, ideally repeated across multiple attempts/timings since it's intermittent. Check both the supervisor board state and the guard's "התורנויות שלי" view. Test both terminology modes (civil "בטל פרסום" vs army "הפץ סד\"כ").

## Known ruled out

- `src/lib/api.js`'s `setPublished()` (~lines 597-612) already has correct `.select()` + row-count-check RLS handling — verified via prior grep, not the suspect.

## Suspected area

- `src/hooks/useGuardian.js`'s `publish` action (~line 577, now shifted after Phase 12 changes — verify current line) wraps the write in `optimistic()`. Investigate the optimistic patch/rollback logic and whoever calls `publish(ids, false)`.
- Unexplored lines: status transitions, error handling that silently swallows an exception, race conditions against the realtime subscription (`gs_shifts` subscription triggering `refresh()`).
- `src/lib/terms.js` splits terminology (`action.unpublish` = "בטל פרסום" generic vs. army mode "הפץ סד\"כ") — verify both modes are exercised.

## Current Focus

status_note: "RESOLVED (session 3 closeout). Human-verify checkpoint answered 'confirmed fixed' by the orchestrator's live browser + DB run. Root cause reconciled with the live empty-publication finding: see Resolution."
bug_class: "Bohrbug on the guard front, deterministic once the environment is known: the realtime publication was empty, so a running guard client NEVER learned about a publish/unpublish until a cold reload. The earlier 'Mandelbug' label depended on RC2 (dropped realtime events), which could not operate because no events were ever sent."
hypothesis: "CONFIRMED (guard front): an AND of (a) an empty supabase_realtime publication, so no postgres_changes event ever left the DB, and (b) no client-side resync on resume/(re)join. Together they left a guard's 'התורנויות שלי' on the snapshot loaded at app open. LATENT (supervisor front): the RC1 optimistic/refresh race is a real code defect, reproduced in Node. It could not fire from the publish's own realtime storm before the fix because there was no realtime. 0023 makes it live and `reconcile` guards it. NOT DETERMINED: the pre-fix mechanism of any supervisor-board-shows-published symptom, which was never reproduced live."
test: "Done. Live post-fix (orchestrator): security team, 14/14 -> 0 on unpublish, 0 -> 14/14 on publish (direct SQL). Guard cold-open shows the correct state both ways. Node: verify-publish-sync.mjs 17/17. npm test 468 ok, build pass."
expecting: "n/a (closed)"
next_action: "None in this session. Session manager commits the fix files and this doc. Follow-ups are listed under Resolution.follow_ups."

reasoning_checkpoint:
  hypothesis: "(original, session 2; superseded in part, see Resolution) Unpublish 'fails' because (RC1) useGuardian.optimistic() paints the unpublish patch without invalidating in-flight refresh() calls and publish() does not re-read after writing, so a pre-write loadTeam() from the publish's own realtime refresh storm repaints published=true; AND (RC2) the realtime channel never resyncs after dropped events (N-row bulk UPDATE bursts exceed Supabase's 100 msg/s free-tier limit -> disconnect; mobile background), so neither the supervisor's stale paint nor the guard's view is ever corrected without a reload."
  confirming_evidence:
    - "useGuardian.js 285-298: optimistic() calls setData(patch) and never touches refreshSeqRef; refresh() 203-206 checks isCurrent(token) only against other refresh() tokens -> a refresh issued pre-patch is still current and paints."
    - "useGuardian.js 612-620: publish = optimistic(patch, setPublished) with no refresh() on success (contrast deleteShifts/replaceShifts/applyPlan which all await refresh())."
    - "useGuardian.js 241-254: channel.subscribe() without a status callback; realtime-js 2.101 fires SUBSCRIBED on every rejoin (phoenix Channel.rejoin -> joinPush.resend, persistent recHooks) but nobody listens."
    - "Supabase realtime limits doc: 100 msg/s free tier, excess disconnects connections, no replay. Army demo week = 62 shifts -> 62 msgs per client per publish; Phase 12's non-repro used a 14-shift security week."
  falsification_test: "(1) Node: if the pure repro with the ORIGINAL optimistic logic (no guard.next()) does not repaint published=true when a pre-write refresh resolves after the patch, RC1 is false. (2) Live: if an army week of ~62 shifts published+unpublished with supervisor+guard clients online shows NO realtime disconnect/'Too many messages' and the guard view updates without reload, RC2's rate-limit leg is false (RC2's resync gap would still stand for mobile background)."
  falsification_outcome: "(1) RC1 survived (5 FAIL -> 17 ok). (2) Superseded by a stronger falsifier. The publication was EMPTY, so no realtime event was ever delivered. RC2's rate-limit leg is false for the pre-fix system. Its resync-gap leg survives as leg (b) of the confirmed cause."
  fix_rationale: "Bumping the sequence token at optimistic-paint time makes every pre-write read stale by construction (addresses RC1 at the choke point, for all optimistic actions, no extra network). publish additionally reconciles with a post-write refresh() — its fresh token supersedes any mid-write read and repaints server truth without depending on realtime. Resync on SUBSCRIBED (every (re)join) and on visibilitychange->visible re-reads the DB exactly when realtime may have dropped events, which fixes the guard front and the supervisor's persistence leg. None of this suppresses the symptom: they restore the invariant 'the last paint reflects a read issued after the last write'."
  blind_spots: "Cannot observe realtime in this environment: unverified whether gs_work_items is in the supabase_realtime publication at all (no migration adds it), whether the project is on the free tier, and whether the rate-limit disconnect actually occurs for a 62-row publish. If gs_work_items is NOT in the publication, live updates never worked for shifts; the resync-on-SUBSCRIBED/visibility still fixes 'guard keeps seeing it' on app open/resume, but in-foreground live update needs the table added to the publication (DB change, orchestrator). A mid-write stale refresh can still cause a sub-second flicker before the reconcile repaints."
  blind_spot_outcome: "The first blind spot came true (publication empty, see Evidence session 3). The orchestrator added the tables via 0023."
  candidate_causes:
    - "code: optimistic() not sequenced against refresh(); publish lacks post-write reconcile (useGuardian.js)"
    - "code: realtime subscription has no resync on rejoin/resume (useGuardian.js)"
    - "environment/config: Supabase Realtime rate limit (tenant_events) disconnects on N-row bulk UPDATE bursts; gs_work_items possibly absent from supabase_realtime publication (not tracked in any migration)"
    - "data: seedDemoTeam omits `published` and gs_work_items.published defaults TRUE (born-published demo week) — ruled out as the unpublish cause, side finding only"
    - "code: WorkItemForm/updateShift rewrites `published` from a possibly stale form snapshot — low-probability secondary trigger, side finding only"
  and_gate: "yes, but a different AND than recorded in session 2. The guard front needed BOTH the empty publication (config) AND the missing resume/rejoin resync (code). Either one alone would have let a running guard client catch up: live events without the resync, or a resume refresh without the events. The session-2 AND (RC1 x RC2) is withdrawn as the pre-fix production mechanism."

## Evidence

- timestamp: 2026-09-25 (session 2)
  checked: src/hooks/useGuardian.js publish action (lines 612-620) + optimistic() (285-298) + refresh() (193-215)
  found: "publish = optimistic(patch, api.setPublished, {rethrow:true}). optimistic() snapshots dataRef, setData(patch), awaits the write, rolls back only on throw. On SUCCESS nothing re-reads the DB (no refresh()). refresh() is sequenced only against other refresh() calls via createSequenceGuard (Phase 11) — the token is not bumped by optimistic()/deferred() writes, so a refresh() whose loadTeam was issued BEFORE the write is still 'current' and paints its pre-write snapshot over the optimistic patch."
  implication: "Supervisor-side revert of an unpublish is possible whenever a refresh() is in flight when the user confirms unpublish. Publish itself generates such refreshes: the UPDATE of N rows produces N realtime postgres_changes events -> N refresh() calls."

- timestamp: 2026-09-25 (session 2)
  checked: realtime subscription (useGuardian.js 241-254) and all SQL in supabase/ + docs/
  found: "Channel subscribes to gs_work_items, gs_work_item_assignments, gs_availability, gs_profiles, gs_swap_requests. NO migration (0002-0022) or doc ever adds any table to the supabase_realtime publication; gs_work_items was created in 0017 as a brand-new table. Whether it is in the publication is unknowable from the repo."
  implication: "If gs_work_items is NOT in supabase_realtime, (a) the guard client never learns about publish/unpublish until reload or an unrelated-table event, (b) the supervisor-side stale-refresh race never self-heals. Needs a live DB check: select tablename from pg_publication_tables where pubname='supabase_realtime'."

- timestamp: 2026-09-25 (session 2)
  checked: supabase/migrations/0017_work_items.sql RLS
  found: "gs_work_items_select: team_code = gs_my_team() — no published filter. Guards can SELECT unpublished rows; GuardApp filters client-side (s.published). Column default: published boolean not null default TRUE."
  implication: "Eliminates 'realtime UPDATE event suppressed for guard because new row fails RLS' as the guard-side mechanism (per migrations; live policy could differ). Default TRUE means any insert path that omits `published` creates born-published shifts."

- timestamp: 2026-09-25 (session 2)
  checked: every gs_work_items insert path (createShifts/materializeTemplateShifts via shiftToRow, demoData positionPlanToShiftRow, demoData seedDemoTeam)
  found: "shiftToRow and positionPlanToShiftRow send published explicitly (false unless set). seedDemoTeam's shiftPayload (demoData.js 163-174) omits `published` -> DB default TRUE -> seeded demo shifts are born published."
  implication: "Side finding, not the unpublish failure itself: a freshly seeded (non-army) demo week already shows N/N published."

- timestamp: 2026-09-25 (session 2)
  checked: WorkItemForm.jsx save() for shifts (line 191) + api.updateShift -> shiftToRow
  found: "Edit form initializes with setForm({...editing}) (the whole shift incl. `published`) and updateShift writes published: Boolean(form.published) unconditionally. A shift edit saved after an unpublish, with a form opened before it, re-publishes that shift; conversely any updateShift patch lacking `published` silently unpublishes."
  implication: "Secondary contributor candidate: updateShift overwrites `published` as a side effect of an unrelated edit."

- timestamp: 2026-09-25 (session 2)
  checked: all 4 publish/unpublish UI entry points (views.jsx ScheduleMgmt askPublish 1454-1464 + call sites 1478/1494/1545, WeekFlow.jsx CTA 313-322) and terms.js civil/army keys
  found: "Every entry point calls actions.publish(ids, publishFlag) with the correct boolean; ids = shift ids of the displayed week/day at click time. terms.js only changes labels (army: 'בטל הפצה'/'הפץ הכל'/'הפץ יום'; base: 'בטל פרסום'/'פרסם הכל'/'פרסם יום'); no branch picks a different action or argument per mode. ConfirmDialog (ui.jsx 665-716) awaits onConfirm and stays open on reject; publish has {rethrow:true}."
  implication: "Eliminates wrong-action/wrong-argument-per-mode and dialog-swallows-error hypotheses."

- timestamp: 2026-09-25 (session 2)
  checked: GuardApp.jsx MySchedule (137-256)
  found: "'התורנויות שלי' reads the SAME field the supervisor writes: publishedAll = shifts.filter(s => s.published), where shifts come from the guard's own useGuardian loadTeam (published column via SHIFT_SELECT). The guard client only learns about a change through (a) a realtime postgres_changes event -> refresh(), (b) the window 'online' event, or (c) a full reload. Tasks (kind='task') are shown unfiltered by design (comment at 141-145)."
  implication: "Guard-side staleness after unpublish = the guard client did not re-read after the UPDATE, i.e. a realtime event was not delivered/acted upon. There is no resync path when realtime drops events."

- timestamp: 2026-09-25 (session 2)
  checked: Supabase Realtime limits (docs: supabase.com/docs/guides/realtime/limits) + realtime-js 2.101.0 / @supabase/phoenix channel.js rejoin logic
  found: "Free plan: 100 messages/sec project-wide (an event = one WebSocket message delivered to a client). Exceeding it -> 'tenant_events': connections are DISCONNECTED; supabase-js reconnects when throughput drops. postgres_changes has no replay: events during the gap are lost. A bulk UPDATE of N rows = N messages per subscribed client. phoenix Channel.rejoin() -> joinPush.resend(); recHooks persist, so the subscribe() callback receives 'SUBSCRIBED' again on every successful rejoin — but useGuardian passes NO callback to channel.subscribe(), so nothing resyncs after a rejoin."
  implication: "Differential: army week (seedArmyRoster: 3 fixed positions + 2 posts x 3 divisions = 62 shifts/week) -> publish = 62 msgs per client; with supervisor + >=1 guard online that is >100 msgs in <1s -> disconnect. The unpublish burst that follows lands on an already-throttled/reconnecting tenant -> its events are the ones lost. Phase 12's two clean unpublish attempts used a security demo week (seedDemoTeam, 14 shifts = 28 msgs with 2 clients), well under the limit -> consistent with 'did not reproduce'. The bug report's own wording ('ביטול הפצה' = army term) points at army mode."

- timestamp: 2026-09-25 (session 2)
  checked: army 'weekly' positions (RosterWizard.jsx 224-255, api.materializeWeeklyPositionTasks)
  found: "A weekly (undivided 24/7) position materializes as kind='task'. Tasks carry no published flag, are excluded from ScheduleMgmt allIds and setPublished (.eq('kind','shift')), and GuardApp shows them unfiltered."
  implication: "Side finding (product decision, not changed here): in army mode an undivided 24/7 duty is visible to soldiers before publish and after unpublish. Default wizard/demo positions are all 'template' (divided), so this does not explain the default-flow failure."

- timestamp: 2026-09-25 (session 2)
  checked: "RED run — refresh()/optimistic() bodies extracted VERBATIM (no behavior change) into sequenceGuard.js sequencedRefresh/optimisticWrite; scripts/verify-publish-sync.mjs drives them with hand-resolved promises"
  found: "5 FAIL / 7 ok. Scenario 1 (one pre-write read resolving after the unpublish patch) ends with ['s1','s2'] still published and the stale read reports it painted; scenario 3 (62-shift army week, 62 storm reads) ends with 62 still published; day-level unpublish ends with all 4 published."
  implication: "RC1 reproduced deterministically in Node on the hook's own logic: the unpublish patch is overwritten by a read issued before the write. Oracle type: specified (the phase success criterion: after unpublish the shifts are unpublished and stay so)."

- timestamp: 2026-09-25 (session 2)
  checked: "Fix scope review — first draft bumped the sequence token on EVERY optimistic() write"
  found: "For per-click writes (toggleAssignment, setAvailability, moveAssignment, setGuard*, toggleTask, updateTeamSettings) no read follows the write, so dropping an in-flight refresh could drop another user's change or rows just created by ensurePositionsForWeek until the next realtime event. Narrowed: only a write with `reconcile` invalidates in-flight reads, because its own post-write read replaces them. Only publish passes reconcile."
  implication: "Blast radius confined to publish/unpublish; scenario 9 in verify-publish-sync.mjs pins the unchanged contract for the other actions."

- timestamp: 2026-09-25 (session 2)
  checked: "GREEN + revert-and-reconfirm + manual mutants (real file edited, restored from a scratch backup after each run, diff verified identical)"
  found: "Fixed: 17/17 ok. Revert both fix lines: 7 FAIL (incl. 62-shift army storm and flicker history 2→0→2). Mutant A (drop pre-paint bump): 1b flicker FAIL (2→0→2→0). Mutant B (drop reconcile): scenario 2 FAIL. Mutant D (bump unconditionally): scope scenario 9 FAIL. Mutant E (bump after write): 1b FAIL. Mutant C (reconcile not awaited): survives — equivalent, refresh() takes its token synchronously on call, so ordering is identical; only the dialog closes one read earlier."
  implication: "Every fix line is load-bearing and killed by a specific scenario. npm test: 468 ok / 0 FAIL. npm run build: pass (pre-existing >500kB chunk warning only)."

- timestamp: 2026-09-25 (session 3, orchestrator live check step 0)
  checked: "Live DB via Supabase MCP: select tablename from pg_publication_tables where pubname='supabase_realtime'"
  found: "EMPTY. The realtime publication held zero public tables, and had for the whole life of the project. Only two publications exist, supabase_realtime and supabase_realtime_messages_publication, and neither contains any public table. The orchestrator wrote supabase/migrations/0023_realtime_publication.sql and applied it live. It adds gs_work_items, gs_work_item_assignments, gs_availability, gs_profiles and gs_swap_requests, which are exactly the five tables useGuardian.js subscribes to."
  implication: "Before this fix, no postgres_changes event ever reached any client, on any table. So (1) a running guard client could learn about a publish/unpublish only through the window 'online' event or a full reload. That is the confirmed guard-side mechanism. (2) Publish/unpublish never triggered any refresh() on any client, so the session-2 RC1 trigger (the N refreshes from the preceding publish's realtime storm) did not exist in production. (3) RC2's rate-limit disconnect could not drop events that were never sent. RC1 and RC2 as recorded cannot explain the pre-fix symptom."

- timestamp: 2026-09-25 (session 3, static re-examination)
  checked: "Every pre-fix path that could leave the SUPERVISOR's board showing 'published' after a successful unpublish, with realtime inert: all refresh() callers in useGuardian.js (grep), boot/hydrate, the offline snapshot, SupervisorApp's ensurePositionsForWeek effect"
  found: "(a) publish/unpublish = optimistic() with no refresh() of its own, so a publish->unpublish sequence produced zero reads. (b) The only pre-fix refresh() sources were: window 'online'; the awaited refresh() inside other run() actions (seedDemo 590, addShifts 597, updateShift 603, deleteShifts 623, replaceShifts 641, ensurePositionsForWeek 1030, and others at 759-1003). ensurePositionsForWeek runs on week navigation (SupervisorApp.jsx 136-138) but returns before refresh() when nothing is missing, and rows it creates are unpublished (shiftToRow). For RC1 to fire, one of these reads must be issued before the unpublish paint and resolve after it. That means the user completes the two-click ConfirmDialog inside one loadTeam round-trip of an unrelated action. It is theoretically reachable but not a credible explanation of a recurring report. (c) boot()/hydrate() runs only at mount. The offline snapshot is used only when navigator.onLine is false and the load fails, and saveOffline (222-224) re-saves after every paint, including the unpublish patch. Neither can bring back 'published'. (d) Mechanisms that were operable pre-fix but are partial or different: the stale WorkItemForm snapshot re-publishes one edited shift; re-running seedDemoTeam after an unpublish creates born-published shifts (published DEFAULT TRUE). Neither is 'unpublish did not work' on a whole week."
  implication: "No concrete pre-fix mechanism was found for a whole-week supervisor-side 'still published' symptom. The original report does not say which screen it came from. The one front that was certainly broken is the guard's. Record it as NOT DETERMINED, NOT REPRODUCED LIVE, and do not attribute it to RC1/RC2. No code defect was found by this re-examination, so no code was changed in session 3."

- timestamp: 2026-09-25 (session 3, orchestrator live check, post-fix build only)
  checked: "Security (civil) team, 14 demo shifts + 20 guards, fixed code plus 0023 applied. Supervisor 'בטל פרסום' -> confirm, then 'פרסם הכל' -> confirm, with a direct SQL read after each. A real guard joined via join code and checked 'התורנויות שלי'."
  found: "The DB went from 14/14 to 0 published immediately on unpublish, and from 0/14 back to 14/14 on publish. After unpublish, the guard saw 'האחמ״ש עדיין לא פרסם את הסידור'. After re-publish, a fresh guard login (cold open) showed the full schedule. The orchestrator's own rapid reloads caused refresh-token rotation (auth logs: token_revoked, 429 over_request_rate_limit on /token). That was test method, not a product defect. npm test 468 ok, build pass. The test team was deleted afterwards."
  implication: "Both fronts are correct post-fix in civil mode on a 14-shift week, for the supervisor board/DB and for a guard cold open. The pre-fix reproduction was not run, so BUG-01's 'reproduced live' criterion is met only by the Node reproduction plus the live empty-publication finding, not by a live pre-fix browser run."

- timestamp: 2026-09-25 (session 3)
  checked: "npm test and node scripts/verify-publish-sync.mjs re-run on the current working tree (no code changes in session 3). Supabase docs on postgres_changes and RLS."
  found: "npm test: 468 ok, 0 FAIL. verify-publish-sync.mjs: 17 ok, 'all ok'. package.json 'test' includes verify-publish-sync.mjs. Supabase docs say RLS is NOT applied to DELETE events on postgres_changes (the old record carries the primary key only), and DELETEs cannot be filtered without REPLICA IDENTITY FULL."
  implication: "The regression guard exists and passes. New hazard from 0023 (follow-up, not a defect in this fix): each DELETE on the five published tables is delivered, PK-only, to every subscribed client in EVERY team. The channel has no team filter, so each such event triggers a refresh() (one loadTeam) on every connected client project-wide. A 62-shift week deletion in one team fans out to all teams and counts toward the project-wide message limit. The SUBSCRIBED resync keeps this correct after a disconnect, but it is wasteful, and it leaks row UUIDs across tenants."

## Eliminated

- hypothesis: "api.setPublished() DB write is wrong (RLS/zero-rows swallowed)"
  evidence: "api.js 611-626: .select('id') + !data?.length -> throws. RLS write policy is team+supervisor, all ids in one team -> all-or-nothing. Pre-ruled-out by Phase 12 as well."
  timestamp: 2026-09-25

- hypothesis: "A UI entry point (civil vs army) calls publish with the wrong action/argument"
  evidence: "All 4 entry points pass the correct boolean; terms.js only swaps labels. See Evidence entry on entry points."
  timestamp: 2026-09-25

- hypothesis: "ConfirmDialog/run() silently swallows an unpublish error"
  evidence: "publish passes {rethrow:true}; ConfirmDialog.confirm() stays open on reject; run() sets the error banner. A failed write is visible, and the bug report records no error."
  timestamp: 2026-09-25

- hypothesis: "Guard never receives the unpublish realtime event because the UPDATE makes the row invisible to the guard under RLS"
  evidence: "0017 gs_work_items_select = team_code = gs_my_team() with no published predicate; guards see unpublished rows (filtered client-side)."
  timestamp: 2026-09-25

- hypothesis: "Guard view reads a different field than the supervisor writes"
  evidence: "GuardApp publishedAll = shifts.filter(s => s.published) — same gs_work_items.published column via SHIFT_SELECT/shiftFromRow."
  timestamp: 2026-09-25

- hypothesis: "(session-2 RC2, as the pre-fix production mechanism) Realtime events for publish/unpublish were lost to a Supabase tenant_events rate-limit disconnect tripped by N-row bulk UPDATE bursts"
  evidence: "The live supabase_realtime publication was empty (session 3 Evidence), so no postgres_changes event was ever sent. There were no events to drop. The missing resync that RC2 described is real and is leg (b) of the confirmed cause. The rate-limit leg is eliminated for the pre-fix system. It is a live hazard only now that 0023 publishes the tables."
  timestamp: 2026-09-25 (session 3)

- hypothesis: "(session-2 RC1 trigger, as the pre-fix production mechanism) The preceding publish's N realtime-triggered refresh() calls resolved after the unpublish patch and repainted published=true on the supervisor's board"
  evidence: "With the publication empty, a publish triggered zero refresh() calls on any client, and publish has no refresh() of its own pre-fix (session 3 static re-examination). The RC1 code defect (optimistic() not sequenced against refresh()) is real, since the Node reproduction shows 5/7 FAIL on the verbatim logic. It is retained as a latent hazard that 0023 activates, not as the observed cause."
  timestamp: 2026-09-25 (session 3)

- hypothesis: "Supervisor board brought back 'published' by the offline snapshot or by boot/hydrate"
  evidence: "The snapshot is read only when navigator.onLine is false AND the load threw. saveOffline re-saves after every paint, including the unpublish patch. hydrate runs only at mount."
  timestamp: 2026-09-25 (session 3)

## Resolution

root_cause: >
  CONFIRMED, guard front (AND of two conditions): the live supabase_realtime publication contained zero
  public tables for the project's whole life, and no migration ever added any. So no postgres_changes event
  reached any client, and the useGuardian.js realtime channel (pre-fix 241-254) was inert. The client also
  had no resync path on app resume or channel (re)join (pre-fix: only window 'online'). A running guard's
  "התורנויות שלי" (GuardApp.jsx 139, shifts.filter(s => s.published)) therefore stayed on the snapshot it
  loaded at app open. Guards saw a publish or unpublish only after a cold reload;
  LATENT, not operative pre-fix: the RC1 race in useGuardian.optimistic() (pre-fix 285-298). The optimistic
  patch was not sequenced against refresh() calls already in flight, and publish (pre-fix 612-620) never
  re-read after writing. A loadTeam() issued before the unpublish write and resolving after it repaints
  published=true, as reproduced in Node. Before the fix, publish produced no refresh() calls because realtime
  was inert, so this race could not come from the publish's own event storm. 0023 makes it live: a 62-shift
  publish now fans out 62 refresh() calls per client. The `reconcile` fix guards against it. RC2's
  rate-limit-disconnect leg could not operate pre-fix and is eliminated as a cause;
  NOT DETERMINED (not reproduced live): the pre-fix mechanism of any supervisor-board-still-shows-published
  symptom. A static check of every pre-fix refresh() caller, boot/hydrate and the offline snapshot found no
  credible whole-week mechanism with realtime inert. The only operable candidates are partial (a stale
  WorkItemForm snapshot re-publishing one edited shift, or re-seeding a demo week with published DEFAULT
  TRUE). The original report does not say which screen it came from, and the guard front is the one that
  was certainly broken.
fix: >
  (1) src/lib/sequenceGuard.js: refresh()/optimistic() bodies moved verbatim into sequencedRefresh() and
  optimisticWrite() (hook keeps React glue only) so the race is Node-testable. optimisticWrite gains
  `reconcile`: when set it takes a sequence token BEFORE painting (every in-flight read becomes stale) and,
  after a successful write, awaits the reconcile read (fresh token supersedes mid-write reads; repaints DB
  truth without depending on realtime). Writes without reconcile are unchanged. (2) useGuardian.js: publish
  passes { rethrow: true, reconcile: true } (reconcile = refresh). (3) useGuardian.js: channel.subscribe(status
  => status === 'SUBSCRIBED' && refresh()), which resyncs on every (re)join, including the gap between the
  first loadTeam and the first join. visibilitychange -> visible (when online) -> refresh(), for phones
  resuming from the background. (4) scripts/verify-publish-sync.mjs (17 checks) wired into npm test.
  (5) supabase/migrations/0023_realtime_publication.sql (authored and applied live by the orchestrator):
  adds the five subscribed tables to supabase_realtime, so in-foreground live updates reach guards.
oracle_type: specified
cycles: "3 sessions. S1 gathering/scoping. S2 investigation, Node RED->GREEN, mutants, checkpoint. S3 live verification by the orchestrator, root-cause reconciliation and archive. 1 human-verify checkpoint round-trip."
verification:
  target_test:        { result: pass, script: "scripts/verify-publish-sync.mjs", red_before_fix: "5 FAIL on verbatim-extracted original logic (first draft); 7 FAIL on revert of final fix", rerun_session_3: "17 ok / all ok" }
  mutation_check:     { result: pass, reason_if_skipped: "Stryker not configured in project — replaced by manual scoped mutants on the fix lines", mutant_killed: "A (drop pre-paint bump), B (drop reconcile), D (unconditional bump), E (bump after write) all killed; C (reconcile not awaited) survives as an equivalent mutant (token issued synchronously)" }
  no_op_deletion:     { result: pass, deletion_justified_by_rca: true, note: "Only removed lines are the refresh()/optimistic() bodies, moved verbatim into sequenceGuard.js; the rest is additive" }
  adjacent_tests:     { result: pass, suites_run: ["npm test — 468 ok / 0 FAIL (session 2, orchestrator, and re-run in session 3)", "npm run build — pass (orchestrator)"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, scope: "Node only (RC1). No live revert was run." }
  live_browser:
    result: pass (partial scope)
    verified_live:
      - "DB: supabase_realtime publication was empty pre-fix; 0023 applied live."
      - "Security (civil) team, 14-shift demo week, fixed build: 'בטל פרסום' -> confirm took the DB from 14/14 to 0 immediately (direct SQL); 'פרסם הכל' -> confirm took it from 0 back to 14/14."
      - "Guard joined via join code: after unpublish 'התורנויות שלי' showed 'האחמ״ש עדיין לא פרסם את הסידור'; after re-publish a fresh guard login (cold app open) showed the full schedule."
      - "npm test 468 ok; npm run build pass."
    NOT_verified:
      - "Army mode / 62-shift week (labels 'הפץ הכל'/'בטל הפצה')."
      - "The rapid publish-then-unpublish race (RC1) live. It is covered only by the Node test."
      - "Same-session live WebSocket delivery to a running guard client (single browser instance, so the guard was only checked on cold open)."
      - "The visibilitychange refresh after hiding and re-showing the tab."
      - "The SUBSCRIBED resync after a real channel disconnect/rejoin."
      - "The single-day 'בטל' button on a day card."
      - "The WeekFlow bottom CTA button ('שלח לצוות'/'הפץ סד\"כ') and unpublish from that screen."
      - "Step-5 regression sanity: assign/remove on the board, drag-move, guard availability submit."
      - "The pre-fix live reproduction (BUG-01's live-repro criterion is covered only by the Node reproduction and the live empty-publication finding)."
  guardrail_verdict:  accepted
  human_verify:       "confirmed fixed (orchestrator live browser + DB run, session 3), within the scope listed under verified_live"
files_changed:
  - package.json
  - src/hooks/useGuardian.js
  - src/lib/sequenceGuard.js
  - scripts/verify-publish-sync.mjs
  - supabase/migrations/0023_realtime_publication.sql   # authored and applied live by the orchestrator
follow_ups:
  - "0023_realtime_publication.sql uses a plain `alter publication supabase_realtime add table ...`. It is NOT idempotent and will error ('relation ... is already member of publication') if re-run on a DB where any of the five tables is already published, e.g. a fresh environment that replays migrations after a manual add. Consider a guarded DO block that checks pg_publication_tables. Not edited here, per instruction."
  - "NEW with 0023: RLS is not applied to DELETE postgres_changes events (Supabase docs), and the channel has no team filter. Every DELETE on the five tables in any team reaches every subscribed client in every team (PK only). Each one triggers a loadTeam, and all of them count toward the project-wide realtime message limit. It also leaks row UUIDs across tenants. Consider a team_code filter for INSERT/UPDATE and REPLICA IDENTITY FULL (or a broadcast channel per team) for DELETE."
  - "NEW with 0023: the RC1 event storm is now real. An N-row publish or delete delivers N events per client, which means N refresh() calls. The sequence guard ensures only the last one paints, but N network reads still happen and bursts can hit the rate limit. Consider coalescing realtime-triggered refresh() (trailing debounce)."
  - "useGuardian.js 263-266 comment says as fact that 'the socket does go down: a publish of N rows ... trips Supabase's messages-per-second limit and disconnects everyone'. This was never observed, because realtime was inert pre-fix. Reword it as a hazard, not an observation, in a follow-up. It is a comment only, so it was not changed in this closeout."
  - "Nothing automated checks that the tables useGuardian.js subscribes to are in supabase_realtime. A backend check in the style of scripts/verify-backend.mjs (querying pg_publication_tables) would catch this whole class."
side_findings_not_fixed:
  - "demoData.js seedDemoTeam (163-174) omits `published`; gs_work_items.published DEFAULT TRUE (0017) -> a seeded non-army demo week is born published (14/14). Product decision whether to send published:false."
  - "WorkItemForm.jsx 130/191 + api.updateShift -> shiftToRow writes `published` from the form snapshot; a shift edit form opened before an unpublish and saved after it re-publishes that shift."
  - "Army 'weekly' (undivided 24/7) positions materialize as kind='task'; tasks have no published flag and GuardApp shows them unfiltered -> visible to soldiers before publish and after unpublish."
  - "No migration tracked supabase_realtime publication membership. ADDRESSED by 0023_realtime_publication.sql (see follow_ups for its idempotency and DELETE/RLS caveats)."
  - "Other optimistic() actions (toggleAssignment etc.) still allow a pre-write read to repaint over their patch until the next realtime event — same race class, deliberately out of scope (transient for per-row writes; fixing needs reconcile or rebase)."
prevention:
  five_whys_branches:
    config: "Guards never saw a publish/unpublish live -> no realtime events were sent -> the supabase_realtime publication was empty -> table membership in the publication was never written as a migration, so it was set neither in the dashboard nor in SQL -> nothing in the repo or the test suite states or checks which tables must be published."
    code: "Guards stayed stale even after returning to the app -> the client re-read only on 'online' or a full reload -> the realtime subscription was treated as the only freshness mechanism, with no resync on (re)join or resume -> nothing required a fallback when a push channel stays silent."
    verification: "The bug survived Phase 12 live verification -> that verification used one supervisor client and read the supervisor board, where the optimistic patch always looks right -> no live check looked at a second, already-running guard session without a reload."
  why_not_caught: "No gate existed for this class. npm test is Node-only and cannot see realtime, and there was no backend check of publication membership. Phase 12's live verification checked the supervisor's own optimistic paint, which is correct by construction, and never checked a running guard session. The RC1 race had no test because refresh()/optimistic() lived inside the React hook."
  recurrence_guard: "(1) supabase/migrations/0023_realtime_publication.sql now tracks publication membership in the repo. (2) useGuardian.js resyncs on SUBSCRIBED and on visibilitychange, so a silent channel no longer means a stale screen. (3) scripts/verify-publish-sync.mjs (17 checks, in npm test, verified passing) pins the RC1 race and the reconcile contract. (4) qa_checklist_BUG04 below covers the live-only legs. Gap: no automated check that subscribed tables match the publication (see follow_ups)."
qa_checklist_BUG04: >
  Automated: scripts/verify-publish-sync.mjs (in npm test) covers RC1. Manual (realtime wiring, not Node-testable):
  [0] DB: select tablename from pg_publication_tables where pubname='supabase_realtime' lists all five
  subscribed tables. [1] army team, 62-shift week, supervisor + guard in SEPARATE browser profiles; "הפץ הכל" ->
  confirm -> within 2 s "בטל הפצה" -> confirm; supervisor subtitle reads 0/62 and stays 0/62 for 30 s; guard
  "התורנויות שלי" empties without reload. [2] same in a security team ("פרסם הכל"/"בטל פרסום").
  [3] day card "בטל" in both modes: only that day returns to "טיוטה". [4] guard tab hidden for 60 s during an
  unpublish, then shown: view updates immediately. [5] DB: count of published rows for the week matches the screen.
