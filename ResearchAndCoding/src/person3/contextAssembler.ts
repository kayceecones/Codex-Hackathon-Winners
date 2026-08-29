import type { FeatureProposal, PlanningContext, ProjectContext } from "./types.ts";

export function assemblePlanningContext(
  projectContext: ProjectContext,
  proposal: FeatureProposal,
  leaderFeedback: string | null = null
): PlanningContext {
  return {
    projectName: projectContext.project.name,
    projectSummary: projectContext.project.summary,
    projectGoals: projectContext.project.goals,
    constraints: projectContext.project.constraints,
    currentPlanSummary: projectContext.currentPlan.summary,
    currentPlanVersion: projectContext.currentPlan.version,
    proposalTitle: proposal.title,
    proposalValue: proposal.userValue,
    recentEvents: projectContext.recentEvents.map((event) => ({
      type: event.type,
      createdAt: event.createdAt,
    })),
    leaderFeedback,
  };
}
