# Multiplayer AI for Team Collaboration — 4-Hour Build Plan

*Codex Hackathon, San Francisco*

## Origin

### Initial ideas from YC website

**Multiplayer AI** — By Aaron Epstein

The best work tools of the last two decades won by going multiplayer. Google Docs replaced Microsoft Word. Figma beat Photoshop. And they turned solo tools into places where teams do their best work together.

But AI hasn't had its multiplayer moment yet.

AI agents are the most powerful new tool a team has, but it's the one thing people still use by themselves. That's because right now, working with AI is largely single-player. You open a chat, type a prompt, and get an answer, in a box only you can see. When you want to collaborate with your teammates and agents, the best you can do is send a link to a read-only transcript they can't touch.

That's about to change.

Agents are starting to run tasks that take hours, days, even weeks. Work at that scale was never meant to be done alone, and pulls in many people across a company. Anyone on a team should be able to drop into the same live agent session to watch it work, redirect it, and hand it off, the way they'd work with any other human team member. This turns the work a team does with agents into a shared, living thing instead of a thousand private threads.

We think there's a version of this for every kind of work. Shared agents for engineers coding together in real time. For sales teams working a deal together. For support teams resolving a ticket. For lawyers drafting a contract, analysts building a model, and marketers shipping a campaign. Anywhere a team already crowds around one problem, there should be multiplayer agents they all share.

So if you're building AI that's multiplayer by default, we'd love to hear from you.

**The Primer**

In Neal Stephenson's *The Diamond Age*, a young girl is given an interactive book called *A Young Lady's Illustrated Primer*. It looks like a tool for learning to read, but it's far more. It adapts to her completely, and through stories tuned to her life, it teaches her not just to read but to think, to reason, and eventually to grapple with the hardest questions of ethics, meaning, and character. She returns to it day after day for years, and as she grows, it grows too, continually reshaping itself around who she is becoming and the life she is living.

For the first time in history, something like the Primer is starting to feel possible.

The best education has always come from one-on-one tutoring. Aristotle taught Alexander. But that privilege has been reserved for the few. AI can bring it to every child. And great tutors do more than drill facts. Over years, they learn a child's mind, and with it how to teach what can't be drilled at all: thinking, reasoning, even wisdom.

In Stephenson's story, the Primer is an AI tutor that never runs out of patience or time. We're a long way from building one, but we can start today. What we'd love to see now is a product that adaptively teaches young children to read, write, and do arithmetic, at the quality of a devoted private tutor and at consumer scale. Not a replacement for teachers, but a supplement that makes them more effective.

While we think this begins as something a parent buys to help their child learn basic skills, it is also the entry point to far greater ambitions. A company that gets it right could build toward something like the Primer, and even a fraction of that vision would have a profound effect on society.

If you're building this, we'd love to hear from you.

### Our resulting hackathon idea

Shared knowledge multiplayer AI — think GitHub for group reasoning. Users create a summary of the challenge or decision they are facing and can invite other users into the environment to help them work through it. Teams can utilize a chat box in the environment and pull in useful resources to cooperatively solve problems.

## Multiplayer AI for Team Collaboration

### Overview

- Designed at Codex hackathon in San Francisco
- Goal: improve team collaboration on projects using a multi-agent AI system
- Key objectives:
  - Distribute work evenly across team
  - Keep everyone aware of each other's progress
  - Enable parallel streams of development

### Current pain points

- Only the "driver" has full project context when interacting with AI
- Model gets confused by multiple people giving prompts simultaneously
- Hard for team members to meaningfully contribute ideas

### Proposed architecture

- Master agent coordinates specialized sub-agents
- Each team member has their own sub-agent to work on distinct areas
- GitHub-like branching model:
  - Work happens in individual branches
  - Merged into master branch when ready to share
- Human approval required before master agent finalizes tasks
- New sub-agents created for new features to avoid corrupting existing context
- Sub-agents grouped by role: planning, execution, code review

### Key features

