import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { EventAcceptedResponse, ProjectResponse } from "../src/contracts/api.js";

async function createProject(app: FastifyInstance): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: { name: "Integration Project", leader: "Leader" }
  });
  expect(response.statusCode).toBe(201);
  return (JSON.parse(response.body) as ProjectResponse).snapshot.project.id;
}

describe("teammate integration adapters", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("maps Person 3 plan_version_ready into canonical Master proposal and planning events", async () => {
    app = await buildApp();
    const projectId = await createProject(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/person3/events",
      payload: {
        type: "person3.plan_version_ready",
        payload: {
          projectId,
          planVersion: {
            id: "plan-v2",
            projectId,
            proposalId: "proposal-1",
            version: 2,
            title: "Plan v2: Dark Mode",
            summary: "Add dark mode with frontend-only scope.",
            scope: ["Update dashboard theme tokens."],
            tasks: ["Create theme toggle.", "Persist preference locally."],
            acceptanceCriteria: ["Theme persists across reloads."],
            risks: ["Hard-coded colors may remain."],
            leaderFeedback: null
          }
        }
      }
    });

    expect(response.statusCode).toBe(202);
    const body = JSON.parse(response.body) as EventAcceptedResponse & { transitions: Array<{ type: string }> };
    expect(body.transitions.map((transition) => transition.type)).toEqual(["proposal.accepted", "planning.completed"]);
    expect(body.snapshot.project.status).toBe("awaiting_leader_decision");
    expect(body.snapshot.proposals).toHaveLength(1);
    expect(body.snapshot.plans[0].version).toBe(2);
    expect(body.nextActions[0].kind).toBe("await_leader_decision");
  });

  it("includes a Person 5 compatible codingReviewContract after leader approval", async () => {
    app = await buildApp();
    const projectId = await createProject(app);

    await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        type: "proposal.accepted",
        projectId,
        payload: {
          proposal: {
            title: "Add dark mode",
            summary: "Add frontend-only dark mode.",
            proposer: "Person A"
          }
        }
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        type: "planning.completed",
        projectId,
        payload: {
          plan: {
            version: 3,
            title: "Plan v3: Dark Mode",
            summary: "Add theme toggle and persistence.",
            steps: [{ title: "Add toggle", description: "Expose and persist the dashboard theme toggle." }],
            acceptanceCriteria: ["Theme persists across reloads."]
          }
        }
      }
    });

    const approved = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        type: "leader.approved",
        projectId,
        payload: { leader: "Leader" }
      }
    });

    expect(approved.statusCode).toBe(202);
    const body = JSON.parse(approved.body) as EventAcceptedResponse;
    const codingAction = body.dispatchedActions.find((action) => action.kind === "invoke_coding");
    expect(codingAction?.payload).toMatchObject({
      codingReviewContract: {
        project_id: projectId,
        plan_version: 3,
        acceptance_criteria: ["Theme persists across reloads."],
        verify_script: "dark-mode"
      }
    });
  });
});