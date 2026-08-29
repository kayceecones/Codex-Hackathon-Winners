import type { NextAction } from "./agents.js";
import type { ProjectSnapshot } from "./workflow.js";

export interface HealthResponse {
  ok: true;
  service: "person-1-master-backend";
  timestamp: string;
}

export interface ProjectResponse {
  snapshot: ProjectSnapshot;
  nextActions: NextAction[];
}

export interface EventAcceptedResponse extends ProjectResponse {
  transition: {
    eventId: string;
    fromState: string;
    toState: string;
    message: string;
  };
  dispatchedActions: NextAction[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