- Real-time project status summary (auto-updates every 5–10 min)
- Search historical context for past decisions and reasoning
- Drag-and-drop prioritized task queue
- Visual project roadmap showing milestones and new idea impact
- Automatic scope impact analysis when new ideas are proposed
- Fun, game-like UX layer over the complex agent infrastructure

### Agent interaction model

- Sub-agents grouped by specialization: planning, execution, review
- Agents manage and trigger each other (e.g. review starts after execution)
- Shared context maintained across all agents and users

### Implementation notes

- `skills.md` file approach to align agents and provide context
- Traditional rigid tools considered outdated
- Strong emphasis on delightful, collaborative UX
- Goal: automate tedious parts of teamwork while preserving creativity and fun

## Product thesis

> **Everyone can propose. Agents synthesize. Humans decide. Runloop executes.**

## Core demo

Customer Support Dashboard with Ticket List, Customer Details, and AI Response Assistant. During the demo, two team members propose **Add dark mode** and **Make the dashboard mobile responsive**.

## Architecture

```
TEAM MEMBERS
      |
      v
PLANNING QUEUE
      |
      v
PLANNING AGENT
      |
      v
RESEARCH AGENT
      |
      v
UPDATED PLAN
      |
      v
HUMAN APPROVAL #1 — Is this the right plan?
      |
      v
FINAL EXECUTION PLAN
      |
      v
HUMAN APPROVAL #2 — Ready to execute?
      |
      v
CODING AGENT
      |
      v
RUNLOOP
      |
      v
CODE + TESTS
      |
      v
SHARED PROJECT MEMORY
      |
      +----> NEXT REQUEST
```

## Five-person ownership

| Person | Ownership | Must deliver |
| --- | --- | --- |
| **1 — Orchestrator / Integrator** | Backend, state machine, API, agent coordination, approvals | End-to-end workflow |
| **2 — Runloop / Coding Agent** | Runloop environment, repository, coding agent, tests | Real code change |
| **3 — Planning / Research** | Planning agent, research agent, plan updates, tradeoffs | Updated plan |
| **4 — Frontend / UX** | Shared workspace, queue, activity, approvals, coding UI | Demoable interface |
| **5 — Memory / Review / Demo** | Decisions, history, execution review, seed data, reliability | Shared memory + reliable demo |

**Integration rule:** Person 1 owns integration. Everyone else exposes the agreed contracts below.

## Person 1 — Orchestration / Integration

**Mission:** own the nervous system of the application.

**Responsibilities:**

- Backend/API
- Workflow state machine
- Agent invocation
- Context passing
- Approval transitions
- Execution triggering
- Integration
- Demo reset

**Minimum API:**

```
GET  /project
GET  /state
POST /requests
POST /approve-plan
POST /approve-execution
POST /execute
GET  /events
```

Optional: `POST /reset`

**State:**

```json
{
  "project": {},
  "requests": [],
  "currentPlan": {},
  "executionPlan": {},
  "approvals": [],
  "events": [],
  "executionResult": null
}
```

**Definition of done:** a request can move through: request → planning → research → plan → approval #1 → execution proposal → approval #2 → Runloop → coding → result.

**Do not build:** complex orchestration frameworks, advanced queues, production auth, distributed infrastructure, or sophisticated permissions.

## Person 2 — Runloop + Coding Agent

**Mission:** prove that an approved plan becomes real work.

**Responsibilities:**

- Runloop environment
- Coding agent
- Repository access
- File modifications
- Tests
- Execution results

**Demo repository** (keep it tiny):

```
demo-app/
  index.html
  style.css
  app.js
```

**Target capability:** given an approved request such as **Add dark mode**, the agent inspects the repo, modifies files, runs validation/tests, and returns changed files, test results, and a summary.

**Interface**

Input:

```json
{
  "project_id": "demo-project",
  "plan_version": 5,
  "tasks": [],
  "constraints": [],
  "context": []
}
```

Output:

```json
{
  "status": "success",
  "summary": "...",
  "files_changed": [],
  "tests": { "passed": 12, "failed": 0 }
}
```

