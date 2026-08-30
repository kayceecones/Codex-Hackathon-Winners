// Client for the Master backend (src/routes/*).
//
// The API base comes from VITE_API_URL, inlined at build time. When it is
// unset or the server can't be reached the app falls back to the bundled
// demo fixtures so a presentation never lands on a blank screen — the UI
// shows which mode it is in rather than pretending.

import {
  scenarios,
  demoAgents,
  demoFeed,
  demoMissions,
  demoProject,
  type Agent,
  type FeedEvent,
  type Mission,
  type Project,
  type Risk,
  type Scenario,
  type WorkflowState,
} from '../workflow';

const BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? '').replace(/\/$/, '');
const KEY = 'weave.projectId';
const LIST = 'weave.projects';
const SEP = ' :: ';

const readLocal = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeLocal = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export type Mode = 'connecting' | 'live' | 'demo';

/* ── Backend shapes (subset of src/contracts/workflow.ts) ─────────────── */

interface ApiPlan {
  id: string;
  version: number;
  title: string;
  summary: string;
  steps: { id: string; title: string; description: string }[];
  acceptanceCriteria: string[];
  risks: string[];
}

interface ApiSnapshot {
  project: { id: string; name: string; description?: string; leader?: string; status: WorkflowState };
  proposals: { id: string; title: string; summary: string; proposer: string }[];
  plans: ApiPlan[];
  approvals: { decision: string; leader: string; createdAt: string }[];
  events: {
    id: string;
    type: string;
    actor?: { name: string };
    occurredAt: string;
    fromState: WorkflowState;
    toState: WorkflowState;
    message: string;
  }[];
}

/** Everything the UI renders, whether it came from the API or the fixtures. */
export interface PlanView {
  version: number;
  title: string;
  summary: string;
  steps: string[];
  acceptance: string[];
  risks: Risk[];
}

export interface QueueItem {
  projectId: string;
  title: string;
  owner: string;
  state: WorkflowState;
}

