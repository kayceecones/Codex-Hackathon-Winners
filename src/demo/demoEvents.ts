import type { IncomingWorkflowEvent } from "../contracts/events.js";

export function buildDarkModeDemoEvents(projectId: string): IncomingWorkflowEvent[] {
  return [
    {
      type: "proposal.accepted",
      projectId,
      actor: { name: "Person A", role: "team_member" },
      payload: {
        proposal: {
          title: "Add dark mode",
          summary: "Introduce a frontend-only dark mode with saved user preference.",
          proposer: "Person A",
          rationale: "This is visible in a demo, easy to scope, and proves plan revision control.",
          acceptanceCriteria: [
            "Users can toggle dark mode from the UI.",
            "The selected theme persists across reloads.",
            "No backend schema change is required."
          ],
          risks: ["Theme regressions in existing components"]
        }
      }
    },
    {
      type: "planning.completed",
      projectId,
      actor: { name: "Planning Agent", role: "planning" },
      payload: {
        plan: {
          title: "Plan v2: dark mode across app shell",
          summary: "Add theme tokens, a toggle, and persistence for the selected theme.",
          steps: [
            {
              title: "Create theme state",
              description: "Add a frontend theme provider with light and dark values.",
              owner: "Person 4"
            },
            {
              title: "Persist preference",
              description: "Store the selected theme in browser local storage.",
              owner: "Person 4"
            },
            {
              title: "Validate UI contrast",
              description: "Review important surfaces for readable dark mode contrast.",
              owner: "Person 5"
            }
          ],
          acceptanceCriteria: [
            "Theme toggle is visible in the dashboard.",
            "Theme persists after reload.",
            "No backend code path is changed."
          ],
          risks: ["Some UI surfaces may miss token coverage"]
        }
      }
    },
    {
      type: "leader.requested_changes",
      projectId,
      actor: { name: "Leader", role: "leader" },
      payload: {
        leader: "Leader",
        feedback: "Keep dark mode, but do not change the backend. Scope it to frontend theme tokens and persistence."
      }
    },
    {
      type: "planning.completed",
      projectId,
      actor: { name: "Planning Agent", role: "planning" },
      payload: {
        plan: {
          title: "Plan v3: frontend-only dark mode",
          summary: "Limit implementation to frontend theme tokens, toggle UI, and local persistence.",
          feedbackAddressed: "Removed backend work and narrowed validation to frontend UI surfaces.",
          steps: [
            {
              title: "Add theme tokens",
              description: "Define light and dark variables used by the dashboard.",
              owner: "Person 4"
            },
            {
              title: "Add theme toggle",
              description: "Expose a compact toggle in the dashboard controls.",
              owner: "Person 4"
            },
            {
              title: "Save preference locally",
              description: "Persist the chosen theme in browser local storage.",
              owner: "Person 4"
            },
            {
              title: "Review contrast",
              description: "Check main dashboard states in both themes.",
              owner: "Person 5"
            }
          ],
          acceptanceCriteria: [
            "Dark mode can be toggled without a backend request.",
            "The selected theme persists across reloads.",
            "Review confirms no unreadable dashboard state."
          ],
          risks: ["A component may still use hard-coded colors"]
        }
      }
    },
    {
      type: "leader.approved",
      projectId,
      actor: { name: "Leader", role: "leader" },
      payload: {
        leader: "Leader",
        notes: "Approved as frontend-only scope."
      }
    },
    {
      type: "coding.completed",
      projectId,
      actor: { name: "Coding Agent", role: "coding" },
      payload: {
        execution: {
          status: "completed",
          summary: "Implemented theme tokens, toggle UI, and local storage persistence.",
          filesChanged: ["src/frontend/theme.ts", "src/frontend/Dashboard.tsx"],
          commandsRun: ["npm.cmd run test"]
        }
      }
    },
    {
      type: "review.completed",
      projectId,
      actor: { name: "Review Agent", role: "review" },
      payload: {
        review: {
          classification: "coding_issue",
          summary: "Dark mode works, but one timeline badge has low contrast.",
          issues: [
            {
              title: "Timeline badge contrast",
              detail: "The held-state badge is hard to read in dark mode.",
              severity: "medium"
            }
          ]
        }
      }
    },
    {
      type: "coding.completed",
      projectId,
      actor: { name: "Coding Agent", role: "coding" },
      payload: {
        execution: {
          status: "completed",
          summary: "Adjusted held-state badge token for dark mode contrast.",
          filesChanged: ["src/frontend/theme.ts"],
          commandsRun: ["npm.cmd run test"]
        }
      }
    },
    {
      type: "review.completed",
      projectId,
      actor: { name: "Review Agent", role: "review" },
      payload: {
        review: {
          classification: "pass",
          summary: "Dark mode meets approved acceptance criteria."
        }
      }
    }
  ];
}
