import { PrismaClient } from "@prisma/client";
import type { Store } from "./Store.js";
import type { WorkflowTransition } from "../../master/stateMachine.js";
import type {
  Approval,
  CodingResult,
  CreateProjectInput,
  ExecutionContract,
  PlanStep,
  PlanVersion,
  Project,
  ProjectSnapshot,
  Proposal,
  ReviewIssue,
  ReviewResult,
  WorkflowEventRecord
} from "../../contracts/workflow.js";
import { createId } from "../../utils/ids.js";
import { nowIso } from "../../utils/time.js";
import { syncTransition } from "../../notion/notionSync.js";

const prisma = new PrismaClient();

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function orUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

type ProjectRowT = Awaited<ReturnType<typeof prisma.projectRow.findUniqueOrThrow>>;
type ProposalRowT = Awaited<ReturnType<typeof prisma.proposalRow.findFirstOrThrow>>;
type PlanVersionRowT = Awaited<ReturnType<typeof prisma.planVersionRow.findFirstOrThrow>>;
type ApprovalRowT = Awaited<ReturnType<typeof prisma.approvalRow.findFirstOrThrow>>;
type ExecutionContractRowT = Awaited<ReturnType<typeof prisma.executionContractRow.findFirstOrThrow>>;
type CodingResultRowT = Awaited<ReturnType<typeof prisma.codingResultRow.findFirstOrThrow>>;
type ReviewResultRowT = Awaited<ReturnType<typeof prisma.reviewResultRow.findFirstOrThrow>>;
type EventRowT = Awaited<ReturnType<typeof prisma.eventRow.findFirstOrThrow>>;

function toProject(row: ProjectRowT): Project {
  return {
    id: row.id,
    name: row.name,
    description: orUndefined(row.description),
    status: row.status as Project["status"],
    leader: orUndefined(row.leader),
    currentProposalId: orUndefined(row.currentProposalId),
    currentPlanId: orUndefined(row.currentPlanId),
    approvedPlanId: orUndefined(row.approvedPlanId),
    currentExecutionContractId: orUndefined(row.currentExecutionContractId),
    currentExecutionId: orUndefined(row.currentExecutionId),
    currentReviewId: orUndefined(row.currentReviewId),
    previousStateBeforeHold: orUndefined(row.previousStateBeforeHold) as Project["previousStateBeforeHold"],
    exitReason: orUndefined(row.exitReason),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toProposal(row: ProposalRowT): Proposal {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    summary: row.summary,
    proposer: row.proposer,
    rationale: orUndefined(row.rationale),
    acceptanceCriteria: parseJson<string[]>(row.acceptanceCriteria, []),
    risks: parseJson<string[]>(row.risks, []),
    createdAt: row.createdAt
  };
}

function toPlanVersion(row: PlanVersionRowT): PlanVersion {
  return {
    id: row.id,
    projectId: row.projectId,
    proposalId: row.proposalId,
    version: row.version,
    title: row.title,
    summary: row.summary,
    steps: parseJson<PlanStep[]>(row.steps, []),
    acceptanceCriteria: parseJson<string[]>(row.acceptanceCriteria, []),
    risks: parseJson<string[]>(row.risks, []),
    feedbackAddressed: orUndefined(row.feedbackAddressed),
    createdAt: row.createdAt
  };
}

function toApproval(row: ApprovalRowT): Approval {
  return {
    id: row.id,
    projectId: row.projectId,
    planId: orUndefined(row.planId),
    decision: row.decision as Approval["decision"],
    leader: row.leader,
    feedback: orUndefined(row.feedback),
    reason: orUndefined(row.reason),
    createdAt: row.createdAt
  };
}

function toExecutionContract(row: ExecutionContractRowT): ExecutionContract {
  return {
    id: row.id,
    projectId: row.projectId,
    planId: row.planId,
    planVersion: row.planVersion,
    proposalId: row.proposalId,
    objective: row.objective,
    summary: row.summary,
    steps: parseJson<PlanStep[]>(row.steps, []),
    acceptanceCriteria: parseJson<string[]>(row.acceptanceCriteria, []),
    constraints: parseJson<string[]>(row.constraints, []),
    reason: row.reason as ExecutionContract["reason"],
    createdAt: row.createdAt
  };
}

function toCodingResult(row: CodingResultRowT): CodingResult {
  return {
    id: row.id,
    projectId: row.projectId,
    planId: row.planId,
    executionContractId: orUndefined(row.executionContractId),
    status: row.status as CodingResult["status"],
    summary: row.summary,
    filesChanged: parseJson<string[]>(row.filesChanged, []),
    commandsRun: parseJson<string[]>(row.commandsRun, []),
    output: orUndefined(row.output),
    createdAt: row.createdAt
  };
}

function toReviewResult(row: ReviewResultRowT): ReviewResult {
  return {
    id: row.id,
    projectId: row.projectId,
    planId: row.planId,
    executionId: orUndefined(row.executionId),
    classification: row.classification as ReviewResult["classification"],
    summary: row.summary,
    issues: parseJson<ReviewIssue[]>(row.issues, []),
    createdAt: row.createdAt
  };
}

function toEventRecord(row: EventRowT): WorkflowEventRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    actor: row.actor ? parseJson(row.actor, undefined) : undefined,
    occurredAt: row.occurredAt,
    fromState: row.fromState as WorkflowEventRecord["fromState"],
    toState: row.toState as WorkflowEventRecord["toState"],
    message: row.message,
    payload: parseJson(row.payload, {})
  };
}

