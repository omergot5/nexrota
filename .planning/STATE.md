---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: גימור להשקה
current_phase: 13
current_phase_name: "באג — ביטול הפצה אחרי פרסום"
status: milestone_complete
stopped_at: "Phase 13 closed via /gsd-debug (BUG-01..04 all complete): root-caused as an AND of two faults — a stale in-flight refresh() racing the optimistic unpublish paint, and a realtime publication that had ZERO tables in it (verified empty via pg_publication_tables), so the guard's view never resynced without a cold reload. Fixed + live-verified end-to-end (supervisor DB state + guard-side view, both directions). v1.2 (גימור להשקה) milestone is now fully complete — all 8 phases done."
last_updated: "2026-09-25T03:30:00.000Z"
last_activity: 2026-09-25
last_activity_desc: "Ran /gsd-debug for Phase 13. gsd-debugger root-caused the unpublish bug as two compounding faults in useGuardian.js: (1) optimistic() didn't invalidate in-flight refresh() calls issued before the write, so a stale read could resolve after the optimistic unpublish paint and repaint 'published'; (2) the realtime channel never resynced on reconnect or tab-resume. Fix: sequenceGuard.js gained sequencedRefresh()/optimisticWrite() (refresh()/optimistic()'s bodies, moved so the race is testable in Node); publish now uses { reconcile: true } to invalidate in-flight reads and re-read after write; the realtime effect resyncs on every channel (re)join and on visibilitychange. New regression script scripts/verify-publish-sync.mjs (17 checks) wired into npm test. While investigating, discovered the realtime publication had never had any tables in it at all (a separate, deeper cause of guard-side staleness) — applied migration 0023 to add the five subscribed tables live via Supabase MCP. Live-verified in-browser + DB: registered a fresh team, unpublish flipped 14/14→0 published shifts immediately and correctly, a real guard account's 'התורנויות שלי' correctly hid the schedule; re-published and the guard's view correctly showed it again. Found during review that 0023 opened a cross-team realtime DELETE leak (Postgres only sends REPLICA IDENTITY columns on delete, so RLS couldn't filter deletes without team_code in the replica identity) — closed via migration 0024 (REPLICA IDENTITY FULL on the five tables). npm test (468 ok) and npm run build both pass throughout. Debug session archived at .planning/debug/resolved/unpublish-fails-after-publish.md. BUG-01..04 and Phase 13 marked complete in ROADMAP.md/REQUIREMENTS.md — this was v1.2's last phase, so the milestone is done."
state_head: c32387f
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 23
  completed_plans: 23
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-17)

**Core value:** אדם שמקבל את האפליקציה לידיו מסיים סידור שבועי מלא בלי שאף אחד יסביר לו כלום — ומה שהמערכת אומרת לו על עצמה הוא נכון.
**Current focus:** v1.2 (גימור להשקה) milestone complete — all 8 phases done

## Current Position

Phase: 13 (באג — ביטול הפצה אחרי פרסום) — complete, milestone closed
Plan: /gsd-debug (no phase plan files; bug workflow instead)
Status: Milestone complete
Last activity: 2026-09-25 — Phase 13 (BUG-01..04) fixed and live-verified via /gsd-debug; v1.2 done

Progress: [██████████] 100% (v1.2)

## Performance Metrics

**Velocity:**

