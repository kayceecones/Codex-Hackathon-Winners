# Memory Service API

Base URL: `http://localhost:4000`

Source of truth is SQLite (via Prisma). Every write also appends an `Event` row and
best-effort mirrors to Notion. Notion sync is safe to ignore in dev — if `NOTION_TOKEN`
isn't set, it's a silent no-op and the DB still works.

## Projects

- `POST /projects` `{ name, description? }` → Project
- `GET /projects` → Project[]
- `GET /projects/:id/state` → `{ project, proposals, latestPlan, latestApproval, executionContract, implementation, review }`
  — the one endpoint the frontend needs for a full dashboard snapshot.
- `GET /projects/:id/timeline` → Event[] (ascending, for the activity feed)
- `GET /projects/:id/plans` → PlanVersion[] (ascending by version, for version history/diff view)

## Proposals (Brainstorm Agent)

- `POST /proposals` `{ projectId, memberName, title, description }` → Proposal (status `pending`)
- `POST /proposals/:id/confirm` → Proposal (status `confirmed`)

## Plan versions (Planning Agent)

- `POST /plans` `{ projectId, proposalId?, content, diffSummary? }` → PlanVersion
  - Auto-increments `version` per project.
  - Auto-supersedes the previous `awaiting_decision`/`needs_revision` version.
  - New version always starts as `awaiting_decision`.

## Leader decision

- `POST /plans/:id/decision` `{ decision: "approve" | "request_update" | "hold" | "exit", feedback?, decidedBy }`
  → `{ plan, executionContract }`
  - `approve` → plan → `approved`, creates an `ExecutionContract`, emits `coding.ready` (this is what Master Agent listens for to invoke Coding).
  - `request_update` → plan → `needs_revision`; `feedback` is what Planning Agent should read to produce the next version.
  - `hold` → plan → `held`.
  - `exit` → plan → `rejected`.

## Execution (Coding Agent / Runloop)

- `POST /implementations` `{ projectId, executionContractId, runloopSessionId?, filesChanged?, testResults?, status? }` → Implementation
- `PATCH /implementations/:id` `{ status?, filesChanged?, testResults? }` → Implementation (sets `finishedAt` once status leaves `running`)

## Review Agent

- `POST /reviews` `{ projectId, implementationId, verdict: "pass" | "coding_issue" | "plan_issue", notes? }` → Review
  - Master Agent should route `coding_issue` back to Coding and `plan_issue` back to Planning (new plan version off the same proposal).

## Agent run log (optional, for debugging/observability)

- `POST /agent-runs` `{ projectId, agentType: "brainstorm"|"planning"|"coding"|"review", input }` → AgentRun (`running`)
- `PATCH /agent-runs/:id` `{ status: "done"|"error", output? }` → AgentRun

## Generic event ingestion

- `POST /events` `{ projectId, type, payload? }` → Event
  - Use this for any lifecycle event that doesn't already have a dedicated endpoint above.
  - Every event is timestamped, persisted, and mirrored to the Notion Timeline database.

## Running it

```bash
cd memory-service
cp .env.example .env         # fill in NOTION_* once you have them
npm install
npm run prisma:migrate
npm run seed                 # optional: loads the dark-mode demo project through plan v2
npm run dev                  # http://localhost:4000
```
