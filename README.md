<div align="center">

# Weave
### Multiplayer AI for Team Collaboration

<p>
  <img src="https://img.shields.io/badge/TypeScript-Node.js_22%2B-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenAI-Responses_API-412991?style=for-the-badge&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Runloop-Devboxes_%2B_Snapshots-6C4EF5?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Fastify-Master_API-000000?style=for-the-badge&logo=fastify&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-Persistence-2D3748?style=for-the-badge&logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/vitest-18_passing-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" />
  <img src="https://img.shields.io/badge/Notion-Shared_Memory-000000?style=for-the-badge&logo=notion&logoColor=white" />
</p>

**Weave** turns AI-assisted development from a single-player activity into a shared, governed workflow. Anyone on the team can propose a change; agents research it, synthesize it into one coherent plan, and a human leader decides what happens next - approve, ask for a revision, hold, or close it out. Only after a human says go does a coding agent touch real code, inside an isolated Runloop devbox booted from the project's current state. The result isn't a diff you read about: it's a live URL the whole team can open, committed as a snapshot that any future run can build on.

> Everyone can propose. Agents synthesize. Humans decide. Runloop executes.

[Architecture](#system-architecture) · [The Workflow Pipeline](#the-workflow-pipeline) · [Features](#features) · [Master API](#master-api) · [Tech Stack](#tech-stack) · [Quick Start](#quick-start)

</div>

## What Makes This Different

Most AI coding tools are a chat box one person drives while everyone else watches a read-only transcript.

| Typical AI Coding Tool | Weave |
|---|---|
| One person prompts the model in a private thread | Any team member can submit an idea into a shared planning queue |
| Feedback on a plan gets relayed back to whoever is driving | Leader feedback goes straight to the Planning Agent, which produces the next plan version itself |
| A new idea starts a disconnected conversation | Planning updates the *existing* plan: current plan + new proposal + research = the next version, not a fork |
| "Approve" is implicit - the model just keeps going | Two explicit human gates: is this the right plan, and is this plan ready to execute - plus Hold and Exit as first-class outcomes, not dead ends |
| Code changes happen against your real environment or a shared branch | Every execution runs inside an isolated Runloop devbox, booted from the project's current committed state |
| The result is a diff you read, or a screenshot one person took | The devbox serves the finished app over a public tunnel - the whole team opens the same live URL and sees the same running result |
| Each run starts from nothing and its output is discarded | Every approved run is committed as a named Runloop snapshot, so the project accumulates and any past plan version can be booted again |
| "Looks done" is taken on faith | A Review Agent checks the result against the plan's own acceptance criteria and classifies it as passing, a coding problem, or a planning problem - each routed back to whoever should fix it |
| Why a decision was made lives in someone's memory or a buried Slack thread | Every proposal, plan version, decision, and execution result is durable, shared project memory |

## System Architecture

```
╔════════════════════════════════════════════════════════════════════════╗
║                      Weave: Proposal-to-Result Flow                    ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   TEAM MEMBERS                                                          ║
║        │  any member submits an idea, in plain language                ║
║        ▼                                                                ║
║   ┌───────────────────┐                                                 ║
║   │  Brainstorm Agent    │  turns a rough idea into a structured        ║
║   │  (per member)        │  proposal: problem, value, scope, risks,     ║
║   └──────────┬──────────┘  alternatives, acceptance criteria           ║
║              │  member confirms the proposal                            ║
║              ▼                                                          ║
║   ┌───────────────────┐                                                 ║
║   │  Master Agent        │  state + orchestration - routes every        ║
║   │  (control plane)     │  event to the next correct step              ║
║   └──────────┬──────────┘                                              ║
║              ▼                                                          ║
║   ┌───────────────────┐                                                 ║
║   │  Planning Agent      │  current plan + new proposal + research      ║
║   │  + research          │  = next plan version (never a disconnected   ║
║   └──────────┬──────────┘  fork - Plan v4 + input = Plan v5)            ║
║              ▼                                                          ║
║   ┌────────────────────────────────────────────────┐                   ║
║   │              LEADER DECISION                      │                 ║
║   │  ┌─────────┐ ┌──────────────┐ ┌──────┐ ┌──────┐ │                 ║
║   │  │ APPROVE │ │ REQUEST PLAN │ │ HOLD │ │ EXIT │ │                 ║
║   │  └────┬────┘ └──────┬───────┘ └──┬───┘ └──┬───┘ │                 ║
║   └───────┼─────────────┼────────────┼────────┼─────┘                 ║
║           │              └──► back to Planning Agent                    ║
║           │                          │            │                     ║
║           │                 persisted, resumable   persisted, closed    ║
║           ▼                     (memory)              with reason       ║
║   ┌───────────────────┐                                                 ║
║   │  Execution Contract  │  Master builds the handoff: tasks,          ║
║   └──────────┬──────────┘  constraints, acceptance criteria,            ║
║              │              and the previous base_snapshot_id           ║
║              ▼                                                          ║
║   ┌───────────────────┐        ┌────────────────────────┐              ║
║   │  Coding Agent        │───►│  Runloop Devbox           │             ║
║   │  (tool-calling loop) │◄───│  booted from the project's │            ║
║   │  read/write/exec/done│     │  last committed snapshot   │           ║
║   └──────────┬──────────┘        └───────────┬────────────┘             ║
║              │                                │                         ║
║              │              ┌─────────────────┴──────────────┐          ║
║              │              ▼                                ▼          ║
║              │      ╔═══════════════╗            ╔═══════════════╗     ║
║              │      ║  PUBLIC TUNNEL ║            ║   SNAPSHOT     ║     ║
║              │      ║  live URL the  ║            ║  named commit  ║     ║
║              │      ║  whole team    ║            ║  = a bootable  ║     ║
║              │      ║  can open      ║            ║  plan version  ║     ║
║              │      ╚═══════════════╝            ╚═══════╤═══════╝     ║
║              ▼                                            │             ║
║   ┌───────────────────┐                                   │             ║
║   │  Review Agent        │  checks the result against the │             ║
║   │                      │  plan's acceptance criteria     │            ║
║   └──────────┬──────────┘  and declared scope              │            ║
║      ┌───────┼────────────┐                               │             ║
║      ▼       ▼            ▼                               │             ║
║   PASS   CODING ISSUE   PLAN ISSUE                        │             ║
║   done   → back to      → back to                         │             ║
║           Coding Agent   Planning Agent                   │             ║
║              │              │              │              │             ║
║              └──────────────┴──────────────┘              │             ║
║                             ▼                             │             ║
║   ┌──────────────────────────────────────────────┐        │             ║
║   │              SHARED PROJECT MEMORY               │◄──────┘             ║
║   │  Notion - human-readable project history          │                ║
║   │  Database - workflow state / events                │               ║
║   │  Snapshots - the bootable state of every version    │              ║
║   └──────────────────────┬───────────────────────┘                     ║
║                          │  next run boots from here                    ║
║                          ▼                                              ║
║                    NEXT REQUEST                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

Every stage above communicates through one canonical event stream. The Master
Agent owns the state machine; each specialist agent posts its result back and
the Master decides what happens next:

```
proposal.accepted ─► planning.completed ─► leader.approved
                                            leader.requested_changes
                                            leader.held / leader.exited
                                                  │
                                                  ▼
                                          coding.completed
                                                  │
                                                  ▼
                                          review.completed
                                    pass │ coding_issue │ plan_issue
```

## The Workflow Pipeline

Every idea passes through the same stages, whether it lands as working code, bounces back for another plan revision, or gets closed out.

### Stage 1: Brainstorm and Propose

A team member describes an idea in plain language. The Brainstorm Agent expands it into a structured `FeatureProposal` - problem statement, user value, suggested scope, explicit out-of-scope boundaries, risks, alternatives considered, and acceptance criteria - using the project's existing context so it isn't reasoning from a blank slate. Nothing enters the shared plan until the proposing member explicitly confirms it.

### Stage 2: Plan Synthesis

The Planning Agent is the point where multiplayer input becomes one coherent plan. It never starts a new, disconnected plan: it takes the *current* plan plus the new proposal (or the leader's feedback) plus fresh research, and produces the next version - `Plan v4 + input + research = Plan v5`. Each version carries a diff-style summary against the one before it, so the team can see exactly what changed and why.

### Stage 3: Leader Decision

A designated leader reviews the plan and picks one of four outcomes, not a binary approve/reject:

- **Approve** - the plan is ready; Master builds the execution contract and hands off to Coding.
- **Request Updated Plan** - feedback goes straight to the Planning Agent, which produces the next version without anyone manually relaying it to the original proposer.
- **Hold** - the plan is persisted as-is and can be resumed later; it doesn't block the queue.
- **Exit** - the plan is persisted as closed, with a reason, so the decision and its rationale aren't lost.

### Stage 4: Execution

Once approved, the Coding Agent runs a tool-calling loop against a Runloop devbox: read a file, write a file, run a command, or signal done. The box boots from the project's last committed snapshot when one exists, so work accumulates instead of restarting from a blank slate every time; with no snapshot it seeds from a known-good base. Execution never touches a shared or persistent environment, and a run that doesn't converge within its iteration cap fails explicitly rather than hanging.

### Stage 5: See It Running

A successful run doesn't end at a diff. The devbox serves the finished app over a public Runloop tunnel and the resulting URL travels with the result, so the whole team opens the same live page and sees the same working feature - not a screenshot someone took, but the actual thing.

The same run is committed as a named Runloop snapshot carrying the plan version, its summary as the commit message, and metadata linking it back to the execution contract. Each approved plan version becomes an environment you can boot again later. Because the preview must stay reachable, a successful devbox is suspended rather than destroyed, and clicking its URL wakes it on demand; failed runs are torn down immediately, and suspended boxes are tracked and reapable so they can't quietly accumulate.

### Stage 6: Review

The Review Agent checks the result against the plan's own acceptance criteria and declared scope, and classifies it one of three ways: **pass**, a **coding issue** (the implementation didn't satisfy its own checks, or touched something outside scope - routed back to the Coding Agent), or a **plan issue** (the plan itself was under-specified in a way execution exposed - routed back to the Planning Agent). Classification is deterministic-first by design: reliability over cleverness.

### Stage 7: Shared Memory

Every proposal, plan version, leader decision, execution result, and review outcome becomes durable shared memory - a human-readable trail in Notion, machine-readable operational state in the database, and the snapshot id that lets any past version be booted again. So the next request has full context, and "why did we make this change" is answerable by clicking it, not just reading about it.

## Features

### Brainstorm and Planning Agents
Event-driven from the start: `person3.idea_submitted` produces a structured proposal, `person3.proposal_confirmed` produces the first plan version, and `person3.leader_feedback_received` produces the next one. A pluggable memory-adapter interface (`getProjectContext`, `saveProposal`, `savePlanVersion`, `recordEvent`) keeps the agents' logic independent of where project memory actually lives.

### Master Agent + Workflow State Machine
The control plane. Eight workflow states (`idle`, `awaiting_plan`, `awaiting_leader_decision`, `on_hold`, `awaiting_coding`, `awaiting_review`, `completed`, `exited`) and one canonical event stream, so every specialist agent posts its result to `POST /api/events` and the Master alone decides what happens next. No agent calls another directly.

### Real Dispatch to Execution
An approved plan doesn't just become a recorded intention. `CodingReviewAgentGateway` POSTs the execution contract to the Coding + Review service, deliberately fire-and-forget: a real run boots a devbox and drives an LLM loop for minutes, and the service reports back through `/api/events` on its own. An unreachable coding service is logged and never thrown - the dispatch runs detached from the request that triggered it, so a raised error would take the Master down with it.

### Persistence + Notion Sync
Workflow state lives in a Prisma-backed `DbStore` behind the same `Store` interface the in-memory implementation uses, so tests stay fast and isolated while the running system persists. `notionSync` mirrors the human-readable trail into Notion, and runs as a no-op when no Notion credentials are configured rather than failing the workflow.

### Coding Agent + Runloop Execution
A manual tool-calling loop against the OpenAI Responses API, with four tools exposed to the model: `read_file`, `write_file`, `run_command`, and `done`. Each call is executed against a real Runloop devbox (`@runloop/api-client`) - never against a mock. A fixed iteration cap means a run that can't converge fails cleanly instead of hanging the workflow.

### Live Preview Tunnels
After a successful run, a static server is injected into the devbox and exposed through a public Runloop tunnel, giving the team one live URL for the finished app. Deliberately `auth_mode: 'open'` so the frontend can embed it directly - an authenticated tunnel requires a bearer header a plain `<iframe>` cannot send. Failure to start a preview is never fatal: a run that produced real code changes is still a successful run.

### Snapshots as Commits
Each approved run is committed with `snapshotDiskAsync` under a version name, the plan summary as its commit message, and metadata tying it to the execution contract. An execution contract may carry `base_snapshot_id` to boot from the previous approved state; absent that, it seeds from scratch - so the feature lights up the moment the field is populated and degrades silently when it isn't.

### Review Agent
A pure, deterministic classifier: failed verification checks or files touched outside the plan's declared scope become a coding issue; a result that can't satisfy real acceptance criteria despite passing its own checks becomes a plan issue; everything else passes. No LLM judge in the loop - reliability first, so the same input always produces the same classification.

### Verification Scripts
Lightweight, scripted assertions run inside the devbox after execution - not a full test framework, but real, deterministic pass/fail signal the Review Agent can act on, seeded per request type (e.g. a dark-mode request checks for a theme rule and a toggle handler; a responsive-layout request checks for a breakpoint and a viewport tag).

### Shared Workspace UI
A single dashboard surfaces the planning queue, live agent activity, the current plan, and the leader's decision panel in one place - built so a new viewer understands the whole loop (propose → synthesize → decide → execute) within seconds, without reading documentation first.

### Execution Contract
The handoff between an approved plan and the Coding Agent: tasks, constraints, files or areas in scope, and acceptance criteria, carried through unchanged so Review can check the result against the exact same criteria the plan was approved against - not a re-interpretation of them.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript, Node.js 22+ |
| Master API / control plane | Fastify |
| Coding agent model | OpenAI, Responses API, tool-calling loop |
| Execution sandbox | Runloop Devboxes (`@runloop/api-client`) |
| Live previews | Runloop V2 tunnels (`https://{port}-{tunnel_key}.tunnel.runloop.ai`) |
| Versioned project state | Runloop disk snapshots, named and commit-messaged |
| Coding-agent service API | Express |
| Frontend | React + Vite |
| Tests | vitest |
| Shared human-readable memory | Notion |
| Shared operational memory | Database (project, proposal, plan-version, event, approval, execution, review records) |

## Project Structure

```
Weave/
│
├── src/                            # Master Agent - control plane
│   ├── master/
│   │   ├── stateMachine.ts           # the eight workflow states and every transition
│   │   ├── router.ts                 # event -> next action
│   │   └── errors.ts
│   ├── contracts/                   # canonical shared types
│   │   ├── workflow.ts               # WorkflowState, LeaderDecision, PlanVersion,
│   │   │                             #   CodingResult, ReviewResult
│   │   ├── events.ts                 # the nine canonical workflow events
│   │   └── agents.ts
│   ├── integrations/
│   │   ├── codingReviewContract.ts   # approved plan -> execution contract
│   │   └── person3Adapter.ts         # Planning events -> canonical Master events
│   ├── adapters/
│   │   ├── store/                    # DbStore (Prisma) + InMemoryStore
│   │   └── agents/                   # CodingReviewAgentGateway - real dispatch
│   ├── notion/notionSync.ts         # human-readable history mirror
│   └── routes/                      # /api/projects, /api/events, /api/contracts
│
├── prisma/                         # schema + migrations
│
├── coding-review-agent/            # Coding Agent + Runloop execution + Review Agent
│   ├── src/
│   │   ├── server.ts                 # execution-contract endpoint, Master callbacks
│   │   ├── devbox.ts                  # Runloop wrapper: exec, files, tunnels,
│   │   │                              #   snapshots, suspend/resume
│   │   ├── coding-agent.ts            # OpenAI tool-calling loop
│   │   ├── review-agent.ts            # pass / coding_issue / plan_issue classifier
│   │   ├── preview-server.ts          # static server injected into the devbox
│   │   └── verify/                    # scripted verification checks
│   ├── scripts/milestone0.ts        # end-to-end Runloop verification
│   └── seed/                        # seed customer-support demo app
│
├── ResearchAndCoding/              # Brainstorm + Planning Agents
│   └── src/person3/
│       ├── brainstormAgent.ts        # idea -> structured FeatureProposal
│       ├── planningAgent.ts          # proposal/feedback + context -> next PlanVersion
│       ├── memoryStore.ts            # pluggable memory adapter interface
│       ├── workflow.ts               # event routing (idea/confirm/feedback)
│       └── types.ts                  # Proposal, PlanVersion, PlanningContext
│
├── frontend/                       # Shared workspace UI
├── tests/                          # Master Agent suite (vitest)
├── scripts/integrated-demo.ts      # full golden path, end to end
└── docs/                           # API examples, integration and setup guides
```

## Quick Start

### Coding Agent + Runloop + Review

```bash
cd coding-review-agent
npm install
cp .env.example .env
# set RUNLOOP_API_KEY and OPENAI_API_KEY
npm run typecheck
npm start
```

Verify the whole Runloop path - devbox, file I/O, tunnel, snapshot, and booting
back from that snapshot - in one command:

```bash
npm run milestone0
```

### Master Agent (control plane)

```bash
npm install
npm test          # vitest - 18 tests
npm run dev       # Master API on :3001
```

To dispatch approved plans to the real coding service rather than waiting for a
`coding.completed` event, set `CODING_REVIEW_URL=http://127.0.0.1:4005` and run
both.

### Brainstorm + Planning Agents

```bash
cd ResearchAndCoding
npm install
npm test               # runs the Node built-in test runner
npm run demo:person3   # golden path: idea -> proposal -> Plan v2 -> feedback -> Plan v3
```

### Full integrated demo

```bash
npx tsx scripts/integrated-demo.ts
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Master API

| Endpoint | Purpose |
|---|---|
| `POST /api/projects` | Create a project |
| `GET /api/projects/:projectId` | Current workflow state, plan, and history |
| `GET /api/projects/:projectId/events` | The project's event stream |
| `POST /api/events` | The one way any agent reports a result |
| `POST /api/integrations/person3/events` | Planning events, mapped to canonical form |
| `GET /api/contracts` | Machine-readable contract metadata |

The Coding + Review service exposes `POST /execution-contract`, plus
`GET /devboxes` and `POST /cleanup` for reaping suspended preview devboxes.

## Key Engineering Decisions

**1. Planning updates the existing plan, never forks a new one.**
Every plan version is a function of the one before it plus new input: `Plan v4 + proposal/feedback + research = Plan v5`. A team's second idea should sharpen the plan, not compete with it.

**2. Leader feedback goes directly to Planning - never through a person.**
"Request Updated Plan" hands the leader's own words to the Planning Agent, which produces the next version itself. No one manually relays feedback back to whoever originally proposed the idea.

**3. Four leader outcomes, not two.**
Approve/Reject loses information. Hold (paused, resumable) and Exit (closed, with a reason) are both first-class, persisted outcomes - a plan that isn't approved yet isn't automatically dead.

**4. Nothing executes without an explicit human approval of the current plan.**
The execution contract only exists after Approve. There is no path from a plan version straight to the Coding Agent.

**5. Execution always runs in an isolated Runloop devbox, never in place.**
Every run gets its own sandbox, booted from the project's last committed snapshot or a known-good base. Nothing the agent does can reach a teammate's machine or a shared environment.

**6. A successful devbox is suspended, not destroyed - and tracked because of it.**
Tearing the box down would kill the tunnel and with it the preview URL, so success suspends (the disk and tunnel survive, and HTTP traffic wakes it) while failure shuts down immediately. Suspended boxes still cost quota, so they are registered and reapable via `POST /cleanup`. Convenience that leaks paid resources isn't convenience.

**7. The preview tunnel is public by design.**
`auth_mode: 'open'`, because an authenticated tunnel requires an `X-Runloop-Tunnel-Authorization` bearer header that a plain `<iframe>` cannot send. A preview the team can't actually open isn't a preview.

**8. A failed preview or snapshot never fails the run.**
Both are wrapped and degrade to `null`. A run that changed real code and passed its checks succeeded, even if the nice-to-have around it didn't.

**9. Review classification is deterministic-first.**
Coding-issue and pass are decided by checking real signals (verification-script results, files touched vs. declared scope) - not by asking a model whether it thinks the work looks right. The harder plan-issue path is kept intentionally narrow rather than generalized, because a classification the team can't trust is worse than one that's occasionally too conservative.

**10. A coding-issue and a plan-issue are routed to different agents.**
The Review Agent doesn't just fail a run - it decides *whose* problem it is. An implementation bug goes back to Coding; a plan that was under-specified in a way execution exposed goes back to Planning. Fixing the wrong thing wastes a cycle.

**11. The execution contract carries acceptance criteria through unchanged.**
Review checks the result against the exact criteria the plan was approved against, not a fresh interpretation of "did this work" - so approval and review are judging the same thing.

**12. A coding run that can't converge fails explicitly.**
The Coding Agent's tool-calling loop has a fixed iteration cap. Hitting it produces a `failed` status with whatever partial diff exists, not an indefinitely hanging workflow.

**13. Agents report to the Master; they never call each other.**
Every specialist posts its result to one event endpoint and the state machine decides what happens next. Point-to-point calls between agents would put routing logic in five places instead of one, and make the workflow's real state unknowable.

**14. A failed notification never discards completed work.**
Reporting back to the Master is wrapped: if the Master is unreachable, the run's code changes, tests, preview, and snapshot all still stand. Losing finished work because a status update failed is the worst possible trade.

## Domain Reference

**Leader decisions**

| Outcome | Effect |
|---|---|
| Approve | Master builds the execution contract and hands off to Coding |
| Request Updated Plan | Feedback routes to the Planning Agent for the next version |
| Hold | Persisted as-is, resumable later - doesn't block the queue |
| Exit | Persisted as closed, with a reason |

**Review classifications**

| Classification | Meaning | Routed to |
|---|---|---|
| Pass | Result satisfies its checks and stays in scope | Complete, persisted |
| Coding issue | Checks failed, or files changed outside declared scope | Coding Agent |
| Plan issue | Execution succeeded but exposed a gap in the plan itself | Planning Agent |

**Workflow states**

| State | Meaning |
|---|---|
| `idle` | No active proposal |
| `awaiting_plan` | Planning Agent is producing the next version |
| `awaiting_leader_decision` | A plan version is waiting on a human |
| `on_hold` | Paused by the leader, resumable |
| `awaiting_coding` | Approved; execution contract handed to Coding |
| `awaiting_review` | Execution finished, Review classifying |
| `completed` | Review passed |
| `exited` | Closed by the leader, with a reason |

**Canonical workflow events**

Every agent reports through these, and only these:

| Event | Emitted when |
|---|---|
| `proposal.accepted` | A member confirms their structured proposal |
| `planning.completed` | Planning Agent produced a new plan version |
| `leader.approved` | Leader approved the current plan |
| `leader.requested_changes` | Leader asked for a revision, with feedback |
| `leader.held` | Leader paused the plan |
| `leader.exited` | Leader closed the plan, with a reason |
| `workflow.resumed` | A held plan was picked back up |
| `coding.completed` | Execution finished in Runloop - carries files changed, tests, preview URL, snapshot id |
| `review.completed` | Review classified the result as pass / coding_issue / plan_issue |

## Team

| Role | Ownership |
|---|---|
| Master Agent + Backend Orchestration | State machine, event routing, approval transitions, execution triggering |
| Notion + Database / Project Memory | Schema, persistence, Notion sync, shared project history |
| Brainstorm + Planning Agents | Idea-to-approved-plan workflow, plan versioning |
| Frontend / UX | Shared workspace, planning queue, leader decision panel |
| Coding + Runloop + Review | Execution, sandboxed coding agent, live previews, snapshots, review classification |


<sub>TypeScript · Fastify · Prisma · React · OpenAI · Runloop · Notion</sub>
