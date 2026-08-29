import type { FeatureProposal, MemoryStore, PlanVersion, Project, ProjectContext } from "./types.ts";
import type { Person3EventEnvelope } from "./contracts.ts";

interface DemoMemorySeed {
  project?: Project;
  proposals?: FeatureProposal[];
  planVersions?: PlanVersion[];
  events?: Person3EventEnvelope[];
}

export class DemoMemoryStore implements MemoryStore {
  private project: Project;
  private proposals: FeatureProposal[];
  private planVersions: PlanVersion[];
  private events: Person3EventEnvelope[];

  constructor(seed: DemoMemorySeed = {}) {
    this.project = seed.project || createDefaultProject();
    this.proposals = seed.proposals || [];
    this.planVersions = seed.planVersions || [createDefaultPlan()];
    this.events = seed.events || [];
  }

  async getProjectContext(projectId: string): Promise<ProjectContext> {
    return {
      project: this.project.id === projectId ? this.project : createDefaultProject(projectId),
      currentPlan: this.getLatestPlanVersion(),
      planHistory: [...this.planVersions],
      recentEvents: this.events.slice(-10),
    };
  }

  async saveProposal(proposal: FeatureProposal): Promise<FeatureProposal> {
    const existingIndex = this.proposals.findIndex((item) => item.id === proposal.id);

    if (existingIndex >= 0) {
      this.proposals[existingIndex] = proposal;
      return proposal;
    }

    this.proposals.push(proposal);
    return proposal;
  }

  async getProposal(proposalId: string): Promise<FeatureProposal | undefined> {
    return this.proposals.find((proposal) => proposal.id === proposalId);
  }

  async savePlanVersion(planVersion: PlanVersion): Promise<PlanVersion> {
    this.planVersions.push(planVersion);
    return planVersion;
  }

  async recordEvent(event: Person3EventEnvelope): Promise<Person3EventEnvelope> {
    this.events.push(event);
    return event;
  }

  getLatestPlanVersion(): PlanVersion {
    return this.planVersions[this.planVersions.length - 1];
  }
}

export function createDefaultProject(projectId = "project-demo"): Project {
  return {
    id: projectId,
    name: "Multiplayer AI Project OS",
    summary:
      "A shared workspace where teammates and specialized agents move ideas through planning, approval, execution, and review.",
    goals: [
      "Make agent work visible to the whole team",
      "Preserve shared reasoning and decisions",
      "Require leader approval before execution starts",
    ],
    constraints: [
      "Hackathon demo scope",
      "Simple integration contracts",
      "Database is operational source of truth",
      "Notion is human-readable project memory",
    ],
  };
}

export function createDefaultPlan(): PlanVersion {
  return {
    id: "plan-v1",
    projectId: "project-demo",
    proposalId: null,
    version: 1,
    title: "Initial Build Plan",
    summary: "Build the base multi-agent workflow with shared memory and approval gates.",
    scope: [
      "Master Agent event routing",
      "Shared memory records",
      "Brainstorm and planning workflow",
      "Execution and review handoff",
    ],
    acceptanceCriteria: [
      "The demo shows one idea moving through proposal, planning, approval, execution, and review.",
      "Important transitions are persisted as events.",
    ],
    risks: ["Integration work can drift if event contracts are unclear."],
    diff: ["Initial version."],
    leaderFeedback: null,
    createdAt: new Date().toISOString(),
  };
}
