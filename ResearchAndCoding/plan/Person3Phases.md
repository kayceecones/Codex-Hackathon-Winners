# Person 3 Phases — Brainstorm + Planning Agents

## Goal

Own the idea-to-approved-plan workflow:

`idea -> proposal -> member confirmation -> Plan v2 -> leader feedback -> Plan v3`

This TypeScript code can be validated independently, but it is designed to plug into the single integrated project flow through Person 1 events and Person 2 memory adapters.

## Phase 1 — Contracts

- Define event names Person 3 listens for and emits.
- Define the proposal and plan-version shapes.
- Keep event payloads simple enough for backend/frontend teammates to use directly.

## Phase 2 — Memory Boundary

- Add a small memory adapter interface.
- Provide an in-memory local implementation.
- Make it easy for Person 2 to replace the adapter with database/Notion reads and writes.

## Phase 3 — Brainstorm Agent

- Turn a rough member idea into a structured feature proposal.
- Include impact, risks, alternatives, and acceptance criteria.
- Wait for explicit member confirmation before planning begins.

## Phase 4 — Planning Agent

- Generate a new versioned plan from current project context plus the confirmed proposal.
- Produce a diff-style summary from the prior plan.
- Accept leader feedback and generate the next revised plan version.

## Phase 5 — Integrated Workflow Check

- Run the golden-path workflow check with one command.
- Show the proposal, Plan v2, leader feedback, and Plan v3.
- Include focused tests for event routing and plan versioning.

## Integration Points

- Person 1 consumes Person 3 output through `POST /api/integrations/person3/events` or canonical `POST /api/events`.
- Person 2 provides a memory adapter with `getProjectContext`, `saveProposal`, `savePlanVersion`, and `recordEvent`.
- Person 4 should read normalized workflow state from the Master API, not call Person 3 package internals directly.
