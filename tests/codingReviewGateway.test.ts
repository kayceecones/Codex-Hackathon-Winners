import { describe, expect, it, vi } from "vitest";
import { CodingReviewAgentGateway } from "../src/adapters/agents/CodingReviewAgentGateway.js";
import { DemoAgentGateway } from "../src/adapters/agents/DemoAgentGateway.js";
import type { NextAction } from "../src/contracts/agents.js";

function invokeCodingAction(): NextAction {
  return {
    id: "action-1",
    projectId: "project-1",
    kind: "invoke_coding",
    target: "coding",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payload: {
      executionContract: {
        id: "contract-1",
        projectId: "project-1",
        planId: "plan-1",
        proposalId: "proposal-1",
        planVersion: 2,
        objective: "Add dark mode",
        summary: "Add a dark theme toggle",
        reason: "leader approved",
        steps: [],
        constraints: [],
        acceptanceCriteria: ["A toggle switches themes"],
        createdAt: new Date().toISOString()
      },
      codingReviewContract: {
        execution_contract_id: "contract-1",
        project_id: "project-1",
        plan_version: 2,
        tasks: ["Add a theme toggle"],
        files_or_areas: [],
        constraints: [],
        acceptance_criteria: ["A toggle switches themes"],
        context: { source: "test" }
      }
    }
  } as NextAction;
}

/** Waits out the detached fire-and-forget dispatch. */
async function flushPendingDispatch(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("CodingReviewAgentGateway", () => {
  it("posts the coding-review contract to the coding service on invoke_coding", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const gateway = new CodingReviewAgentGateway(new DemoAgentGateway(), "http://localhost:4005");
    await gateway.dispatch(invokeCodingAction());
    await flushPendingDispatch();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4005/execution-contract");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      execution_contract_id: "contract-1",
      plan_version: 2
    });

    vi.unstubAllGlobals();
  });

  it("does not dispatch for actions other than invoke_coding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const gateway = new CodingReviewAgentGateway(new DemoAgentGateway(), "http://localhost:4005");
    await gateway.dispatch({
      ...invokeCodingAction(),
      kind: "invoke_planning",
      target: "planning",
      payload: {}
    } as unknown as NextAction);
    await flushPendingDispatch();

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("still records the action when the coding service is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const gateway = new CodingReviewAgentGateway(new DemoAgentGateway(), "http://localhost:4005");
    const dispatched = await gateway.dispatch(invokeCodingAction());
    await flushPendingDispatch();

    // A dead coding service must not fail the dispatch or crash the Master.
    expect(dispatched.kind).toBe("invoke_coding");
    const pending = await gateway.listProjectActions("project-1", "pending");
    expect(pending).toHaveLength(1);

    vi.unstubAllGlobals();
  });
});
