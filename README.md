# Codex Hackathon Winners

An agentic software-development workspace that turns an idea into a validated implementation through collaborative AI agents, persistent memory, human feedback, and an execution/review loop.

## What We're Building

The system coordinates a multi-agent workflow:

**Idea → Brainstorm → Plan → Human Feedback → Updated Plan → Code → Run → Review**

The planning flow is intentionally iterative: after reviewing a plan, a user can give feedback and ask the Planning Agent for an updated plan rather than manually routing feedback to another team member.

## Architecture

```text
                         ┌──────────────────────┐
                         │      Frontend / UX    │
                         │      Person 4         │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Master Agent     │
                         │      Person 1        │
                         │  orchestration/state │
                         └──────┬───────┬───────┘
                                │       │
                   ┌────────────┘       └────────────┐
                   ▼                                 ▼
          ┌──────────────────┐              ┌──────────────────┐
          │ Brainstorm +     │              │ Coding + Runloop │
          │ Planning Agents  │              │ + Review Agent   │
          │    Person 3      │              │     Person 5     │
          └────────┬─────────┘              └────────┬─────────┘
                   │                                 │
                   └──────────────┬──────────────────┘
                                  ▼
                       ┌──────────────────────┐
                       │   Memory / Database  │
                       │       Person 2       │
                       │ DB + Notion + history│
                       └──────────────────────┘
```

## Team Ownership

| Person | Branch | Ownership |
|---|---|---|
| Person 1 | `person-1-master-backend` | Master Agent, orchestration, state machine, backend/API coordination |
| Person 2 | `person-2-memory-database` | Database, Notion integration, persistence, memory and history |
| Person 3 | `person-3-brainstorm-planning` | Brainstorm Agent, Planning Agent, plan versions and feedback-driven replanning |
| Person 4 | `person-4-frontend-ux` | Frontend, dashboard, brainstorming UI, proposals, plans, controls and timeline |
| Person 5 | `person-5-coding-runloop-review` | Coding Agent, Runloop execution, validation and Review Agent |

## Core Workflow

1. **Capture an idea** through the frontend.
2. **Brainstorm** candidate approaches and proposals.
3. **Create a plan** with implementation steps and dependencies.
4. **Review the plan as a human** and provide feedback.
5. **Regenerate the plan** using the Planning Agent and the user's feedback.
6. **Approve the updated plan** and begin implementation.
7. **Execute coding work** through the Coding Agent and Runloop.
8. **Review and validate** the implementation.
9. **Persist important state and history** in the database and Notion.

## Human-in-the-Loop

Humans remain in control of major transitions. The interface should make the current state, proposals, plan versions, execution progress, review results, and next action visible at all times.

## Persistence

The memory layer provides durable project context across the workflow, including ideas, brainstorm outputs, plan versions, user feedback, execution state, review results, and project history. Notion is used as a connected knowledge/documentation layer alongside the application database.

## Development

Work should be isolated by responsibility using the team branches above. Keep shared contracts and integration points stable so each person's work can be merged without unnecessary coupling.

### Branching Strategy

```text
master
├── person-1-master-backend
├── person-2-memory-database
├── person-3-brainstorm-planning
├── person-4-frontend-ux
└── person-5-coding-runloop-review
```

Each person should commit only work within their ownership area where practical, regularly pull the latest `master`, and open a pull request when their component is ready for integration.

## Project Goal

Deliver a polished hackathon prototype that demonstrates a complete, observable, human-guided agentic development loop—not just isolated AI agents.
