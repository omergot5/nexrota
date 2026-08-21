# Feature Research: Qualifications, Roles & Task/Shift Unification

**Domain:** Workforce shift/roster scheduling — qualification/skill modeling dimension
**Researched:** 2026-08-21
**Confidence:** MEDIUM (web search only, no MCP docs/search providers configured in this environment; every claim below is corroborated across 2+ independent vendor or industry sources — see `.planning/research/` cache — but none is a primary-source spec doc, so nothing here should be treated as HIGH confidence)

**Scope note:** This file covers ONLY the four target dimensions named in the milestone brief — qualification/skill models, nested-vs-disjoint role topology, standing/recurring positions, and task/shift unification. It deliberately does not re-cover auto-assign, availability, swaps, manual assignment, or the weekly calendar, which already exist and work in NexRota.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Every leading product surveyed (Deputy, When I Work, Connecteam, Shiftboard, Humanity/TCP, Quinyx, Skedulo, Legion) ships some form of these. Missing them makes a scheduling product feel unfinished for any team beyond the smallest single-role shop.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-person qualification/skill set on the profile | Managers assume "can I put this person here" is answerable without leaving the scheduler. Deputy, Connecteam, Shiftboard, Quinyx, Skedulo, Legion all store skills/certs on the employee record. | LOW | NexRota's planned model (flat category set per person, default = all) matches this baseline exactly. |
| Qualification requirement attached to the shift/role, not just to the person | The match has two sides — Legion attaches requirements at the "labor plan"/role-definition stage (before shifts exist), 7shifts and When I Work attach a required Position to the shift itself. | LOW–MEDIUM | NexRota's `gs_shifts.type`/category already gives a natural attachment point; this is mostly wiring, not new modeling. |
| Auto-assign respects qualifications as a hard filter | Deputy, Connecteam, Shiftboard, Quinyx, Legion all describe qualification-aware auto-scheduling as baseline, not premium. Connecteam explicitly lists "assigning an unqualified employee" as a first-class scheduling error to catch, same severity class as double-booking. | LOW (NexRota already has a hard-constraint pipeline in `autoAssign.js`; qualification is one more hard filter, same shape as rest/overlap/cap checks) | This is exactly what NexRota's "Active" requirement describes — absolute block, no override. |
| Qualification visible to the manager at decision time, not just enforced silently | Humanity/TCP surfaces each employee's skills directly under their name in the scheduler grid during manual assignment — "so a manager scheduling manually can see qualifications inline rather than looking them up elsewhere." Silent-only enforcement (block with no visible reason) reads as a bug, not a feature, to users. | LOW | NexRota's `reason`/explanation contract (`gs_assignments.reason`) already generalizes to this — a qualification block just needs to be a legible reason string, same channel as every other block today. |
| Sensible default that doesn't require setup before the tool works | Not explicitly documented by any vendor as a "default" (none publish their onboarding defaults), but it is the implied shape of every "toggle it on when you need it" feature — see Humanity below. | LOW | This is inferred, not sourced; flag as MEDIUM-confidence inference, not a vendor claim. |

### Differentiators (Competitive Advantage)

