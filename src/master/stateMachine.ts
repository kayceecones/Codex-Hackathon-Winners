import type { IncomingWorkflowEvent, WorkflowEventType } from "../contracts/events.js";
import {
  codingStatuses,
  reviewClassifications,
  type Approval,
  type CodingResult,
  type ExecutionContract,
  type PlanStep,
  type PlanVersion,
  type Project,
  type ProjectSnapshot,
  type Proposal,
  type ReviewIssue,
  type ReviewResult,
  type WorkflowEventRecord,
  type WorkflowState
} from "../contracts/workflow.js";
import { failTransition, failValidation } from "./errors.js";

export interface TransitionRuntime {
  now(): string;
  id(prefix: string): string;
}

export type RouteInstruction =
  | {
      kind: "invoke_planning";
      reason: "proposal_accepted" | "leader_feedback" | "review_plan_issue" | "resume_from_hold";
      proposalId: string;
      previousPlanId?: string;
      feedback?: string;
      reviewIssues?: ReviewIssue[];
    }
  | { kind: "await_leader_decision"; planId: string; planVersion: number }
  | { kind: "invoke_coding"; executionContract: ExecutionContract }
  | { kind: "invoke_review"; planId: string; executionId: string; acceptanceCriteria: string[] }
  | { kind: "await_resume"; heldState: WorkflowState; reason: string }
  | { kind: "complete"; reviewId: string; message: string }
  | { kind: "close"; reason: string; message: string };

export interface WorkflowTransition {
  project: Project;
  fromState: WorkflowState;
  toState: WorkflowState;
  eventRecord: WorkflowEventRecord;
  created: {
    proposal?: Proposal;
    plan?: PlanVersion;
    approval?: Approval;
    executionContract?: ExecutionContract;
    codingResult?: CodingResult;
    review?: ReviewResult;
  };
  route: RouteInstruction;
}

const terminalStates = new Set<WorkflowState>(["completed", "exited"]);

function ensureActive(project: Project, eventType: WorkflowEventType): void {
  if (terminalStates.has(project.status)) {
    failTransition(`Cannot apply ${eventType} because project is ${project.status}.`, {
      currentState: project.status,
      eventType
    });
  }
}

