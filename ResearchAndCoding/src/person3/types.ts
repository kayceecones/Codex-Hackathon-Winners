import type { Person3EventEnvelope } from "./contracts.ts";

export interface Member {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  summary: string;
  goals: string[];
  constraints: string[];
}

export interface IdeaInput {
  projectId: string;
  text: string;
}

export interface FeatureProposal {
  id: string;
  projectId: string;
  createdBy: Member;
  status: "draft" | "confirmed";
  title: string;
  originalIdea: string;
  problem: string;
  userValue: string[];
  suggestedScope: string[];
  outOfScope: string[];
  risks: string[];
  alternatives: string[];
  acceptanceCriteria: string[];
  createdAt: string;
  confirmedBy?: Member;
  confirmedAt?: string;
}

export interface PlanningContext {
  projectName: string;
  projectSummary: string;
  projectGoals: string[];
  constraints: string[];
  currentPlanSummary: string;
  currentPlanVersion: number;
  proposalTitle: string;
  proposalValue: string[];
  recentEvents: Array<{
    type: string;
    createdAt: string;
  }>;
  leaderFeedback: string | null;
}

export interface PlanVersion {
  id: string;
  projectId: string;
  proposalId: string | null;
  version: number;
  title: string;
  summary: string;
  scope: string[];
  acceptanceCriteria: string[];
  risks: string[];
  diff: string[];
  leaderFeedback: string | null;
  createdAt: string;
  planningContext?: PlanningContext;
  tasks?: string[];
  impactedOwners?: string[];
  status?: "awaiting_leader_decision";
}

export interface ProjectContext {
  project: Project;
  currentPlan: PlanVersion;
  planHistory: PlanVersion[];
  recentEvents: Person3EventEnvelope[];
}

export interface MemoryStore {
  getProjectContext(projectId: string): Promise<ProjectContext>;
  saveProposal(proposal: FeatureProposal): Promise<FeatureProposal>;
  getProposal(proposalId: string): Promise<FeatureProposal | undefined>;
  savePlanVersion(planVersion: PlanVersion): Promise<PlanVersion>;
  recordEvent(event: Person3EventEnvelope): Promise<Person3EventEnvelope>;
}

export interface Person3Services {
  memory: MemoryStore;
}

export interface Person3WorkflowResult {
  proposal?: FeatureProposal;
  planVersion?: PlanVersion;
  emittedEvent: Person3EventEnvelope;
}

export interface IdeaSubmittedPayload {
  projectId: string;
  ideaText: string;
  member: Member;
}

export interface ProposalConfirmedPayload {
  projectId: string;
  proposalId: string;
  member: Member;
}

export interface LeaderFeedbackPayload {
  projectId: string;
  proposalId: string;
  feedback: string;
}
