# Codex Hackathon Winners

A multiplayer AI project workspace that turns a team idea into an approved plan, executed code, reviewed output, and durable project memory.

## Why It Exists

Most AI work still happens in private chats. Teams lose context, decisions are scattered, and agent work is hard to supervise. This project makes AI collaboration shared by default: everyone can see the current project state, how a plan changed, what is waiting on a human, and what the agents should do next.

## What It Does

- Captures a teammate's rough idea and turns it into a structured proposal.
- Builds versioned implementation plans with feedback loops.
- Gives a human leader explicit control to approve, request changes, hold, resume, or exit.
- Routes approved work to coding and review agents.
- Executes approved plans inside an isolated Runloop devbox, serves the result over a public tunnel so the whole team can open one live URL, and commits it as a named snapshot that later runs can build on.
- Loops back when review finds implementation or planning issues, routing each to the agent that owns it.
- Exposes a frontend-ready API for live status, timeline, plans, approvals, and next actions.
- Persists workflow state to a database with Notion sync for human-readable project history.

## Integrated Workflow

```text
Idea
  -> Brainstorm and planning agents create proposal and plan versions
  -> Master orchestration validates state transitions
  -> Leader approves, requests changes, holds, resumes, or exits
  -> Coding agent executes the approved contract
  -> Review agent validates the result
  -> Master completes the workflow or loops back for fixes
  -> Frontend and memory layers read the same source of truth
```

## Repository Map

```text
/
  src/                    Master orchestration backend and shared contracts
    master/               Workflow state machine and event routing
    contracts/            Canonical workflow, event, and agent types
    adapters/store/       DbStore (Prisma) and InMemoryStore
    adapters/agents/      Dispatch to the coding/review service
    notion/               Notion sync for human-readable history
  prisma/                 Database schema and migrations
  tests/                  Backend, gateway, and integration-adapter tests
  scripts/                End-to-end integrated workflow script
  docs/                   Setup, API, frontend, and persistence handoff docs
  ResearchAndCoding/      Brainstorm and planning agent package
  coding-review-agent/    Coding, Runloop, and review service package
  frontend/               Shared workspace UI
```

## Run Locally

Requirements: Node.js 20 or newer and npm.

```powershell
npm.cmd run install:all
npm.cmd run test:all
npm.cmd run build:all
npm.cmd run demo
npm.cmd run dev:master
```

Default backend URL:

```text
http://127.0.0.1:3001
```

Useful checks:

```powershell
curl.exe http://127.0.0.1:3001/
curl.exe http://127.0.0.1:3001/health
curl.exe http://127.0.0.1:3001/api/contracts
```

### Running real execution

By default the Master records an approved plan's `invoke_coding` action but does
not call anything, so execution advances only when a `coding.completed` event
arrives. To dispatch approved plans to the real coding service, start it and
point the Master at it:

```powershell
npm.cmd run dev:person5          # coding + review service on :4005
$env:CODING_REVIEW_URL = "http://127.0.0.1:4005"
npm.cmd run dev:master
```

The coding service needs `RUNLOOP_API_KEY` and `OPENAI_API_KEY` in
`coding-review-agent/.env`. Verify the whole Runloop path - devbox, file I/O,
tunnel, snapshot, and booting back from that snapshot - in one command:

```powershell
npm.cmd --prefix coding-review-agent run milestone0
```

## API Highlights

- `POST /api/projects` creates a project and returns the project id.
- `GET /api/projects/:projectId` returns the full workflow snapshot.
- `GET /api/projects/:projectId/events` returns the timeline.
- `GET /api/projects/:projectId/next-actions` returns the current action queue.
- `POST /api/events` accepts canonical workflow events.
- Integration bridge endpoints normalize agent-package output into the main workflow.

## Documentation

- `docs/SETUP.md`: install, run, and verify the full integrated project.
- `docs/API_EXAMPLES.md`: copy-pasteable API walkthrough.
- `docs/FRONTEND_ENDPOINTS.md`: frontend route and payload reference.
- `docs/MEMORY_ADAPTER.md`: database and Notion persistence adapter handoff.

## Current Build Status

Every component and every seam between them is in place: the orchestration
backend and its state machine, the brainstorm/planning package, the
coding/review service, database persistence with Notion sync, the shared
workspace UI, and real dispatch from an approved plan to the coding service.
The local workflow check exercises a complete path from idea to revised plan,
approval, coding, review issue, fix, and final pass.

One thing is written but unproven: **no Runloop call has yet run against a real
API key.** Devbox creation, preview tunnels, and snapshots are implemented and
reachable - dispatch has been confirmed end to end, with Runloop returning a
genuine authentication error for a placeholder key - but none of it has
executed successfully. `milestone0` (above) settles that in one command once a
key is available.