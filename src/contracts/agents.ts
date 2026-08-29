import type { ExecutionContract, PlanVersion, Proposal, ReviewIssue } from "./workflow.js";

export const nextActionKinds = [
  "invoke_planning",
  "await_leader_decision",
  "invoke_coding",
  "invoke_review",
  "await_resume",
  "complete",
  "close"
] as const;

export type NextActionKind = (typeof nextActionKinds)[number];

export const agentTargets = ["planning", "coding", "review", "leader", "master"] as const;

export type AgentTarget = (typeof agentTargets)[number];

export const actionStatuses = ["pending", "completed", "failed"] as const;

export type ActionStatus = (typeof actionStatuses)[number];

export interface CodingReviewExecutionContract {
  execution_contract_id: string;
  project_id: string;
  plan_version: number;
  tasks: string[];
  files_or_areas: string[];
  constraints: string[];
  acceptance_criteria: string[];
  context: Record<string, unknown>;
  verify_script?: "dark-mode" | "mobile-responsive";
}

export interface NextActionBase<TKind extends NextActionKind, TPayload> {
  id: string;
  kind: TKind;
  target: AgentTarget;
  projectId: string;
  sourceEventId: string;
  status: ActionStatus;
  createdAt: string;
  updatedAt: string;
  payload: TPayload;
}

export type InvokePlanningAction = NextActionBase<
  "invoke_planning",
  {
    reason: "proposal_accepted" | "leader_feedback" | "review_plan_issue" | "resume_from_hold";
    proposalId: string;
    previousPlanId?: string;
    feedback?: string;
    reviewIssues?: ReviewIssue[];
  }
>;

export type AwaitLeaderDecisionAction = NextActionBase<
  "await_leader_decision",
  {
    planId: string;
    planVersion: number;
    decisionOptions: ["approve", "request_updated_plan", "hold", "exit"];
  }
>;

export type InvokeCodingAction = NextActionBase<
  "invoke_coding",
  { executionContract: ExecutionContract; codingReviewContract: CodingReviewExecutionContract }
>;

export type InvokeReviewAction = NextActionBase<
  "invoke_review",
  {
    planId: string;
    executionId: string;
    acceptanceCriteria: string[];
  }
>;

export type AwaitResumeAction = NextActionBase<
  "await_resume",
  { heldState: string; reason: string }
>;

export type CompleteAction = NextActionBase<
  "complete",
  { reviewId: string; message: string }
>;

export type CloseAction = NextActionBase<
  "close",
  { reason: string; message: string }
>;

export type NextAction =
  | InvokePlanningAction
  | AwaitLeaderDecisionAction
  | InvokeCodingAction
  | InvokeReviewAction
  | AwaitResumeAction
  | CompleteAction
  | CloseAction;

export interface PlanningDispatchContext {
  proposal: Proposal;
  previousPlan?: PlanVersion;
  feedback?: string;
}
