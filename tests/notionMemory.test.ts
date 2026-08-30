import { describe, expect, it } from "vitest";
import { NotionMemory } from "../src/adapters/memory/NotionMemory.js";

/** Notion property shapes, matching the live Timeline/Plan Versions schemas. */
const title = (s: string) => ({ title: [{ plain_text: s }] });
const rich = (s: string) => ({ rich_text: [{ plain_text: s }] });

const timelineRow = (projectId: string, type: string, summary: string, at?: string) => ({
  properties: {
    Name: title(type),
    Project: rich(projectId),
    Type: rich(type),
    Summary: rich(summary),
    Timestamp: at ? { date: { start: at } } : { date: null },
  },
});

const planRow = (projectId: string, version: number, status: string, content: string) => ({
  properties: {
    Name: title(`v${version}`),
    Project: rich(projectId),
    Version: { number: version },
    Status: rich(status),
    DiffSummary: rich(""),
    Content: rich(content),
  },
});

function stubFetch(pages: Record<string, unknown[][]>) {
  const calls: { db: string; cursor?: string }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const db = String(url).split("/databases/")[1].split("/")[0];
    const body = JSON.parse(String(init.body ?? "{}")) as { start_cursor?: string };
    const batches = pages[db] ?? [[]];
    const index = body.start_cursor ? Number(body.start_cursor) : 0;
    calls.push({ db, cursor: body.start_cursor });
    const hasMore = index < batches.length - 1;
    return {
      ok: true,
      json: async () => ({
        results: batches[index] ?? [],
        has_more: hasMore,
        next_cursor: hasMore ? String(index + 1) : null,
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const config = (fetchImpl: typeof fetch) => ({
  token: "secret_test",
  timelineDbId: "TL",
  plansDbId: "PL",
  fetchImpl,
});

describe("NotionMemory", () => {
  it("is disabled without a token, and reports why", () => {
    const memory = new NotionMemory({ token: undefined, timelineDbId: "TL" });
    expect(memory.enabled).toBe(false);
    expect(memory.describe()).toEqual({ enabled: false, timeline: false, plans: false });
  });

  it("is enabled once a token and one database are present", () => {
    const memory = new NotionMemory({ token: "t", timelineDbId: "TL" });
    expect(memory.enabled).toBe(true);
    expect(memory.describe().plans).toBe(false);
  });

  it("reads without calling Notion when disabled", async () => {
    const { impl, calls } = stubFetch({});
    const memory = new NotionMemory({ fetchImpl: impl, token: undefined });
    expect(await memory.listEvents()).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("maps timeline rows and sorts newest first", async () => {
    const { impl } = stubFetch({
      TL: [
        [
          timelineRow("p1", "proposal.accepted", "idle -> awaiting_plan", "2026-08-29T22:00:00.000Z"),
          timelineRow("p1", "leader.approved", "awaiting_leader_decision -> awaiting_coding", "2026-08-29T22:30:00.000Z"),
        ],
      ],
    });
    const events = await new NotionMemory(config(impl)).listEvents();
    expect(events.map((e) => e.type)).toEqual(["leader.approved", "proposal.accepted"]);
    expect(events[0]).toMatchObject({ projectId: "p1", summary: "awaiting_leader_decision -> awaiting_coding" });
  });

  it("filters to one project", async () => {
    const { impl } = stubFetch({
      TL: [[timelineRow("p1", "a", "s", "2026-08-29T01:00:00Z"), timelineRow("p2", "b", "s", "2026-08-29T02:00:00Z")]],
    });
    const events = await new NotionMemory(config(impl)).listEvents("p2");
    expect(events).toHaveLength(1);
    expect(events[0].projectId).toBe("p2");
  });

  it("follows pagination across pages", async () => {
    const { impl, calls } = stubFetch({
      TL: [
        [timelineRow("p1", "first", "s", "2026-08-29T01:00:00Z")],
        [timelineRow("p1", "second", "s", "2026-08-29T02:00:00Z")],
      ],
    });
    const events = await new NotionMemory(config(impl)).listEvents();
    expect(events).toHaveLength(2);
    expect(calls.filter((c) => c.db === "TL")).toHaveLength(2);
  });

  it("sorts plans by version ascending and keeps content", async () => {
    const { impl } = stubFetch({
      PL: [[planRow("p1", 3, "awaiting_decision", "v3 body"), planRow("p1", 1, "superseded", "v1 body")]],
    });
    const plans = await new NotionMemory(config(impl)).listPlans("p1");
    expect(plans.map((p) => p.version)).toEqual([1, 3]);
    expect(plans[1]).toMatchObject({ status: "awaiting_decision", content: "v3 body" });
  });

  it("groups projects by latest activity and counts events", async () => {
    const { impl } = stubFetch({
      TL: [
        [
          timelineRow("old", "x", "s", "2026-08-29T01:00:00Z"),
          timelineRow("new", "y", "s", "2026-08-29T05:00:00Z"),
          timelineRow("new", "z", "s", "2026-08-29T04:00:00Z"),
        ],
      ],
    });
    const projects = await new NotionMemory(config(impl)).listProjects();
    expect(projects.map((p) => p.projectId)).toEqual(["new", "old"]);
    expect(projects[0]).toMatchObject({ events: 2, latestType: "y" });
  });

  it("tolerates rows with no timestamp instead of throwing", async () => {
    const { impl } = stubFetch({
      TL: [[timelineRow("p1", "dated", "s", "2026-08-29T01:00:00Z"), timelineRow("p1", "undated", "s")]],
    });
    const events = await new NotionMemory(config(impl)).listEvents();
    expect(events.map((e) => e.type)).toEqual(["dated", "undated"]);
  });

  it("surfaces an upstream failure rather than returning empty data", async () => {
    const impl = (async () => ({ ok: false, status: 401, text: async () => "unauthorized" })) as unknown as typeof fetch;
    await expect(new NotionMemory(config(impl)).listEvents()).rejects.toThrow(/401/);
  });
});
