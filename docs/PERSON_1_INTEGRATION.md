# Person 1 Integration Guide

Person 1 owns the Master Agent control plane. This backend receives workflow events, validates legal state transitions, records timeline history, and exposes the next action each teammate should consume.

## Quick Start

```powershell
npm.cmd run install:all
npm.cmd run dev:master
```

Open:

```text
http://127.0.0.1:3001
```

Setup details live in `docs/SETUP.md`.

Use these first:

- `GET /health` confirms the backend is running.
- `GET /api/contracts` returns all supported states, events, actions, and review classifications.
- `POST /api/projects` creates a real project id for the rest of the flow.
- `POST /api/events` is the canonical workflow event intake endpoint.
- `POST /api/integrations/person3/events` accepts Person 3 output events and maps them into canonical Master events.

Important: `GET /api/projects/:projectId` and `GET /api/projects/:projectId/next-actions` require a real project id returned by `POST /api/projects`. A fake id like `demo` correctly returns `404 Project not found`.

## Project Structure

```text
/
  src/                    Person 1 Master backend API
  tests/                  Person 1 backend tests
  docs/                   Shared setup and integration handoff docs
  ResearchAndCoding/      Person 3 Brainstorm + Planning package
  coding-review-agent/    Person 5 Coding + Runloop + Review package
```

## Workflow Lifecycle

```text
proposal.accepted
  -> Master creates invoke_planning
planning.completed
  -> Master creates await_leader_decision
leader.requested_changes
  -> Master creates invoke_planning again
planning.completed
  -> Master creates await_leader_decision again
leader.approved
  -> Master creates invoke_coding with executionContract and codingReviewContract
coding.completed
  -> Master creates invoke_review
review.completed pass
  -> Master completes workflow
```

Recovery paths:

- `leader.held` moves the project to `on_hold` and preserves the previous actionable state.
- `workflow.resumed` routes back to Planning, Leader, Coding, or Review depending on where the workflow was held.
- `leader.exited` closes the workflow with a reason.
- `review.completed` with `coding_issue` routes back to Coding.
- `review.completed` with `plan_issue` routes back to Planning and clears the approved plan.

## Valid States And Events

States:

- `idle`
- `awaiting_plan`
- `awaiting_leader_decision`
- `on_hold`
- `awaiting_coding`
- `awaiting_review`
- `completed`
- `exited`

Events:

- `proposal.accepted`
- `planning.completed`
- `leader.approved`
- `leader.requested_changes`
- `leader.held`
- `leader.exited`
- `workflow.resumed`
- `coding.completed`
- `review.completed`

Hard rule: Coding cannot start before `leader.approved` creates an `invoke_coding` next action.

## What Each Teammate Does

### Person 2: Database + Notion Memory

Person 2 should replace `InMemoryStore` with a database-backed class that implements `src/adapters/store/Store.ts`. For the detailed storage handoff, use `docs/MEMORY_ADAPTER.md`.

Required responsibilities:

- Persist the full `ProjectSnapshot` shape: project, proposals, plans, approvals, execution contracts, coding results, reviews, and events.
- Treat the database as the operational source of truth.
- Sync committed `WorkflowEventRecord` entries to Notion for human-readable history.
- Keep the same store method names so `src/app.ts` can swap adapters without changing routes or state logic.

Integration point:

```ts
import type { Store } from "../src/adapters/store/Store.js";
```

### Person 3: Brainstorm + Planning Agents

Person 3 code lives in `ResearchAndCoding/`.

Person 3 can integrate in two ways:

- Preferred: send canonical Master events to `POST /api/events`.
- Fast bridge: send existing Person 3 output events to `POST /api/integrations/person3/events`.

When a team member confirms a proposal, send canonical `proposal.accepted`:

```json
{
  "type": "proposal.accepted",
  "projectId": "project_123",
  "actor": { "name": "Person A", "role": "team_member" },
  "payload": {
    "proposal": {
      "title": "Add dark mode",
      "summary": "Frontend-only dark mode with persistence.",
      "proposer": "Person A",
      "acceptanceCriteria": ["Theme can be toggled", "Preference persists"]
    }
  }
}
```

When Planning finishes a plan or revised plan, send canonical `planning.completed`:

```json
{
  "type": "planning.completed",
  "projectId": "project_123",
  "actor": { "name": "Planning Agent", "role": "planning" },
  "payload": {
    "plan": {
      "version": 3,
      "title": "Plan v3: frontend-only dark mode",
      "summary": "Add theme tokens, toggle UI, and local persistence.",
      "feedbackAddressed": "Removed backend work and kept frontend-only scope.",
      "steps": [
        { "title": "Add theme tokens", "description": "Create light and dark theme variables.", "owner": "Person 4" }
      ],
      "acceptanceCriteria": ["Theme persists across reloads."]
    }
  }
}
```

