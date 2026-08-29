import type { FastifyInstance } from "fastify";
import { actionStatuses, agentTargets, nextActionKinds } from "../contracts/agents.js";
import { workflowEventTypes } from "../contracts/events.js";
import { codingStatuses, leaderDecisions, reviewClassifications, workflowStates } from "../contracts/workflow.js";

export async function registerContractRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/contracts", async () => ({
    workflowStates,
    workflowEventTypes,
    leaderDecisions,
    reviewClassifications,
    codingStatuses,
    nextActionKinds,
    actionStatuses,
    agentTargets,
    endpoints: {
      health: "GET /health",
      contracts: "GET /api/contracts",
      createProject: "POST /api/projects",
      getProject: "GET /api/projects/:projectId",
      getEvents: "GET /api/projects/:projectId/events",
      getNextActions: "GET /api/projects/:projectId/next-actions",
      sendEvent: "POST /api/events"
    }
  }));
}
