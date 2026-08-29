import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { CodingReviewAgentGateway } from "./adapters/agents/CodingReviewAgentGateway.js";
import { DemoAgentGateway } from "./adapters/agents/DemoAgentGateway.js";
import type { AgentGateway } from "./adapters/agents/AgentGateway.js";
import { InMemoryStore } from "./adapters/store/InMemoryStore.js";
import type { Store } from "./adapters/store/Store.js";
import type { ApiErrorResponse } from "./contracts/api.js";
import { WorkflowTransitionError } from "./master/errors.js";
import { registerContractRoutes } from "./routes/contractRoutes.js";
import { registerEventRoutes } from "./routes/eventRoutes.js";
import { registerHealthRoutes } from "./routes/healthRoutes.js";
import { registerIntegrationRoutes } from "./routes/integrationRoutes.js";
import { registerProjectRoutes } from "./routes/projectRoutes.js";
import { registerRootRoutes } from "./routes/rootRoutes.js";

export interface BuildAppOptions {
  store?: Store;
  agentGateway?: AgentGateway;
  logger?: boolean;
}

/**
 * With CODING_REVIEW_URL set, approved plans are dispatched to the real
 * Coding + Review service. Without it, behaviour is unchanged: actions are
 * recorded and the workflow advances only when a coding.completed event
 * arrives - which is what the tests and the scripted demo rely on.
 */
function buildDefaultAgentGateway(): AgentGateway {
  const demoGateway = new DemoAgentGateway();
  const codingReviewUrl = process.env.CODING_REVIEW_URL?.replace(/\/+$/, "");

  if (!codingReviewUrl) return demoGateway;

  return new CodingReviewAgentGateway(demoGateway, codingReviewUrl);
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const store = options.store ?? new InMemoryStore();
  const agentGateway = options.agentGateway ?? buildDefaultAgentGateway();

  await app.register(cors, { origin: true });

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof WorkflowTransitionError) {
      const body: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      };
      return reply.code(error.statusCode).send(body);
    }

    const maybeFastifyError = error as { validation?: unknown; message?: string };
    if (maybeFastifyError.validation) {
      const body: ApiErrorResponse = {
        error: {
          code: "VALIDATION_ERROR",
          message: maybeFastifyError.message ?? "Request validation failed."
        }
      };
      return reply.code(400).send(body);
    }

    app.log.error(error);
    const body: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error."
      }
    };
    return reply.code(500).send(body);
  });

  await registerRootRoutes(app);
  await registerHealthRoutes(app);
  await registerContractRoutes(app);
  await registerProjectRoutes(app, { store, agentGateway });
  await registerEventRoutes(app, { store, agentGateway });
  await registerIntegrationRoutes(app, { store, agentGateway });

  return app;
}