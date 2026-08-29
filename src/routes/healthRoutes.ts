import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "../contracts/api.js";
import { nowIso } from "../utils/time.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (): Promise<HealthResponse> => ({
    ok: true,
    service: "person-1-master-backend",
    timestamp: nowIso()
  }));
}
