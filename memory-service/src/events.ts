import { prisma } from "./db.js";
import { logTimelineEvent } from "./notion.js";

export async function recordEvent(projectId: string, type: string, payload: unknown) {
  const event = await prisma.event.create({
    data: { projectId, type, payload: JSON.stringify(payload ?? {}) },
  });

  // Fire-and-forget: Notion sync must never block or fail the request.
  void logTimelineEvent({ projectId, type, payload }).catch((err) =>
    console.error("[events] notion sync failed:", err)
  );

  return event;
}
