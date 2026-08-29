import { describe, expect, it } from "vitest";
import type { IncomingWorkflowEvent } from "../src/contracts/events.js";
import type { ProjectSnapshot } from "../src/contracts/workflow.js";
import { WorkflowTransitionError } from "../src/master/errors.js";
import { applyWorkflowEvent, type TransitionRuntime, type WorkflowTransition } from "../src/master/stateMachine.js";

function runtime(): TransitionRuntime {
  let id = 0;
  let second = 0;
  return {
    id: (prefix) => `${prefix}_${++id}`,
    now: () => `2026-08-29T00:00:${String(second++).padStart(2, "0")}.000Z`
  };
}

function baseSnapshot(): ProjectSnapshot {
  return {
    project: {
      id: "project_1",
      name: "Test Project",
      status: "idle",
      createdAt: "2026-08-29T00:00:00.000Z",
      updatedAt: "2026-08-29T00:00:00.000Z"
    },
    proposals: [],
    plans: [],
    approvals: [],
    executionContracts: [],
    codingResults: [],
    reviews: [],
    events: []
  };
}

function commit(snapshot: ProjectSnapshot, transition: WorkflowTransition): ProjectSnapshot {
  return {
    project: transition.project,
    proposals: [...snapshot.proposals, ...(transition.created.proposal ? [transition.created.proposal] : [])],
    plans: [...snapshot.plans, ...(transition.created.plan ? [transition.created.plan] : [])],
    approvals: [...snapshot.approvals, ...(transition.created.approval ? [transition.created.approval] : [])],
    executionContracts: [
      ...snapshot.executionContracts,
      ...(transition.created.executionContract ? [transition.created.executionContract] : [])
    ],
    codingResults: [...snapshot.codingResults, ...(transition.created.codingResult ? [transition.created.codingResult] : [])],
    reviews: [...snapshot.reviews, ...(transition.created.review ? [transition.created.review] : [])],
    events: [...snapshot.events, transition.eventRecord]
  };
}

function proposalEvent(projectId = "project_1"): IncomingWorkflowEvent {
  return {
    type: "proposal.accepted",
    projectId,
    payload: {
      proposal: {
        title: "Add dark mode",
        summary: "Add frontend-only dark mode.",
        proposer: "Person A"
      }
    }
  };
}

function planEvent(projectId = "project_1", title = "Plan v2"): IncomingWorkflowEvent {
  return {
    type: "planning.completed",
    projectId,
    payload: {
      plan: {
        title,
        summary: "Implement approved scope.",
        steps: [{ title: "Build", description: "Implement the requested feature." }],
        acceptanceCriteria: ["Feature works"]
      }
    }
  };
}

function approvedEvent(projectId = "project_1"): IncomingWorkflowEvent {
  return {
    type: "leader.approved",
    projectId,
    payload: { leader: "Leader", notes: "Approved." }
  };
}

function codingEvent(projectId = "project_1"): IncomingWorkflowEvent {
  return {
    type: "coding.completed",
    projectId,
    payload: {
      execution: {
        status: "completed",
        summary: "Implemented the approved plan."
      }
    }
  };
}

function reviewEvent(classification: "pass" | "coding_issue" | "plan_issue", projectId = "project_1"): IncomingWorkflowEvent {
  return {
    type: "review.completed",
    projectId,
    payload: {
      review: {
        classification,
        summary: classification === "pass" ? "Looks good." : "Needs more work.",
        issues:
          classification === "pass"
            ? []
            : [{ title: "Issue", detail: "Something needs correction.", severity: "medium" }]
      }
    }
  };
}

