import type { WorkflowTransition } from "../../master/stateMachine.js";
import type { CreateProjectInput, ProjectSnapshot, WorkflowEventRecord } from "../../contracts/workflow.js";

export interface Store {
  createProject(input: CreateProjectInput): Promise<ProjectSnapshot>;
  getSnapshot(projectId: string): Promise<ProjectSnapshot | undefined>;
  commitTransition(transition: WorkflowTransition): Promise<ProjectSnapshot>;
  listEvents(projectId: string): Promise<WorkflowEventRecord[]>;
}
