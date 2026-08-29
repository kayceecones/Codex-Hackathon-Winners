import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { EventAcceptedResponse, ProjectResponse } from "../src/contracts/api.js";

async function createProject(app: FastifyInstance): Promise<ProjectResponse> {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: { name: "API Test Project", leader: "Leader" }
  });
  expect(response.statusCode).toBe(201);
  return JSON.parse(response.body) as ProjectResponse;
}

describe("Master API", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("returns the root landing page, health, and contract metadata", async () => {
    app = await buildApp();

    const root = await app.inject({ method: "GET", url: "/" });
    expect(root.statusCode).toBe(200);
    expect(root.headers["content-type"]).toContain("text/html");
    expect(root.body).toContain("Person 1 Master Backend");

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body).ok).toBe(true);

    const contracts = await app.inject({ method: "GET", url: "/api/contracts" });
    expect(contracts.statusCode).toBe(200);
    const body = JSON.parse(contracts.body);
    expect(body.workflowStates).toContain("awaiting_plan");
    expect(body.workflowEventTypes).toContain("leader.approved");
    expect(body.nextActionKinds).toContain("invoke_coding");
  });

  it("accepts valid events and exposes pending next actions", async () => {
    app = await buildApp();
    const created = await createProject(app);
    const projectId = created.snapshot.project.id;

    const proposal = await app.inject({
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

    expect(proposal.statusCode).toBe(202);
    const proposalBody = JSON.parse(proposal.body) as EventAcceptedResponse;
    expect(proposalBody.snapshot.project.status).toBe("awaiting_plan");
    expect(proposalBody.nextActions[0].kind).toBe("invoke_planning");

    const plan = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        type: "planning.completed",
        projectId,
        payload: {
          plan: {
            title: "Plan v2",
            summary: "Implement the feature.",
            steps: [{ title: "Build", description: "Build the feature." }]
          }
        }
      }
    });

    expect(plan.statusCode).toBe(202);
    const actions = await app.inject({ method: "GET", url: `/api/projects/${projectId}/next-actions` });
    const actionBody = JSON.parse(actions.body);
    expect(actionBody.actions).toHaveLength(1);
    expect(actionBody.actions[0].kind).toBe("await_leader_decision");
  });

  it("rejects invalid transitions with a clear error", async () => {
    app = await buildApp();
    const created = await createProject(app);
    const projectId = created.snapshot.project.id;

    const response = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        type: "coding.completed",
        projectId,
        payload: { execution: { summary: "Tried to code too early." } }
      }
    });

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error.code).toBe("INVALID_TRANSITION");
  });

  it("records a timeline event for every accepted workflow event", async () => {
    app = await buildApp();
    const created = await createProject(app);
    const projectId = created.snapshot.project.id;

    await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        type: "proposal.accepted",
        projectId,
        payload: { proposal: { title: "A", summary: "B", proposer: "C" } }
      }
    });

    await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        type: "planning.completed",
        projectId,
        payload: { plan: { title: "Plan", summary: "Summary", steps: [{ title: "S", description: "D" }] } }
      }
    });

    const events = await app.inject({ method: "GET", url: `/api/projects/${projectId}/events` });
    expect(events.statusCode).toBe(200);
    expect(JSON.parse(events.body).events).toHaveLength(2);
  });
});

