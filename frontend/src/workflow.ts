// Workflow model for the Weave frontend.
//
// Phase ids and decision ids are the real contract values from the Master
// backend (src/contracts/workflow.ts): `workflowStates` and
// `leaderDecisions`. Keeping them identical means wiring this to
// GET /api/projects/:projectId is a data swap, not a translation layer.

export type WorkflowState =
  | 'idle'
  | 'awaiting_plan'
  | 'awaiting_leader_decision'
  | 'on_hold'
  | 'awaiting_coding'
  | 'awaiting_review'
  | 'completed'
  | 'exited';

export type LeaderDecision = 'approve' | 'request_updated_plan' | 'hold' | 'exit';

export type PhaseStatus = 'done' | 'current' | 'upcoming';

export interface Phase {
  id: Exclude<WorkflowState, 'on_hold' | 'exited'>;
  label: string;
  glyph: string;
  crew: string;
  blurb: string;
  at?: string;
}

/** The six pipeline stages, in order. */
export const pipeline: Phase[] = [
  { id: 'idle', label: 'IDEA', glyph: '✦', crew: 'Team', blurb: 'Proposals collect in the shared queue.', at: '10:18 AM' },
  { id: 'awaiting_plan', label: 'PLAN', glyph: '▤', crew: 'Planning Agent', blurb: 'Planning Agent turns requests into a versioned plan.', at: '10:22 AM' },
  { id: 'awaiting_leader_decision', label: 'GATE', glyph: '⬡', crew: 'Leader — human', blurb: 'The one gate a human must clear before any code runs.', at: '10:24 AM' },
  { id: 'awaiting_coding', label: 'CODE', glyph: '⌘', crew: 'Coding Agent', blurb: 'The approved plan becomes an execution contract.' },
  { id: 'awaiting_review', label: 'REVIEW', glyph: '◎', crew: 'Review Agent', blurb: 'Result is validated against the acceptance criteria.' },
  { id: 'completed', label: 'DONE', glyph: '✓', crew: 'Team', blurb: 'Shipped, bound to the plan version that authorized it.' },
];

export const offPipeline: Record<'on_hold' | 'exited', { label: string; blurb: string }> = {
  on_hold: { label: 'ON HOLD', blurb: 'Paused by the leader. Resumes from the phase it held at.' },
  exited: { label: 'EXITED', blurb: 'Closed before delivery.' },
};

export interface DecisionSpec {
  id: LeaderDecision;
  label: string;
  detail: string;
  tone: 'go' | 'warn' | 'hold' | 'stop';
}

/** Mirrors `leaderDecisions` in the backend contract. */
export const decisions: DecisionSpec[] = [
  { id: 'approve', label: 'APPROVE', detail: 'Create execution contract', tone: 'go' },
  { id: 'request_updated_plan', label: 'REQUEST CHANGES', detail: 'Send feedback to Planning', tone: 'warn' },
  { id: 'hold', label: 'HOLD', detail: 'Pause and keep state', tone: 'hold' },
  { id: 'exit', label: 'EXIT', detail: 'Close with reason', tone: 'stop' },
];

export interface Risk { name: string; level?: 'Low' | 'Medium' | 'High'; note?: string }
export interface FeedEvent { at: string; type: string; tag: string; actor: string; detail: string; tone: 'go' | 'warn' | 'hold' | 'stop' | 'info' }
export interface Agent { key: string; name: string; task: string; status: string; tone: 'go' | 'warn' | 'hold' | 'stop' | 'info' }

export interface Brief {
  title: string;
  scope: string[];
  acceptance: string[];
  risks: Risk[];
  steps?: string[];
}

export interface Project {
  name: string;
  tagline: string;
  repo: string;
  leader: string;
  planVersion: number;
  versions: number[];
  state: WorkflowState;
  brief: Brief;
}

