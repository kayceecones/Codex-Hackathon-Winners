// Mission model for the journey map.
//
// The phase ids below are the real workflow states from the Master backend
// (src/contracts/workflow.ts), so the map reflects the system that actually
// runs rather than a parallel invention. When the frontend is wired to
// GET /api/projects/:projectId, `project.status` drops straight into
// `currentState` and the map becomes live.

export type WorkflowState =
  | 'idle'
  | 'awaiting_plan'
  | 'awaiting_leader_decision'
  | 'on_hold'
  | 'awaiting_coding'
  | 'awaiting_review'
  | 'completed'
  | 'exited';

export type PhaseStatus = 'done' | 'current' | 'upcoming';

export interface Phase {
  id: Exclude<WorkflowState, 'on_hold' | 'exited'>;
  code: string;
  label: string;
  callsign: string;
  crew: string;
  blurb: string;
  at?: string;
}

/** The six on-route waypoints, in flight order. */
export const route: Phase[] = [
  {
    id: 'idle',
    code: '01',
    label: 'Proposal',
    callsign: 'LAUNCH PAD',
    crew: 'Team',
    blurb: 'Anyone on the team proposes a change. Requests collect in the shared queue.',
    at: '2:38 PM',
  },
  {
    id: 'awaiting_plan',
    code: '02',
    label: 'Planning',
    callsign: 'NAV PLOTTING',
    crew: 'Planning Agent',
    blurb: 'Planning Agent synthesizes the requests into a versioned plan.',
    at: '2:41 PM',
  },
  {
    id: 'awaiting_leader_decision',
    code: '03',
    label: 'Leader Review',
    callsign: 'COMMAND GATE',
    crew: 'Leader — human',
    blurb: 'The one gate a human must clear. Approve, or send back for a new version.',
    at: '2:47 PM',
  },
  {
    id: 'awaiting_coding',
    code: '04',
    label: 'Execution',
    callsign: 'ENGINE BURN',
    crew: 'Coding Agent',
    blurb: 'The approved plan becomes an execution contract and the Coding Agent runs it.',
  },
  {
    id: 'awaiting_review',
    code: '05',
    label: 'Review',
    callsign: 'DIAGNOSTICS',
    crew: 'Review Agent',
    blurb: 'Review Agent validates the result against the plan’s acceptance criteria.',
  },
  {
    id: 'completed',
    code: '06',
    label: 'Delivered',
    callsign: 'TOUCHDOWN',
    crew: 'Team',
    blurb: 'Change is shipped and bound to the plan version that authorized it.',
  },
];

/** States that sit off the main trajectory. */
export const offRoute: Record<'on_hold' | 'exited', { label: string; callsign: string; blurb: string }> = {
  on_hold: {
    label: 'On Hold',
    callsign: 'HOLDING ORBIT',
    blurb: 'Mission paused by the leader. Resumes from the phase it held at.',
  },
  exited: {
    label: 'Exited',
    callsign: 'MISSION ABORT',
    blurb: 'Mission closed before delivery.',
  },
};

export interface Crew {
  name: string;
  initials: string;
  role: string;
  /** Which route phase this person is currently attached to. */
  station: Phase['id'];
}

export interface Mission {
  project: string;
  codename: string;
  objective: string;
  repo: string;
  leader: string;
  planVersion: number;
  startedAt: string;
  currentState: WorkflowState;
  crew: Crew[];
}

export const mission: Mission = {
  project: 'Weave',
  codename: 'WEAVE-01',
  objective: 'Frontend-only dark mode with persisted preference, without backend changes.',
  repo: 'kayceecones/Codex-Hackathon-Winners',
  leader: 'Sarah',
  planVersion: 5,
  startedAt: '2:38 PM',
  currentState: 'awaiting_leader_decision',
  crew: [
    { name: 'Maya', initials: 'M', role: 'Product', station: 'idle' },
    { name: 'James', initials: 'J', role: 'Engineering', station: 'awaiting_plan' },
    { name: 'Sarah', initials: 'S', role: 'Lead', station: 'awaiting_leader_decision' },
  ],
};

/** Index of `state` on the route, or -1 when it sits off-route. */
export function routeIndex(state: WorkflowState): number {
  return route.findIndex((p) => p.id === state);
}

export function phaseStatus(phase: Phase, current: WorkflowState): PhaseStatus {
  const here = routeIndex(current);
  const mine = routeIndex(phase.id);
  // Off-route states (on_hold / exited) leave every phase unvisited rather
  // than silently marking the whole route done.
  if (here < 0) return 'upcoming';
  if (mine < here) return 'done';
  if (mine === here) return 'current';
  return 'upcoming';
}

/** Fraction of the trajectory travelled, 0..1. */
export function missionProgress(current: WorkflowState): number {
  const here = routeIndex(current);
  if (here < 0) return 0;
  return here / (route.length - 1);
}
