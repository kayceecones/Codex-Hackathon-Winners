# Person 3 Phases — Brainstorm + Planning Agents

## Goal

Own the idea-to-approved-plan workflow:

`idea -> proposal -> member confirmation -> Plan v2 -> leader feedback -> Plan v3`

This TypeScript code is built to run by itself for the demo, while exposing simple contracts that Person 1 can route through events and Person 2 can back with real database/Notion memory.

## Phase 1 — Contracts

- Define event names Person 3 listens for and emits.
- Define the proposal and plan-version shapes.
- Keep event payloads simple enough for backend/frontend teammates to use directly.

## Phase 2 — Memory Boundary

- Add a small memory adapter interface.
- Provide an in-memory demo implementation.
- Make it easy for Person 2 to replace the adapter with database/Notion reads and writes.

## Phase 3 — Brainstorm Agent

- Turn a rough member idea into a structured feature proposal.
- Include impact, risks, alternatives, and acceptance criteria.
- Wait for explicit member confirmation before planning begins.

## Phase 4 — Planning Agent

- Generate a new versioned plan from current project context plus the confirmed proposal.
- Produce a diff-style summary from the prior plan.
- Accept leader feedback and generate the next revised plan version.

## Phase 5 — Demo Workflow

- Run the golden-path demo with one command.
- Show the proposal, Plan v2, leader feedback, and Plan v3.
- Include focused tests for event routing and plan versioning.

## Integration Points

- Person 1 calls `handlePerson3Event(event, services)` from the Master Agent routing layer.
- Person 2 provides a memory adapter with `getProjectContext`, `saveProposal`, `savePlanVersion`, and `recordEvent`.
- Person 4 can call the same workflow functions from the UI.
