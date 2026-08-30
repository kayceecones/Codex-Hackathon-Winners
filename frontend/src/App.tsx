import { useState } from 'react';
import { Check, ChevronRight, Lock, MessageSquare, Pause, Target, X } from 'lucide-react';
import ObjectiveTracker from './components/ObjectiveTracker';
import EventFeed from './components/EventFeed';
import Panel from './components/Panel';
import {
  agents,
  decisions,
  missions,
  offPipeline,
  phaseIndex,
  phaseStatus,
  pipeline,
  project,
  type LeaderDecision,
  type Phase,
  type WorkflowState,
} from './workflow';

const tabs = ['OVERVIEW', 'BRIEF', 'PLAN', 'LEADER', 'EXECUTION', 'AUDIT'] as const;
type Tab = (typeof tabs)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>('OVERVIEW');
  const [state, setState] = useState<WorkflowState>(project.state);
  const [held, setHeld] = useState<WorkflowState | null>(null);
  const [version, setVersion] = useState(project.planVersion);
  const [feedback, setFeedback] = useState('');
  const [picked, setPicked] = useState<Phase['id'] | null>(null);
  const [note, setNote] = useState('');

  // Mirrors the backend state machine's leader-decision transitions.
  function decide(id: LeaderDecision) {
    if (id === 'approve') {
      setState('awaiting_coding');
      setNote('Plan approved. Execution contract created — Coding Agent released.');
      setTab('EXECUTION');
    } else if (id === 'request_updated_plan') {
      setState('awaiting_plan');
      setVersion((v) => v + 1);
      setNote(`Feedback sent to Planning. Drafting v${version + 1}.`);
      setTab('PLAN');
    } else if (id === 'hold') {
      setHeld(state);
      setState('on_hold');
      setNote('Mission held. State preserved for resume.');
    } else {
      setState('exited');
      setNote('Mission closed.');
    }
    setFeedback('');
  }

  function resume() {
    setState(held ?? 'awaiting_leader_decision');
    setHeld(null);
    setNote('Mission resumed from hold.');
  }

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
          <span className="live-chip">
            <i /> LIVE
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
            <button onClick={() => setNote('')} aria-label="Dismiss">
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

        {tab === 'OVERVIEW' && <Overview state={state} picked={picked} setPicked={setPicked} />}
        {tab === 'BRIEF' && <BriefScreen />}
        {tab === 'PLAN' && <PlanScreen version={version} setVersion={setVersion} />}
        {tab === 'LEADER' && (
          <LeaderScreen
            version={version}
            setVersion={setVersion}
            feedback={feedback}
            setFeedback={setFeedback}
            onDecide={decide}
            locked={off}
          />
        )}
        {tab === 'EXECUTION' && <ExecutionScreen state={state} />}
        {tab === 'AUDIT' && <AuditScreen />}

        <EventFeed />
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
  state,
  picked,
  setPicked,
}: {
  state: WorkflowState;
  picked: Phase['id'] | null;
  setPicked: (p: Phase['id']) => void;
}) {
  const here = phaseIndex(state);
  const focus = pipeline.find((p) => p.id === (picked ?? state)) ?? pipeline[0];
  const pct = here < 0 ? 0 : Math.round((here / (pipeline.length - 1)) * 100);

  return (
    <div className="deck-grid">
      <Panel title="Mission Queue" count={`${missions.length}`}>
        {missions.map((m) => (
          <div className="mission" key={m.title}>
            <div className="mission-hex">{m.title[0]}</div>
            <div>
              <h4>{m.title}</h4>
              <div className="owner">{m.owner}</div>
              <span className={`chip tone-${m.tone}`}>
                <i />
                {m.status}
              </span>
            </div>
          </div>
        ))}
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
            <span className="k">Reached</span>
            <span className="v">{focus.at ?? '—'}</span>
          </div>
          <p className="lead" style={{ marginTop: 12 }}>
            {focus.blurb}
          </p>
        </div>
      </Panel>

      <Panel title="Current Objective" tone="accent">
        <div className="big-title">{project.brief.title}</div>
        <div className="kv">
          <span className="k">Owner</span>
          <span className="v">{project.leader}</span>
        </div>
        <div className="kv">
          <span className="k">Status</span>
          <span className="v">{state}</span>
        </div>

        <div className="fb-label">Acceptance checklist</div>
        {project.brief.acceptance.slice(0, 4).map((a) => (
          <div className="check" key={a}>
            <span />
            {a}
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ── Brief ───────────────────────────────────────────────────────────── */

function BriefScreen() {
  const { brief } = project;
  return (
    <div className="leader-grid">
      <Panel title="Mission Brief">
        <div className="big-title">{brief.title}</div>
        {brief.scope.map((s) => (
          <p className="lead" key={s}>
            {s}
          </p>
        ))}
        <div className="fb-label">Acceptance criteria</div>
        {brief.acceptance.map((a) => (
          <div className="check" key={a}>
            <span />
            {a}
          </div>
        ))}
      </Panel>

      <Panel title="Risk Assessment">
        {brief.risks.map((r) => (
          <div className="risk" key={r.name}>
            <span className="rn">{r.name}</span>
            <span className={`rv lvl-${r.level}`}>{r.level}</span>
            <span className="rd">{r.note}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ── Plan ────────────────────────────────────────────────────────────── */

function PlanScreen({ version, setVersion }: { version: number; setVersion: (v: number) => void }) {
  return (
    <div className="leader-grid">
      <Panel title="Plan Review">
        <div className="big-title">{project.brief.title}</div>
        <p className="lead">{project.brief.scope.join(' ')}</p>
        <div className="fb-label">Acceptance criteria</div>
        {project.brief.acceptance.map((a) => (
          <div className="check" key={a}>
            <span />
            {a}
          </div>
        ))}
        <div className="fb-label">Version</div>
        <div className="versions">
          {[...new Set([...project.versions, version])].sort((a, b) => a - b).map((v) => (
            <button key={v} className={`ver ${v === version ? 'active' : ''}`} onClick={() => setVersion(v)}>
              <span>v{v}</span>
            </button>
          ))}
          <span className="ver-note">
            <Lock size={11} /> CODING LOCKED UNTIL LEADER DECISION
          </span>
        </div>
      </Panel>

      <Panel title="Risk Assessment">
        {project.brief.risks.map((r) => (
          <div className="risk" key={r.name}>
            <span className="rn">{r.name}</span>
            <span className={`rv lvl-${r.level}`}>{r.level}</span>
            <span className="rd">{r.note}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ── Leader gate ─────────────────────────────────────────────────────── */

const actIcon = { approve: Check, request_updated_plan: MessageSquare, hold: Pause, exit: X };

function LeaderScreen({
  version,
  setVersion,
  feedback,
  setFeedback,
  onDecide,
  locked,
}: {
  version: number;
  setVersion: (v: number) => void;
  feedback: string;
  setFeedback: (s: string) => void;
  onDecide: (d: LeaderDecision) => void;
  locked: boolean;
}) {
  return (
    <div className="leader-grid">
      <Panel title="Plan Review">
        <div className="big-title">{project.brief.title}</div>
        <span className="chip tone-info">PLAN V{version}</span>

        <div className="fb-label">Scope</div>
        {project.brief.scope.map((s) => (
          <p className="lead" key={s}>
            {s}
          </p>
        ))}

        <div className="fb-label">Acceptance criteria</div>
        {project.brief.acceptance.map((a) => (
          <div className="check" key={a}>
            <span />
            {a}
          </div>
        ))}

        <div className="fb-label">Risk assessment</div>
        {project.brief.risks.map((r) => (
          <div className="risk" key={r.name}>
            <span className="rn">{r.name}</span>
            <span className={`rv lvl-${r.level}`}>{r.level}</span>
            <span className="rd">{r.note}</span>
          </div>
        ))}

        <div className="fb-label">Version</div>
        <div className="versions">
          {[...new Set([...project.versions, version])].sort((a, b) => a - b).map((v) => (
            <button key={v} className={`ver ${v === version ? 'active' : ''}`} onClick={() => setVersion(v)}>
              <span>v{v}</span>
            </button>
          ))}
          <span className="ver-note">
            <Lock size={11} /> CODING LOCKED UNTIL LEADER DECISION
          </span>
        </div>
      </Panel>

      <Panel title="Leader Actions">
        {decisions.map((d) => {
          const Ico = actIcon[d.id];
          return (
            <button
              key={d.id}
              className={`act ${d.tone}`}
              onClick={() => onDecide(d.id)}
              disabled={locked}
              style={locked ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
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

function ExecutionScreen({ state }: { state: WorkflowState }) {
  return (
    <div className="leader-grid">
      <Panel title="Agents" count={`${agents.length} online`}>
        <div className="agent-grid">
          {agents.map((a) => (
            <div className="panel" key={a.name} style={{ ['--n' as string]: '9px' }}>
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

      <Panel title="Runloop Preview">
        <div className="term">
          <div>
            <span className="dim">&gt;</span> leader_decision.recorded
          </div>
          <div>
            <span className="dim">&gt;</span> execution_contract.created
          </div>
          <div>
            <span className="dim">&gt;</span> runloop.inspect frontend
          </div>
          <div>
            <span className="dim">&gt;</span> state = {state}
          </div>
          <div>
            <span className="dim">&gt;</span> _
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ── Audit ───────────────────────────────────────────────────────────── */

function AuditScreen() {
  return (
    <Panel title="Decision Audit">
      {pipeline.map((p) => {
        const s = phaseStatus(p, project.state);
        return (
          <div className="kv" key={p.id}>
            <span className="k">
              <span className={`chip tone-${s === 'done' ? 'go' : s === 'current' ? 'info' : 'hold'}`}>{p.label}</span>
            </span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.blurb}</span>
            <span className="v">{p.at ?? '—'}</span>
          </div>
        );
      })}
    </Panel>
  );
}