describe("Master state machine", () => {
  it("routes an accepted proposal to Planning", () => {
    const transition = applyWorkflowEvent(baseSnapshot(), proposalEvent(), runtime());

    expect(transition.fromState).toBe("idle");
    expect(transition.toState).toBe("awaiting_plan");
    expect(transition.route.kind).toBe("invoke_planning");
    expect(transition.created.proposal?.title).toBe("Add dark mode");
  });

  it("runs the golden path from proposal to completed review", () => {
    const rt = runtime();
    let snapshot = baseSnapshot();

    for (const event of [proposalEvent(), planEvent(), approvedEvent(), codingEvent(), reviewEvent("pass")]) {
      const transition = applyWorkflowEvent(snapshot, event, rt);
      snapshot = commit(snapshot, transition);
    }

    expect(snapshot.project.status).toBe("completed");
    expect(snapshot.proposals).toHaveLength(1);
    expect(snapshot.plans).toHaveLength(1);
    expect(snapshot.executionContracts).toHaveLength(1);
    expect(snapshot.codingResults).toHaveLength(1);
    expect(snapshot.reviews[0].classification).toBe("pass");
  });

  it("routes leader feedback back to Planning as a new plan request", () => {
    const rt = runtime();
    let snapshot = baseSnapshot();
    snapshot = commit(snapshot, applyWorkflowEvent(snapshot, proposalEvent(), rt));
    snapshot = commit(snapshot, applyWorkflowEvent(snapshot, planEvent(), rt));

    const transition = applyWorkflowEvent(
      snapshot,
      {
        type: "leader.requested_changes",
        projectId: "project_1",
        payload: { leader: "Leader", feedback: "Keep this frontend-only." }
      },
      rt
    );

    expect(transition.toState).toBe("awaiting_plan");
    expect(transition.route.kind).toBe("invoke_planning");
    expect(transition.route.kind === "invoke_planning" ? transition.route.reason : undefined).toBe("leader_feedback");
  });

  it("supports hold and resume back to the prior actionable state", () => {
    const rt = runtime();
    let snapshot = baseSnapshot();
    snapshot = commit(snapshot, applyWorkflowEvent(snapshot, proposalEvent(), rt));
    snapshot = commit(snapshot, applyWorkflowEvent(snapshot, planEvent(), rt));

    const held = applyWorkflowEvent(
      snapshot,
      {
        type: "leader.held",
        projectId: "project_1",
        payload: { leader: "Leader", reason: "Need stakeholder review." }
      },
      rt
    );
    snapshot = commit(snapshot, held);

    const resumed = applyWorkflowEvent(
      snapshot,
      {
        type: "workflow.resumed",
        projectId: "project_1",
        payload: { note: "Stakeholder approved continuation." }
      },
      rt
    );

    expect(held.toState).toBe("on_hold");
    expect(resumed.toState).toBe("awaiting_leader_decision");
    expect(resumed.route.kind).toBe("await_leader_decision");
  });

  it("supports leader exit with a reason", () => {
    const rt = runtime();
    let snapshot = baseSnapshot();
    snapshot = commit(snapshot, applyWorkflowEvent(snapshot, proposalEvent(), rt));
    snapshot = commit(snapshot, applyWorkflowEvent(snapshot, planEvent(), rt));

    const transition = applyWorkflowEvent(
      snapshot,
      {
        type: "leader.exited",
        projectId: "project_1",
        payload: { leader: "Leader", reason: "Out of hackathon scope." }
      },
      rt
    );

    expect(transition.toState).toBe("exited");
    expect(transition.project.exitReason).toBe("Out of hackathon scope.");
    expect(transition.route.kind).toBe("close");
  });

  it("routes review coding issues back to Coding", () => {
    const rt = runtime();
    let snapshot = baseSnapshot();

    for (const event of [proposalEvent(), planEvent(), approvedEvent(), codingEvent()]) {
      snapshot = commit(snapshot, applyWorkflowEvent(snapshot, event, rt));
    }

    const transition = applyWorkflowEvent(snapshot, reviewEvent("coding_issue"), rt);

    expect(transition.toState).toBe("awaiting_coding");
    expect(transition.route.kind).toBe("invoke_coding");
    expect(transition.created.executionContract?.reason).toBe("review_coding_issue");
  });

  it("routes review plan issues back to Planning", () => {
    const rt = runtime();
    let snapshot = baseSnapshot();

    for (const event of [proposalEvent(), planEvent(), approvedEvent(), codingEvent()]) {
      snapshot = commit(snapshot, applyWorkflowEvent(snapshot, event, rt));
    }

    const transition = applyWorkflowEvent(snapshot, reviewEvent("plan_issue"), rt);

    expect(transition.toState).toBe("awaiting_plan");
    expect(transition.project.approvedPlanId).toBeUndefined();
    expect(transition.route.kind).toBe("invoke_planning");
  });

  it("rejects coding before leader approval", () => {
    expect(() => applyWorkflowEvent(baseSnapshot(), codingEvent(), runtime())).toThrow(WorkflowTransitionError);
  });
});