Where NexRota's stated design already diverges from the market majority — these are real edges, not table stakes, and some cut against the grain of what competitors do by default.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Absolute qualification block, zero override — even by a manager** | This is the sharpest finding of this research. Healthcare-vertical sources (Deputy's own healthcare blog, Vars Health, Healthcarousel) describe "credential-aware scheduling that blocks an assignment automatically" as the aspirational best practice — but frame it as an advanced/healthcare-specific capability, not a baseline behavior. Connecteam's phrasing ("flag scheduling errors in real-time") and Legion's phrasing ("selecting the most qualified employee... based on skills, performance, labor rules") both describe qualification as an *input to ranking/warning*, not confirmed as an unconditional block a human manager cannot override. NexRota's "Out of Scope" decision — no override, ever, because qualification is a fact about the person, not a hypothesis about the world — is stricter than the SMB-tier default and matches only the aspirational healthcare-compliance pattern. This is a genuine, defensible differentiator, not a table-stakes restatement. | LOW (already decided; mostly enforcement placement, see Pitfalls below for where it can leak) | Frame this explicitly in product messaging: "we don't let you override qualification, because your app already lets you override the conflict matrix with a reason — this is the one thing that isn't a judgment call." |
| **Flat category set instead of a two-facet Position+Tag model** | When I Work's "Positions vs Tags" is the closest thing to an industry-standard pattern: Position = coarse primary role, Tags = additional eligibility layered on top, and eligibility requires satisfying **both** (cumulative AND). That's still two separate concepts a manager has to learn and maintain. NexRota's flat set-of-categories-per-person collapses this into one concept: a "רב-מלצר" (server-bartender) just carries two tags in one set, instead of one Position plus N Tags in a second system. Fewer concepts to explain matches the "stranger finishes a roster with nobody explaining anything" entry test better than the market's own two-layer default. | LOW (already decided) | Cite explicitly: no vendor surveyed markets a true hierarchical/inheriting role primitive either (see below) — the market has converged on flat, independent qualification units even where a two-facet UI exists; NexRota goes one step further by removing the facet split too. |
| **Standing/recurring position membership = a qualification declaration, not a schedule commitment** | Closest market analogue: Legion attaches skill/certification requirements at the "labor plan" stage, *before* shifts are generated — i.e., "who is eligible for this recurring role" is decided upstream of, and separately from, "who actually works this week." NexRota's plan (`עמדה קבועה` — assigning a person to a standing position states they're qualified/willing; the engine still decides who actually works) mirrors this separation, but no vendor in this survey documents it as cleanly as a first-class product concept — it's usually implicit in how labor plans + auto-scheduling interact. This is closer to a genuine gap-fill than a pattern being copied. | MEDIUM (new UI concept: a "roster of the eligible" view distinct from "who's on this week") | Worth prototyping the distinction visibly: eligible-for list vs. actually-scheduled list, so the "declaration ≠ assignment" idea isn't just a backend nuance nobody sees. |
| **Task and shift unified in one assignable entity with hours, rest, and load counted identically** | No vendor surveyed does this. The closest analogue — Humanity's "Shift Tasks" — is explicitly a checklist of sub-items *inside* a shift, not a peer entity with its own start/end time that participates in rest/overlap/cap/fairness math. Every other vendor treats "tasks" (if present at all) as a to-do layer bolted onto attendance software, disconnected from the shift-scheduling engine's hard constraints. NexRota folding "task" into the same engine that already enforces 8h rest / 12h continuous / 6-shift cap / fairness load is not something any surveyed competitor does. This is a real structural differentiator, directly addressing the "Gap שני" named in `PROJECT.md` (kitchen duty + night duty same day, invisible to both engines). | MEDIUM–HIGH (this is the load-bearing architectural change of the milestone; not a UI feature, a data-model unification) | This is the single highest-leverage differentiator in this research — worth calling out to whoever prioritizes phases: it's also the riskiest change (touches `checkHardConstraints`, `findConflicts`, and `fairness.js` simultaneously). |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| **Hierarchical/inheriting role tree** (e.g., a "Combat" role that automatically inherits every "Non-Combat" qualification) | Feels natural for the army use case specifically — "combat can do everything non-combat can do" reads like inheritance. | Zero vendors surveyed (Deputy, When I Work, Connecteam, Shiftboard, Humanity, Quinyx, Skedulo, Legion) implement a true inheriting hierarchy; all use flat, independent tags/skills/badges even in verticals (healthcare, field service) with obviously graded skill levels. A hierarchy primitive that works for the army case actively breaks the restaurant case (chef and waiter are disjoint sets, not ranked) — the exact failure mode already identified in NexRota's own "Out of Scope" reasoning. Building it would be scope no competitor bothers with, to solve a problem a flat set already solves by giving the combat person every tag. | Flat category set (already the decision). Where "X can do everything Y can" is genuinely true, the person or the seed data just carries the union of tags — no engine-level inheritance needed. |
| **Qualification editor exposed to end users at first run, with mandatory setup before scheduling works** | Skills/certification management "feels important" so products are tempted to front-load it in onboarding. | Humanity/TCP explicitly ships qualification matching as an *optional, disable-able toggle* — evidence that even a mature competitor treats mandatory qualification setup as friction to be avoided by default. This directly threatens NexRota's hard entry test: "a stranger finishes a full weekly roster with nobody explaining anything to them." A qualification model that must be configured before the first auto-assign will run is a table-stakes feature turned into an onboarding gate. | Default every person to "qualified for everything" (already NexRota's planned default) and let qualification restriction be an opt-in narrowing a manager discovers later, exactly mirroring Humanity's on/off toggle — except NexRota's default should be "on but permissive" rather than "off," so the blocking logic path is exercised from day one and doesn't need a separate code path to enable later. |
| **A second, separate credential-expiration/compliance product bolted onto the scheduler** | Certification tracking with expiry alerts is a recognizable need (renewal reminders, license lapses) and there's a whole cottage industry of point solutions for it (Expiration Reminder, Remindax, TalentGuard, RenewOps) that appear in searches next to scheduling tools. | Building a full expiration-tracking subsystem (renewal dates, multi-channel reminders, audit trail) is a different product with a different data model (time-bounded validity, not a binary flag) and is explicitly out of scope per NexRota's PROJECT.md (no "absence as separate entity" this cycle, and no notifications this cycle). Chasing it now would smuggle two deferred-on-purpose features back in through the qualifications door. | Keep qualification a binary "has / doesn't have" fact this cycle, matching the flat-set decision. If expiring credentials become a real ask later, it's a new milestone (adds a `valid_until` dimension to the category-membership row), not a retrofit of this one. |
| **Manager override with required justification note, mirroring the conflict matrix's override pattern** | Consistent UX — the conflict matrix already lets a manager override a block with a note, so qualification blocking "should probably work the same way" for interface consistency. | This is the one place consistency is the wrong instinct, and NexRota's own Key Decisions table already says so: the conflict matrix is a *hypothesis about the world* (this pairing is usually bad, but maybe not today), while qualification is a *fact about the person* (a waiter cannot cook). No vendor researched frames qualification and shift-conflict rules as the same kind of thing, and healthcare sources are unanimous that credential blocks should be unconditional. Confirmed by product's own stated Key Decision, not just this research. | Keep qualification block absolute, no note field, no override path — already decided; call out explicitly in the UI copy so it doesn't read as an inconsistency bug ("this is different from a conflict on purpose"). |

