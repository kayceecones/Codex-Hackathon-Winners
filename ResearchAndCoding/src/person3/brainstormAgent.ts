import { requireFields } from "./contracts.ts";
import type { FeatureProposal, IdeaInput, Member, ProjectContext } from "./types.ts";

interface DraftProposalInput {
  projectContext: ProjectContext;
  idea: IdeaInput;
  member: Member;
}

export function draftProposal({ projectContext, idea, member }: DraftProposalInput): FeatureProposal {
  requireFields(idea, ["projectId", "text"], "idea");
  requireFields(member, ["id", "name"], "member");

  const title = makeProposalTitle(idea.text);
  const currentPlan = projectContext.currentPlan;

  return {
    id: `proposal-${Date.now()}`,
    projectId: idea.projectId,
    createdBy: {
      id: member.id,
      name: member.name,
    },
    status: "draft",
    title,
    originalIdea: idea.text,
    problem: `The team needs a clear way to evaluate whether "${title}" belongs in the current project scope.`,
    userValue: [
      "Gives the leader a concrete proposal instead of a loose chat message.",
      "Shows likely product impact before planning work starts.",
      "Keeps the team aligned with the current project plan.",
    ],
    suggestedScope: buildSuggestedScope(title, currentPlan.summary),
    outOfScope: [
      "Starting coding work before leader approval.",
      "Changing unrelated parts of the project plan.",
      "Replacing the shared memory or Master Agent contracts.",
    ],
    risks: [
      "Scope could grow if the feature is not tied to acceptance criteria.",
      "The proposal may affect frontend, memory, and event contracts at the same time.",
    ],
    alternatives: [
      "Hold the idea for a later milestone.",
      "Demo the feature with mocked data first.",
      "Limit the feature to one workflow path before expanding it.",
    ],
    acceptanceCriteria: [
      `A leader can understand what "${title}" changes in under one minute.`,
      "The proposal can be converted into a versioned plan.",
      "The workflow does not trigger Coding until the plan is approved.",
    ],
    createdAt: new Date().toISOString(),
  };
}

export function confirmProposal(proposal: FeatureProposal, confirmedBy: Member): FeatureProposal {
  requireFields(proposal, ["id", "projectId", "title"], "proposal");
  requireFields(confirmedBy, ["id", "name"], "confirmedBy");

  return {
    ...proposal,
    status: "confirmed",
    confirmedBy,
    confirmedAt: new Date().toISOString(),
  };
}

function makeProposalTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  const withoutPrefix = cleaned.replace(/^(add|build|create|make|implement)\s+/i, "");
  return toTitleCase(withoutPrefix).slice(0, 80);
}

function buildSuggestedScope(title: string, currentPlanSummary: string): string[] {
  return [
    `Add "${title}" to the active plan as a scoped feature proposal.`,
    "Describe user-visible behavior and approval requirements.",
    "List impacted owners so frontend, memory, and orchestration can coordinate.",
    `Preserve current plan direction: ${currentPlanSummary}`,
  ];
}

function toTitleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