export interface View {
  mode: Mode;
  /** Why we fell back, when mode is 'demo'. */
  reason?: string;
  projectId: string | null;
  project: Project;
  missions: Mission[];
  agents: Agent[];
  feed: FeedEvent[];
  /** Every version of this project's plan, oldest first. */
  plans: PlanView[];
  /** All seeded projects, so the queue can switch between them. */
  queue: QueueItem[];
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const event = (projectId: string, type: string, payload: unknown, actor?: { name: string; role?: string }) =>
  call<{ snapshot: ApiSnapshot }>('/api/events', {
    method: 'POST',
    body: JSON.stringify({ type, projectId, payload, ...(actor ? { actor } : {}) }),
  });

/* ── Mapping ──────────────────────────────────────────────────────────── */

const TONE: Record<string, FeedEvent['tone']> = {
  'proposal.accepted': 'go',
  'planning.completed': 'info',
  'leader.approved': 'go',
  'leader.requested_changes': 'warn',
  'leader.held': 'hold',
  'leader.exited': 'stop',
  'workflow.resumed': 'info',
  'coding.completed': 'go',
  'review.completed': 'go',
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * PlanVersionInput.risks is string[], so grading is encoded into the string
 * on the way out and parsed back here. A risk written by anything else still
 * renders — it just arrives with no level or note.
 */
export const encodeRisk = (r: Risk): string =>
  [r.name, r.level ?? '', r.note ?? ''].join(SEP).replace(/(\s::\s)+$/, '');

const decodeRisk = (raw: string): Risk => {
  const [name, level, note] = raw.split(SEP);
  return {
    name: (name ?? raw).trim(),
    level: (['Low', 'Medium', 'High'] as const).find((l) => l === level?.trim()),
    note: note?.trim() || undefined,
  };
};

const toRisks = (plan?: ApiPlan): Risk[] => (plan?.risks ?? []).map(decodeRisk);

/** Which agent the current state implies is working. */
function agentsFor(state: WorkflowState): Agent[] {
  const active: Partial<Record<WorkflowState, string>> = {
    awaiting_plan: 'PLANNING',
    awaiting_coding: 'CODING',
    awaiting_review: 'REVIEW',
  };
  const live = active[state];
  return demoAgents.map((a) => {
    if (a.name === 'MASTER') return { ...a, task: `Routing · ${state}`, status: 'LIVE', tone: 'info' };
    if (a.name === live) return { ...a, task: 'Working', status: 'ACTIVE', tone: 'go' };
    if (state === 'awaiting_leader_decision' && a.name === 'CODING')
      return { ...a, task: 'Blocked on leader decision', status: 'LOCKED', tone: 'hold' };
    return { ...a, task: 'Standing by', status: 'IDLE', tone: 'info' };
  });
}

function toPlanViews(snap: ApiSnapshot): PlanView[] {
  return snap.plans.map((p) => ({
    version: p.version,
    title: p.title,
    summary: p.summary,
    steps: p.steps?.map((x) => x.title) ?? [],
    acceptance: p.acceptanceCriteria ?? [],
    risks: (p.risks ?? []).map(decodeRisk),
  }));
}

function toView(snap: ApiSnapshot, queue: QueueItem[] = []): View {
  const plan = snap.plans[snap.plans.length - 1];
  const proposal = snap.proposals[snap.proposals.length - 1];

  return {
    mode: 'live',
    projectId: snap.project.id,
    plans: toPlanViews(snap),
    queue,
    project: {
      ...demoProject,
      name: snap.project.name,
      leader: snap.project.leader ?? demoProject.leader,
      state: snap.project.status,
      planVersion: plan?.version ?? 1,
      versions: snap.plans.map((p) => p.version),
      brief: {
        title: plan?.title ?? proposal?.title ?? demoProject.brief.title,
        scope: [plan?.summary ?? proposal?.summary ?? ''].filter(Boolean),
        acceptance: plan?.acceptanceCriteria ?? [],
        risks: toRisks(plan),
        steps: plan?.steps?.map((x) => x.title) ?? [],
      },
    },
    missions: snap.proposals.map((p) => ({
      title: p.title,
      owner: p.proposer,
      status: snap.project.status === 'idle' ? 'NEW' : 'IN PLAN',
      tone: 'info' as const,
    })),
    agents: agentsFor(snap.project.status),
    feed: [...snap.events].reverse().map((e) => ({
      at: clock(e.occurredAt),
      type: e.type,
      tag: e.toState.toUpperCase(),
      actor: e.actor?.name ?? 'System',
      detail: e.message,
      tone: TONE[e.type] ?? 'info',
    })),
  };
}

export const demoView: View = {
  mode: 'demo',
  reason: '',
  projectId: null,
  project: demoProject,
  missions: demoMissions,
  agents: demoAgents,
  feed: demoFeed,
  plans: [],
  queue: [],
};

/* ── Seeding ──────────────────────────────────────────────────────────── */

const planPayload = (sc: Scenario) => ({
  plan: {
    title: sc.title,
    summary: sc.summary,
    steps: sc.acceptance.slice(0, 3).map((t) => ({ title: t, description: t })),
    acceptanceCriteria: sc.acceptance,
    risks: sc.risks.map(encodeRisk),
  },
});

/**
 * Drive one project to its scenario's target state using the same events the
 * agents would send. The order mirrors the state machine, so an unreachable
 * target fails loudly here rather than silently leaving the project behind.
 */
async function drive(id: string, sc: Scenario): Promise<ApiSnapshot | null> {
  let snap: ApiSnapshot | null = null;
  const send = async (type: string, payload: unknown, actor?: { name: string; role?: string }) => {
    snap = (await event(id, type, payload, actor)).snapshot;
  };

  if (sc.target === 'idle') return null;

  await send(
    'proposal.accepted',
    {
      proposal: {
        title: sc.title,
        summary: sc.summary,
        proposer: sc.owner,
        acceptanceCriteria: sc.acceptance,
        risks: sc.risks.map(encodeRisk),
      },
    },
    { name: sc.owner, role: 'Product' }
  );
  if (sc.target === 'awaiting_plan') return snap;

  await send('planning.completed', planPayload(sc), { name: 'Planning Agent', role: 'agent' });

  // Each revision is a real send-back round, so the plan gains a version the
  // leader can actually page through rather than a fabricated history.
  for (let i = 0; i < (sc.revisions ?? 0); i += 1) {
    await send(
      'leader.requested_changes',
      { leader: demoProject.leader, feedback: sc.feedback ?? 'Please revise.' },
      { name: demoProject.leader, role: 'Leader' }
    );
    await send('planning.completed', planPayload(sc), { name: 'Planning Agent', role: 'agent' });
  }

  if (sc.target === 'awaiting_leader_decision') return snap;

  const leader = { name: demoProject.leader, role: 'Leader' };
  if (sc.target === 'on_hold') {
    await send('leader.held', { leader: demoProject.leader, reason: sc.feedback ?? 'Paused.' }, leader);
    return snap;
  }
  if (sc.target === 'exited') {
    await send('leader.exited', { leader: demoProject.leader, reason: sc.feedback ?? 'Closed.' }, leader);
    return snap;
  }

  await send('leader.approved', { leader: demoProject.leader, notes: 'Approved for execution.' }, leader);
  if (sc.target === 'awaiting_coding') return snap;

  await send(
    'coding.completed',
    { execution: { status: 'completed', summary: 'Implementation complete.', filesChanged: ['frontend/src/theme.css'] } },
    { name: 'Coding Agent', role: 'agent' }
  );
  if (sc.target === 'awaiting_review') return snap;

  await send('review.completed', { review: { classification: 'pass', summary: 'Acceptance criteria met.' } }, {
    name: 'Review Agent',
    role: 'agent',
  });
  return snap;
}

/** Create every scenario as a real project. Returns the queue and the primary. */
async function seedAll(): Promise<{ queue: QueueItem[]; primary: ApiSnapshot }> {
  const queue: QueueItem[] = [];
  let primary: ApiSnapshot | null = null;

  for (const sc of scenarios) {
    const created = await call<{ snapshot: ApiSnapshot }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: sc.title, description: sc.summary, leader: demoProject.leader }),
    });
    const id = created.snapshot.project.id;

    let snap = created.snapshot;
    try {
      const driven = await drive(id, sc);
      if (driven) snap = driven;
    } catch {
      // One scenario failing must not cost the whole queue.
    }

    queue.push({ projectId: id, title: sc.title, owner: sc.owner, state: snap.project.status });
    // The first scenario is the one the workspace opens on.
    if (!primary) primary = snap;
  }

  if (!primary) throw new Error('Could not seed any project.');
  writeLocal(LIST, JSON.stringify(queue));
  writeLocal(KEY, queue[0].projectId);
  return { queue, primary };
}

