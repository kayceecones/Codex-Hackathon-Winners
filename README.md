# Codex Hackathon Winners

A multiplayer AI project workspace that turns a team idea into an approved plan, executed code, reviewed output, and durable project memory.

## Why It Exists

Most AI work still happens in private chats. Teams lose context, decisions are scattered, and agent work is hard to supervise. This project makes AI collaboration shared by default: everyone can see the current project state, how a plan changed, what is waiting on a human, and what the agents should do next.

## What It Does

- Captures a teammate's rough idea and turns it into a structured proposal.
- Builds versioned implementation plans with feedback loops.
- Gives a human leader explicit control to approve, request changes, hold, resume, or exit.
- Routes approved work to coding and review agents.
- Loops back when review finds implementation or planning issues.
- Exposes a frontend-ready API for live status, timeline, plans, approvals, and next actions.
- Keeps persistence replaceable so the in-memory workflow can move to a real database and Notion history.

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
  tests/                  Backend and integration-adapter tests
  scripts/                End-to-end integrated workflow script
  docs/                   Setup, API, frontend, and persistence handoff docs
  ResearchAndCoding/      Brainstorm and planning agent package
  coding-review-agent/    Coding, Runloop, and review service package
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

The current integrated build includes the orchestration backend, brainstorm/planning package, coding/review service, shared contracts, API docs, frontend endpoint guide, and persistence adapter guide. The local workflow check exercises a complete path from idea to revised plan, approval, coding, review issue, fix, and final pass.