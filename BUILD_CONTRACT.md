# Codex Hackathon — Build Plan

*Supersedes the previous 5-role split. Architecture revised: roles renumbered, Notion/DB memory split out as its own role, Review folded into Coding/Runloop.*

## Goal

Build a demoable multiplayer multi-agent project operating system in 4 hours. The product demonstrates a closed-loop workflow where any team member can brainstorm a feature, the system researches and updates the existing plan, a designated leader controls approval, the Master Agent orchestrates execution, Coding runs through Runloop, Review validates the result, and Notion + a structured database preserve shared project memory and operational state.

## Final architecture

```
TEAM MEMBERS
    ↓
BRAINSTORM AGENT (per member)
    ↓ member confirms proposal
FEATURE PROPOSAL
    ↓
MASTER AGENT — state + orchestration
    ↓
PLANNING AGENT — research + impact + updated plan
    ↓
LEADER DECISION
    ├── APPROVE → MASTER → CODING AGENT → RUNLOOP → REVIEW
    ├── REQUEST UPDATED PLAN → PLANNING AGENT → LEADER (repeat)
    ├── HOLD → persisted in memory until resumed
    └── EXIT → persisted as rejected/closed with reason

REVIEW
    ├── PASS → complete + persist
    └── ISSUE → MASTER → CODING or PLANNING → continue loop

SHARED MEMORY
    NOTION = human-readable project knowledge/history
    DATABASE = machine-readable workflow state/events/relationships
```

## Four-hour build strategy

### Phase 0 — 0:00–0:20: Align and scaffold

- Lock the shared event/state model.
- Create repo branches/workspaces and environment variables.
- Create the Notion project-memory structure.
- Create the database schema and seed one demo project.
- Define the API/event contracts between agents.

### Phase 1 — 0:20–1:20: Core orchestration + memory

- Implement Master Agent state machine.
- Implement database persistence for projects, proposals, plans, approvals, tasks, agent runs, reviews, issues, and events.
- Implement Notion read/write adapter for durable human-facing history.
- Build event routing: proposal accepted, plan update requested, plan approved, hold, exit, coding complete, review issue/pass.

### Phase 2 — 1:20–2:20: Brainstorm + Planning + Leader workflow

- Build team-member brainstorm UI and Brainstorm Agent prompt/context assembly.
- Generate structured feature proposals using current project memory.
- Build Planning Agent that takes current plan + proposal/feedback + research and outputs a versioned updated plan.
- Build leader decision UI with four actions: Approve, Request Updated Plan, Hold, Exit.
- Ensure leader feedback goes directly to Planning Agent for a revised plan; no manual relay to the proposing team member.

### Phase 3 — 2:20–3:15: Coding + Runloop + Review

- Implement Coding Agent handoff from an approved execution contract.
- Connect Coding Agent to Runloop for repository inspection, edits, commands, and tests.
- Capture execution result in database and Notion.
- Implement Review Agent against approved plan + acceptance criteria.
- Route review failures to Coding for implementation issues or Planning for plan-invalidating issues.

### Phase 4 — 3:15–3:40: End-to-end integration

Run one complete golden path:

1. Team member brainstorms feature.
2. Member confirms proposal.
3. Master routes to Planning.
4. Planning produces Plan v2.
5. Leader requests changes.
6. Planning produces Plan v3.
7. Leader approves.
8. Master invokes Coding.
9. Coding executes in Runloop.
10. Review passes.
11. Notion + database show the complete history.

Then run one recovery path:

- Review discovers a plan issue → Master → Planning → revised plan → Leader approval → Coding → Review.

### Phase 5 — 3:40–4:00: Demo hardening

- Seed reliable demo data.
- Fix UI/state synchronization issues.
- Add visible plan-version history and event timeline.
- Verify all four leader outcomes.
- Verify Notion persistence.
- Prepare 3–5 minute demo script and fallback screenshots/data.

## MVP acceptance criteria

- Any team member can open a brainstorming session using shared project context.
- A member can confirm a proposal and send it into the project workflow.
- Master Agent routes accepted proposals to Planning.
- Planning updates the existing plan instead of creating disconnected plans.
- Leader can Approve, Request Updated Plan, Hold, or Exit.
- Leader feedback can go directly to Planning and produce a new plan version.
- No coding starts without leader approval of the current plan.
- Approved plans create an execution contract for Coding.
- Coding runs through Runloop.
- Review can pass or classify an issue.
- Master routes coding issues to Coding and plan issues to Planning.
- Notion contains the human-readable project history.
- Database contains operational state and event history.
- The demo visibly demonstrates at least one planning revision and one closed-loop recovery.