**Definition of done:** one call causes approved execution → Runloop → coding agent → actual file changes → tests → result.

**Do not build:** multiple simultaneous coding agents, general-purpose coding platform, complex Git branching, or production CI/CD.

## Person 3 — Planning + Research Agents

**Mission:** turn multiplayer input into one coherent plan.

**Pipeline:**

```
Current Plan + New Requests + Project Context
                    |
                    v
             PLANNING AGENT
                    |
                    v
             RESEARCH AGENT
                    |
                    v
              UPDATED PLAN
```

**Planning output:**

```json
{
  "version": 5,
  "summary": "Add dark mode and mobile responsiveness",
  "tasks": [],
  "affected_areas": [],
  "tradeoffs": [],
  "research": [],
  "unresolved_questions": []
}
```

**Research:** inspect existing files, implementation patterns, decisions, and project context. Return findings, recommendation, impact, and conflicts.

**Critical behavior:** update the existing plan rather than creating an unrelated plan: **Plan v4 + new requests + research = Plan v5.**

**Definition of done:** two team members can submit requests and the system produces one coherent updated plan.

**Do not build:** general web research, sophisticated RAG, long-term autonomous planning, or multiple planning agents.

## Person 4 — Frontend / UX

**Mission:** make the system understandable in 30 seconds.

**Main screen:**

```
+-------------------------------------------------------+
| TEAM PROJECT                           3 AGENTS ●     |
+----------------+----------------------+---------------+
| PROJECT        | LIVE ACTIVITY        | PROJECT STATE |
|                |                      |               |
| ● Master       | Maya: Add dark mode  | PLAN v5       |
| ├ Design       | 🤖 Researching...    | ✓ Research    |
| ├ Backend      | James: Mobile UI     | ✓ Planning    |
| └ Frontend     |                      | ● Approval    |
+----------------+----------------------+---------------+
| What should we change?                    [ Send ]    |
+-------------------------------------------------------+
```

**Required states:**

1. Project workspace — team/project, planning queue, agent activity, current plan.
2. Plan approval — **Approve Plan** / reject.
3. Execution approval — **Approve & Execute** / back to plan.
4. Coding progress — repository inspection, implementation, tests.
5. Result — files changed, tests passed, summary, view result.

**Definition of done:** a judge immediately understands: anyone can contribute → agents synthesize → humans approve → coding agent executes.

**Do not build:** real-time cursors, complex permissions, mobile app, dozens of screens, or advanced analytics.

## Person 5 — Shared Memory + Review + Demo Reliability

**Mission:** make the project remember why things happened and make the demo reliable.

**Core objects:**

```
Decision
Plan
Plan Version
Agent Run
Execution Result
Event
Approval
```

**Decision example:**

```json
{
  "question": "Should we support dark mode?",
  "proposed_by": "maya",
  "research": "...",
  "tradeoffs": [],
  "plan_version": 5,
  "approved_by": "sarah",
  "result": "implemented"
}
```

**Review:** after execution, show requirements, tests, unrelated-change check, and any potential issue. For the hackathon, non-critical review can be deterministic/mock-driven.

**Reliability ownership:**

- Seed data
- Demo reset
- Fallback states
- Test runs
- Demo script
- Backup screenshots/results

## Shared data contracts

**Planning Request**

```json
{
  "id": "request-123",
  "project_id": "demo-project",
  "author": "maya",
  "text": "Add dark mode",
  "status": "queued"
}
```

**Execution Plan**

```json
{
  "plan_version": 5,
  "tasks": [],
  "files_or_areas": [],
  "constraints": [],
  "tests_required": []
}
```

**Execution Result**

```json
{
  "status": "success",
  "summary": "Implemented dark mode and responsive navigation",
  "files_changed": [],
  "tests": { "passed": 12, "failed": 0 }
}
```

**Events**

```
request.created
planning.started
research.started
plan.updated
plan.approved
execution.approved
coding.started
coding.completed
review.completed
project.updated
```

## Workflow state machine

