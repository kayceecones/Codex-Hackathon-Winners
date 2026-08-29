import type {
  Actor,
  CodingResultInput,
  PlanVersionInput,
  ProposalInput,
  ReviewResultInput
} from "./workflow.js";

export const workflowEventTypes = [
  "proposal.accepted",
  "planning.completed",
  "leader.approved",
  "leader.requested_changes",
  "leader.held",
  "leader.exited",
  "workflow.resumed",
  "coding.completed",
  "review.completed"
] as const;

export type WorkflowEventType = (typeof workflowEventTypes)[number];

export interface WorkflowEvent<TType extends WorkflowEventType = WorkflowEventType, TPayload = unknown> {
  id?: string;
  type: TType;
  projectId: string;
  actor?: Actor;
  occurredAt?: string;
  payload: TPayload;
}

export type ProposalAcceptedEvent = WorkflowEvent<
  "proposal.accepted",
  { proposal: ProposalInput }
>;

export type PlanningCompletedEvent = WorkflowEvent<
  "planning.completed",
  { plan: PlanVersionInput }
>;

export type LeaderApprovedEvent = WorkflowEvent<
  "leader.approved",
  { planId?: string; leader: string; notes?: string }
>;

export type LeaderRequestedChangesEvent = WorkflowEvent<
  "leader.requested_changes",
  { planId?: string; leader: string; feedback: string }
>;

export type LeaderHeldEvent = WorkflowEvent<
  "leader.held",
  { leader: string; reason: string }
>;

export type LeaderExitedEvent = WorkflowEvent<
  "leader.exited",
  { leader: string; reason: string }
>;

export type WorkflowResumedEvent = WorkflowEvent<
  "workflow.resumed",
  { note?: string }
>;

export type CodingCompletedEvent = WorkflowEvent<
  "coding.completed",
  { execution: CodingResultInput }
>;

export type ReviewCompletedEvent = WorkflowEvent<
  "review.completed",
  { review: ReviewResultInput }
>;

export type IncomingWorkflowEvent =
  | ProposalAcceptedEvent
  | PlanningCompletedEvent
  | LeaderApprovedEvent
  | LeaderRequestedChangesEvent
  | LeaderHeldEvent
  | LeaderExitedEvent
  | WorkflowResumedEvent
  | CodingCompletedEvent
  | ReviewCompletedEvent;

export function isWorkflowEventType(value: string): value is WorkflowEventType {
  return workflowEventTypes.includes(value as WorkflowEventType);
}
