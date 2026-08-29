import type { FastifyInstance } from "fastify";
import type { AgentGateway } from "../adapters/agents/AgentGateway.js";
import type { Store } from "../adapters/store/Store.js";
import type { EventAcceptedResponse } from "../contracts/api.js";
import { isWorkflowEventType, type IncomingWorkflowEvent } from "../contracts/events.js";
import { WorkflowTransitionError } from "../master/errors.js";
import { routeTransition } from "../master/router.js";
import { applyWorkflowEvent, type TransitionRuntime } from "../master/stateMachine.js";
import { createId } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";

interface RouteDependencies {
  store: Store;
  agentGateway: AgentGateway;
}

const eventSchema = {
  body: {
    type: "object",
    required: ["type", "projectId", "payload"],
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      type: { type: "string" },
      projectId: { type: "string" },
      actor: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          role: { type: "string" }
        }
      },
      occurredAt: { type: "string" },
      payload: { type: "object", additionalProperties: true }
    }
  }
};

function assertRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowTransitionError(`${label} must be an object.`, {
      code: "VALIDATION_ERROR",
      statusCode: 400
    });
  }
  return value as Record<string, unknown>;
}

function normalizeEvent(body: unknown): IncomingWorkflowEvent {
  const record = assertRecord(body, "event");
  const type = record.type;
  if (typeof type !== "string" || !isWorkflowEventType(type)) {
    throw new WorkflowTransitionError("Unsupported workflow event type.", {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details: { type }
    });
  }

  if (typeof record.projectId !== "string" || record.projectId.trim().length === 0) {
    throw new WorkflowTransitionError("projectId is required.", {
      code: "VALIDATION_ERROR",
      statusCode: 400
    });
  }

  const payload = assertRecord(record.payload, "payload");
  if (type === "proposal.accepted") assertRecord(payload.proposal, "payload.proposal");
  if (type === "planning.completed") assertRecord(payload.plan, "payload.plan");
  if (type === "coding.completed") assertRecord(payload.execution, "payload.execution");
  if (type === "review.completed") assertRecord(payload.review, "payload.review");

  return record as unknown as IncomingWorkflowEvent;
}

export async function registerEventRoutes(app: FastifyInstance, dependencies: RouteDependencies): Promise<void> {
  const runtime: TransitionRuntime = { now: nowIso, id: createId };

  app.post("/api/events", { schema: eventSchema }, async (request, reply) => {
    const event = normalizeEvent(request.body);
    const snapshot = await dependencies.store.getSnapshot(event.projectId);
    if (!snapshot) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Project not found." } });
    }

    const transition = applyWorkflowEvent(snapshot, event, runtime);
    const updatedSnapshot = await dependencies.store.commitTransition(transition);
    await dependencies.agentGateway.resolveForEvent(event);
    const dispatchedActions = await dependencies.agentGateway.dispatchMany(routeTransition(transition, runtime));
    const nextActions = await dependencies.agentGateway.listProjectActions(event.projectId, "pending");

    const response: EventAcceptedResponse = {
      transition: {
        eventId: transition.eventRecord.id,
        fromState: transition.fromState,
        toState: transition.toState,
        message: transition.eventRecord.message
      },
      dispatchedActions,
      snapshot: updatedSnapshot,
      nextActions
    };

    return reply.code(202).send(response);
  });
}
