import { Person3Event, Person3OutputEvent, createEvent, requireFields } from "./contracts.ts";
import { draftProposal, confirmProposal } from "./brainstormAgent.ts";
import { createPlanVersion } from "./planningAgent.ts";
import type { Person3EventEnvelope } from "./contracts.ts";
import type {
  FeatureProposal,
  IdeaSubmittedPayload,
  LeaderFeedbackPayload,
  Person3Services,
  Person3WorkflowResult,
  ProposalConfirmedPayload,
} from "./types.ts";

export async function handlePerson3Event(
  event: Person3EventEnvelope,
  services: Person3Services
): Promise<Person3WorkflowResult> {
  requireFields(event, ["type", "payload"], "event");
  requireFields(services, ["memory"], "services");

  await services.memory.recordEvent(event);

  if (event.type === Person3Event.IDEA_SUBMITTED) {
    return handleIdeaSubmitted(event.payload as IdeaSubmittedPayload, services);
  }

  if (event.type === Person3Event.PROPOSAL_CONFIRMED) {
    return handleProposalConfirmed(event.payload as ProposalConfirmedPayload, services);
  }

  if (event.type === Person3Event.LEADER_FEEDBACK_RECEIVED) {
    return handleLeaderFeedback(event.payload as LeaderFeedbackPayload, services);
  }

  throw new Error(`unsupported Person 3 event type: ${event.type}`);
}

async function handleIdeaSubmitted(
  payload: IdeaSubmittedPayload,
  services: Person3Services
): Promise<Person3WorkflowResult> {
  requireFields(payload, ["projectId", "ideaText", "member"], "idea submitted payload");

  const projectContext = await services.memory.getProjectContext(payload.projectId);
  const proposal = draftProposal({
    projectContext,
    idea: {
      projectId: payload.projectId,
      text: payload.ideaText,
    },
    member: payload.member,
  });

  await services.memory.saveProposal(proposal);

  const emittedEvent = createEvent(Person3OutputEvent.PROPOSAL_READY, {
    projectId: payload.projectId,
    proposalId: proposal.id,
    proposal,
  });

  await services.memory.recordEvent(emittedEvent);

  return {
    proposal,
    emittedEvent,
  };
}

async function handleProposalConfirmed(
  payload: ProposalConfirmedPayload,
  services: Person3Services
): Promise<Person3WorkflowResult> {
  requireFields(payload, ["projectId", "proposalId", "member"], "proposal confirmed payload");

  const proposal = await loadProposal(services, payload.proposalId);
  const confirmedProposal = confirmProposal(proposal, payload.member);
  await services.memory.saveProposal(confirmedProposal);

  const projectContext = await services.memory.getProjectContext(payload.projectId);
  const planVersion = createPlanVersion({
    projectContext,
    proposal: confirmedProposal,
  });

  await services.memory.savePlanVersion(planVersion);

  const emittedEvent = createEvent(Person3OutputEvent.PLAN_VERSION_READY, {
    projectId: payload.projectId,
    proposalId: confirmedProposal.id,
    planVersionId: planVersion.id,
    planVersion,
  });

  await services.memory.recordEvent(emittedEvent);

  return {
    proposal: confirmedProposal,
    planVersion,
    emittedEvent,
  };
}

async function handleLeaderFeedback(
  payload: LeaderFeedbackPayload,
  services: Person3Services
): Promise<Person3WorkflowResult> {
  requireFields(payload, ["projectId", "proposalId", "feedback"], "leader feedback payload");

  const proposal = await loadProposal(services, payload.proposalId);
  const projectContext = await services.memory.getProjectContext(payload.projectId);
  const planVersion = createPlanVersion({
    projectContext,
    proposal,
    leaderFeedback: payload.feedback,
  });

  await services.memory.savePlanVersion(planVersion);

  const emittedEvent = createEvent(Person3OutputEvent.PLAN_VERSION_READY, {
    projectId: payload.projectId,
    proposalId: proposal.id,
    planVersionId: planVersion.id,
    leaderFeedback: payload.feedback,
    planVersion,
  });

  await services.memory.recordEvent(emittedEvent);

  return {
    planVersion,
    emittedEvent,
  };
}

async function loadProposal(services: Person3Services, proposalId: string): Promise<FeatureProposal> {
  const proposal = await services.memory.getProposal(proposalId);

  if (!proposal) {
    throw new Error(`proposal not found: ${proposalId}`);
  }

  return proposal;
}