## 5-person division of labor

### Person 1 — Master Agent + Backend Orchestration

**Owns:** the control plane.

- Master Agent state machine and routing.
- Event model and lifecycle transitions.
- Agent invocation contracts.
- Approval/hold/exit/replan routing.
- Shared backend API.
- Integration with all other teammates.

**Deliverable:** one API/event layer where any incoming event resolves to the correct next action.

**Must coordinate with:** Person 2 for database schema, Person 3 for planning/feedback contracts, Person 4 for frontend state, Person 5 for Runloop/review events.

### Person 2 — Notion + Database / Project Memory

**Owns:** the system's persistent memory.

- Database schema.
- Project, proposal, plan-version, task, event, approval, implementation, review, and issue records.
- Notion workspace structure.
- Notion sync/read/write service.
- Timeline/history queries.
- Seed/demo data.

**Deliverable:** any agent can retrieve current state/history, and every important workflow transition is persisted.

**Key rule:** Database is operational source of truth; Notion is shared human-readable project memory/history.

### Person 3 — Brainstorm + Planning Agents

**Owns:** idea-to-approved-plan workflow.

- Brainstorm Agent.
- Proposal generation and member confirmation.
- Planning Agent.
- Research/context assembly.
- Plan versioning and diff output.
- Leader feedback → Planning → revised plan loop.

**Deliverable:** a compelling demo where a feature goes from idea → proposal → Plan v2 → leader feedback → Plan v3.

**Must coordinate with:** Person 1 on events and Person 2 on memory/context.

### Person 4 — Frontend / UX

**Owns:** the demo experience.

- Team member brainstorming screen.
- Proposal view.
- Plan/version comparison.
- Leader decision panel.
- Execution/review status.
- Project timeline/activity feed.
- Agent status indicators.
- Hold/exit/replan states.

**Deliverable:** one coherent dashboard that makes the workflow understandable within seconds.

**Critical UX:** make the leader's four decisions and plan-version progression visually obvious.

### Person 5 — Coding + Runloop + Review

**Owns:** execution and validation.

- Coding Agent.
- Runloop integration.
- Execution contract.
- Repository operations and test execution.
- Review Agent.
- Review classification: pass / coding issue / plan issue.
- Feedback event generation back to Master.

**Deliverable:** approved plan → Coding → Runloop → Review → Master loop works end-to-end.

## Parallel dependency map

```
Person 2: DB + Notion ───────────────┐
                                    │
Person 1: Master + Events ──────────┼──→ Integration
                                    │
Person 3: Brainstorm + Planning ────┤
                                    │
Person 4: Frontend ─────────────────┤
                                    │
Person 5: Coding + Runloop + Review ┘
```

### Integration checkpoints

- **T+60 min:** Master, DB/Notion, Brainstorm/Planning, frontend shell, and Runloop prototype all exist.
- **T+120 min:** proposal → planning → leader decision path works.
- **T+180 min:** approved plan → coding → Runloop → review works.
- **T+210 min:** recovery/replanning loop works.
- **T+240 min:** polished demo.

## Demo story

Use one simple feature request, such as "add dark mode," because it clearly demonstrates impact analysis, planning changes, leader feedback, and implementation.

1. Person A opens Brainstorm Agent and proposes dark mode.
2. Brainstorm Agent explains impact, benefits, risks, and alternatives using shared memory.
3. Person A confirms the proposal.
4. Master routes it to Planning.
5. Planning creates an updated plan.
6. Leader says: "Keep dark mode, but don't change the backend; scope it to the frontend and include persistence."
7. Planning incorporates the feedback and creates the next plan version.
8. Leader approves.
9. Master creates the execution contract and invokes Coding.
10. Coding executes in Runloop.
11. Review finds a small UI issue and routes it back to Coding.
12. Coding fixes it.
13. Review passes.
14. Dashboard shows the full event/plan history, while Notion contains the durable project record.

## Build rule

Do not build a collection of disconnected agents. Build one **stateful workflow** with specialized agents around a shared memory layer. The Master Agent is the control plane; Notion + database are the memory layer; human leader approval is the governance gate; Runloop is the execution layer.
