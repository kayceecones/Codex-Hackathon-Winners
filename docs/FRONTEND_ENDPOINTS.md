# Frontend Endpoint Reference

This document is for Person 4. The frontend should treat the Person 1 Master backend as the single workflow state API.

Base URL during local development:

```text
http://127.0.0.1:3001
```

## Recommended Frontend Flow

1. Call `GET /api/contracts` on app load to know valid states, events, actions, decisions, and review classifications.
2. Call `POST /api/projects` when starting a project.
3. Store the returned `snapshot.project.id` as the active `projectId`.
4. Poll or refresh `GET /api/projects/:projectId` after each action.
5. Render `snapshot.events` as the timeline.
6. Render `snapshot.plans` as the plan-version history.
7. Render `nextActions` as the current user/agent action queue.
8. Send leader buttons through `POST /api/events`.

## Endpoints Person 4 Should Use

| Method | Path | Frontend Use |
|---|---|---|
| GET | `/` | Optional landing/health page for humans. |
| GET | `/health` | Show backend connection status. |
| GET | `/api/contracts` | Load allowed workflow states, event names, action kinds, and decisions. |
| POST | `/api/projects` | Create a project and get a real project id. |
| GET | `/api/projects/:projectId` | Read the full project snapshot plus pending next actions. |
| GET | `/api/projects/:projectId/events` | Read timeline events only. |
| GET | `/api/projects/:projectId/next-actions` | Read pending next actions only. |
| POST | `/api/events` | Send proposal, planning, leader, coding, review, hold, exit, and resume events. |
| POST | `/api/integrations/person3/events` | Optional bridge if frontend forwards Person 3 output events directly. |

## Create Project

```http
POST /api/projects
Content-Type: application/json
```

```json
{
  "name": "Codex Hackathon Project",
  "description": "Integrated agent workflow",
  "leader": "Leader"
}
```

Response shape:

```json
{
  "snapshot": {
    "project": {
      "id": "project_abc",
      "name": "Codex Hackathon Project",
      "status": "idle"
    },
    "proposals": [],
    "plans": [],
    "approvals": [],
    "executionContracts": [],
    "codingResults": [],
    "reviews": [],
    "events": []
  },
  "nextActions": []
}
```

## Read Project State

```http
GET /api/projects/:projectId
```

Use this response to render the dashboard.

Important fields:

- `snapshot.project.status`: current workflow state.
- `snapshot.project.currentPlanId`: selected current plan.
- `snapshot.project.approvedPlanId`: plan approved for Coding.
- `snapshot.proposals`: proposal history.
- `snapshot.plans`: plan-version history.
- `snapshot.approvals`: leader decisions.
- `snapshot.executionContracts`: generated coding contracts.
- `snapshot.codingResults`: Coding/Runloop results.
- `snapshot.reviews`: Review Agent results.
- `snapshot.events`: complete timeline.
- `nextActions`: pending actions for leader, planning, coding, review, or master.

## Render Next Actions

```http
GET /api/projects/:projectId/next-actions
```

Action kinds the UI should understand:

- `invoke_planning`: show Planning is needed or in progress.
- `await_leader_decision`: show Approve, Request Changes, Hold, and Exit controls.
- `invoke_coding`: show Coding/Runloop is ready and expose the execution contract.
- `invoke_review`: show Review is ready.
- `await_resume`: show Resume control.
- `complete`: show completed state.
- `close`: show closed/exited state.

## Leader Buttons

Approve current plan:

```json
{
  "type": "leader.approved",
  "projectId": "project_abc",
  "actor": { "name": "Leader", "role": "leader" },
  "payload": {
    "leader": "Leader",
    "notes": "Approved for implementation."
  }
}
```

Request updated plan:

```json
{
  "type": "leader.requested_changes",
  "projectId": "project_abc",
  "actor": { "name": "Leader", "role": "leader" },
  "payload": {
    "leader": "Leader",
    "feedback": "Keep this frontend-only and include persistence."
  }
}
```

Hold workflow:

```json
{
  "type": "leader.held",
  "projectId": "project_abc",
  "actor": { "name": "Leader", "role": "leader" },
  "payload": {
    "leader": "Leader",
    "reason": "Waiting for stakeholder confirmation."
  }
}
```

Exit workflow:

```json
{
  "type": "leader.exited",
  "projectId": "project_abc",
  "actor": { "name": "Leader", "role": "leader" },
  "payload": {
    "leader": "Leader",
    "reason": "Out of hackathon scope."
  }
}
```

Resume held workflow:

```json
{
  "type": "workflow.resumed",
  "projectId": "project_abc",
  "actor": { "name": "Leader", "role": "leader" },
  "payload": {
    "note": "Ready to continue."
  }
}
```

Send these payloads to:

```http
POST /api/events
Content-Type: application/json
```

## Status To UI Mapping

| State | Suggested UI |
|---|---|
| `idle` | Empty project, waiting for proposal. |
| `awaiting_plan` | Planning Agent working or waiting for plan. |
| `awaiting_leader_decision` | Show leader decision panel. |
| `on_hold` | Show held state and Resume action. |
| `awaiting_coding` | Show Coding/Runloop execution pending. |
| `awaiting_review` | Show Review Agent validation pending. |
| `completed` | Show successful final state. |
| `exited` | Show closed state and exit reason. |

## Error Handling

All API errors use this shape:

```json
{
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Cannot apply coding.completed while project is idle.",
    "details": {}
  }
}
```

Frontend should show `error.message` to the user or timeline/debug panel.

Common codes:

- `NOT_FOUND`: project id does not exist.
- `VALIDATION_ERROR`: request body is missing required fields.
- `INVALID_TRANSITION`: event is valid but not allowed in the current workflow state.
- `INTEGRATION_PAYLOAD_ERROR`: Person 3 bridge payload is malformed.

## Integrated Flow Notes

Use `docs/API_EXAMPLES.md` for a complete PowerShell walkthrough. Use `npm.cmd run demo` for the integrated local flow covering Person 3, Person 1, and Person 5 logic.