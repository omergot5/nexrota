---
phase: 04
slug: standing-positions
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-02
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → Supabase (PostgREST) | All position reads/writes cross here. The anon key is public in client code, so RLS is the only real boundary. | `gs_positions` rows, `gs_shifts`/`gs_tasks.position_id` |
| Supabase Auth → `gs_profiles.role` | "Is this user a supervisor" is decided inside RLS policy, never in the browser. | role claim used by `gs_positions_write` |
| Client code → eligibility engine | `isQualified` runs in the browser; server-side enforcement was explicitly deferred to QUAL-V2-03 in Phase 3 and this phase does not extend that gap. | qualified-guard list |
| Team data → guard screen | `GuardApp` reads position data already scoped to the caller's team by RLS via `loadTeam`; the screen requests nothing additional. | positions, guard names |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Elevation of Privilege | `gs_positions` write | high | mitigate | `gs_positions_write` policy scoped to `team_code = gs_my_team() and gs_is_supervisor()`. Live-verified: a non-supervisor write is rejected at the database layer. | closed |
| T-04-02 | Information Disclosure | `gs_positions` read | high | mitigate | `gs_positions_read` policy scoped to `team_code = gs_my_team()`. Guessing another team's `position_id` returns no row. **Note:** the original 0007 migration used a raw `auth.uid()` subquery that this audit found did NOT actually enforce team-scoping correctly for the real anonymous-demo auth flow (returned zero rows for legitimate same-team reads, not a leak, but a functional break of the same policy). Fixed in `0009_positions_rls_use_helpers.sql` — now uses the same `gs_my_team()` pattern proven correct on `gs_shifts`. Live-verified post-fix across two fresh demo sessions and 3+ weeks with no reload. | closed |
| T-04-03 | Tampering | `shape` / `weekdays` input | medium | mitigate | Column-level `check (shape in ('template','weekly'))`; `weekdays` written only through `positionToRow` and validated as integers 0–6 in the form layer (04-02). ASVS V5. | closed |
| T-04-04 | Tampering | Client-side-only qualification enforcement | medium | accept | Documented, unextended carryover from Phase 3 — QUAL-04/QUAL-05 enforced in-browser, server enforcement deferred to QUAL-V2-03 (REQUIREMENTS.md). This phase does not widen the gap: it reuses the same `isQualified` over the same data. | closed |
| T-04-05 | Denial of Service | `ensurePositionsForWeek` | low | mitigate | Returns immediately with no write and no `refresh()` when nothing is missing; without this gate, every week switch would trigger a write+refresh round trip. | closed |
| T-04-06 | Information Disclosure | "who's qualified" list, supervisor screen | low | accept | Derived from `gs_profiles` of the same team, already delivered to the client via `loadTeam` under RLS. The screen exposes no field that wasn't already reachable. | closed |
| T-04-07 | Repudiation | "who's working this week" read | low | accept | Read-only screen; source of truth stays `gs_assignments`/`gs_tasks.assignees` with the existing `assignmentMeta.source` — nothing new to attribute. | closed |
| T-04-08 | Elevation of Privilege | Position form actions | high | mitigate | The form is only reachable from `SupervisorApp`, but that's not the real control — `gs_positions_write` (see T-04-01, now on the corrected `gs_my_team()`/`gs_is_supervisor()` pattern) rejects a guard calling the API directly, at the database layer. | closed |
| T-04-SC | Tampering | npm installs | n/a | accept | No external package added by this phase (04-RESEARCH.md Package Legitimacy Audit: not applicable). No install task, no legitimacy gate to pass. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-04 | Client-side-only qualification enforcement — carried over unchanged from Phase 3's own accepted risk; server-side enforcement is tracked as QUAL-V2-03 | Phase 3 decision, reaffirmed unchanged in Phase 4 | 2026-08-26 |
| AR-04-02 | T-04-06 | "Who's qualified" list exposes no data beyond what RLS already delivers to the same-team client | Orchestrator (this audit) | 2026-09-02 |
| AR-04-03 | T-04-07 | Read-only screen with an existing, unmodified source of truth — no new repudiation surface | Orchestrator (this audit) | 2026-09-02 |
| AR-04-04 | T-04-SC | No external package installed this phase | Orchestrator (this audit) | 2026-09-02 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-27 | 8 | 6 | 2 (T-04-02, T-04-08 pending live RLS fix) | Orchestrator, during live browser regression testing |
| 2026-09-02 | 8 | 8 | 0 | Orchestrator (`/gsd-secure-phase 04`), ASVS L1 short-circuit — both plans authored their threat register at plan time, all 8 threats carry a documented disposition (mitigate with verified evidence, or accept with rationale) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-02