function ensureState(project: Project, allowed: WorkflowState[], eventType: WorkflowEventType): void {
  if (!allowed.includes(project.status)) {
    failTransition(`Cannot apply ${eventType} while project is ${project.status}.`, {
      currentState: project.status,
      allowedStates: allowed,
      eventType
    });
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    failValidation(`${label} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function arrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function requireCurrentProposal(snapshot: ProjectSnapshot): Proposal {
  const proposalId = snapshot.project.currentProposalId;
  const proposal = snapshot.proposals.find((item) => item.id === proposalId);
  if (!proposal) {
    failTransition("No current proposal exists for this project.", { proposalId });
  }
  return proposal;
}

function requirePlan(snapshot: ProjectSnapshot, requestedPlanId?: string): PlanVersion {
  const planId = requestedPlanId ?? snapshot.project.currentPlanId;
  const plan = snapshot.plans.find((item) => item.id === planId);
  if (!plan) {
    failTransition("No matching plan exists for this project.", { planId });
  }
  if (requestedPlanId && requestedPlanId !== snapshot.project.currentPlanId) {
    failTransition("Leader decisions must target the current plan.", {
      requestedPlanId,
      currentPlanId: snapshot.project.currentPlanId
    });
  }
  return plan;
}

function requireApprovedPlan(snapshot: ProjectSnapshot, requestedPlanId?: string): PlanVersion {
  const planId = requestedPlanId ?? snapshot.project.approvedPlanId;
  const plan = snapshot.plans.find((item) => item.id === planId);
  if (!plan) {
    failTransition("No approved plan exists for coding or review.", { planId });
  }
  if (requestedPlanId && requestedPlanId !== snapshot.project.approvedPlanId) {
    failTransition("Coding and review must target the approved plan.", {
      requestedPlanId,
      approvedPlanId: snapshot.project.approvedPlanId
    });
  }
  return plan;
}

function makeExecutionContract(
  project: Project,
  plan: PlanVersion,
  runtime: TransitionRuntime,
  createdAt: string,
  reason: ExecutionContract["reason"]
): ExecutionContract {
  return {
    id: runtime.id("contract"),
    projectId: project.id,
    planId: plan.id,
    planVersion: plan.version,
    proposalId: plan.proposalId,
    objective: plan.title,
    summary: plan.summary,
    steps: plan.steps,
    acceptanceCriteria: plan.acceptanceCriteria,
    constraints: [
      "Implement only the approved plan scope.",
      "Run relevant checks before returning coding.completed.",
      "Report files changed and commands run in the coding.completed event."
    ],
    reason,
    createdAt
  };
}

function buildRecord(
  event: IncomingWorkflowEvent,
  eventId: string,
  occurredAt: string,
  fromState: WorkflowState,
  toState: WorkflowState,
  message: string
): WorkflowEventRecord {
  return {
    id: eventId,
    projectId: event.projectId,
    type: event.type,
    actor: event.actor,
    occurredAt,
    fromState,
    toState,
    message,
    payload: event.payload
  };
}

function buildSteps(steps: unknown, runtime: TransitionRuntime): PlanStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    failValidation("plan.steps must contain at least one implementation step.");
  }

  return steps.map((step, index) => {
    if (!step || typeof step !== "object") {
      failValidation("Each plan step must be an object.", { index });
    }
    const candidate = step as Record<string, unknown>;
    return {
      id: runtime.id("step"),
      title: requireString(candidate.title, `plan.steps[${index}].title`),
      description: requireString(candidate.description, `plan.steps[${index}].description`),
      owner: optionalString(candidate.owner),
      dependencies: arrayOrEmpty(candidate.dependencies),
      status: "pending"
    };
  });
}

function reviewFeedback(review: ReviewResult): string {
  if (review.issues.length === 0) {
    return review.summary;
  }
  const issueText = review.issues.map((issue) => `${issue.title}: ${issue.detail}`).join("; ");
  return `${review.summary} Issues: ${issueText}`;
}

export function applyWorkflowEvent(
  snapshot: ProjectSnapshot,
  event: IncomingWorkflowEvent,
  runtime: TransitionRuntime
): WorkflowTransition {
  if (event.projectId !== snapshot.project.id) {
    failValidation("Event projectId does not match the loaded project snapshot.", {
      eventProjectId: event.projectId,
      snapshotProjectId: snapshot.project.id
    });
  }

  const project: Project = { ...snapshot.project };
  const fromState = project.status;
  const occurredAt = event.occurredAt ?? runtime.now();
  const eventId = event.id ?? runtime.id("event");

  const finish = (
    toState: WorkflowState,
    message: string,
    created: WorkflowTransition["created"],
    route: RouteInstruction
  ): WorkflowTransition => {
    project.status = toState;
    project.updatedAt = occurredAt;
    return {
      project,
      fromState,
      toState,
      eventRecord: buildRecord(event, eventId, occurredAt, fromState, toState, message),
      created,
      route
    };
  };

  if (event.type !== "workflow.resumed") {
    ensureActive(project, event.type);
  }

  switch (event.type) {
    case "proposal.accepted": {
      ensureState(project, ["idle"], event.type);
      const input = event.payload.proposal;
      const proposal: Proposal = {
        id: runtime.id("proposal"),
        projectId: project.id,
        title: requireString(input.title, "proposal.title"),
        summary: requireString(input.summary, "proposal.summary"),
        proposer: requireString(input.proposer, "proposal.proposer"),
        rationale: optionalString(input.rationale),
        acceptanceCriteria: arrayOrEmpty(input.acceptanceCriteria),
        risks: arrayOrEmpty(input.risks),
        createdAt: occurredAt
      };
      project.currentProposalId = proposal.id;
      project.currentPlanId = undefined;
      project.approvedPlanId = undefined;
      project.currentExecutionContractId = undefined;
      project.currentExecutionId = undefined;
      project.currentReviewId = undefined;
      project.exitReason = undefined;

      return finish(
        "awaiting_plan",
        `Proposal accepted: ${proposal.title}`,
        { proposal },
        { kind: "invoke_planning", reason: "proposal_accepted", proposalId: proposal.id }
      );
    }

    case "planning.completed": {
      ensureState(project, ["awaiting_plan"], event.type);
      const proposal = requireCurrentProposal(snapshot);
      const input = event.payload.plan;
      const proposalId = input.proposalId ?? proposal.id;
      if (proposalId !== proposal.id) {
        failTransition("Planning output must target the current proposal.", {
          requestedProposalId: proposalId,
          currentProposalId: proposal.id
        });
      }
      const plan: PlanVersion = {
        id: runtime.id("plan"),
        projectId: project.id,
        proposalId,
        version: typeof input.version === "number" && input.version > 0 ? input.version : snapshot.plans.length + 1,
        title: requireString(input.title, "plan.title"),
        summary: requireString(input.summary, "plan.summary"),
        steps: buildSteps(input.steps, runtime),
        acceptanceCriteria: arrayOrEmpty(input.acceptanceCriteria),
        risks: arrayOrEmpty(input.risks),
        feedbackAddressed: optionalString(input.feedbackAddressed),
        createdAt: occurredAt
      };
      project.currentPlanId = plan.id;
      project.approvedPlanId = undefined;

      return finish(
        "awaiting_leader_decision",
        `Plan v${plan.version} completed: ${plan.title}`,
        { plan },
        { kind: "await_leader_decision", planId: plan.id, planVersion: plan.version }
      );
    }

    case "leader.approved": {
      ensureState(project, ["awaiting_leader_decision"], event.type);
      const plan = requirePlan(snapshot, event.payload.planId);
      const approval: Approval = {
        id: runtime.id("approval"),
        projectId: project.id,
        planId: plan.id,
        decision: "approve",
        leader: requireString(event.payload.leader, "leader"),
        feedback: optionalString(event.payload.notes),
        createdAt: occurredAt
      };
      const executionContract = makeExecutionContract(project, plan, runtime, occurredAt, "leader_approved");
      project.approvedPlanId = plan.id;
      project.currentExecutionContractId = executionContract.id;

      return finish(
        "awaiting_coding",
        `Leader approved Plan v${plan.version}.`,
        { approval, executionContract },
        { kind: "invoke_coding", executionContract }
      );
    }

    case "leader.requested_changes": {
      ensureState(project, ["awaiting_leader_decision"], event.type);
      const plan = requirePlan(snapshot, event.payload.planId);
      const feedback = requireString(event.payload.feedback, "feedback");
      const approval: Approval = {
        id: runtime.id("approval"),
        projectId: project.id,
        planId: plan.id,
        decision: "request_updated_plan",
        leader: requireString(event.payload.leader, "leader"),
        feedback,
        createdAt: occurredAt
      };
      project.approvedPlanId = undefined;

      return finish(
        "awaiting_plan",
        `Leader requested changes for Plan v${plan.version}.`,
        { approval },
        {
          kind: "invoke_planning",
          reason: "leader_feedback",
          proposalId: plan.proposalId,
          previousPlanId: plan.id,
          feedback
        }
      );
    }

    case "leader.held": {
      ensureState(project, ["awaiting_plan", "awaiting_leader_decision", "awaiting_coding", "awaiting_review"], event.type);
      const reason = requireString(event.payload.reason, "reason");
      const approval: Approval = {
        id: runtime.id("approval"),
        projectId: project.id,
        planId: project.currentPlanId,
        decision: "hold",
        leader: requireString(event.payload.leader, "leader"),
        reason,
        createdAt: occurredAt
      };
      project.previousStateBeforeHold = fromState;

      return finish(
        "on_hold",
        `Workflow placed on hold: ${reason}`,
        { approval },
        { kind: "await_resume", heldState: fromState, reason }
      );
    }

    case "workflow.resumed": {
      ensureState(project, ["on_hold"], event.type);
      const heldState = project.previousStateBeforeHold;
      if (!heldState || heldState === "on_hold" || terminalStates.has(heldState)) {
        failTransition("Cannot resume because the held workflow state is missing or invalid.", { heldState });
      }
      project.previousStateBeforeHold = undefined;

      if (heldState === "awaiting_plan") {
        const proposal = requireCurrentProposal(snapshot);
        return finish(
          heldState,
          "Workflow resumed and routed back to Planning.",
          {},
          { kind: "invoke_planning", reason: "resume_from_hold", proposalId: proposal.id, previousPlanId: project.currentPlanId }
        );
      }

      if (heldState === "awaiting_leader_decision") {
        const plan = requirePlan(snapshot);
        return finish(
          heldState,
          "Workflow resumed and is awaiting leader decision.",
          {},
          { kind: "await_leader_decision", planId: plan.id, planVersion: plan.version }
        );
      }

      if (heldState === "awaiting_coding") {
        const plan = requireApprovedPlan(snapshot);
        const executionContract = makeExecutionContract(project, plan, runtime, occurredAt, "resume_from_hold");
        project.currentExecutionContractId = executionContract.id;
        return finish(
          heldState,
          "Workflow resumed and routed back to Coding.",
          { executionContract },
          { kind: "invoke_coding", executionContract }
        );
      }

      if (heldState === "awaiting_review") {
        const plan = requireApprovedPlan(snapshot);
        const executionId = project.currentExecutionId;
        if (!executionId) {
          failTransition("Cannot resume review because no current execution exists.");
        }
        return finish(
          heldState,
          "Workflow resumed and routed back to Review.",
          {},
          {
            kind: "invoke_review",
            planId: plan.id,
            executionId,
            acceptanceCriteria: plan.acceptanceCriteria
          }
        );
      }

      failTransition("Cannot resume unsupported held state.", { heldState });
    }

    case "leader.exited": {
      ensureState(project, ["awaiting_plan", "awaiting_leader_decision", "awaiting_coding", "awaiting_review", "on_hold"], event.type);
      const reason = requireString(event.payload.reason, "reason");
      const approval: Approval = {
        id: runtime.id("approval"),
        projectId: project.id,
        planId: project.currentPlanId,
        decision: "exit",
        leader: requireString(event.payload.leader, "leader"),
        reason,
        createdAt: occurredAt
      };
      project.exitReason = reason;
      project.previousStateBeforeHold = undefined;

      return finish(
        "exited",
        `Workflow exited: ${reason}`,
        { approval },
        { kind: "close", reason, message: "Workflow closed by leader." }
      );
    }

    case "coding.completed": {
      ensureState(project, ["awaiting_coding"], event.type);
      const input = event.payload.execution;
      const plan = requireApprovedPlan(snapshot, input.planId);
      const status = input.status ?? "completed";
      if (!codingStatuses.includes(status)) {
        failValidation("execution.status must be completed or failed.", { status });
      }
      const codingResult: CodingResult = {
        id: runtime.id("execution"),
        projectId: project.id,
        planId: plan.id,
        executionContractId: input.executionContractId ?? project.currentExecutionContractId,
        status,
        summary: requireString(input.summary, "execution.summary"),
        filesChanged: arrayOrEmpty(input.filesChanged),
        commandsRun: arrayOrEmpty(input.commandsRun),
        output: optionalString(input.output),
        createdAt: occurredAt
      };
      project.currentExecutionId = codingResult.id;

      return finish(
        "awaiting_review",
        `Coding reported ${status} for approved plan ${plan.id}.`,
        { codingResult },
        {
          kind: "invoke_review",
          planId: plan.id,
          executionId: codingResult.id,
          acceptanceCriteria: plan.acceptanceCriteria
        }
      );
    }

    case "review.completed": {
      ensureState(project, ["awaiting_review"], event.type);
      const input = event.payload.review;
      if (!reviewClassifications.includes(input.classification)) {
        failValidation("review.classification must be pass, coding_issue, or plan_issue.", {
          classification: input.classification
        });
      }
      const plan = requireApprovedPlan(snapshot, input.planId);
      const review: ReviewResult = {
        id: runtime.id("review"),
        projectId: project.id,
        planId: plan.id,
        executionId: input.executionId ?? project.currentExecutionId,
        classification: input.classification,
        summary: requireString(input.summary, "review.summary"),
        issues: Array.isArray(input.issues) ? input.issues : [],
        createdAt: occurredAt
      };
      project.currentReviewId = review.id;

      if (review.classification === "pass") {
        return finish(
          "completed",
          "Review passed. Workflow completed.",
          { review },
          { kind: "complete", reviewId: review.id, message: "Implementation accepted by Review." }
        );
      }

      if (review.classification === "coding_issue") {
        const executionContract = makeExecutionContract(project, plan, runtime, occurredAt, "review_coding_issue");
        project.currentExecutionContractId = executionContract.id;
        return finish(
          "awaiting_coding",
          "Review found a coding issue and routed work back to Coding.",
          { review, executionContract },
          { kind: "invoke_coding", executionContract }
        );
      }

      project.approvedPlanId = undefined;
      return finish(
        "awaiting_plan",
        "Review found a plan issue and routed work back to Planning.",
        { review },
        {
          kind: "invoke_planning",
          reason: "review_plan_issue",
          proposalId: plan.proposalId,
          previousPlanId: plan.id,
          feedback: reviewFeedback(review),
          reviewIssues: review.issues
        }
      );
    }
  }
}