---

## Feature Dependencies

```
Flat qualification category set (per-person)
    └──requires──> Category taxonomy per team/mode (civil vs army vocabulary — terms.js already does this pattern)
                       └──requires──> Default-all-categories seeding on person creation (no onboarding gate)

Qualification hard-block in auto-assign
    └──requires──> Flat qualification category set (per-person)
    └──requires──> Category tag on shift/task type
    └──enhances──> Existing `checkAssignment` (same code path as rest/overlap/cap, not a parallel system)

Standing/recurring position
    └──requires──> Flat qualification category set (person-to-position membership reuses the same "set of categories" mechanism)
    └──enhances──> Auto-assign (gives the engine a stable weekly pool to draw from, rather than re-declaring eligibility every week)

Task-as-first-class-assignable-entity (hours + engine participation)
    └──requires──> Task carries start/end time (currently day-granularity only)
    └──requires──> Qualification hard-block in auto-assign (a task now needs the same "who's allowed" filter a shift has)
    └──conflicts with──> Treating `checkHardConstraints` (shift-only) and `findConflicts` (task-only) as separate engines — this dependency is exactly why "unify tasks and shifts" and "qualification model" must land in the same or adjacent phases, not independently

Unified "one board" view (tasks + shifts together)
    └──requires──> Task-as-first-class-assignable-entity
    └──requires──> Qualification hard-block (so the unified view can show blocked-vs-eligible consistently across both entity types)
```

### Dependency Notes

