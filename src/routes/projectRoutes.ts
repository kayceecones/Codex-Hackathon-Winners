import type { FastifyInstance } from "fastify";
import type { AgentGateway } from "../adapters/agents/AgentGateway.js";
import type { Store } from "../adapters/store/Store.js";
import type { ProjectResponse } from "../contracts/api.js";
import type { ActionStatus } from "../contracts/agents.js";
import type { CreateProjectInput } from "../contracts/workflow.js";

interface RouteDependencies {
  store: Store;
  agentGateway: AgentGateway;
}

const createProjectSchema = {
  body: {
    type: "object",
    required: ["name"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1 },
      description: { type: "string" },
      leader: { type: "string" }
    }
  }
};

export async function registerProjectRoutes(app: FastifyInstance, dependencies: RouteDependencies): Promise<void> {
  app.post<{ Body: CreateProjectInput }>("/api/projects", { schema: createProjectSchema }, async (request, reply) => {
    const snapshot = await dependencies.store.createProject(request.body);
    const response: ProjectResponse = { snapshot, nextActions: [] };
    return reply.code(201).send(response);
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId", async (request, reply) => {
    const snapshot = await dependencies.store.getSnapshot(request.params.projectId);
    if (!snapshot) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
    }
    const nextActions = await dependencies.agentGateway.listProjectActions(request.params.projectId, "pending");
    const response: ProjectResponse = { snapshot, nextActions };
    return response;
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/events", async (request, reply) => {
    const snapshot = await dependencies.store.getSnapshot(request.params.projectId);
    if (!snapshot) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
    }
    return { events: await dependencies.store.listEvents(request.params.projectId) };
  });

  app.get<{ Params: { projectId: string }; Querystring: { status?: ActionStatus } }>(
    "/api/projects/:projectId/next-actions",
    async (request, reply) => {
      const snapshot = await dependencies.store.getSnapshot(request.params.projectId);
      if (!snapshot) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
      }
      return {
        actions: await dependencies.agentGateway.listProjectActions(
          request.params.projectId,
          request.query.status ?? "pending"
        )
      };
    }
  );
}
