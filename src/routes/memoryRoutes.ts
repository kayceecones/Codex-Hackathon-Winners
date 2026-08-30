import type { FastifyInstance } from "fastify";
import { NotionMemory } from "../adapters/memory/NotionMemory.js";

interface RouteDependencies {
  memory?: NotionMemory;
}

/**
 * Read-only Notion project memory. Never feeds the state machine — the store
 * remains the operational source of truth (docs/MEMORY_ADAPTER.md).
 */
export async function registerMemoryRoutes(
  app: FastifyInstance,
  dependencies: RouteDependencies = {}
): Promise<void> {
  const memory = dependencies.memory ?? new NotionMemory();

  const unavailable = {
    error: {
      code: "MEMORY_NOT_CONFIGURED",
      message:
        "Notion memory is not configured. Set NOTION_TOKEN and NOTION_TIMELINE_DB_ID / NOTION_PLANS_DB_ID.",
    },
  };

  app.get("/api/memory/status", async () => memory.describe());

  app.get("/api/memory/projects", async (_request, reply) => {
    if (!memory.enabled) return reply.code(503).send(unavailable);
    try {
      return { projects: await memory.listProjects() };
    } catch (error) {
      return reply.code(502).send({
        error: { code: "MEMORY_UPSTREAM_ERROR", message: (error as Error).message },
      });
    }
  });

  app.get<{ Params: { projectId: string } }>("/api/memory/projects/:projectId", async (request, reply) => {
    if (!memory.enabled) return reply.code(503).send(unavailable);
    try {
      const { projectId } = request.params;
      const [events, plans] = await Promise.all([memory.listEvents(projectId), memory.listPlans(projectId)]);
      return { projectId, events, plans };
    } catch (error) {
      return reply.code(502).send({
        error: { code: "MEMORY_UPSTREAM_ERROR", message: (error as Error).message },
      });
    }
  });
}