```
IDLE
  |
  v
PLANNING_REQUEST
  |
  v
RESEARCHING
  |
  v
PLAN_UPDATED
  |
  v
PLAN_APPROVAL
  | \
  |  \ reject → PLANNING_REQUEST
  v
EXECUTION_REVIEW
  | \
  |  \ reject → PLANNING_REQUEST
  v
CODING
  |
  v
REVIEW
  |
  v
MERGED
```

New planning requests can arrive while coding is underway. They queue and do not interrupt current execution. Drain the planning queue at a natural checkpoint before the next meaningful execution step.

## Four-hour schedule

### 0:00–0:20 — Lock scope

Agree on the Customer Support Dashboard, dark mode request, mobile request, two approvals, and Runloop execution. No new product ideas after this point.

### 0:20–1:20 — Parallel implementation

- Person 1: backend + state machine
- Person 2: Runloop + coding agent
- Person 3: planning + research
- Person 4: frontend
- Person 5: memory + demo data

### 1:20–2:20 — Critical integration

Connect frontend → orchestrator → planning → research → plan, then plan → approval #1 → execution plan → approval #2 → Runloop → coding agent.

**At 2:20 the entire happy path must exist.** It can be ugly.

### 2:20–3:00 — Multiplayer behavior

Make two requests appear in the planning queue and have planning reconcile them.

### 3:00–3:30 — Approval flow

Keep the two checkpoints unmistakable:

- **Approval #1:** "Is this the right thing to build?"
- **Approval #2:** "Is this plan ready for the coding agent?"

### 3:30–4:00 — Freeze

No new features. Run the complete demo at least three times. Fix crashes, broken integration, confusing UI, and unreliable agent behavior only.

## Allowed to fake vs. must be real

**Can be fake:**

- Typing indicators
- Agent thinking animations
- Agent progress timing
- Some historical activity
- Non-critical research latency
- Complex permissions
- Real-time cursors
- Git branching
- Advanced search

**Must be real:**

- Planning → Approval #1
- Execution → Approval #2
- Runloop execution
- Actual code modification
- Actual test/result output

## Explicitly out of scope

Production authentication, complex Git branching, sophisticated permissions, vector databases, general-purpose RAG, multiple simultaneous coding agents, mobile app, production deployment infrastructure, advanced analytics, full GitHub integration, and complex autonomous loops.

## Demo script

1. **Problem:** "AI coding is still mostly single-player. One person drives the AI while everyone else watches."
2. **Multiplayer:** Maya submits "Add dark mode." James submits "Make the dashboard mobile responsive."
3. **AI synthesis:** planning + research produce an updated plan with tasks, tradeoffs, and dependencies.
4. **Approval #1:** approver clicks **Approve Plan**.
5. **Execution handoff:** show files affected, tasks, and unresolved dependencies.
6. **Approval #2:** approver clicks **Approve & Execute**.
7. **Runloop:** coding agent inspects the repo, implements changes, and runs tests.
8. **Result:** show the actual working application.
9. **Memory:** ask "Why did we make these changes?" and show the decision/history trail.
10. **Final line:** **"Everyone can propose. Agents synthesize. Humans decide. Runloop executes."**

## Final definition of done

```
Two people propose ideas
        ↓
Ideas enter shared planning queue
        ↓
Planning agent incorporates them
        ↓
Research agent provides evidence/tradeoffs
        ↓
Updated plan appears
        ↓
Human approves plan
        ↓
Execution plan appears
        ↓
Human approves execution
        ↓
Coding agent starts in Runloop
        ↓
Real code changes
        ↓
Tests run
        ↓
Result becomes shared knowledge
```

If this works reliably, **we have the demo**.

## Future architecture

The demo deliberately models reasoning branches without implementing full Git branching. The long-term path is:

```
Logical reasoning branches
        ↓
Actual Git branches
        ↓
Isolated Runloop environments
        ↓
Agent-to-agent collaboration
        ↓
Pull-request-style review
        ↓
Human merge
```

Long-term vision: **GitHub for group reasoning — a persistent multiplayer workspace where teams and agents collaboratively reason, plan, execute, review, and remember.**
