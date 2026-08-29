import type { ActionStatus, NextAction } from "../../contracts/agents.js";
import type { IncomingWorkflowEvent } from "../../contracts/events.js";
import type { AgentGateway } from "./AgentGateway.js";

/**
 * Decorates any AgentGateway so that an `invoke_coding` action actually reaches
 * the Coding + Review service instead of only being recorded.
 *
 * Without this, the Master creates an invoke_coding action, stores it, and
 * waits forever - nothing calls Person 5's service, so the only way the loop
 * closed was a hand-written coding.completed event.
 *
 * The dispatch is deliberately fire-and-forget: a real run boots a devbox and
 * drives an LLM loop, which takes minutes. The Coding service reports back on
 * its own via POST /api/events (coding.completed, then review.completed), so
 * blocking here would stall the caller for the entire execution and gain
 * nothing.
 */
export class CodingReviewAgentGateway implements AgentGateway {
  constructor(
    private readonly inner: AgentGateway,
    private readonly codingReviewUrl: string
  ) {}

  async dispatch(action: NextAction): Promise<NextAction> {
    const dispatched = await this.inner.dispatch(action);

    if (action.kind === "invoke_coding") {
      void this.sendToCodingService(action);
    }

    return dispatched;
  }

  async dispatchMany(actions: NextAction[]): Promise<NextAction[]> {
    const dispatched: NextAction[] = [];
    for (const action of actions) {
      dispatched.push(await this.dispatch(action));
    }
    return dispatched;
  }

  async resolveForEvent(event: IncomingWorkflowEvent): Promise<void> {
    return this.inner.resolveForEvent(event);
  }

  async listProjectActions(projectId: string, status?: ActionStatus): Promise<NextAction[]> {
    return this.inner.listProjectActions(projectId, status);
  }

  private async sendToCodingService(action: NextAction): Promise<void> {
    if (action.kind !== "invoke_coding") return;

    const contract = action.payload.codingReviewContract;
    const target = `${this.codingReviewUrl}/execution-contract`;

    try {
      const response = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contract)
      });

      if (!response.ok) {
        const body = await response.text();
        console.warn(
          `[coding-review] ${contract.execution_contract_id} rejected with ${response.status}: ${body}`
        );
        return;
      }

      console.log(`[coding-review] dispatched ${contract.execution_contract_id} to ${target}`);
    } catch (error) {
      // Never rethrow: this runs detached from the request that triggered it,
      // and an unhandled rejection here would take down the Master process.
      console.warn(
        `[coding-review] could not reach ${target}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}