- **Qualification hard-block requires the flat category set to exist first** — this is sequencing, not just logical dependency: shipping the block before the taxonomy exists means either blocking nothing (default-all with no categories defined yet) or blocking everything (empty set misread as "qualified for nothing"). The default-all seeding must land in the same phase as the block, or before it.
- **Task-as-first-class-entity conflicts with the current two-engine split** — `checkHardConstraints` only sees shifts, `findConflicts` only sees tasks (per `PROJECT.md`'s own "gap שני"). Qualification blocking, if built only into `autoAssign.js`'s shift path, would replicate this exact blind spot for tasks. This means the qualification feature and the task/shift unification feature are not independent — building qualification-blocking for shifts alone before unifying the entities creates a second gap identical to the one this milestone exists to close (fairness measured in two places). Recommend sequencing: unify the entity (or at minimum, give tasks a time range) before or alongside wiring the qualification block, not after.
- **Standing/recurring position enhances auto-assign but does not require the task/shift unification** — it can be built against shifts alone first (lower risk), and extended to cover tasks once the entities are unified. This is a safe first phase within the milestone if sequencing risk needs to be reduced.
- **Anti-feature "hierarchical roles" would conflict with "flat category set"** — including both is contradictory; the research confirms flat is sufficient market-wide, so this isn't a real tension to plan around, just a reason to not revisit the hierarchy idea later without new evidence.

---

## MVP Definition

Scoped to what this milestone's `PROJECT.md` Active list already commits to — MVP here means "smallest version of these four items that doesn't reopen scope already closed by Key Decisions."

### Launch With (v1)

- [ ] Flat qualification category set per person, default = all categories — essential because it's the foundation every other item depends on, and the default is what keeps the "stranger finishes a roster" entry test intact.
- [ ] Qualification as absolute hard block in `checkAssignment`/`autoAssign.js`, no override — essential because it's the actual product promise this milestone is closing ("blocked with no exception, because it's a fact not a hypothesis").
- [ ] Qualification reason surfaced through the existing `reason`/explanation channel — essential because a silent block violates the product's core "explains every decision" value; this is not a nice-to-have, it's the same bar every other engine decision already clears.
- [ ] Task carries start/end time and participates in the same hard-constraint + fairness math as a shift — essential per PROJECT.md's explicit Active requirement; without this, qualification-blocking would only ever cover half the product's assignable surface.

### Add After Validation (v1.x)

- [ ] Standing/recurring position as a distinct "eligible pool" concept, separate from weekly assignment — add once the flat-set + hard-block foundation is proven stable; trigger = manager feedback that re-declaring the same eligible people every week is friction.
- [ ] Unified "one board" showing tasks and shifts together, plus a per-position forward-looking view — add once both entity types are unified under one engine; trigger = the two-entity gap is closed and there's now something coherent to unify visually.

### Future Consideration (v2+)

- [ ] Credential expiration / time-bounded qualification validity — defer; this is a different data shape (a validity window, not a boolean) and pulls in the notifications question NexRota has already deferred this cycle. Trigger to revisit: a real customer segment (e.g. security guards with licenses, or a healthcare-adjacent vertical) explicitly asks for it.
- [ ] Manager-facing qualification editor UI beyond raw restriction toggling (bulk edit, skill matrix view, per-category headcount reporting) — defer; the milestone's own scope explicitly leaves the conflict-matrix and load-weight editors as SQL-only for now, and qualification editing should follow the same discipline until there's evidence editing frequency justifies UI investment.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Flat qualification set + default-all + hard block | HIGH | MEDIUM | P1 |
| Qualification reason in explanation channel | HIGH | LOW | P1 |
| Task carries hours + enters engine (unification) | HIGH | HIGH | P1 |
| Standing/recurring position as eligibility declaration | MEDIUM | MEDIUM | P2 |
| Unified board (tasks + shifts + per-position view) | MEDIUM | MEDIUM | P2 |
| Credential expiration / time-bounded qualification | LOW (for current stated audience) | HIGH | P3 |
| Qualification editor UI (bulk/matrix) | LOW (SQL is acceptable per stated constraints) | MEDIUM | P3 |

**Priority key:**
- P1: Must have for this milestone to deliver on its stated Active requirements
- P2: Should have, natural next step once P1 lands
- P3: Nice to have, explicitly deferred by existing Key Decisions / Out of Scope

---

## Competitor Feature Analysis

| Feature | When I Work | Legion | Humanity/TCP | NexRota's Approach |
|---------|-------------|--------|---------------|---------------------|
| Qualification unit | Two facets: Position (coarse role) + Tags (fine eligibility), cumulative AND | Requirements ("badges") attached at labor-plan stage, upstream of shift creation | Skills attached to roles via an optional "Match Shifts" toggle | One flat facet: a set of categories per person, no split between "role" and "tag" |
| Default state | Not documented publicly; positions are set up per role during onboarding | Not documented; assumed configured during labor-plan setup (enterprise onboarding) | Feature is off by default (opt-in toggle) | Default = qualified for everything; managers narrow later, no setup gate |
| Override behavior | Not confirmed hard-blocking for manager manual assignment; tags gate open-shift claims by employees | Framed as a ranking/optimization input, not confirmed as an unconditional block | Informational display for manual scheduling, not confirmed as blocking | Absolute block, zero override, for anyone including the manager |
| Where enforced | Both auto-assign and open-shift claim flow | Labor-plan stage, before shift generation | Scheduler grid display (visibility) + presumably auto-schedule input | Same `checkAssignment` path already used for every hard constraint (rest, overlap, caps) |
| Task vs shift as scheduling primitive | Not applicable (single "shift" primitive) | Not applicable (single "shift" primitive) | "Shift Tasks" = checklist sub-items inside a shift, not a peer engine entity | Task and shift become one assignable entity, both carrying hours/rest/fairness weight |

---

## Sources

All sources below were retrieved via web search (provider: `websearch`); confidence tier MEDIUM per the project's classify-confidence seam (cross-checked across 2+ independent sources per claim, no single-source claim presented as authoritative). Specific numeric review ratings (Capterra/G2/Trustpilot scores) are point-in-time and should be treated as illustrative, not current, if re-cited later.

- Deputy — [Employee Scheduling Software features](https://www.deputy.com/features), [Deputy Review — Workyard](https://www.workyard.com/compare/deputy-review), [Deputy healthcare credential tracking blog](https://www.deputy.com/blog/credential-tracking-healthcare-stop-expired-licenses-fast)
- When I Work — [Use Tags to Match Qualified Employees to Shifts](https://wheniwork.com/blog/product-update-tags), [Positions vs Tags help doc](https://help.wheniwork.com/articles/when-to-use-positions-and-tags/), [Creating and Managing Tags](https://help.wheniwork.com/articles/creating-and-managing-tags-ios/), [G2 reviews](https://www.g2.com/products/when-i-work/reviews)
- Connecteam — [Auto Scheduling Software](https://connecteam.com/employee-scheduling-app/auto-scheduling/), [Best Employee Scheduling Software comparison](https://connecteam.com/best-employee-scheduling-software/)
- Shiftboard — [Employee Scheduling for Manufacturing](https://www.shiftboard.com/employee-scheduling-for-manufacturing/), [Automated Employee Shift Scheduling Software](https://www.shiftboard.com/employee-scheduling-software/)
- Humanity / TCP Software — [Humanity launches Shift Tasks](https://tcpsoftware.com/blog/humanity-shift-tasks/), [Scheduling Made Smarter — Employee Skills in Humanity's Scheduler](https://tcpsoftware.com/blog/scheduling-made-smarter-now-you-can-see-employee-skills-in-humanitys-employee-scheduler/)
- Quinyx — [Employee Scheduling Software](https://www.quinyx.com/workforce-management/scheduling-software), [Workforce Optimization / Labor Optimization](https://www.quinyx.com/workforce-management/labor-optimization)
- Skedulo — [Managing Complex Field Service Work](https://www.skedulo.com/resources/managing-complex-field-service-work), [Field Service Management Software](https://www.skedulo.com/industries/field-service-scheduling/)
- Legion — [Streamline Operations with Skill-Based Scheduling](https://legion.co/blog/2024/09/24/skill-based-scheduling/), [Automated Scheduling Software](https://legion.co/products/automated-scheduling/)
- Credential/certification tracking category — [Certification Tracking Software comparison](https://www.expirationreminder.com/blog/certification-tracking-software-comparing-top-solutions-for-compliance-automation), [Remindax certification tracking](https://www.remindax.com/solutions/certification-tracking-software)
- Healthcare vertical — [Vars Health hospital scheduling](https://www.varshealth.com/post/hospital-scheduling-software-for-nursing), [Healthcarousel nurse credentialing](https://www.healthcarousel.com/post/streamlining-hospital-staffing-through-nurse-credentialing-software)
- Restaurant vertical — [7shifts restaurant scheduling](https://www.7shifts.com/restaurant-employee-scheduling-software/), [7shifts full-service restaurants](https://www.7shifts.com/built-for/full-service-restaurants/)
- General/synthesis — [Skills-Based Scheduling — item.com](https://www.item.com/staffing/time-and-attendance-scheduling-skills-based-scheduling), [7 Steps to Schedule Staff Based on Skills & Roles](https://blog.makeshift.ca/schedule-staff-based-on-skills), [Employee Scheduling Problems — Synerion](https://www.synerion.com/blog/employee-scheduling-problems-10-issues-and-fixes-that-work)

---
*Feature research for: workforce shift/roster scheduling — qualifications, roles, standing positions, task/shift unification*
*Researched: 2026-08-21*
