import type { FastifyInstance } from "fastify";
import type { AgentGateway } from "../adapters/agents/AgentGateway.js";
import type { Store } from "../adapters/store/Store.js";
import { mapPerson3EventToMasterEvents } from "../integrations/person3Adapter.js";
import { WorkflowTransitionError } from "../master/errors.js";
import { routeTransition } from "../master/router.js";
import { applyWorkflowEvent, type TransitionRuntime } from "../master/stateMachine.js";
import { createId } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

interface RouteDependencies {
  store: Store;
  agentGateway: AgentGateway;
}

function normalizeAdapterError(error: unknown): WorkflowTransitionError {
  if (error instanceof WorkflowTransitionError) return error;
  return new WorkflowTransitionError(error instanceof Error ? error.message : String(error), {
    code: "INTEGRATION_PAYLOAD_ERROR",
    statusCode: 400
  });
}

export async function registerIntegrationRoutes(app: FastifyInstance, dependencies: RouteDependencies): Promise<void> {
  const runtime: TransitionRuntime = { now: nowIso, id: createId };

  app.post("/api/integrations/person3/events", async (request, reply) => {
    try {
      const raw = request.body as { payload?: Record<string, unknown> };
      const projectId = raw.payload?.projectId as string | undefined;
      if (!projectId) {
        return reply.code(400).send({
          error: { code: "INTEGRATION_PAYLOAD_ERROR", message: "Person 3 event payload.projectId is required." }
        });
      }

      let snapshot = await dependencies.store.getSnapshot(projectId);
      if (!snapshot) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
      }

      const mapped = mapPerson3EventToMasterEvents(snapshot, request.body as { type: string; payload?: Record<string, unknown> });
      const transitions = [];
      const dispatchedActions = [];

      for (const event of mapped.events) {
        const transition = applyWorkflowEvent(snapshot, event, runtime);
        snapshot = await dependencies.store.commitTransition(transition);
        await dependencies.agentGateway.resolveForEvent(event);
        const actions = await dependencies.agentGateway.dispatchMany(routeTransition(transition, runtime));
        transitions.push({
          eventId: transition.eventRecord.id,
          type: transition.eventRecord.type,
          fromState: transition.fromState,
          toState: transition.toState,
          message: transition.eventRecord.message
        });
        dispatchedActions.push(...actions);
      }

      const nextActions = await dependencies.agentGateway.listProjectActions(projectId, "pending");
      return reply.code(202).send({
        message: mapped.message,
        transitions,
        dispatchedActions,
        snapshot,
        nextActions
      });
    } catch (error) {
      const normalized = normalizeAdapterError(error);
      return reply.code(normalized.statusCode).send({
        error: { code: normalized.code, message: normalized.message, details: normalized.details }
      });
    }
  });
}