- Total plans completed: 13 (tracked)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 04 | 2 | - | - |
| 05 | 5 | - | - |
| 06 | 4 | - | - |
| 07 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 06 P01 | 15min | 2 tasks | 3 files |
| Phase 08 P01 | 15min | 1 tasks | 1 files |
| Phase 08 P02 | 55min | 2 tasks | 1 files |
| Phase 08 P03 | unknown | 2 tasks | 2 files |
| Phase 09 P01 | ~15min | 1 tasks | 1 files |
| Phase 09 P02 | ~20min | 2 tasks | 1 files |
| Phase 10 P01 | ~15min | 1 tasks | 1 files |
| Phase 10 P02 | ~15min | 1 tasks | 6 files |
| Phase 10 P03 | 55min | 1 tasks | 1 files |
| Phase 11 P01 | 35min | 3 tasks | 6 files |
| Phase 11 P02 | ~25min | 3 tasks | 5 files |
| Phase 11 P03 | 20min | 1 tasks | 1 files |
| Phase 12 P01 | 10min | 1 tasks | 1 files |
| Phase 12 P02 | 25min | 3 tasks | 1 files |
| Phase 12 P03 | 15min | 3 tasks | 1 files |
| Phase 12 P04 | 10min | 2 tasks | 1 files |
| Phase 12 P05 | 10min | 2 tasks | 2 files |
| Phase 12 P06 | 35min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

