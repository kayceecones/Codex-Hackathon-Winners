# Memory Adapter Handoff

This document is for Person 2. Person 1 currently uses `InMemoryStore` only so the integrated project flow can run before the real database and Notion layer is connected.

## Integration Boundary

Person 2 should implement this interface:

```ts
import type { WorkflowTransition } from "../src/master/stateMachine.js";
import type { CreateProjectInput, ProjectSnapshot, WorkflowEventRecord } from "../src/contracts/workflow.js";

export interface Store {
  createProject(input: CreateProjectInput): Promise<ProjectSnapshot>;
  getSnapshot(projectId: string): Promise<ProjectSnapshot | undefined>;
  commitTransition(transition: WorkflowTransition): Promise<ProjectSnapshot>;
  listEvents(projectId: string): Promise<WorkflowEventRecord[]>;
}
```

Source file:

```text
src/adapters/store/Store.ts
```

Demo implementation:

```text
src/adapters/store/InMemoryStore.ts
```

## Source Of Truth Rule

- Database is the operational source of truth.
- Notion is the human-readable project memory/history.
- Notion should be updated from committed workflow transitions or event records.
- Master state transitions should not depend on Notion writes succeeding in real time.

## Data Person 2 Must Persist

Persist the full `ProjectSnapshot` shape:

- `project`
- `proposals`
- `plans`
- `approvals`
- `executionContracts`
- `codingResults`
- `reviews`
- `events`

The safest implementation pattern is to persist everything created in `commitTransition(transition)` inside one database transaction.

## Commit Transition Behavior

`commitTransition` receives a `WorkflowTransition` containing:

- Updated `project` state.
- One `eventRecord` timeline item.
- Optional created records such as proposal, plan, approval, execution contract, coding result, or review result.

Person 2 should:

1. Update the project row/document.
2. Insert the workflow event record.
3. Insert any records from `transition.created`.
4. Return a fresh `ProjectSnapshot`.
5. Trigger or enqueue Notion sync from the inserted event.

## Notion Sync Recommendation

Create a readable timeline entry for each `WorkflowEventRecord`:

```text
[time] event.type
fromState -> toState
message
actor.name / actor.role
```

Include links or references to plan versions, approvals, execution contracts, and review issues when available.

## Compatibility Notes

- Person 3 plan versions are normalized into Master `PlanVersion` records.
- Person 5 receives `ExecutionContract` and `codingReviewContract` from the same Master action.
- Person 4 should read state from `GET /api/projects/:projectId`, not directly from the database.
- Keep generated database ids stable and unique; the in-memory `createId` format does not need to be preserved.