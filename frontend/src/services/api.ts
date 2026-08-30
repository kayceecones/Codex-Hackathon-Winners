// Client for the Master backend (src/routes/*).
//
// The API base comes from VITE_API_URL, inlined at build time. When it is
// unset or the server can't be reached the app falls back to the bundled
// demo fixtures so a presentation never lands on a blank screen — the UI
// shows which mode it is in rather than pretending.

import {
  demoAgents,
  demoFeed,
  demoMissions,
  demoProject,
  type Agent,
  type FeedEvent,
  type Mission,
  type Project,
  type Risk,
  type WorkflowState,
} from '../workflow';

const BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? '').replace(/\/$/, '');
const KEY = 'weave.projectId';

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
export interface View {
  mode: Mode;
  /** Why we fell back, when mode is 'demo'. */
  reason?: string;
  projectId: string | null;
  project: Project;
  missions: Mission[];
  agents: Agent[];
  feed: FeedEvent[];
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

/** Backend plan risks are plain strings; the fixtures carry graded rows. */
const toRisks = (plan?: ApiPlan): Risk[] => (plan?.risks ?? []).map((r) => ({ name: r }));

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

function toView(snap: ApiSnapshot): View {
  const plan = snap.plans[snap.plans.length - 1];
  const proposal = snap.proposals[snap.proposals.length - 1];

  return {
    mode: 'live',
    projectId: snap.project.id,
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
        acceptance: plan?.acceptanceCriteria?.length ? plan.acceptanceCriteria : [],
        risks: toRisks(plan),
        steps: plan?.steps?.map((s) => s.title) ?? [],
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
};

/* ── Bootstrap ────────────────────────────────────────────────────────── */

/** Seed a fresh project up to the leader gate — the state worth demoing. */
async function seed(): Promise<ApiSnapshot> {
  const created = await call<{ snapshot: ApiSnapshot }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name: 'Weave', description: demoProject.tagline, leader: demoProject.leader }),
  });
  const id = created.snapshot.project.id;
  const b = demoProject.brief;

  await event(
    id,
    'proposal.accepted',
    {
      proposal: {
        title: b.title,
        summary: b.scope.join(' '),
        proposer: 'Maya',
        acceptanceCriteria: b.acceptance,
        risks: b.risks.map((r) => r.name),
      },
    },
    { name: 'Maya', role: 'Product' }
  );

  const planned = await event(
    id,
    'planning.completed',
    {
      plan: {
        title: b.title,
        summary: b.scope.join(' '),
        steps: (b.steps ?? []).map((t) => ({ title: t, description: t })),
        acceptanceCriteria: b.acceptance,
        risks: b.risks.map((r) => r.name),
      },
    },
    { name: 'Planning Agent', role: 'agent' }
  );

  localStorage.setItem(KEY, id);
  return planned.snapshot;
}

export async function load(): Promise<View> {
  if (!BASE) return demoView;
  try {
    // A sleeping free-tier service can take ~50s to wake. Spend that wait
    // on the cheapest endpoint, so the calls that follow are quick.
    await call('/health', undefined, 60000);

    const saved = (() => {
      try {
        return localStorage.getItem(KEY);
      } catch {
        return null;
      }
    })();

    if (saved) {
      try {
        const got = await call<{ snapshot: ApiSnapshot }>(`/api/projects/${saved}`);
        return toView(got.snapshot);
      } catch {
        // The project can vanish for several reasons — the store is
        // in-memory and restarts, or a deploy swaps the store entirely.
        // Whatever the cause, the answer is the same: start a fresh one
        // rather than treating a reachable server as unreachable.
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* private mode */
        }
      }
    }
    return toView(await seed());
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

export async function refresh(projectId: string): Promise<View> {
  const got = await call<{ snapshot: ApiSnapshot }>(`/api/projects/${projectId}`);
  return toView(got.snapshot);
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
  return toView(res.snapshot);
}

export async function resume(projectId: string, note = 'Resumed by leader.'): Promise<View> {
  const res = await event(projectId, 'workflow.resumed', { note });
  return toView(res.snapshot);
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
  return toView(res.snapshot);
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
