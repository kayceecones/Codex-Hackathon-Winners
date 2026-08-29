import type { Person3EventEnvelope } from "./contracts.ts";

export interface MasterClientOptions {
  masterApiUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface MasterBridgeResponse {
  message: string;
  transitions: Array<{
    eventId: string;
    type: string;
    fromState: string;
    toState: string;
    message: string;
  }>;
  dispatchedActions: unknown[];
  snapshot?: unknown;
  nextActions?: unknown[];
}

export async function submitPerson3OutputToMaster(
  event: Person3EventEnvelope,
  options: MasterClientOptions = {}
): Promise<MasterBridgeResponse> {
  const baseUrl = normalizeBaseUrl(options.masterApiUrl ?? process.env.MASTER_API_URL ?? "http://127.0.0.1:3001");
  const fetcher = options.fetchImpl ?? fetch;
  const response = await fetcher(`${baseUrl}/api/integrations/person3/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Master bridge rejected Person 3 event with ${response.status}: ${body}`);
  }

  return JSON.parse(body) as MasterBridgeResponse;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}