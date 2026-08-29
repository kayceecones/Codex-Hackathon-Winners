import type { CodingReviewExecutionContract } from "../contracts/agents.js";
import type { ExecutionContract } from "../contracts/workflow.js";

export function toCodingReviewContract(contract: ExecutionContract): CodingReviewExecutionContract {
  const verifyScript = inferVerifyScript(`${contract.objective} ${contract.summary}`);

  return {
    execution_contract_id: contract.id,
    project_id: contract.projectId,
    plan_version: contract.planVersion,
    tasks: contract.steps.map((step) => `${step.title}: ${step.description}`),
    files_or_areas: [],
    constraints: contract.constraints,
    acceptance_criteria: contract.acceptanceCriteria,
    context: {
      source: "person-1-master-backend",
      planId: contract.planId,
      proposalId: contract.proposalId,
      objective: contract.objective,
      summary: contract.summary,
      reason: contract.reason,
      createdAt: contract.createdAt
    },
    ...(verifyScript ? { verify_script: verifyScript } : {})
  };
}

function inferVerifyScript(text: string): "dark-mode" | "mobile-responsive" | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("dark mode")) return "dark-mode";
  if (normalized.includes("mobile") || normalized.includes("responsive")) return "mobile-responsive";
  return undefined;
}