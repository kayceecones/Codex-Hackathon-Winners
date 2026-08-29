import { buildApp } from "../src/app.js";
import type { EventAcceptedResponse, ProjectResponse } from "../src/contracts/api.js";
import {
  DemoMemoryStore,
  Person3Event,
  createEvent,
  handlePerson3Event,
} from "../ResearchAndCoding/src/person3/index.ts";
import { review } from "../coding-review-agent/src/review-agent.ts";

const app = await buildApp();
const memory = new DemoMemoryStore();
const person3Services = { memory };
const member = { id: "member-demo", name: "Demo Member" };

async function postEvent(payload: unknown): Promise<EventAcceptedResponse> {
  const response = await app.inject({ method: "POST", url: "/api/events", payload });
  if (response.statusCode !== 202) {
    throw new Error(`Master event failed with ${response.statusCode}: ${response.body}`);
  }
  return JSON.parse(response.body) as EventAcceptedResponse;
}

async function postPerson3Event(payload: unknown): Promise<EventAcceptedResponse & { transitions: Array<{ type: string }> }> {
  const response = await app.inject({ method: "POST", url: "/api/integrations/person3/events", payload });
  if (response.statusCode !== 202) {
    throw new Error(`Person 3 bridge failed with ${response.statusCode}: ${response.body}`);
  }
  return JSON.parse(response.body) as EventAcceptedResponse & { transitions: Array<{ type: string }> };
}

try {
  const created = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Integrated Multiplayer AI Demo",
      description: "Single demo path for Person 1, Person 3, and Person 5 integration.",
      leader: "Leader",
    },
  });

  if (created.statusCode !== 201) {
    throw new Error(`Project creation failed: ${created.body}`);
  }

  const projectId = (JSON.parse(created.body) as ProjectResponse).snapshot.project.id;

  const proposalResult = await handlePerson3Event(
    createEvent(Person3Event.IDEA_SUBMITTED, {
      projectId,
      member,
      ideaText: "add dark mode",
    }),
    person3Services
  );

  const proposal = proposalResult.proposal;
  if (!proposal) throw new Error("Person 3 did not create a proposal.");

  const planV2Result = await handlePerson3Event(
    createEvent(Person3Event.PROPOSAL_CONFIRMED, {
      projectId,
      member,
      proposalId: proposal.id,
    }),
    person3Services
  );

  await postPerson3Event(planV2Result.emittedEvent);

  await postEvent({
    type: "leader.requested_changes",
    projectId,
    actor: { name: "Leader", role: "leader" },
    payload: {
      leader: "Leader",
      feedback: "Keep dark mode, but don't change the backend; scope it to the frontend and include persistence.",
    },
  });

  const planV3Result = await handlePerson3Event(
    createEvent(Person3Event.LEADER_FEEDBACK_RECEIVED, {
      projectId,
      proposalId: proposal.id,
      feedback: "Keep dark mode, but don't change the backend; scope it to the frontend and include persistence.",
    }),
    person3Services
  );

  await postPerson3Event(planV3Result.emittedEvent);

  const approved = await postEvent({
    type: "leader.approved",
    projectId,
    actor: { name: "Leader", role: "leader" },
    payload: { leader: "Leader", notes: "Approved for integrated demo." },
  });

  const codingAction = approved.dispatchedActions.find((action) => action.kind === "invoke_coding");
  if (!codingAction || codingAction.kind !== "invoke_coding") {
    throw new Error("Master did not create an invoke_coding action.");
  }

  const codingReviewContract = codingAction.payload.codingReviewContract;

  await postEvent({
    type: "coding.completed",
    projectId,
    actor: { name: "Coding Agent", role: "person_5" },
    payload: {
      execution: {
        executionContractId: codingReviewContract.execution_contract_id,
        status: "completed",
        summary: "Person 5 consumed the Master contract and implemented the approved dark-mode plan.",
        filesChanged: ["demo-app/app.js", "demo-app/style.css"],
        commandsRun: ["runloop coding agent", "node demo-app/verify.js"],
      },
    },
  });

  const firstReview = review({
    filesOrAreas: codingReviewContract.files_or_areas,
    filesChanged: ["demo-app/app.js", "demo-app/style.css"],
    tests: { passed: 1, failed: 1 },
    acceptanceCriteria: codingReviewContract.acceptance_criteria,
  });

  await postEvent({
    type: "review.completed",
    projectId,
    actor: { name: "Review Agent", role: "person_5" },
    payload: {
      review: {
        classification: firstReview.classification,
        summary: firstReview.detail,
        issues: [{ title: "Verification issue", detail: firstReview.detail, severity: "medium" }],
      },
    },
  });

  await postEvent({
    type: "coding.completed",
    projectId,
    actor: { name: "Coding Agent", role: "person_5" },
    payload: {
      execution: {
        status: "completed",
        summary: "Person 5 fixed the review issue and reran verification.",
        filesChanged: ["demo-app/style.css"],
        commandsRun: ["node demo-app/verify.js"],
      },
    },
  });

  const finalReview = review({
    filesOrAreas: codingReviewContract.files_or_areas,
    filesChanged: ["demo-app/style.css"],
    tests: { passed: 2, failed: 0 },
    acceptanceCriteria: codingReviewContract.acceptance_criteria,
  });

  const completed = await postEvent({
    type: "review.completed",
    projectId,
    actor: { name: "Review Agent", role: "person_5" },
    payload: {
      review: {
        classification: finalReview.classification,
        summary: finalReview.detail,
        issues: [],
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        projectId,
        finalStatus: completed.snapshot.project.status,
        planVersions: completed.snapshot.plans.map((plan) => plan.version),
        eventTypes: completed.snapshot.events.map((event) => event.type),
        person5Contract: {
          project_id: codingReviewContract.project_id,
          plan_version: codingReviewContract.plan_version,
          verify_script: codingReviewContract.verify_script,
        },
      },
      null,
      2
    )
  );
} finally {
  await app.close();
}