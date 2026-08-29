# Person 1 Integration Guide

Person 1 owns the Master Agent control plane. This backend receives workflow events, validates legal state transitions, records timeline history, and exposes the next action each teammate should consume.

## Quick Start

```powershell
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://127.0.0.1:3001
```

Use these first:

- `GET /health` confirms the backend is running.
- `GET /api/contracts` returns all supported states, events, actions, and review classifications.
- `POST /api/projects` creates a real project id for the rest of the flow.
- `POST /api/events` is the single workflow event intake endpoint.

Important: `GET /api/projects/:projectId` and `GET /api/projects/:projectId/next-actions` require a real project id returned by `POST /api/projects`. A fake id like `demo` correctly returns `404 Project not found`.

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
  -> Master creates invoke_coding with executionContract
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

Person 2 should replace `InMemoryStore` with a database-backed class that implements `src/adapters/store/Store.ts`.

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

Person 3 sends ideas and plans into the Master backend.

When a team member confirms a proposal, send `proposal.accepted`:

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

When Planning finishes a plan or revised plan, send `planning.completed`:

```json
{
  "type": "planning.completed",
  "projectId": "project_123",
  "actor": { "name": "Planning Agent", "role": "planning" },
  "payload": {
    "plan": {
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

Person 3 should also read `invoke_planning` actions from:

```text
GET /api/projects/:projectId/next-actions
```

### Person 4: Frontend / UX

Person 4 should use the Master backend as the dashboard state API.

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

Person 5 should consume `invoke_coding` and `invoke_review` actions from:

```text
GET /api/projects/:projectId/next-actions
```

Coding starts only when an `invoke_coding` action exists. Its payload contains `executionContract`, including the approved plan id, objective, steps, acceptance criteria, and constraints.

After coding finishes, send `coding.completed`:

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

After review finishes, send `review.completed`:

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
- HTTP routes and storage are intentionally separate from state transitions so teammate integrations can evolve safely.