function savedQueue(): QueueItem[] {
  try {
    const raw = readLocal(LIST);
    const parsed = raw ? (JSON.parse(raw) as QueueItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function load(): Promise<View> {
  if (!BASE) return demoView;
  try {
    // A sleeping free-tier service can take ~50s to wake. Spend that wait
    // on the cheapest endpoint, so the calls that follow are quick.
    await call('/health', undefined, 60000);

    const saved = readLocal(KEY);
    const queue = savedQueue();

    if (saved && queue.length) {
      try {
        const got = await call<{ snapshot: ApiSnapshot }>(`/api/projects/${saved}`);
        // Refresh each queued project's state so the list is not stale.
        const states = await Promise.all(
          queue.map((q) =>
            call<{ snapshot: ApiSnapshot }>(`/api/projects/${q.projectId}`)
              .then((r) => ({ ...q, state: r.snapshot.project.status }))
              .catch(() => null)
          )
        );
        const live = states.filter((q): q is QueueItem => q !== null);
        if (live.length) {
          writeLocal(LIST, JSON.stringify(live));
          return toView(got.snapshot, live);
        }
      } catch {
        // The project can vanish for several reasons — the store is
        // in-memory and restarts, or a deploy swaps the store entirely.
        // Whatever the cause, re-seed rather than call a reachable
        // server unreachable.
      }
    }

    const { queue: fresh, primary } = await seedAll();
    return toView(primary, fresh);
  } catch (e) {
    // Say what actually happened. "Unreachable" is misleading when the
    // server answered with an error.
    const status = (e as { status?: number }).status;
    return {
      ...demoView,
      reason: status
        ? `Backend returned HTTP ${status}.`
        : `Backend unreachable (${(e as Error).message}).`,
    };
  }
}

/** Switch the workspace to another project in the queue. */
export async function open(projectId: string): Promise<View> {
  const got = await call<{ snapshot: ApiSnapshot }>(`/api/projects/${projectId}`);
  writeLocal(KEY, projectId);
  const queue = savedQueue().map((q) =>
    q.projectId === projectId ? { ...q, state: got.snapshot.project.status } : q
  );
  return toView(got.snapshot, queue);
}

export async function refresh(projectId: string): Promise<View> {
  const got = await call<{ snapshot: ApiSnapshot }>(`/api/projects/${projectId}`);
  const queue = savedQueue().map((q) =>
    q.projectId === projectId ? { ...q, state: got.snapshot.project.status } : q
  );
  return toView(got.snapshot, queue);
}

/** Re-render with the queue row for this project brought up to date. */
function withQueue(projectId: string, snap: ApiSnapshot): View {
  const queue = savedQueue().map((q) =>
    q.projectId === projectId ? { ...q, state: snap.project.status } : q
  );
  writeLocal(LIST, JSON.stringify(queue));
  return toView(snap, queue);
}

/* ── Commands ─────────────────────────────────────────────────────────── */

const EVENT_FOR = {
  approve: 'leader.approved',
  request_updated_plan: 'leader.requested_changes',
  hold: 'leader.held',
  exit: 'leader.exited',
} as const;

export async function decide(
  projectId: string,
  decision: keyof typeof EVENT_FOR,
  leader: string,
  text: string
): Promise<View> {
  const payload =
    decision === 'approve'
      ? { leader, notes: text || undefined }
      : decision === 'request_updated_plan'
        ? { leader, feedback: text || 'Please revise the plan.' }
        : { leader, reason: text || (decision === 'hold' ? 'Paused by leader.' : 'Closed by leader.') };

  const res = await event(projectId, EVENT_FOR[decision], payload, { name: leader, role: 'Leader' });
  return withQueue(projectId, res.snapshot);
}

export async function resume(projectId: string, note = 'Resumed by leader.'): Promise<View> {
  const res = await event(projectId, 'workflow.resumed', { note });
  return withQueue(projectId, res.snapshot);
}

/**
 * After an approval the Planning Agent is out of the loop and the next real
 * move is the Coding Agent reporting in. The demo drives that by hand.
 */
export async function completeCoding(projectId: string): Promise<View> {
  const res = await event(
    projectId,
    'coding.completed',
    { execution: { status: 'completed', summary: 'Implementation complete.', filesChanged: ['frontend/src/theme.css'] } },
    { name: 'Coding Agent', role: 'agent' }
  );
  return withQueue(projectId, res.snapshot);
}

export async function completeReview(projectId: string): Promise<View> {
  const res = await event(
    projectId,
    'review.completed',
    { review: { classification: 'pass', summary: 'Acceptance criteria met.' } },
    { name: 'Review Agent', role: 'agent' }
  );
  return toView(res.snapshot);
}

/* ── Notion project memory (read-only) ────────────────────────────────── */

export interface MemoryEvent { projectId: string; type: string; summary: string; at?: string }
export interface MemoryPlan { projectId: string; version: number; status: string; diffSummary: string; content: string }
export interface MemoryProject { projectId: string; events: number; latestType: string; latestAt?: string }

export type MemoryStatus =
  | { state: 'off' }                                    // no API base configured
  | { state: 'unconfigured'; message: string }          // server reachable, Notion creds absent
  | { state: 'error'; message: string }
  | { state: 'ready'; projects: MemoryProject[] };

/**
 * The workspace's durable history. The backend owns the Notion credentials —
 * a static page can neither hold a token nor call Notion cross-origin.
 */
export async function memoryProjects(): Promise<MemoryStatus> {
  if (!BASE) return { state: 'off' };
  try {
    const { projects } = await call<{ projects: MemoryProject[] }>('/api/memory/projects');
    return { state: 'ready', projects };
  } catch (e) {
    const status = (e as { status?: number }).status;
    // 404 = backend predates the memory routes; same user-facing meaning.
    if (status === 503 || status === 404) {
      return {
        state: 'unconfigured',
        message: 'Set NOTION_TOKEN and NOTION_TIMELINE_DB_ID on the backend service to read project memory.',
      };
    }
    return { state: 'error', message: (e as Error).message };
  }
}

export async function memoryFor(projectId: string): Promise<{ events: MemoryEvent[]; plans: MemoryPlan[] }> {
  return call<{ events: MemoryEvent[]; plans: MemoryPlan[] }>(`/api/memory/projects/${encodeURIComponent(projectId)}`);
}