export const demoProject: Project = {
  name: 'Weave',
  tagline: 'MULTIPLAYER AI WORKSPACE',
  repo: 'kayceecones/Codex-Hackathon-Winners',
  leader: 'Sarah',
  planVersion: 3,
  versions: [1, 2, 3],
  state: 'awaiting_leader_decision',
  brief: {
    title: 'Frontend-only dark mode',
    scope: [
      'Implement a dark mode theme using CSS variables and a theme toggle.',
      'No backend changes. Persist preference in localStorage.',
    ],
    acceptance: [
      'Toggle to switch between light and dark modes',
      'All primary surfaces use dark theme tokens',
      'Text, icons, and interactive states meet WCAG AA contrast',
      'Preference persists across sessions',
      'No visual regressions in key flows',
    ],
    steps: [
      'Add theme state and persistence',
      'Build light/dark design tokens',
      'Add theme toggle to the workspace',
      'Validate contrast and responsive behaviour',
    ],
    risks: [
      { name: 'THEME REGRESSION', level: 'Medium', note: 'Token mapping may miss edge cases' },
      { name: 'CROSS-BROWSER VARIANCE', level: 'Low', note: 'Test matrix covers modern evergreen browsers' },
      { name: 'SCOPE CREEP', level: 'Medium', note: 'Requests to extend beyond frontend-only' },
      { name: 'ACCESSIBILITY', level: 'Low', note: 'Contrast checks and focus states included' },
    ],
  },
};

export interface Mission { title: string; owner: string; status: string; tone: 'go' | 'warn' | 'hold' | 'info' }

export const demoMissions: Mission[] = [
  { title: 'Add dark mode', owner: 'Maya', status: 'PLANNING', tone: 'info' },
  { title: 'Mobile layout', owner: 'James', status: 'NEW', tone: 'warn' },
  { title: 'Keyboard nav', owner: 'Priya', status: 'QUEUED', tone: 'go' },
];

export const demoAgents: Agent[] = [
  { key: 'B', name: 'BRAINSTORM', task: 'Proposal ready', status: 'IDLE', tone: 'info' },
  { key: 'P', name: 'PLANNING', task: 'Updating plan v3', status: 'ACTIVE', tone: 'go' },
  { key: 'M', name: 'MASTER', task: 'Routing events', status: 'LIVE', tone: 'info' },
  { key: 'C', name: 'CODING', task: 'Waiting for approval', status: 'NEXT', tone: 'hold' },
  { key: 'R', name: 'REVIEW', task: 'Queued', status: 'WAITING', tone: 'warn' },
  { key: 'M', name: 'MEMORY', task: 'Synced with Notion', status: 'SYNCED', tone: 'go' },
];

export const demoFeed: FeedEvent[] = [
  { at: '10:24:31', type: 'awaiting_leader_decision', tag: 'LEADER', actor: 'System', detail: 'Coding locked until a decision is recorded', tone: 'warn' },
  { at: '10:22:17', type: 'plan.submitted', tag: 'PLAN', actor: 'Planning Agent', detail: 'Frontend-only dark mode — v3', tone: 'info' },
  { at: '10:21:04', type: 'validation.complete', tag: 'GUARDRAIL', actor: 'Guardrail Check', detail: 'No policy violations detected', tone: 'go' },
  { at: '10:20:03', type: 'leader.requested', tag: 'LEADER', actor: 'Sarah', detail: 'Requested changes to keyboard navigation scope', tone: 'warn' },
  { at: '10:18:12', type: 'proposal.accepted', tag: 'IDEA', actor: 'Maya', detail: 'Add dark mode accepted into planning', tone: 'go' },
];

export function phaseIndex(state: WorkflowState): number {
  return pipeline.findIndex((p) => p.id === state);
}

export function phaseStatus(phase: Phase, current: WorkflowState): PhaseStatus {
  const here = phaseIndex(current);
  const mine = phaseIndex(phase.id);
  // on_hold / exited sit off the pipeline: nothing reads as reached.
  if (here < 0) return 'upcoming';
  if (mine < here) return 'done';
  if (mine === here) return 'current';
  return 'upcoming';
}
