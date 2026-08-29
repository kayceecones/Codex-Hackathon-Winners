export const workflowStates = [
  "idle",
  "awaiting_plan",
  "awaiting_leader_decision",
  "on_hold",
  "awaiting_coding",
  "awaiting_review",
  "completed",
  "exited"
] as const;

export type WorkflowState = (typeof workflowStates)[number];

export const leaderDecisions = [
  "approve",
  "request_updated_plan",
  "hold",
  "exit"
] as const;

export type LeaderDecision = (typeof leaderDecisions)[number];

export const reviewClassifications = [
  "pass",
  "coding_issue",
  "plan_issue"
] as const;

export type ReviewClassification = (typeof reviewClassifications)[number];

export const codingStatuses = ["completed", "failed"] as const;

export type CodingStatus = (typeof codingStatuses)[number];

export interface Actor {
  id?: string;
  name: string;
  role?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: WorkflowState;
  leader?: string;
  currentProposalId?: string;
  currentPlanId?: string;
  approvedPlanId?: string;
  currentExecutionContractId?: string;
  currentExecutionId?: string;
  currentReviewId?: string;
  previousStateBeforeHold?: WorkflowState;
  exitReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  leader?: string;
}

export interface ProposalInput {
  title: string;
  summary: string;
  proposer: string;
  rationale?: string;
  acceptanceCriteria?: string[];
  risks?: string[];
}

export interface Proposal {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  proposer: string;
  rationale?: string;
  acceptanceCriteria: string[];
  risks: string[];
  createdAt: string;
}

export interface PlanStepInput {
  title: string;
  description: string;
  owner?: string;
  dependencies?: string[];
}

export interface PlanStep extends PlanStepInput {
  id: string;
  status: "pending" | "in_progress" | "completed";
}

export interface PlanVersionInput {
  proposalId?: string;
  version?: number;
  title: string;
  summary: string;
  steps: PlanStepInput[];
  acceptanceCriteria?: string[];
  risks?: string[];
  feedbackAddressed?: string;
}

export interface PlanVersion {
  id: string;
  projectId: string;
  proposalId: string;
  version: number;
  title: string;
  summary: string;
  steps: PlanStep[];
  acceptanceCriteria: string[];
  risks: string[];
  feedbackAddressed?: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  projectId: string;
  planId?: string;
  decision: LeaderDecision;
  leader: string;
  feedback?: string;
  reason?: string;
  createdAt: string;
}

export interface ExecutionContract {
  id: string;
  projectId: string;
  planId: string;
  planVersion: number;
  proposalId: string;
  objective: string;
  summary: string;
  steps: PlanStep[];
  acceptanceCriteria: string[];
  constraints: string[];
  reason: "leader_approved" | "review_coding_issue" | "resume_from_hold";
  createdAt: string;
}

export interface CodingResultInput {
  planId?: string;
  executionContractId?: string;
  status?: CodingStatus;
  summary: string;
  filesChanged?: string[];
  commandsRun?: string[];
  output?: string;
}

export interface CodingResult {
  id: string;
  projectId: string;
  planId: string;
  executionContractId?: string;
  status: CodingStatus;
  summary: string;
  filesChanged: string[];
  commandsRun: string[];
  output?: string;
  createdAt: string;
}

export interface ReviewIssue {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
}

export interface ReviewResultInput {
  planId?: string;
  executionId?: string;
  classification: ReviewClassification;
  summary: string;
  issues?: ReviewIssue[];
}

export interface ReviewResult {
  id: string;
  projectId: string;
  planId: string;
  executionId?: string;
  classification: ReviewClassification;
  summary: string;
  issues: ReviewIssue[];
  createdAt: string;
}

export interface WorkflowEventRecord {
  id: string;
  projectId: string;
  type: string;
  actor?: Actor;
  occurredAt: string;
  fromState: WorkflowState;
  toState: WorkflowState;
  message: string;
  payload: unknown;
}

export interface ProjectSnapshot {
  project: Project;
  proposals: Proposal[];
  plans: PlanVersion[];
  approvals: Approval[];
  executionContracts: ExecutionContract[];
  codingResults: CodingResult[];
  reviews: ReviewResult[];
  events: WorkflowEventRecord[];
}
