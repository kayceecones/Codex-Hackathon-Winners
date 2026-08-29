<div align="center">

# Weave
### Multiplayer AI for Team Collaboration

<p>
  <img src="https://img.shields.io/badge/TypeScript-Node.js_22%2B-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/OpenAI-Responses_API-412991?style=for-the-badge&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Runloop-Devboxes-6C4EF5?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Notion-Shared_Memory-000000?style=for-the-badge&logo=notion&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-API_Layer-000000?style=for-the-badge&logo=express&logoColor=white" />
</p>

**Weave** turns AI-assisted development from a single-player activity into a shared, governed workflow. Anyone on the team can propose a change; agents research it, synthesize it into one coherent plan, and a human leader decides what happens next - approve, ask for a revision, hold, or close it out. Only after a human says go does a coding agent touch real code, inside a disposable Runloop sandbox, with every result folded back into shared project memory.

> Everyone can propose. Agents synthesize. Humans decide. Runloop executes.

[Architecture](#system-architecture) · [The Workflow Pipeline](#the-workflow-pipeline) · [Features](#features) · [Tech Stack](#tech-stack) · [Quick Start](#quick-start)

</div>

## What Makes This Different

Most AI coding tools are a chat box one person drives while everyone else watches a read-only transcript.

| Typical AI Coding Tool | Weave |
|---|---|
| One person prompts the model in a private thread | Any team member can submit an idea into a shared planning queue |
| Feedback on a plan gets relayed back to whoever is driving | Leader feedback goes straight to the Planning Agent, which produces the next plan version itself |
| A new idea starts a disconnected conversation | Planning updates the *existing* plan: current plan + new proposal + research = the next version, not a fork |
| "Approve" is implicit - the model just keeps going | Two explicit human gates: is this the right plan, and is this plan ready to execute - plus Hold and Exit as first-class outcomes, not dead ends |
| Code changes happen against your real environment or a shared branch | Every execution runs inside a disposable Runloop devbox seeded from a known-good snapshot, torn down after |
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
║   └──────────┬──────────┘  constraints, acceptance criteria             ║
║              ▼                                                          ║
║   ┌───────────────────┐        ┌───────────────────┐                   ║
║   │  Coding Agent        │───►│  Runloop Devbox      │  isolated,       ║
║   │  (tool-calling loop) │◄───│  (sandboxed exec)     │  disposable      ║
║   └──────────┬──────────┘        └───────────────────┘                   ║
║              ▼                                                          ║
║   ┌───────────────────┐                                                 ║
║   │  Review Agent        │  checks the result against the plan's own   ║
║   │                      │  acceptance criteria and scope               ║
║   └──────────┬──────────┘                                              ║
║      ┌───────┼────────────┐                                            ║
║      ▼       ▼            ▼                                            ║
║   PASS   CODING ISSUE   PLAN ISSUE                                     ║
║   done   → back to      → back to                                      ║
║           Coding Agent   Planning Agent                                 ║
║              │              │              │                            ║
║              └──────────────┴──────────────┘                           ║
║                             ▼                                          ║
║   ┌──────────────────────────────────────────────┐                     ║
║   │              SHARED PROJECT MEMORY               │                 ║
║   │  Notion - human-readable project history          │                ║
║   │  Database - machine-readable state / events        │               ║
║   └──────────────────────┬───────────────────────┘                     ║
║                          │                                              ║
║                          ▼                                              ║
║                    NEXT REQUEST                                        ║
╚════════════════════════════════════════════════════════════════════════╝
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

Once approved, the Coding Agent runs a tool-calling loop against a Runloop devbox: read a file, write a file, run a command, or signal done. The devbox is seeded fresh for the run and torn down afterward - execution never touches a shared or persistent environment, and a run that doesn't converge within its iteration cap fails explicitly rather than hanging.

### Stage 5: Review

The Review Agent checks the result against the plan's own acceptance criteria and declared scope, and classifies it one of three ways: **pass**, a **coding issue** (the implementation didn't satisfy its own checks, or touched something outside scope - routed back to the Coding Agent), or a **plan issue** (the plan itself was under-specified in a way execution exposed - routed back to the Planning Agent). Classification is deterministic-first by design: reliability over cleverness.

### Stage 6: Shared Memory

Every proposal, plan version, leader decision, execution result, and review outcome becomes durable shared memory - a human-readable trail in Notion, and machine-readable operational state in the database - so the next request has full context, and "why did we make this change" always has an answer.

## Features

### Brainstorm and Planning Agents
Event-driven from the start: `person3.idea_submitted` produces a structured proposal, `person3.proposal_confirmed` produces the first plan version, and `person3.leader_feedback_received` produces the next one. A pluggable memory-adapter interface (`getProjectContext`, `saveProposal`, `savePlanVersion`, `recordEvent`) keeps the agents' logic independent of where project memory actually lives.

