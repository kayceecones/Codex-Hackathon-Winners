import { DemoMemoryStore, Person3Event, createEvent, handlePerson3Event } from "../src/person3/index.ts";
import type { FeatureProposal, PlanVersion } from "../src/person3/index.ts";

async function runDemo(): Promise<void> {
  const memory = new DemoMemoryStore();
  const services = { memory };
  const projectId = "project-demo";
  const member = { id: "member-uday", name: "Uday" };

  const proposalResult = await handlePerson3Event(
    createEvent(Person3Event.IDEA_SUBMITTED, {
      projectId,
      member,
      ideaText: "add dark mode",
    }),
    services
  );

  const proposal = proposalResult.proposal!;

  const planV2Result = await handlePerson3Event(
    createEvent(Person3Event.PROPOSAL_CONFIRMED, {
      projectId,
      member,
      proposalId: proposal.id,
    }),
    services
  );

  const planV3Result = await handlePerson3Event(
    createEvent(Person3Event.LEADER_FEEDBACK_RECEIVED, {
      projectId,
      proposalId: proposal.id,
      feedback: "Keep dark mode, but don't change the backend; scope it to the frontend and include persistence.",
    }),
    services
  );

  printProposal(proposal);
  printPlan(planV2Result.planVersion!);
  printLeaderFeedback(planV3Result.planVersion!.leaderFeedback);
  printPlan(planV3Result.planVersion!);
}

function printProposal(proposal: FeatureProposal): void {
  console.log("\n=== Feature Proposal ===");
  console.log(`${proposal.title} (${proposal.status})`);
  console.log(`Problem: ${proposal.problem}`);
  printList("Suggested scope", proposal.suggestedScope);
  printList("Acceptance criteria", proposal.acceptanceCriteria);
}

function printLeaderFeedback(feedback: string | null): void {
  console.log("\n=== Leader Feedback ===");
  console.log(feedback);
}

function printPlan(plan: PlanVersion): void {
  console.log(`\n=== ${plan.title} ===`);
  console.log(plan.summary);
  printList("Scope", plan.scope);
  printList("Tasks", plan.tasks || []);
  printList("Diff", plan.diff);
}

function printList(label: string, items: string[]): void {
  console.log(`${label}:`);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

runDemo().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});
