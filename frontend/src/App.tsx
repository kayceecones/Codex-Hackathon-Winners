import { useEffect, useState } from 'react';
import { Check, ChevronRight, Lock, MessageSquare, Pause, Target, X } from 'lucide-react';
import * as api from './services/api';
import type { View } from './services/api';
import ObjectiveTracker from './components/ObjectiveTracker';
import EventFeed from './components/EventFeed';
import Panel from './components/Panel';
import {
  decisions,
  offPipeline,
  phaseIndex,
  phaseStatus,
  pipeline,
  type Agent,
  type FeedEvent,
  type LeaderDecision,
  type Mission,
  type Phase,
  type Project,
  type WorkflowState,
} from './workflow';

const tabs = ['OVERVIEW', 'BRIEF', 'PLAN', 'LEADER', 'EXECUTION', 'AUDIT'] as const;
type Tab = (typeof tabs)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [view, setView] = useState<View>(api.demoView);
  const [mode, setMode] = useState<api.Mode>('connecting');
  const [feedback, setFeedback] = useState('');
  const [picked, setPicked] = useState<Phase['id'] | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const [attempt, setAttempt] = useState(0);
  const [failures, setFailures] = useState(0);

  useEffect(() => {
    let live = true;
    setMode('connecting');
    api.load().then((v) => {
      if (!live) return;
      setView(v);
      setMode(v.mode);
      setFailures(0);
      setNote(
        v.mode === 'live'
          ? 'Connected to the Master backend. Decisions are recorded server-side.'
          : `${v.reason || 'Backend unavailable.'} Running on bundled demo data.`
      );
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  // Weave is multiplayer: refresh so one person's decision reaches the others.
  useEffect(() => {
    if (mode !== 'live' || !view.projectId) return;
    const id = view.projectId;
    const timer = setInterval(() => {
      if (busy) return;
      api
        .refresh(id)
        .then((v) => {
          setView(v);
          setFailures(0);
        })
        .catch(() => {
          // A teammate's deploy can restart the server mid-session. Tolerate
          // a blip, but don't sit on a permanently broken connection.
          setFailures((n) => {
            if (n + 1 >= 3) setAttempt((a) => a + 1);
            return n + 1;
          });
        });
    }, 10000);
    return () => clearInterval(timer);
  }, [mode, view.projectId, busy]);

  const { project, missions, agents, feed } = view;
  const state = project.state;
  const version = project.planVersion;

  /** Send a decision to the backend, or move local state in demo mode. */
  async function run(fn: (id: string) => Promise<View>, offline: () => void, msg: string) {
    setNote('');
    if (mode !== 'live' || !view.projectId) {
      offline();
      setNote(`${msg} (demo mode — not persisted)`);
      return;
    }
    setBusy(true);
    try {
      const next = await fn(view.projectId);
      setView(next);
      setNote(msg);
    } catch (e) {
      setNote(`Backend rejected the change: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setFeedback('');
    }
  }

  function decide(id: LeaderDecision) {
    const copy: Record<LeaderDecision, string> = {
      approve: 'Plan approved. Execution contract created.',
      request_updated_plan: 'Feedback sent to Planning for a new version.',
      hold: 'Mission held. State preserved for resume.',
      exit: 'Mission closed.',
    };
    if (id === 'approve') setTab('EXECUTION');
    if (id === 'request_updated_plan') setTab('PLAN');
    run(
      (pid) => api.decide(pid, id, project.leader, feedback),
      () =>
        setView((v) => ({
          ...v,
          project: {
            ...v.project,
            state:
              id === 'approve'
                ? 'awaiting_coding'
                : id === 'request_updated_plan'
                  ? 'awaiting_plan'
                  : id === 'hold'
                    ? 'on_hold'
                    : 'exited',
          },
        })),
      copy[id]
    );
  }

  /** Open another seeded project from the queue. */
  async function openProject(projectId: string) {
    if (mode !== 'live' || projectId === view.projectId) return;
    setBusy(true);
    try {
      setView(await api.open(projectId));
      setNote('');
    } catch (e) {
      setNote(`Could not open that project: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const resume = () =>
    run(
      (pid) => api.resume(pid),
      () => setView((v) => ({ ...v, project: { ...v.project, state: 'awaiting_leader_decision' } })),
      'Mission resumed.'
    );

  const off = state === 'on_hold' || state === 'exited';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <div>
            WEAVE
            <small>{project.tagline}</small>
          </div>
        </div>

        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              <span>{t}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <span className={`live-chip ${mode === 'live' ? '' : 'is-demo'}`}>
            <i /> {mode === 'live' ? 'LIVE' : mode === 'connecting' ? 'CONNECTING' : 'DEMO'}
          </span>
          <span className="chip tone-info">PLAN V{version}</span>
          <div className="role-badge">
            <Target size={17} color="#a855f7" />
            <div>
              <strong>{project.leader.toUpperCase()}</strong>
              <span>TEAM LEADER</span>
            </div>
          </div>
        </div>
      </header>

      <main className="stage">
        {note && (
          <div className="toast">
            {note}
            {mode === 'demo' && (
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setAttempt((a) => a + 1)}>
                Retry
              </button>
            )}
            <button onClick={() => setNote('')} aria-label="Dismiss" style={mode === 'demo' ? { marginLeft: 12 } : undefined}>
              <X size={14} />
            </button>
          </div>
        )}

        {off && (
          <div className="toast" style={{ borderColor: 'rgba(245,158,11,.4)', background: 'rgba(245,158,11,.08)' }}>
            <strong>{offPipeline[state as 'on_hold' | 'exited'].label}</strong>
            {offPipeline[state as 'on_hold' | 'exited'].blurb}
            {state === 'on_hold' && (
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={resume}>
                Resume
              </button>
            )}
          </div>
        )}

        {tab === 'OVERVIEW' && <Overview view={view} picked={picked} setPicked={setPicked} onOpen={openProject} />}
        {tab === 'BRIEF' && <BriefScreen view={view} />}
        {tab === 'PLAN' && <PlanScreen view={view} />}
        {tab === 'LEADER' && (
          <LeaderScreen
            view={view}
            feedback={feedback}
            setFeedback={setFeedback}
            onDecide={decide}
            locked={off || busy || state !== 'awaiting_leader_decision'}
            reason={
              state === 'awaiting_leader_decision' ? '' : `No decision pending — project is ${state}.`
            }
          />
        )}
        {tab === 'EXECUTION' && <ExecutionScreen state={state} agents={agents} view={view} setView={setView} mode={mode} setNote={setNote} />}
        {tab === 'AUDIT' && <AuditScreen feed={feed} state={state} />}

        <EventFeed feed={feed} />
      </main>

      <footer className="statusbar">
        <span>
          LEADER <b>@{project.leader.toLowerCase()}</b>
        </span>
        <span>
          STATE <b>{state}</b>
        </span>
        <span>
          REPO <b>{project.repo}</b>
        </span>
        <span className="right">
          <span>
            PLAN <b>v{version}</b>
          </span>
          <span>
            SECURE <b>TLS 1.3</b>
          </span>
        </span>
      </footer>
    </div>
  );
}

/* ── Overview / command deck ─────────────────────────────────────────── */

function Overview({
  view,
  picked,
  setPicked,
  onOpen,
}: {
  view: View;
  picked: Phase['id'] | null;
  setPicked: (p: Phase['id']) => void;
  onOpen: (projectId: string) => void;
}) {
  const { project, queue, missions } = view;
  const state = project.state;
  const here = phaseIndex(state);
  const focus = pipeline.find((p) => p.id === (picked ?? state)) ?? pipeline[0];
  const pct = here < 0 ? 0 : Math.round((here / (pipeline.length - 1)) * 100);
  const { checked } = useChecks(view.projectId);
  const done = project.brief.acceptance.filter((a) => checked.includes(a)).length;

  // Live queue when seeded; otherwise the bundled demo rows.
  const rows: { id: string | null; title: string; owner: string; label: string; tone: string }[] =
    queue.length > 0
      ? queue.map((q) => ({
          id: q.projectId,
          title: q.title,
          owner: q.owner,
          label: STATE_LABEL[q.state] ?? q.state,
          tone: STATE_TONE[q.state] ?? 'info',
        }))
      : missions.map((m: Mission) => ({ id: null, title: m.title, owner: m.owner, label: m.status, tone: m.tone }));

  return (
    <div className="deck-grid">
      <Panel title="Mission Queue" count={`${rows.length}`}>
        {rows.length === 0 && <p className="lead">No proposals yet.</p>}
        {rows.map((r) => {
          const active = r.id !== null && r.id === view.projectId;
          return (
            <button
              key={r.title}
              type="button"
              className={`mission ${active ? 'is-active' : ''}`}
              onClick={() => r.id && onOpen(r.id)}
              disabled={r.id === null}
            >
              <div className="mission-hex">{r.title[0]}</div>
              <div>
                <h4>{r.title}</h4>
                <div className="owner">{r.owner}</div>
                <span className={`chip tone-${r.tone}`}>
                  <i />
                  {r.label}
                </span>
              </div>
            </button>
          );
        })}
      </Panel>

      <Panel title="Objective Tracker" count={`${pct}%`}>
        <ObjectiveTracker state={state} onPick={setPicked} picked={picked} />
        <div style={{ marginTop: 6 }}>
          <div className="kv">
            <span className="k">Stage</span>
            <span className="v">{focus.label}</span>
          </div>
          <div className="kv">
            <span className="k">Owner</span>
            <span className="v">{focus.crew}</span>
          </div>
          <div className="kv">
            <span className="k">Server state</span>
            <span className="v">{state}</span>
          </div>
          <p className="lead" style={{ marginTop: 12 }}>
            {focus.blurb}
          </p>
        </div>
      </Panel>

      <Panel title="Current Objective" tone="accent">
        <div className="big-title">{project.brief.title}</div>
        <div className="kv">
          <span className="k">Leader</span>
          <span className="v">{project.leader}</span>
        </div>
        <div className="kv">
          <span className="k">Plan</span>
          <span className="v">v{project.planVersion}</span>
        </div>

        <div className="fb-label">
          Acceptance checklist
          <span style={{ float: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--dim)' }}>
            {done}/{project.brief.acceptance.length}
          </span>
        </div>
        <Criteria items={project.brief.acceptance} projectId={view.projectId} />
      </Panel>
    </div>
  );
}

/** How each workflow state reads in the queue. */
const STATE_LABEL: Record<string, string> = {
  idle: 'NEW',
  awaiting_plan: 'PLANNING',
  awaiting_leader_decision: 'AWAITING GATE',
  awaiting_coding: 'CODING',
  awaiting_review: 'IN REVIEW',
  completed: 'DELIVERED',
  on_hold: 'ON HOLD',
  exited: 'CLOSED',
};

const STATE_TONE: Record<string, string> = {
  idle: 'info',
  awaiting_plan: 'info',
  awaiting_leader_decision: 'warn',
  awaiting_coding: 'go',
  awaiting_review: 'warn',
  completed: 'go',
  on_hold: 'hold',
  exited: 'stop',
};

/* ── Shared blocks ───────────────────────────────────────────────────── */

function Risks({ risks }: { risks: { name: string; level?: string; note?: string }[] }) {
  if (risks.length === 0) return <p className="lead">No risks recorded on this plan.</p>;
  return (
    <>
      {risks.map((r) => (
        <div className="risk" key={r.name}>
          <span className="rn">{r.name}</span>
          <span className={`rv lvl-${r.level ?? ''}`}>{r.level ?? '—'}</span>
          <span className="rd">{r.note ?? ''}</span>
        </div>
      ))}
    </>
  );
}

/**
 * Acceptance criteria a leader can actually tick off while reviewing.
 * Ticks are the reviewer's own working state, so they stay in the browser
 * rather than being written back as workflow events.
 */
const checkKey = (projectId: string | null) => `weave.checks.${projectId ?? 'demo'}`;

function readChecks(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * The checklist is rendered in more than one place at once (the panel and
 * the Overview counter), so the ticks live in one store every instance
 * subscribes to. Independent useState copies would drift apart.
 */
const checkSubscribers = new Set<() => void>();

function useChecks(projectId: string | null) {
  const storeKey = checkKey(projectId);
  const [checked, setChecked] = useState<string[]>(() => readChecks(storeKey));

  useEffect(() => {
    const sync = () => setChecked(readChecks(storeKey));
    sync();
    checkSubscribers.add(sync);
    return () => {
      checkSubscribers.delete(sync);
    };
  }, [storeKey]);

  const toggle = (item: string) => {
    const current = readChecks(storeKey);
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    checkSubscribers.forEach((fn) => fn());
  };

  return { checked, toggle };
}

function Criteria({ items, projectId }: { items: string[]; projectId: string | null }) {
  const { checked, toggle } = useChecks(projectId);
  if (items.length === 0) return <p className="lead">None recorded.</p>;
  return (
    <>
      {items.map((a) => {
        const on = checked.includes(a);
        return (
          <label className={`check ${on ? 'is-on' : ''}`} key={a}>
            <input type="checkbox" checked={on} onChange={() => toggle(a)} />
            <span aria-hidden="true">{on ? '✓' : ''}</span>
            {a}
          </label>
        );
      })}
    </>
  );
}

function Versions({
  plans,
  selected,
  onSelect,
  locked,
}: {
  plans: api.PlanView[];
  selected: number;
  onSelect: (v: number) => void;
  locked: boolean;
}) {
  if (plans.length === 0) return <p className="lead">No plan versions yet.</p>;
  return (
    <div className="versions">
      {plans.map((p) => (
        <button
          key={p.version}
          type="button"
          className={`ver ${p.version === selected ? 'active' : ''}`}
          onClick={() => onSelect(p.version)}
          aria-pressed={p.version === selected}
        >
          <span>v{p.version}</span>
        </button>
      ))}
      {locked && (
        <span className="ver-note">
          <Lock size={11} /> CODING LOCKED UNTIL LEADER DECISION
        </span>
      )}
    </div>
  );
}

/** The plan version on screen — the newest unless the reviewer picked one. */
function usePlan(view: View) {
  const [picked, setPicked] = useState<number | null>(null);
  const latest = view.plans[view.plans.length - 1];
  const plan = view.plans.find((p) => p.version === picked) ?? latest;
  useEffect(() => setPicked(null), [view.projectId]);
  return { plan, picked: plan?.version ?? view.project.planVersion, setPicked };
}

/* ── Brief ───────────────────────────────────────────────────────────── */

function BriefScreen({ view }: { view: View }) {
  const { plan } = usePlan(view);
  const { project } = view;
  const scope = plan?.summary ?? project.brief.scope.join(' ');
  const acceptance = plan?.acceptance ?? project.brief.acceptance;
  const risks = plan?.risks ?? project.brief.risks;

  return (
    <div className="leader-grid">
      <Panel title="Mission Brief">
        <div className="big-title">{plan?.title ?? project.brief.title}</div>
        <p className="lead">{scope}</p>
        <div className="fb-label">Acceptance criteria</div>
        <Criteria items={acceptance} projectId={view.projectId} />
      </Panel>
      <Panel title="Risk Assessment" count={`${risks.length}`}>
        <Risks risks={risks} />
      </Panel>
    </div>
  );
}

/* ── Plan ────────────────────────────────────────────────────────────── */

function PlanScreen({ view }: { view: View }) {
  const { plan, picked, setPicked } = usePlan(view);
  const locked = view.project.state === 'awaiting_leader_decision';

  return (
    <div className="leader-grid">
      <Panel title="Plan Review" count={plan ? `v${plan.version}` : ''}>
        <div className="big-title">{plan?.title ?? view.project.brief.title}</div>
        <p className="lead">{plan?.summary ?? view.project.brief.scope.join(' ')}</p>

        {(plan?.steps ?? []).length > 0 && (
          <>
            <div className="fb-label">Plan steps</div>
            <ol className="steps">
              {plan!.steps.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </>
        )}

        <div className="fb-label">Acceptance criteria</div>
        <Criteria items={plan?.acceptance ?? []} projectId={view.projectId} />

        <div className="fb-label">Version</div>
        <Versions plans={view.plans} selected={picked} onSelect={setPicked} locked={locked} />
        {view.plans.length > 1 && picked !== view.plans[view.plans.length - 1].version && (
          <p className="mono-sm" style={{ marginTop: 8 }}>
            VIEWING AN EARLIER VERSION — v{view.plans[view.plans.length - 1].version} IS CURRENT
          </p>
        )}
      </Panel>

      <Panel title="Risk Assessment" count={`${(plan?.risks ?? []).length}`}>
        <Risks risks={plan?.risks ?? []} />
      </Panel>
    </div>
  );
}

/* ── Leader gate ─────────────────────────────────────────────────────── */

const actIcon = { approve: Check, request_updated_plan: MessageSquare, hold: Pause, exit: X };

function LeaderScreen({
  view,
  feedback,
  setFeedback,
  onDecide,
  locked,
  reason,
}: {
  view: View;
  feedback: string;
  setFeedback: (s: string) => void;
  onDecide: (d: LeaderDecision) => void;
  locked: boolean;
  reason: string;
}) {
  const { plan, picked, setPicked } = usePlan(view);
  const { project } = view;

  return (
    <div className="leader-grid">
      <Panel title="Plan Review">
        <div className="big-title">{plan?.title ?? project.brief.title}</div>
        <span className="chip tone-info">PLAN V{plan?.version ?? project.planVersion}</span>

        <div className="fb-label">Scope</div>
        <p className="lead">{plan?.summary ?? project.brief.scope.join(' ')}</p>

        <div className="fb-label">Acceptance criteria</div>
        <Criteria items={plan?.acceptance ?? project.brief.acceptance} projectId={view.projectId} />

        <div className="fb-label">Risk assessment</div>
        <Risks risks={plan?.risks ?? project.brief.risks} />

        <div className="fb-label">Version</div>
        <Versions
          plans={view.plans}
          selected={picked}
          onSelect={setPicked}
          locked={project.state === 'awaiting_leader_decision'}
        />
      </Panel>

      <Panel title="Leader Actions">
        {reason && <p className="lead">{reason}</p>}
        {decisions.map((d) => {
          const Ico = actIcon[d.id];
          return (
            <button
              key={d.id}
              className={`act ${d.tone}`}
              onClick={() => onDecide(d.id)}
              disabled={locked}
              style={locked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
            >
              <span className="act-ico">
                <Ico size={17} />
              </span>
              <span>
                <strong>{d.label}</strong>
                <small>{d.detail}</small>
              </span>
              <ChevronRight className="arrow" size={19} />
            </button>
          );
        })}

        <div className="fb-label">Leader feedback (optional)</div>
        <textarea
          className="fb"
          value={feedback}
          maxLength={1000}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Share feedback, concerns, or additional guidance…"
        />
        <div className="fb-count">{feedback.length} / 1000</div>
      </Panel>
    </div>
  );
}

/* ── Execution ───────────────────────────────────────────────────────── */

function ExecutionScreen({
  state,
  agents,
  view,
  setView,
  mode,
  setNote,
}: {
  state: WorkflowState;
  agents: Agent[];
  view: View;
  setView: (v: View) => void;
  mode: api.Mode;
  setNote: (s: string) => void;
}) {
  const canCode = mode === 'live' && view.projectId && state === 'awaiting_coding';
  const canReview = mode === 'live' && view.projectId && state === 'awaiting_review';

  async function send(fn: (id: string) => Promise<View>, msg: string) {
    if (!view.projectId) return;
    try {
      setView(await fn(view.projectId));
      setNote(msg);
    } catch (e) {
      setNote(`Backend rejected the change: ${(e as Error).message}`);
    }
  }

  return (
    <div className="leader-grid">
      <Panel title="Agents" count={`${agents.length}`}>
        <div className="agent-grid">
          {agents.map((a, i) => (
            <div className="panel" key={`${a.name}-${i}`} style={{ ['--n' as string]: '9px' }}>
              <div className="panel-in" style={{ padding: '13px 14px' }}>
                <div className="mission-hex" style={{ marginBottom: 10 }}>
                  {a.key}
                </div>
                <h4 style={{ margin: '0 0 3px', fontFamily: 'var(--cond)', letterSpacing: '.06em' }}>{a.name}</h4>
                <div className="owner" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                  {a.task}
                </div>
                <span className={`chip tone-${a.tone}`}>{a.status}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Runloop">
        <div className="term">
          <div>
            <span className="dim">&gt;</span> state = {state}
          </div>
          <div>
            <span className="dim">&gt;</span> source = {mode === 'live' ? 'master-backend' : 'demo fixtures'}
          </div>
          <div>
            <span className="dim">&gt;</span> project = {view.projectId ?? 'none'}
          </div>
          <div>
            <span className="dim">&gt;</span> _
          </div>
        </div>

        {(canCode || canReview) && (
          <>
            <div className="fb-label">Advance the run</div>
            {canCode && (
              <button className="btn" onClick={() => send(api.completeCoding, 'Coding reported complete.')}>
                Report coding complete
              </button>
            )}
            {canReview && (
              <button className="btn" onClick={() => send(api.completeReview, 'Review passed.')}>
                Report review passed
              </button>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}

/* ── Audit ───────────────────────────────────────────────────────────── */

function AuditScreen({ feed, state }: { feed: FeedEvent[]; state: WorkflowState }) {
  return (
    <>
      <div className="leader-grid">
        <Panel title="Pipeline" count={state}>
          {pipeline.map((p) => {
            const st = phaseStatus(p, state);
            return (
              <div className="kv" key={p.id}>
                <span className="k">
                  <span className={`chip tone-${st === 'done' ? 'go' : st === 'current' ? 'info' : 'hold'}`}>
                    {p.label}
                  </span>
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.crew}</span>
                <span className="v">{st}</span>
              </div>
            );
          })}
        </Panel>

        <Panel title="Session Events" count={`${feed.length}`}>
          {feed.map((e, i) => (
            <div className="kv" key={`${e.at}-${i}`}>
              <span className="k">
                <span className={`chip tone-${e.tone}`}>{e.tag}</span>
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{e.type}</span>
              <span className="v">{e.at}</span>
            </div>
          ))}
        </Panel>
      </div>

      <div style={{ marginTop: 18 }}>
        <NotionMemory />
      </div>
    </>
  );
}

/* ── Notion project memory ───────────────────────────────────────────── */

function NotionMemory() {
  const [status, setStatus] = useState<api.MemoryStatus>({ state: 'off' });
  const [pick, setPick] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ events: api.MemoryEvent[]; plans: api.MemoryPlan[] } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.memoryProjects().then((s) => {
      setStatus(s);
      if (s.state === 'ready' && s.projects[0]) setPick(s.projects[0].projectId);
    });
  }, []);

  useEffect(() => {
    if (!pick) return;
    setDetail(null);
    setErr('');
    api
      .memoryFor(pick)
      .then(setDetail)
      .catch((e) => setErr((e as Error).message));
  }, [pick]);

  if (status.state === 'off') return null;

  if (status.state !== 'ready') {
    return (
      <Panel title="Project Memory · Notion">
        <p className="lead">
          {status.state === 'unconfigured'
            ? status.message
            : `Could not read project memory: ${status.message}`}
        </p>
        <p className="mono-sm">
          READ-ONLY MIRROR · THE DATABASE REMAINS THE OPERATIONAL SOURCE OF TRUTH
        </p>
      </Panel>
    );
  }

  return (
    <div className="leader-grid">
      <Panel title="Project Memory · Notion" count={`${status.projects.length} projects`}>
        {status.projects.length === 0 && <p className="lead">No projects recorded in Notion yet.</p>}
        {status.projects.map((p) => (
          <button
            key={p.projectId}
            className="kv"
            onClick={() => setPick(p.projectId)}
            style={{
              width: '100%',
              background: p.projectId === pick ? 'rgba(34,211,238,.07)' : 'none',
              border: 0,
              borderTop: '1px solid var(--edge-soft)',
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span className="k" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
              {p.projectId}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{p.latestType}</span>
            <span className="v">{p.events} ev</span>
          </button>
        ))}
      </Panel>

      <Panel title="Recorded History" count={pick ?? ''}>
        {err && <p className="lead">Could not load: {err}</p>}
        {!detail && !err && <p className="lead">Loading…</p>}
        {detail && (
          <>
            <div className="fb-label">Plan versions</div>
            {detail.plans.length === 0 && <p className="lead">No plan versions recorded.</p>}
            {detail.plans.map((p) => (
              <div className="kv" key={`${p.projectId}-${p.version}`}>
                <span className="k">
                  <span className="chip tone-info">V{p.version}</span>
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{p.status}</span>
                <span className="v">{p.diffSummary ? 'revised' : '—'}</span>
              </div>
            ))}

            <div className="fb-label">Timeline</div>
            {detail.events.slice(0, 12).map((e, i) => (
              <div className="kv" key={`${e.type}-${i}`}>
                <span className="k" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                  {e.type}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 11, flex: 1 }}>
                  {e.summary.split('\n')[0].slice(0, 70)}
                </span>
                <span className="v">{e.at ? new Date(e.at).toLocaleTimeString('en-US', { hour12: false }) : '—'}</span>
              </div>
            ))}
          </>
        )}
      </Panel>
    </div>
  );
}