### Coding Agent + Runloop Execution
A manual tool-calling loop against the OpenAI Responses API, with four tools exposed to the model: `read_file`, `write_file`, `run_command`, and `done`. Each call is executed against a real Runloop devbox (`@runloop/api-client`) - create, await-running, execute, read/write file, shut down - never against a mock. A fixed iteration cap means a run that can't converge fails cleanly instead of hanging the workflow.

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
| Coding agent model | OpenAI, Responses API, tool-calling loop |
| Execution sandbox | Runloop Devboxes (`@runloop/api-client`) |
| Coding-agent service API | Express |
| Frontend | React + Vite |
| Shared human-readable memory | Notion |
| Shared operational memory | Database (project, proposal, plan-version, event, approval, execution, review records) |

## Project Structure

```
Weave/
│
├── coding-review-agent/          # Coding Agent + Runloop execution + Review Agent
│   ├── src/
│   │   ├── server.ts               # execution-contract endpoint, event emission
│   │   ├── devbox.ts                # Runloop devbox wrapper
│   │   ├── coding-agent.ts          # OpenAI tool-calling loop
│   │   ├── review-agent.ts          # pass / coding_issue / plan_issue classifier
│   │   └── verify/                  # scripted verification checks
│   ├── seed/                       # seed customer-support demo app
│   └── package.json
│
├── ResearchAndCoding/             # Brainstorm + Planning Agents
│   ├── src/person3/
│   │   ├── brainstormAgent.ts       # idea -> structured FeatureProposal
│   │   ├── planningAgent.ts         # proposal/feedback + context -> next PlanVersion
│   │   ├── contextAssembler.ts
│   │   ├── memoryStore.ts           # pluggable memory adapter interface
│   │   ├── workflow.ts              # event routing (idea/confirm/feedback)
│   │   ├── contracts.ts             # event names and envelopes
│   │   └── types.ts                 # Proposal, PlanVersion, PlanningContext
│   └── test/
│
├── frontend/                      # Shared workspace UI (Reason workspace)
│   └── src/
│
├── TEAM.md                         # branch ownership map
├── docs/branches.md
└── README.md
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

### Brainstorm + Planning Agents

```bash
cd ResearchAndCoding
npm install
npm test               # runs the Node built-in test runner
npm run demo:person3   # runs the golden-path demo: idea -> proposal -> Plan v2 -> feedback -> Plan v3
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Key Engineering Decisions

**1. Planning updates the existing plan, never forks a new one.**
Every plan version is a function of the one before it plus new input: `Plan v4 + proposal/feedback + research = Plan v5`. A team's second idea should sharpen the plan, not compete with it.

**2. Leader feedback goes directly to Planning - never through a person.**
"Request Updated Plan" hands the leader's own words to the Planning Agent, which produces the next version itself. No one manually relays feedback back to whoever originally proposed the idea.

**3. Four leader outcomes, not two.**
Approve/Reject loses information. Hold (paused, resumable) and Exit (closed, with a reason) are both first-class, persisted outcomes - a plan that isn't approved yet isn't automatically dead.

**4. Nothing executes without an explicit human approval of the current plan.**
The execution contract only exists after Approve. There is no path from a plan version straight to the Coding Agent.

**5. Execution always runs in a disposable Runloop devbox, never in place.**
Every run gets a fresh sandbox seeded from a known-good snapshot and torn down afterward, in a `finally` block - a leaked or reused devbox is a bug, not an optimization.

**6. Review classification is deterministic-first.**
Coding-issue and pass are decided by checking real signals (verification-script results, files touched vs. declared scope) - not by asking a model whether it thinks the work looks right. The harder plan-issue path is kept intentionally narrow rather than generalized, because a classification the team can't trust is worse than one that's occasionally too conservative.

**7. A coding-issue and a plan-issue are routed to different agents.**
The Review Agent doesn't just fail a run - it decides *whose* problem it is. An implementation bug goes back to Coding; a plan that was under-specified in a way execution exposed goes back to Planning. Fixing the wrong thing wastes a cycle.

**8. The execution contract carries acceptance criteria through unchanged.**
Review checks the result against the exact criteria the plan was approved against, not a fresh interpretation of "did this work" - so approval and review are judging the same thing.

**9. A coding run that can't converge fails explicitly.**
The Coding Agent's tool-calling loop has a fixed iteration cap. Hitting it produces a `failed` status with whatever partial diff exists, not an indefinitely hanging workflow.

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

**Core workflow events**

| Event | Meaning |
|---|---|
| `idea_submitted` | A team member's raw idea enters the system |
| `proposal_ready` | Brainstorm Agent has structured the idea into a proposal |
| `proposal_confirmed` | The proposing member confirmed it for planning |
| `leader_feedback_received` | The leader requested a plan revision |
| `plan_version_ready` | Planning Agent produced a new plan version |
| `plan_approved` | Leader approved the current plan version |
| `coding_started` / `coding_completed` | Execution began / finished inside Runloop |
| `review_passed` / `review_issue` | Review's classification of the result |

## Team

| Role | Ownership |
|---|---|
| Master Agent + Backend Orchestration | State machine, event routing, approval transitions, execution triggering |
| Notion + Database / Project Memory | Schema, persistence, Notion sync, shared project history |
| Brainstorm + Planning Agents | Idea-to-approved-plan workflow, plan versioning |
| Frontend / UX | Shared workspace, planning queue, leader decision panel |
| Coding + Runloop + Review | Execution, sandboxed coding agent, review classification |

<sub>TypeScript · React · OpenAI · Runloop · Notion</sub>
