export const Person3Event = {
  IDEA_SUBMITTED: "person3.idea_submitted",
  PROPOSAL_CONFIRMED: "person3.proposal_confirmed",
  LEADER_FEEDBACK_RECEIVED: "person3.leader_feedback_received",
} as const;

export const Person3OutputEvent = {
  PROPOSAL_READY: "person3.proposal_ready",
  PLAN_VERSION_READY: "person3.plan_version_ready",
} as const;

export type Person3EventType = (typeof Person3Event)[keyof typeof Person3Event];
export type Person3OutputEventType = (typeof Person3OutputEvent)[keyof typeof Person3OutputEvent];

export interface Person3EventEnvelope<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  createdAt: string;
}

export function createEvent<TPayload>(type: string, payload: TPayload): Person3EventEnvelope<TPayload> {
  return {
    id: makeId(type),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function requireFields(object: object | null | undefined, fields: string[], label: string): void {
  if (!object) {
    throw new Error(`${label} is missing required field(s): ${fields.join(", ")}`);
  }

  const record = object as Record<string, unknown>;
  const missing = fields.filter((field) => record[field] === undefined || record[field] === "");

  if (missing.length > 0) {
    throw new Error(`${label} is missing required field(s): ${missing.join(", ")}`);
  }
}

function makeId(prefix: string): string {
  const safePrefix = prefix.replaceAll(".", "-");
  return `${safePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
