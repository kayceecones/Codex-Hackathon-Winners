import type { NextAction } from "../contracts/agents.js";
import { toCodingReviewContract } from "../integrations/codingReviewContract.js";
import type { TransitionRuntime, WorkflowTransition } from "./stateMachine.js";

export function routeTransition(transition: WorkflowTransition, runtime: TransitionRuntime): NextAction[] {
  const timestamp = runtime.now();
  const base = {
    id: runtime.id("action"),
    projectId: transition.project.id,
    sourceEventId: transition.eventRecord.id,
    status: "pending" as const,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  switch (transition.route.kind) {
    case "invoke_planning":
      return [
        {
          ...base,
          kind: "invoke_planning",
          target: "planning",
          payload: {
            reason: transition.route.reason,
            proposalId: transition.route.proposalId,
            previousPlanId: transition.route.previousPlanId,
            feedback: transition.route.feedback,
            reviewIssues: transition.route.reviewIssues
          }
        }
      ];

    case "await_leader_decision":
      return [
        {
          ...base,
          kind: "await_leader_decision",
          target: "leader",
          payload: {
            planId: transition.route.planId,
            planVersion: transition.route.planVersion,
            decisionOptions: ["approve", "request_updated_plan", "hold", "exit"]
          }
        }
      ];

    case "invoke_coding":
      return [
        {
          ...base,
          kind: "invoke_coding",
          target: "coding",
          payload: {
            executionContract: transition.route.executionContract,
            codingReviewContract: toCodingReviewContract(transition.route.executionContract)
          }
        }
      ];

    case "invoke_review":
      return [
        {
          ...base,
          kind: "invoke_review",
          target: "review",
          payload: {
            planId: transition.route.planId,
            executionId: transition.route.executionId,
            acceptanceCriteria: transition.route.acceptanceCriteria
          }
        }
      ];

    case "await_resume":
      return [
        {
          ...base,
          kind: "await_resume",
          target: "leader",
          payload: {
            heldState: transition.route.heldState,
            reason: transition.route.reason
          }
        }
      ];

    case "complete":
      return [
        {
          ...base,
          kind: "complete",
          target: "master",
          payload: {
            reviewId: transition.route.reviewId,
            message: transition.route.message
          }
        }
      ];

    case "close":
      return [
        {
          ...base,
          kind: "close",
          target: "master",
          payload: {
            reason: transition.route.reason,
            message: transition.route.message
          }
        }
      ];
  }
}