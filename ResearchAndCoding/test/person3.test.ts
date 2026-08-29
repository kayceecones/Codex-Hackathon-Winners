import test from "node:test";
import assert from "node:assert/strict";
import {
  DemoMemoryStore,
  Person3Event,
  Person3OutputEvent,
  createEvent,
  handlePerson3Event,
} from "../src/person3/index.ts";

test("drafts a proposal when a member submits an idea", async () => {
  const memory = new DemoMemoryStore();

  const result = await handlePerson3Event(
    createEvent(Person3Event.IDEA_SUBMITTED, {
      projectId: "project-demo",
      member: { id: "member-1", name: "Asha" },
      ideaText: "add dark mode",
    }),
    { memory }
  );

  const proposal = result.proposal!;

  assert.equal(proposal.status, "draft");
  assert.equal(proposal.title, "Dark Mode");
  assert.equal(result.emittedEvent.type, Person3OutputEvent.PROPOSAL_READY);
});

test("confirmed proposal creates Plan v2", async () => {
  const memory = new DemoMemoryStore();
  const services = { memory };

  const proposalResult = await handlePerson3Event(
    createEvent(Person3Event.IDEA_SUBMITTED, {
      projectId: "project-demo",
      member: { id: "member-1", name: "Asha" },
      ideaText: "add dark mode",
    }),
    services
  );

  const proposal = proposalResult.proposal!;
  const planResult = await handlePerson3Event(
    createEvent(Person3Event.PROPOSAL_CONFIRMED, {
      projectId: "project-demo",
      member: { id: "member-1", name: "Asha" },
      proposalId: proposal.id,
    }),
    services
  );

  assert.equal(planResult.proposal!.status, "confirmed");
  assert.equal(planResult.planVersion!.version, 2);
  assert.equal(planResult.emittedEvent.type, Person3OutputEvent.PLAN_VERSION_READY);
});

test("leader feedback creates Plan v3 with frontend-only persistence scope", async () => {
  const memory = new DemoMemoryStore();
  const services = { memory };

  const proposalResult = await handlePerson3Event(
    createEvent(Person3Event.IDEA_SUBMITTED, {
      projectId: "project-demo",
      member: { id: "member-1", name: "Asha" },
      ideaText: "add dark mode",
    }),
    services
  );

  const proposal = proposalResult.proposal!;

  await handlePerson3Event(
    createEvent(Person3Event.PROPOSAL_CONFIRMED, {
      projectId: "project-demo",
      member: { id: "member-1", name: "Asha" },
      proposalId: proposal.id,
    }),
    services
  );

  const revisedPlanResult = await handlePerson3Event(
    createEvent(Person3Event.LEADER_FEEDBACK_RECEIVED, {
      projectId: "project-demo",
      proposalId: proposal.id,
      feedback: "Keep dark mode, but don't change the backend; scope it to the frontend and include persistence.",
    }),
    services
  );

  const revisedPlan = revisedPlanResult.planVersion!;

  assert.equal(revisedPlan.version, 3);
  assert.ok(revisedPlan.scope.some((item) => item.includes("frontend")));
  assert.ok(revisedPlan.acceptanceCriteria.some((item) => item.includes("No backend")));
  assert.ok(revisedPlan.acceptanceCriteria.some((item) => item.includes("restored after refresh")));
});