- [v1.2 roadmap]: סדר הפאזות 6→13 מוכתב ע"י המפרט החיצוני (`shift-app-spec-for-claude-code.md`) ולא נגזר מחדש. Phase 6 קובעת דפוס עיצוב ש-7 ו-8 מאמצות; Phase 11 מייצרת את הפעולות ההרסניות ש-12 מחברת לאישור.
- [v1.2 roadmap]: 8 פאזות למרות `granularity: standard` (4-6) — איחוד היה שובר את ההתאמה 1:1 בין פאזה לנושא במפרט, ואת הנחיית ה-commit-per-topic שבו.
- v1.1 decision log: PROJECT.md Key Decisions + `.planning/milestones/v1.1-ROADMAP.md`.
- [Phase 6]: 06-01: ResourceGrid.jsx חולץ כרכיב תצוגה גנרי יחיד (D-04); mode נקרא בתוך הרכיב מ-subscribeTerms/termProfile, לא כפרופ (D-07); חוזה row.pending/item.pending קיים לפני 06-02
- [Phase 8]: 08-01: רק PROFILE_TERMS.army["nav.shifts"] שונה ל-"בניית שבוע"; BASE["nav.shifts"] (עם ה' הידיעה) נשאר ללא שינוי כפי שנעול ב-08-CONTEXT.md.
- [Phase 8]: 08-02: הלוח (UnifiedBoard) יושב עכשיו בשלב 1 (מיד אחרי בניית שבוע), לא שלב 0 — הזזה שכללה גם רילוקציה של gate ה-hasShifts ושכתוב מצב-הריק של הלוח שכבר לא קורא בשם כפתור, ואומת חי בדפדפן ולא רק בקוד
- [Phase 8]: 08-03: onRowClick אופציונלי נוסף ל-ResourceGrid.jsx (ResourceView.jsx/CalendarView.jsx נשארים ללא שינוי, לא מעבירים אותו); RosterWizard.jsx מוסיף תצוגה ממוקדת לעמדה בודדת + טוגל "מה שיש עד עכשיו" — שני הפיצ'רים לא נוגעים בשלב ה-board כלל
- [Phase 9]: RestHoursSettings placed first among team-settings siblings (before FairnessWindowSettings) reflecting hard-constraint-before-soft-criteria priority, matching autoAssign.js
- [Phase 9]: [Phase 9] 09-02: SeedDemoDialog shared once above SupDashboard, owns its own guardCount state; both real-team demo-fill buttons (SupDashboard onboarding card, TeamView empty-state) now open it instead of writing on click — startGuestDemo/AuthPage.jsx untouched
- [Phase 10]: 10-01: קישור "לדוח המלא" בכרטיס עומס מוצג תמיד (לא תלוי ב-loadRows.length) כי הדוח המלא קיים גם כשאין עדיין נתוני עומס; אין קיצור ל-positions כמוכרע ב-10-CONTEXT.md MORE-02
- [Phase 10]: 10-02: resources הוסר מ-moreItems()/views; ResourceView.jsx נמחק; 3 הערות היסטוריות (CalendarView.jsx, ResourceGrid.jsx, categories.js) נוסחו מחדש ללא המחרוזת המילולית ResourceView כדי לעמוד בשער האוטומטי של התוכנית עצמה
- [Phase 10]: MORE-01 audit table anchored as a durable Hebrew comment above moreItems() in SupervisorApp.jsx, faithfully transferred from 10-CONTEXT.md, not re-derived.
- [Phase 10]: All 5 original 'עוד' items + new analytics shortcut + 2 pre-existing dashboard shortcuts re-verified live in one integrated browser pass (gstack $B headless fallback), closing the gap left by 10-01/10-02 each verifying only their own slice.
- [Phase 10]: Code review (post-merge, full 3-plan diff) found WR-01 (4 stale present-tense RosterWizard.jsx comments still describing the deleted "מסך משאבים" as existing) and WR-02 (a stray untracked byte-identical leftover copy of the already-deleted ResourceView.jsx sitting in the working tree) — both stemmed from the 10-02 verify gate only grepping the literal string "ResourceView", not the Hebrew display name or disk state. Fixed directly; gsd-verifier re-confirmed both fixes independently against current src/.
- [Phase 11]: [Phase 11] 11-01: is_demo placement (gs_work_items only, derived demo-assignment) and army FK safety-net order (unmaterializePositionWeek before deletePosition) implemented exactly as locked in 11-CONTEXT.md — no deviation
- [Phase 11]: [Phase 11] 11-02: Inline board "x"/"+" follows the exact onMove/onDragStart optional-prop precedent (no new wiring mechanism); "+" picker deliberately scoped to toggleAssignment's own qualification-only gate, not AssignView's fuller overlap/rest-hours check, per 11-CONTEXT.md's documented scope boundary.
- [Phase 11]: [Phase 11] 11-03: demo-cleanup button wired to existing deleteDemoDataForWeek/demoShiftIdsForWeek (11-01) inside WeekFlow's shared board step; closing integration pass re-ran INLINE-04's race-condition repro through the NEW 11-02 board +/x affordances stacked with the new delete-demo action, not just the pre-existing AssignView path from Wave 1 — no bugs found, all 7 human-check points pass
- [Phase 12]: [Phase 12] 12-01: ConfirmDialog גנרי (CONFIRM-01) הוסף ל-ui.jsx לצד Modal — tone נופל ישירות ל-Btn variant, pending חוסם סגירה בזמן onConfirm, בלי צרכן עדיין (Wave 2 מחווטת)
- [Phase 12]: Pre-confirm REPLACES UndoBar for deleteShifts/deleteDemoDataForWeek/replaceShifts/removeGuard/deletePosition — no mechanism stacking
- [Phase 12]: removeRoleCompatibility promoted from unprotected run() to deferred()/UndoBar — closes a real safety gap found in Phase 12 codebase review
- [Phase 12]: 12-03: fillWeek gates confirmation only when weekShifts.length > 0 — empty week (EmptyState path) still creates immediately, no dialog
- [Phase 12]: 12-03: ScheduleMgmt publish/unpublish gated via shared askPublish() helper across all 3 UI call sites; no changes to actions.publish/api.setPublished — known unpublish bug left for Phase 13
- [Phase 12]: 12-03: clearWeek's delete call extracted into named confirmDeleteWeek helper (not inline lambda) so it doesn't trip the plan's own literal forward-scan verify-check
- [Phase 12]: 12-04: WeekFlow's step-5 CTA publish button is a separate UI entry point from ScheduleMgmt's own "פרסם הכל" (both call actions.publish(ids,true), both now gated independently, no shared component needed since one-directional); demo-cleanup button gated on demoShiftIdsForWeek(shifts, weekDates).length > 0, same as its Phase-11 visibility gate
- [Phase 12]: 12-05: RosterWizard's removeItem only opens ConfirmDialog for the item.position branch (real, saved positions) — item.seed (unsaved draft) stays immediate, no dialog, since nothing exists server-side yet to confirm deleting; setActiveKey(null) moved inside onConfirm so it only runs after the delete actually succeeds
- [Phase 12]: 12-06: `.claude/CLAUDE.md` is fully gitignored (`.gitignore` line 8, no exception) — worktree executors can never commit edits to it; the orchestrating session must apply such edits directly in the main checkout. Applied here for the Undo/pre-confirm pattern description and the third write-mechanism (`run()`) note.
- [Phase 12]: 12-06: CONFIRM-06 verified specifically via Cancel-then-full-page-reload (not just visual dismissal) across two structurally different dialogs (delete-week, publish/unpublish-all) — both confirmed byte-identical to pre-click state via direct SQL, closing the exact verification gap the phase was scoped to catch
- [Phase 13]: Root cause was an AND of two faults, not one — a stale in-flight refresh() racing the optimistic unpublish paint (dormant until realtime existed at all), AND a realtime publication with zero tables ever added to it, discovered mid-investigation by directly querying pg_publication_tables. Both needed fixing; fixing only the race would have left the guard-side view stale forever, and fixing only the publication would have left the race latent and exploitable.
- [Phase 13]: sequenceGuard.js's refresh()/optimistic() bodies were extracted into sequencedRefresh()/optimisticWrite() specifically so the race condition is testable in Node (scripts/verify-publish-sync.mjs) on the exact code useGuardian.js runs, not a reimplementation — same pattern as the file's pre-existing INLINE-04 guard.
- [Phase 13]: publish() is the only action given { reconcile: true } — it invalidates in-flight reads and re-reads after the write. Not applied to every optimistic() call: a write without a guaranteed following read (no reconcile) would drop someone else's concurrent change if it invalidated in-flight reads too.
- [Phase 13]: Migration 0023 (add 5 tables to supabase_realtime publication) immediately created a second issue found in review — Postgres only sends REPLICA IDENTITY columns on DELETE, so RLS couldn't filter delete events by team_code without it in the replica identity, meaning deletes briefly broadcast cross-team (opaque row ids only, not content). Closed same-session via migration 0024 (REPLICA IDENTITY FULL on the same 5 tables).

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

- **[v1.2 Phase 12] ✓ הושלם ואומת (2026-09-25).** שש התוכניות (12-01..12-06) בוצעו, אומתו לייב בדפדפן (צוותי בדיקה נפרדים לכל אחת מ-12-03/04/05, קוד army למחיקת-עמדה, פורק אחרי כל בדיקה). ה-סתירה לעקרון ברזל 3 (שהיה קיים מ-Phase 8) נפתרה: `CLAUDE.md` (root), `.claude/CLAUDE.md` (מוחל ישירות — gitignored, אין commit) ו-`PROJECT.md` עודכנו לתאר שני מסלולים במקביל — UndoBar כברירת מחדל לרוב הפעולות ההרסניות, פרה-אישור לרשימה סגורה ומתועדת (טבלת-ביקורת ב-useGuardian.js). CONFIRM-06 אומת במיוחד דרך ביטול+רענון-דף-מלא (לא רק דחייה חזותית) על שני דיאלוגים שונים מבנית — תוצאה זהה-בייט למצב שלפני הלחיצה, מאומת ישירות ב-SQL.
- **[v1.2 Phase 8] ✓ הושלם ואומת (2026-09-22).** שלושת התוכניות מוזגו, code review עלה 3 אזהרות (WR-01/02/03) שתוקנו ואומתו לייב בדפדפן, ו-`gsd-verifier` אישר 5/5 קריטריוני הצלחה. `UnifiedBoard.jsx` נשאר באותו שם, רק זז לשלב אחרי `shifts`.
- **[v1.2 Phase 9] ✓ הושלם ואומת (2026-09-22).** שתי התוכניות מוזגו, code review עלה 1 Critical (מחרוזת "משמרות" קשיחה בדיאלוג ההדגמה שבירה את אוצר המילים במצב army) + 2 Warnings + 1 Info — כולם תוקנו ואומתו לייב בדפדפן (כולל רישום צוות-בדיקה נקי במצב army במיוחד כדי לתפוס את הבאג), ו-`gsd-verifier` אישר 5/5 קריטריוני הצלחה.
- **[v1.2 Phase 10] ✓ הושלם ואומת (2026-09-23).** שלושת התוכניות מוזגו (10-01/10-02/10-03), code review על הדיף המלא העלה 0 Critical + 2 Warnings (הערות מיושנות ב-RosterWizard.jsx שעדיין תיארו את מסך המשאבים שנמחק כקיים, וקובץ ResourceView.jsx שנמחק מ-git אך נשאר untracked בעץ העבודה) + 1 Info — שתי האזהרות תוקנו ישירות, `npm test`/`npm run build` עברו נקי, ו-`gsd-verifier` אישר 3/3 קריטריוני הצלחה בבדיקה עצמאית מול הקוד הנוכחי.
- **[v1.2 Phase 13] ✓ הושלם ואומת (2026-09-25).** BUG-01..04 כולן נסגרו דרך `/gsd-debug` (לא GSD plan רגיל — זה workflow דיבאג). שורש: שני תקלות ביחד — refresh() ישן שיכול להתחרות בציור האופטימי של ביטול-הפצה, ופרסום realtime (`supabase_realtime`) שמעולם לא הכיל אף טבלה (התגלה תוך כדי חקירה, לא היה ידוע מראש). תוקן: `sequenceGuard.js` קיבל `sequencedRefresh`/`optimisticWrite` הניתנים לבדיקה ב-Node (`scripts/verify-publish-sync.mjs`, 17 בדיקות, מחובר ל-`npm test`); `publish` מקבל `{ reconcile: true }`; ה-realtime effect מתאזן מחדש ב-(re)subscribe וב-`visibilitychange`. Migration 0023 (הוספת 5 טבלאות לפרסום) הופעלה לייב, ומיד גילתה בעיה נוספת — DELETE לא מסונן RLS בלי `REPLICA IDENTITY FULL` — שנסגרה ב-migration 0024 באותה ישיבה. אומת לייב: פרסום→ביטול־פרסום דרך UI אמיתי, מצב DB נבדק ישירות אחרי כל קליק, וחשבון שומר אמיתי (לא סינתטי) אומת משני הכיוונים ("טרם פורסם" → מציג את הסידור המלא). זו הפאזה האחרונה ב-v1.2 — האבן-דרך כולה נסגרה.
- אין test runner בפרויקט. כל בדיקה חדשה חייבת להיות סקריפט Node עצמאי שמדפיס `ok`/`FAIL` ומחזיר קוד יציאה, מחובר ל-`npm test`. רלוונטי ישירות ל-BUG-04.
- ⚠️ [v1.1] Phases 1-3's VERIFICATION.md files predate the current `status:` frontmatter contract — GSD tooling reports them "missing" on format alone; carried forward as a known override (see MILESTONES.md v1.1 entry). Consider backfilling frontmatter early in this milestone.
- ⚠️ [v1.1] Pre-existing NUL-byte separator in `conflicts.js`'s `pairKey` — acknowledged tech debt, no observed impact (see Deferred Items below).
- [Phase 11] 11-01: Supabase migration 0022 (gs_work_items.is_demo) written and committed but NOT applied to the live database — this executor had no Supabase MCP/CLI/DB credentials available. Apply via SQL editor/CLI/MCP before Plan 11-03's demo-cleanup UI is tested live. **Resolved 2026-09-23 (post-merge follow-up, see 11-01-SUMMARY.md): migration applied live via Supabase MCP.**
- **[v1.2 Phase 11] ✓ הושלם ואומת (2026-09-24).** כל שלוש התוכניות (11-01 שכבת נתונים/state, 11-02 עריכת "x"/"+" על הלוח + תיקון FK-army, 11-03 כפתור "מחק נתוני הדגמה" + סבב אימות-אינטגרציה סוגר) בוצעו, אומתו לייב בדפדפן (7/7 נקודות human-check ב-11-03 בלבד, מעבר לנקודות שאומתו כבר ב-11-01/11-02), ו-`REQUIREMENTS.md` INLINE-01..04 כולן סומנו הושלמו (checkbox + טבלת traceability). ה-repro של הבאג INLINE-04 אומת מחדש דווקא דרך ה-affordances **החדשים** של הלוח (11-02), לא רק דרך המסלול הישן (AssignView) שנבדק בגל 1. code review על הדיף המלא (10 קבצים) העלה 2 Critical: CR-01 — כפתורי "x"/"+" החדשים על הלוח יכלו לפגוע בשקט במטא-דאטה של שיבוץ-משימה (לא-משמרת) כי toggleAssignment מחפש רק ב-data.shifts; CR-02 — deletePosition הדו-שלבי לא אטומי, וכישלון בשלב השני היה מצייר rollback-מזויף על מצב שכבר נמחק בפועל בשרת. שתי הבעיות תוקנו (item.type !== "task" gate; refresh()+setError() במקום rethrow) + 2 Warnings (z-index על ערימת אווטארים, תווית-toast ספציפית) — כולן אומתו מחדש ב-קוד (לא רק בטענה) על ידי `gsd-verifier`, שאישר 4/4 קריטריוני הצלחה.
- 12-03: ScheduleMgmt publish/unpublish (all 3 dialogs), ShiftMgmt fillWeek overwrite-gate, and TeamView remove-guard dialogs still need live-browser verification (worktree lacks Supabase credentials) — same pattern as Task 1's clearWeek, which the coordinator already verified live after merging 8326776

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260903-wx1 | Add a real center dividing line to the AuthPage split layout | 2026-09-03 | (pending) | [260903-wx1-add-a-real-center-dividing-line-to-the-a](./quick/260903-wx1-add-a-real-center-dividing-line-to-the-a/) |
| 260904-bal | Fix balanceWorkload oscillation bug + misleading "16 · כולל 40 העברות" KPI copy | 2026-09-04 | (pending) | — (direct fix, no quick-task dir; see commit for detail) |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| deferred_items | 02/deferred-items.md: Pre-existing NUL bytes in conflicts.js pairKey (no observed impact; would touch byte-identical UNIF-06 verification bytes) | acknowledged | 2026-09-03 | v1.1 |

## Session Continuity

Last session: 2026-09-25T03:30:00.000Z
Stopped at: Phase 13 closed (fixed + live-verified via /gsd-debug); v1.2 milestone fully complete
Resume file: None

## Operator Next Steps

- v1.2 (גימור להשקה) is done — all 8 phases (6-13) complete. Next step is starting a new milestone (`/gsd-new-milestone`) when there's a new scope to define, not phase work in this one.
- Not yet verified live (flagged by the debugger, non-blocking since the underlying mechanism is shared and already tested at the unit + integration level): army mode's 62-shift week, the single-day "בטל" toggle button, the WeekFlow bottom-CTA publish path, and a guard whose app is already open staying live-updated (only cold-reload/rejoin was verified, not an in-foreground WS push).
- Known pre-existing issues surfaced during Phase 13 but out of its scope, left for a future phase/milestone to triage: (1) non-army demo weeks seed shifts already published=true (DB default, not the seeder's intent); (2) editing a shift form opened before an unpublish can re-publish it on save; (3) an unsplit 24/7 army position becomes a task, and tasks have no `published` flag so soldiers can see them regardless of publish state; (4) a write touching N rows now triggers N full reloads per connected client — works correctly but could be batched/debounced for efficiency at scale; (5) migration 0023 isn't safely re-runnable (`alter publication ... add table` errors if a table is already published) — fine as a one-shot historical migration, but worth an idempotent rewrite if migrations are ever replayed.
