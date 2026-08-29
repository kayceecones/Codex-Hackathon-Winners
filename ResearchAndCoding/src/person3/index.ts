export { Person3Event, Person3OutputEvent, createEvent } from "./contracts.ts";
export type { Person3EventEnvelope } from "./contracts.ts";
export { DemoMemoryStore } from "./memoryStore.ts";
export { draftProposal, confirmProposal } from "./brainstormAgent.ts";
export { createPlanVersion } from "./planningAgent.ts";
export { handlePerson3Event } from "./workflow.ts";
export type {
  FeatureProposal,
  LeaderFeedbackPayload,
  MemoryStore,
  Member,
  Person3Services,
  Person3WorkflowResult,
  PlanVersion,
  ProjectContext,
} from "./types.ts";
export { submitPerson3OutputToMaster } from "./masterClient.ts";
export type { MasterBridgeResponse, MasterClientOptions } from "./masterClient.ts";
