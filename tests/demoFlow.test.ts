import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { EventAcceptedResponse, ProjectResponse } from "../src/contracts/api.js";
import { buildDarkModeDemoEvents } from "../src/demo/demoEvents.js";

describe("demo flow", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("runs the dark mode revision and recovery path end to end", async () => {
    app = await buildApp();
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: {
        name: "Demo Project",
        description: "Golden path plus review recovery.",
        leader: "Leader"
      }
    });
    expect(created.statusCode).toBe(201);

    const projectId = (JSON.parse(created.body) as ProjectResponse).snapshot.project.id;
    let latest: EventAcceptedResponse | undefined;

    for (const event of buildDarkModeDemoEvents(projectId)) {
      const response = await app.inject({ method: "POST", url: "/api/events", payload: event });
      expect(response.statusCode, response.body).toBe(202);
      latest = JSON.parse(response.body) as EventAcceptedResponse;
    }

    expect(latest?.snapshot.project.status).toBe("completed");
    expect(latest?.snapshot.plans).toHaveLength(2);
    expect(latest?.snapshot.reviews.map((review) => review.classification)).toEqual(["coding_issue", "pass"]);
    expect(latest?.snapshot.events.map((event) => event.type)).toEqual([
      "proposal.accepted",
      "planning.completed",
      "leader.requested_changes",
      "planning.completed",
      "leader.approved",
      "coding.completed",
      "review.completed",
      "coding.completed",
      "review.completed"
    ]);
  });
});
