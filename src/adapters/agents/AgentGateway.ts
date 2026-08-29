import type { ActionStatus, NextAction } from "../../contracts/agents.js";
import type { IncomingWorkflowEvent } from "../../contracts/events.js";

export interface AgentGateway {
  dispatch(action: NextAction): Promise<NextAction>;
  dispatchMany(actions: NextAction[]): Promise<NextAction[]>;
  resolveForEvent(event: IncomingWorkflowEvent): Promise<void>;
  listProjectActions(projectId: string, status?: ActionStatus): Promise<NextAction[]>;
}
