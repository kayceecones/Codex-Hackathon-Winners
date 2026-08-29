import type { ActionStatus, NextAction, NextActionKind } from "../../contracts/agents.js";
import type { IncomingWorkflowEvent, WorkflowEventType } from "../../contracts/events.js";
import { nowIso } from "../../utils/time.js";
import type { AgentGateway } from "./AgentGateway.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const completionMap: Record<WorkflowEventType, NextActionKind[]> = {
  "proposal.accepted": [],
  "planning.completed": ["invoke_planning"],
  "leader.approved": ["await_leader_decision"],
  "leader.requested_changes": ["await_leader_decision"],
  "leader.held": ["await_leader_decision", "invoke_planning", "invoke_coding", "invoke_review"],
  "leader.exited": ["await_leader_decision", "await_resume", "invoke_planning", "invoke_coding", "invoke_review"],
  "workflow.resumed": ["await_resume"],
  "coding.completed": ["invoke_coding"],
  "review.completed": ["invoke_review"]
};

export class DemoAgentGateway implements AgentGateway {
  private readonly actions: NextAction[] = [];

  async dispatch(action: NextAction): Promise<NextAction> {
    const stored = clone(action);
    if (stored.target === "master") {
      stored.status = "completed";
      stored.updatedAt = nowIso();
    }
    this.actions.push(stored);
    return clone(stored);
  }

  async dispatchMany(actions: NextAction[]): Promise<NextAction[]> {
    const dispatched: NextAction[] = [];
    for (const action of actions) {
      dispatched.push(await this.dispatch(action));
    }
    return dispatched;
  }

  async resolveForEvent(event: IncomingWorkflowEvent): Promise<void> {
    const kindsToComplete = completionMap[event.type];
    if (kindsToComplete.length === 0) return;

    const timestamp = nowIso();
    for (const action of this.actions) {
      if (
        action.projectId === event.projectId &&
        action.status === "pending" &&
        kindsToComplete.includes(action.kind)
      ) {
        action.status = "completed";
        action.updatedAt = timestamp;
      }
    }
  }

  async listProjectActions(projectId: string, status?: ActionStatus): Promise<NextAction[]> {
    return this.actions
      .filter((action) => action.projectId === projectId)
      .filter((action) => (status ? action.status === status : true))
      .map((action) => clone(action));
  }
}
