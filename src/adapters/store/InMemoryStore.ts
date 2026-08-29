import type { Store } from "./Store.js";
import type { WorkflowTransition } from "../../master/stateMachine.js";
import type {
  Approval,
  CodingResult,
  CreateProjectInput,
  ExecutionContract,
  PlanVersion,
  Project,
  ProjectSnapshot,
  Proposal,
  ReviewResult,
  WorkflowEventRecord
} from "../../contracts/workflow.js";
import { createId } from "../../utils/ids.js";
import { nowIso } from "../../utils/time.js";

interface ProjectBucket {
  project: Project;
  proposals: Proposal[];
  plans: PlanVersion[];
  approvals: Approval[];
  executionContracts: ExecutionContract[];
  codingResults: CodingResult[];
  reviews: ReviewResult[];
  events: WorkflowEventRecord[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryStore implements Store {
  private readonly buckets = new Map<string, ProjectBucket>();

  constructor(
    private readonly idFactory: (prefix: string) => string = createId,
    private readonly clock: () => string = nowIso
  ) {}

  async createProject(input: CreateProjectInput): Promise<ProjectSnapshot> {
    const timestamp = this.clock();
    const project: Project = {
      id: this.idFactory("project"),
      name: input.name.trim(),
      description: input.description?.trim(),
      leader: input.leader?.trim(),
      status: "idle",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.buckets.set(project.id, {
      project,
      proposals: [],
      plans: [],
      approvals: [],
      executionContracts: [],
      codingResults: [],
      reviews: [],
      events: []
    });

    return this.snapshot(project.id) as ProjectSnapshot;
  }

  async getSnapshot(projectId: string): Promise<ProjectSnapshot | undefined> {
    return this.snapshot(projectId);
  }

  async commitTransition(transition: WorkflowTransition): Promise<ProjectSnapshot> {
    const bucket = this.buckets.get(transition.project.id);
    if (!bucket) {
      throw new Error(`Cannot commit transition for missing project ${transition.project.id}.`);
    }

    bucket.project = clone(transition.project);
    if (transition.created.proposal) bucket.proposals.push(clone(transition.created.proposal));
    if (transition.created.plan) bucket.plans.push(clone(transition.created.plan));
    if (transition.created.approval) bucket.approvals.push(clone(transition.created.approval));
    if (transition.created.executionContract) bucket.executionContracts.push(clone(transition.created.executionContract));
    if (transition.created.codingResult) bucket.codingResults.push(clone(transition.created.codingResult));
    if (transition.created.review) bucket.reviews.push(clone(transition.created.review));
    bucket.events.push(clone(transition.eventRecord));

    return this.snapshot(transition.project.id) as ProjectSnapshot;
  }

  async listEvents(projectId: string): Promise<WorkflowEventRecord[]> {
    return this.snapshot(projectId)?.events ?? [];
  }

  private snapshot(projectId: string): ProjectSnapshot | undefined {
    const bucket = this.buckets.get(projectId);
    if (!bucket) return undefined;
    return clone({
      project: bucket.project,
      proposals: bucket.proposals,
      plans: bucket.plans,
      approvals: bucket.approvals,
      executionContracts: bucket.executionContracts,
      codingResults: bucket.codingResults,
      reviews: bucket.reviews,
      events: bucket.events
    });
  }
}
