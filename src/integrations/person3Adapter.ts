import type { IncomingWorkflowEvent } from "../contracts/events.js";
import type { PlanStepInput, ProjectSnapshot, ProposalInput } from "../contracts/workflow.js";

interface Person3EventEnvelope {
  type: string;
  payload?: Record<string, unknown>;
}

interface Person3Member {
  id?: string;
  name?: string;
}

interface Person3FeatureProposal {
  id?: string;
  projectId?: string;
  createdBy?: Person3Member;
  confirmedBy?: Person3Member;
  status?: string;
  title?: string;
  originalIdea?: string;
  problem?: string;
  userValue?: string[];
  suggestedScope?: string[];
  risks?: string[];
  acceptanceCriteria?: string[];
}

interface Person3PlanVersion {
  id?: string;
  projectId?: string;
  proposalId?: string | null;
  version?: number;
  title?: string;
  summary?: string;
  scope?: string[];
  acceptanceCriteria?: string[];
  risks?: string[];
  leaderFeedback?: string | null;
  tasks?: string[];
  impactedOwners?: string[];
}

export interface Person3AdapterResult {
  projectId: string;
  message: string;
  events: IncomingWorkflowEvent[];
}

export function mapPerson3EventToMasterEvents(
  snapshot: ProjectSnapshot,
  envelope: Person3EventEnvelope
): Person3AdapterResult {
  const payload = envelope.payload ?? {};
  const proposal = payload.proposal as Person3FeatureProposal | undefined;
  const planVersion = payload.planVersion as Person3PlanVersion | undefined;
  const projectId = inferProjectId(payload, proposal, planVersion);

  if (projectId !== snapshot.project.id) {
    throw new Error(`Person 3 event projectId ${projectId} does not match Master project ${snapshot.project.id}.`);
  }

  if (envelope.type === "person3.proposal_ready") {
    if (proposal?.status !== "confirmed") {
      return {
        projectId,
        message: "Draft proposal received from Person 3. Master waits until the member confirms it.",
        events: []
      };
    }

    return {
      projectId,
      message: "Confirmed Person 3 proposal mapped to proposal.accepted.",
      events: [buildProposalAccepted(projectId, proposal)]
    };
  }

  if (envelope.type === "person3.plan_version_ready") {
    if (!planVersion) {
      throw new Error("person3.plan_version_ready requires payload.planVersion.");
    }

    const events: IncomingWorkflowEvent[] = [];
    if (snapshot.project.status === "idle") {
      events.push(buildProposalAccepted(projectId, proposal ?? proposalFromPlan(planVersion)));
    }
    events.push(buildPlanningCompleted(projectId, planVersion));

    return {
      projectId,
      message: "Person 3 plan version mapped to Master planning flow.",
      events
    };
  }

  throw new Error(`Unsupported Person 3 output event type: ${envelope.type}`);
}

function inferProjectId(
  payload: Record<string, unknown>,
  proposal?: Person3FeatureProposal,
  planVersion?: Person3PlanVersion
): string {
  const value = payload.projectId ?? proposal?.projectId ?? planVersion?.projectId;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Person 3 event must include projectId in payload, proposal, or planVersion.");
  }
  return value.trim();
}

function buildProposalAccepted(projectId: string, proposal: Person3FeatureProposal): IncomingWorkflowEvent {
  return {
    type: "proposal.accepted",
    projectId,
    actor: { name: proposal.confirmedBy?.name ?? proposal.createdBy?.name ?? "Person 3", role: "planning" },
    payload: { proposal: toMasterProposal(proposal) }
  };
}

function buildPlanningCompleted(projectId: string, planVersion: Person3PlanVersion): IncomingWorkflowEvent {
  return {
    type: "planning.completed",
    projectId,
    actor: { name: "Planning Agent", role: "planning" },
    payload: {
      plan: {
        title: requireText(planVersion.title, "planVersion.title"),
        version: typeof planVersion.version === "number" ? planVersion.version : undefined,
        summary: requireText(planVersion.summary, "planVersion.summary"),
        steps: toMasterSteps(planVersion),
        acceptanceCriteria: stringArray(planVersion.acceptanceCriteria),
        risks: stringArray(planVersion.risks),
        feedbackAddressed: planVersion.leaderFeedback ?? undefined
      }
    }
  };
}

function toMasterProposal(proposal: Person3FeatureProposal): ProposalInput {
  const value = stringArray(proposal.userValue);
  return {
    title: requireText(proposal.title, "proposal.title"),
    summary: value.length > 0 ? value.join(" ") : requireText(proposal.problem ?? proposal.originalIdea, "proposal.summary"),
    proposer: proposal.confirmedBy?.name ?? proposal.createdBy?.name ?? "Person 3",
    rationale: proposal.problem,
    acceptanceCriteria: stringArray(proposal.acceptanceCriteria),
    risks: stringArray(proposal.risks)
  };
}

function proposalFromPlan(planVersion: Person3PlanVersion): Person3FeatureProposal {
  return {
    projectId: planVersion.projectId,
    status: "confirmed",
    title: stripPlanPrefix(requireText(planVersion.title, "planVersion.title")),
    problem: planVersion.summary,
    acceptanceCriteria: planVersion.acceptanceCriteria,
    risks: planVersion.risks
  };
}

function toMasterSteps(planVersion: Person3PlanVersion): PlanStepInput[] {
  const tasks = stringArray(planVersion.tasks);
  const scope = stringArray(planVersion.scope);
  const source = tasks.length > 0 ? tasks : scope;
  const impactedOwners = stringArray(planVersion.impactedOwners);

  if (source.length === 0) {
    return [{ title: "Implement plan", description: requireText(planVersion.summary, "planVersion.summary") }];
  }

  return source.map((item, index) => ({
    title: item.length > 80 ? `${item.slice(0, 77)}...` : item,
    description: item,
    owner: impactedOwners[index]
  }));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function stripPlanPrefix(title: string): string {
  return title.replace(/^Plan\s+v\d+:\s*/i, "");
}