# Reason Frontend — Build Plan

## Current milestone

**V1 — Shared Project Workspace** is implemented on `UX/Frontend`.

The live Render preview is configured from this branch and will auto-deploy on new commits.

## Build sequence

### V1 — Shared Workspace — DONE
- App shell and navigation
- Project header
- Team presence
- Planning Queue
- Live Activity feed
- Agent status
- Workflow state
- Current Plan card
- Propose Change interaction with local state

### V2 — Plan Review + Human Approval — NEXT
Build the first human-in-the-loop state.

UI:
- Plan Review workspace
- Plan version badge
- Plan summary
- Proposed tasks
- Requests incorporated into the plan
- Approval history
- **Approve Plan** primary action
- **Send Back** secondary action
- Clear loading/success/error states

Architecture:
- Components render state; they do not own workflow transitions.
- Use a typed workflow state such as `PLAN_APPROVAL`.
- Keep approval actions behind an API adapter so local mock behavior can later map to `POST /approve-plan`.

### V3 — Execution Review
After a plan is approved:
- Show approved plan
- Show implementation tasks
- Show affected areas/files
- Show validation requirements
- **Approve & Execute** action
- Send-back path
- Map future action to `POST /approve-execution`

### V4 — Coding Progress
During execution:
- Execution timeline
- Per-task progress
- Agent activity
- Terminal/log-style output
- Test progress
- Success/failure states
- Map execution trigger to `POST /execute`

### V5 — Results + Decision History
After execution:
- Completion summary
- Files/areas changed
- Test results
- Updated dashboard preview
- Decision history
- Plan/version association
- Human approver and timestamp

### V6 — Backend Integration + Polish
Replace mock data with the shared API contract:

- `GET /project`
- `GET /state`
- `GET /events`
- `POST /requests`
- `POST /approve-plan`
- `POST /approve-execution`
- `POST /execute`

Keep API access centralized in `src/services/api.ts` so components remain independent of transport details.

## Demo-critical flow

```text
Team request
    ↓
Planning Queue
    ↓
AI synthesis + research
    ↓
Plan v5
    ↓
Human approves plan
    ↓
Execution review
    ↓
Human approves execution
    ↓
Coding Agent
    ↓
Tests
    ↓
Completed result
    ↓
Decision history
```

## Priority if time is limited

1. Plan Review
2. Approve Plan interaction
3. Execution Review
4. Coding Progress
5. Results screen
6. Decision history
7. Backend integration
8. Animation and secondary polish

## Integration rule

Do not put orchestration logic in the frontend. The frontend visualizes the current state and emits user actions. Person 1's orchestration/backend layer remains responsible for state transitions and agent coordination.
