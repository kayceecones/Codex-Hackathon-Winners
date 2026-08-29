import { requireFields } from "./contracts.ts";
import { assemblePlanningContext } from "./contextAssembler.ts";
import type { FeatureProposal, PlanVersion, ProjectContext } from "./types.ts";

interface CreatePlanVersionInput {
  projectContext: ProjectContext;
  proposal: FeatureProposal;
  leaderFeedback?: string | null;
}

export function createPlanVersion({
  projectContext,
  proposal,
  leaderFeedback = null,
}: CreatePlanVersionInput): PlanVersion {
  requireFields(proposal, ["id", "projectId", "title", "status"], "proposal");

  if (proposal.status !== "confirmed") {
    throw new Error("proposal must be confirmed before Planning Agent can create a plan");
  }

  const previousPlan = projectContext.currentPlan;
  const version = previousPlan.version + 1;
  const planningContext = assemblePlanningContext(projectContext, proposal, leaderFeedback);
  const scope = buildScope(proposal, leaderFeedback);
  const tasks = buildTasks(proposal, leaderFeedback);
  const acceptanceCriteria = buildAcceptanceCriteria(proposal, leaderFeedback);
  const nextPlan: PlanVersion = {
    id: `plan-v${version}`,
    projectId: proposal.projectId,
    proposalId: proposal.id,
    version,
    title: `Plan v${version}: ${proposal.title}`,
    summary: buildSummary(proposal, leaderFeedback),
    planningContext,
    scope,
    tasks,
    impactedOwners: [
      "Person 1: route proposal and plan events through Master Agent",
      "Person 2: persist proposal, plan version, feedback, and timeline events",
      "Person 3: generate proposal and revised plan versions",
      "Person 4: show proposal, plan diff, and leader actions in the dashboard",
    ],
    acceptanceCriteria,
    risks: buildRisks(proposal, leaderFeedback),
    diff: [],
    leaderFeedback,
    status: "awaiting_leader_decision",
    createdAt: new Date().toISOString(),
  };

  nextPlan.diff = makePlanDiff(previousPlan, nextPlan);
  return nextPlan;
}

export function makePlanDiff(previousPlan: PlanVersion, nextPlan: PlanVersion): string[] {
  return [
    `Version changed from v${previousPlan.version} to v${nextPlan.version}.`,
    `Summary changed from: ${previousPlan.summary}`,
    `Summary changed to: ${nextPlan.summary}`,
    ...listAdds("Scope", previousPlan.scope, nextPlan.scope),
    ...listAdds("Acceptance criteria", previousPlan.acceptanceCriteria, nextPlan.acceptanceCriteria),
  ];
}

function buildSummary(proposal: FeatureProposal, leaderFeedback: string | null): string {
  if (!leaderFeedback) {
    return `Add "${proposal.title}" to the project plan with clear scope, owner impact, and leader approval before execution.`;
  }

  return `Revise "${proposal.title}" based on leader feedback: ${leaderFeedback}`;
}

function buildScope(proposal: FeatureProposal, leaderFeedback: string | null): string[] {
  const scope = [
    ...proposal.suggestedScope,
    "Create a visible plan version that can be approved, held, exited, or sent back for revision.",
  ];

  if (mentionsFrontendOnly(leaderFeedback)) {
    scope.push("Limit implementation impact to frontend behavior and UI state.");
    scope.push("Do not require backend schema or API changes for this revision.");
  }

  if (mentionsPersistence(leaderFeedback)) {
    scope.push("Persist the member's selected preference using the existing client-side persistence approach.");
  }

  if (leaderFeedback) {
    scope.push(`Address leader feedback directly: ${leaderFeedback}`);
  }

  return scope;
}

function buildTasks(proposal: FeatureProposal, leaderFeedback: string | null): string[] {
  const tasks = [
    `Confirm the final user-facing behavior for "${proposal.title}".`,
    "Map proposal impact to frontend, memory, and Master Agent event contracts.",
    "Prepare an execution-ready task list for Coding after leader approval.",
  ];

  if (mentionsFrontendOnly(leaderFeedback)) {
    tasks.push("Mark backend work as out of scope for this plan version.");
  }

  if (mentionsPersistence(leaderFeedback)) {
    tasks.push("Add a persistence requirement to the acceptance criteria.");
  }

  return tasks;
}

function buildAcceptanceCriteria(proposal: FeatureProposal, leaderFeedback: string | null): string[] {
  const criteria = [...proposal.acceptanceCriteria];

  criteria.push("Leader can approve this exact plan version before Coding starts.");
  criteria.push("The approved plan can be converted into an execution contract.");

  if (mentionsFrontendOnly(leaderFeedback)) {
    criteria.push("No backend API or database migration is required for this plan version.");
  }

  if (mentionsPersistence(leaderFeedback)) {
    criteria.push("The selected user preference is restored after refresh.");
  }

  return criteria;
}

function buildRisks(proposal: FeatureProposal, leaderFeedback: string | null): string[] {
  const risks = [...proposal.risks];

  if (mentionsFrontendOnly(leaderFeedback)) {
    risks.push("Frontend-only scope may limit cross-device persistence.");
  }

  if (!leaderFeedback) {
    risks.push("Leader may request narrower scope after seeing Plan v2.");
  }

  return risks;
}

function listAdds(label: string, before: string[] = [], after: string[] = []): string[] {
  const added = after.filter((item) => !before.includes(item));

  if (added.length === 0) {
    return [`${label}: no new items.`];
  }

  return added.map((item) => `${label}: added ${item}`);
}

function mentionsFrontendOnly(feedback: string | null | undefined): boolean {
  if (!feedback) {
    return false;
  }

  const text = feedback.toLowerCase();
  return text.includes("frontend") && (text.includes("no backend") || text.includes("don't change the backend"));
}

function mentionsPersistence(feedback: string | null | undefined): boolean {
  return Boolean(feedback && feedback.toLowerCase().includes("persist"));
}
