import { buildApp } from "../app.js";
import type { EventAcceptedResponse, ProjectResponse } from "../contracts/api.js";
import { buildDarkModeDemoEvents } from "./demoEvents.js";

const app = await buildApp();

const created = await app.inject({
  method: "POST",
  url: "/api/projects",
  payload: {
    name: "Codex Hackathon Winners Demo",
    description: "Demo project for the full proposal to planning to coding to review loop.",
    leader: "Leader"
  }
});

if (created.statusCode !== 201) {
  throw new Error(`Failed to create demo project: ${created.body}`);
}

const projectResponse = JSON.parse(created.body) as ProjectResponse;
const projectId = projectResponse.snapshot.project.id;
let latest: EventAcceptedResponse | undefined;

for (const event of buildDarkModeDemoEvents(projectId)) {
  const response = await app.inject({ method: "POST", url: "/api/events", payload: event });
  if (response.statusCode !== 202) {
    throw new Error(`Demo event failed (${event.type}): ${response.body}`);
  }
  latest = JSON.parse(response.body) as EventAcceptedResponse;
}

console.log(JSON.stringify({ projectId, finalStatus: latest?.snapshot.project.status, events: latest?.snapshot.events.length }, null, 2));
await app.close();