Fast bridge example for Person 3's existing event shape:

```json
{
  "type": "person3.plan_version_ready",
  "payload": {
    "projectId": "project_123",
    "planVersion": {
      "id": "plan-v2",
      "projectId": "project_123",
      "proposalId": "proposal-1",
      "version": 2,
      "title": "Plan v2: Dark Mode",
      "summary": "Add dark mode with frontend-only scope.",
      "tasks": ["Create theme toggle.", "Persist preference locally."],
      "acceptanceCriteria": ["Theme persists across reloads."],
      "risks": ["Hard-coded colors may remain."],
      "leaderFeedback": null
    }
  }
}
```

Bridge behavior:

- `person3.proposal_ready` with draft proposal is recorded as accepted by the endpoint but does not move Master state.
- `person3.proposal_ready` with confirmed proposal maps to `proposal.accepted`.
- `person3.plan_version_ready` maps to `planning.completed`.
- If the Master project is still `idle`, `person3.plan_version_ready` also creates a synthetic `proposal.accepted` first.
- Person 3 plan `version` is preserved for frontend plan history.

### Person 4: Frontend / UX

Person 4 should use the Master backend as the dashboard state API. For a route-by-route frontend reference, use `docs/FRONTEND_ENDPOINTS.md`.

Read:

```text
GET /api/contracts
GET /api/projects/:projectId
GET /api/projects/:projectId/events
GET /api/projects/:projectId/next-actions
```

Send leader decisions to `POST /api/events`:

```json
{
  "type": "leader.approved",
  "projectId": "project_123",
  "actor": { "name": "Leader", "role": "leader" },
  "payload": {
    "leader": "Leader",
    "notes": "Approved for implementation."
  }
}
```

Other leader event payloads:

```json
{ "type": "leader.requested_changes", "projectId": "project_123", "payload": { "leader": "Leader", "feedback": "Revise scope." } }
{ "type": "leader.held", "projectId": "project_123", "payload": { "leader": "Leader", "reason": "Waiting for confirmation." } }
{ "type": "leader.exited", "projectId": "project_123", "payload": { "leader": "Leader", "reason": "Out of scope." } }
{ "type": "workflow.resumed", "projectId": "project_123", "payload": { "note": "Ready to continue." } }
```

UI should show:

- `snapshot.project.status` as the current workflow state.
- `snapshot.plans` as plan version history.
- `snapshot.events` as the timeline.
- `nextActions` as what the user or agent should do next.

### Person 5: Coding + Runloop + Review

Person 5 code lives in `coding-review-agent/`.

Person 5 should consume `invoke_coding` and `invoke_review` actions from:

```text
GET /api/projects/:projectId/next-actions
```

Coding starts only when an `invoke_coding` action exists. Its payload contains both shapes:

- `executionContract`: canonical Person 1 contract.
- `codingReviewContract`: Person 5 compatible payload for `POST /execution-contract`.

Send `codingReviewContract` to Person 5:

```text
POST http://127.0.0.1:4005/execution-contract
```

Person 5 `.env` should include:

```text
MASTER_API_URL=http://127.0.0.1:3001
```

When `MASTER_API_URL` is set, Person 5 posts canonical `coding.completed` and `review.completed` events back to Master automatically.

Manual `coding.completed` shape:

```json
{
  "type": "coding.completed",
  "projectId": "project_123",
  "actor": { "name": "Coding Agent", "role": "coding" },
  "payload": {
    "execution": {
      "status": "completed",
      "summary": "Implemented approved plan.",
      "filesChanged": ["src/frontend/theme.ts"],
      "commandsRun": ["npm.cmd run test"]
    }
  }
}
```

Manual `review.completed` shape:

```json
{
  "type": "review.completed",
  "projectId": "project_123",
  "actor": { "name": "Review Agent", "role": "review" },
  "payload": {
    "review": {
      "classification": "coding_issue",
      "summary": "One issue remains.",
      "issues": [
        { "title": "Low contrast badge", "detail": "Held badge is hard to read.", "severity": "medium" }
      ]
    }
  }
}
```

Review classifications:

- `pass`: Master completes the workflow.
- `coding_issue`: Master routes back to Coding.
- `plan_issue`: Master routes back to Planning.

## Integration Notes

- Use `src/contracts/index.ts` as the teammate-facing TypeScript export surface.
- Use `GET /api/contracts` as the runtime source of valid states and event names.
- Every successful `POST /api/events` returns the transition, updated snapshot, dispatched actions, and currently pending next actions.
- The state machine is pure and lives in `src/master/stateMachine.ts`.
- HTTP routes, integration adapters, and storage are intentionally separate from state transitions so teammate integrations can evolve safely.