export class DbStore implements Store {
  async createProject(input: CreateProjectInput): Promise<ProjectSnapshot> {
    const timestamp = nowIso();
    const row = await prisma.projectRow.create({
      data: {
        id: createId("project"),
        name: input.name.trim(),
        description: input.description?.trim(),
        leader: input.leader?.trim(),
        status: "idle",
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });

    const snapshot = await this.getSnapshot(row.id);
    if (!snapshot) throw new Error(`Failed to load snapshot for newly created project ${row.id}.`);
    return snapshot;
  }

  async getSnapshot(projectId: string): Promise<ProjectSnapshot | undefined> {
    const projectRow = await prisma.projectRow.findUnique({ where: { id: projectId } });
    if (!projectRow) return undefined;

    const [proposals, plans, approvals, executionContracts, codingResults, reviews, events] = await Promise.all([
      prisma.proposalRow.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      prisma.planVersionRow.findMany({ where: { projectId }, orderBy: { version: "asc" } }),
      prisma.approvalRow.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      prisma.executionContractRow.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      prisma.codingResultRow.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      prisma.reviewResultRow.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
      prisma.eventRow.findMany({ where: { projectId }, orderBy: { occurredAt: "asc" } })
    ]);

    return {
      project: toProject(projectRow),
      proposals: proposals.map(toProposal),
      plans: plans.map(toPlanVersion),
      approvals: approvals.map(toApproval),
      executionContracts: executionContracts.map(toExecutionContract),
      codingResults: codingResults.map(toCodingResult),
      reviews: reviews.map(toReviewResult),
      events: events.map(toEventRecord)
    };
  }

  async commitTransition(transition: WorkflowTransition): Promise<ProjectSnapshot> {
    const { project, created, eventRecord } = transition;

    await prisma.$transaction(async (tx) => {
      await tx.projectRow.update({
        where: { id: project.id },
        data: {
          status: project.status,
          leader: project.leader,
          currentProposalId: project.currentProposalId,
          currentPlanId: project.currentPlanId,
          approvedPlanId: project.approvedPlanId,
          currentExecutionContractId: project.currentExecutionContractId,
          currentExecutionId: project.currentExecutionId,
          currentReviewId: project.currentReviewId,
          previousStateBeforeHold: project.previousStateBeforeHold,
          exitReason: project.exitReason,
          updatedAt: project.updatedAt
        }
      });

      if (created.proposal) {
        const proposal = created.proposal;
        await tx.proposalRow.create({
          data: {
            id: proposal.id,
            projectId: proposal.projectId,
            title: proposal.title,
            summary: proposal.summary,
            proposer: proposal.proposer,
            rationale: proposal.rationale,
            acceptanceCriteria: toJson(proposal.acceptanceCriteria),
            risks: toJson(proposal.risks),
            createdAt: proposal.createdAt
          }
        });
      }

      if (created.plan) {
        const plan = created.plan;
        await tx.planVersionRow.create({
          data: {
            id: plan.id,
            projectId: plan.projectId,
            proposalId: plan.proposalId,
            version: plan.version,
            title: plan.title,
            summary: plan.summary,
            steps: toJson(plan.steps),
            acceptanceCriteria: toJson(plan.acceptanceCriteria),
            risks: toJson(plan.risks),
            feedbackAddressed: plan.feedbackAddressed,
            createdAt: plan.createdAt
          }
        });
      }

      if (created.approval) {
        const approval = created.approval;
        await tx.approvalRow.create({
          data: {
            id: approval.id,
            projectId: approval.projectId,
            planId: approval.planId,
            decision: approval.decision,
            leader: approval.leader,
            feedback: approval.feedback,
            reason: approval.reason,
            createdAt: approval.createdAt
          }
        });
      }

      if (created.executionContract) {
        const contract = created.executionContract;
        await tx.executionContractRow.create({
          data: {
            id: contract.id,
            projectId: contract.projectId,
            planId: contract.planId,
            planVersion: contract.planVersion,
            proposalId: contract.proposalId,
            objective: contract.objective,
            summary: contract.summary,
            steps: toJson(contract.steps),
            acceptanceCriteria: toJson(contract.acceptanceCriteria),
            constraints: toJson(contract.constraints),
            reason: contract.reason,
            createdAt: contract.createdAt
          }
        });
      }

      if (created.codingResult) {
        const result = created.codingResult;
        await tx.codingResultRow.create({
          data: {
            id: result.id,
            projectId: result.projectId,
            planId: result.planId,
            executionContractId: result.executionContractId,
            status: result.status,
            summary: result.summary,
            filesChanged: toJson(result.filesChanged),
            commandsRun: toJson(result.commandsRun),
            output: result.output,
            createdAt: result.createdAt
          }
        });
      }

      if (created.review) {
        const review = created.review;
        await tx.reviewResultRow.create({
          data: {
            id: review.id,
            projectId: review.projectId,
            planId: review.planId,
            executionId: review.executionId,
            classification: review.classification,
            summary: review.summary,
            issues: toJson(review.issues),
            createdAt: review.createdAt
          }
        });
      }

      await tx.eventRow.create({
        data: {
          id: eventRecord.id,
          projectId: eventRecord.projectId,
          type: eventRecord.type,
          actor: eventRecord.actor ? toJson(eventRecord.actor) : undefined,
          occurredAt: eventRecord.occurredAt,
          fromState: eventRecord.fromState,
          toState: eventRecord.toState,
          message: eventRecord.message,
          payload: toJson(eventRecord.payload)
        }
      });
    });

    // Notion is human-readable memory, not the source of truth - never let it
    // block or fail a state transition that already committed to the DB.
    void syncTransition(transition).catch((err) => console.error("[notion] sync failed:", err));

    const snapshot = await this.getSnapshot(project.id);
    if (!snapshot) throw new Error(`Failed to load snapshot after committing transition for ${project.id}.`);
    return snapshot;
  }

  async listEvents(projectId: string): Promise<WorkflowEventRecord[]> {
    const rows = await prisma.eventRow.findMany({ where: { projectId }, orderBy: { occurredAt: "asc" } });
    return rows.map(toEventRecord);
  }
}
