import { useState } from 'react';
import { Activity, Bot, Check, ChevronRight, CircleDot, Plus, Send, Users, Zap } from 'lucide-react';

type Request = { name: string; initials: string; text: string };

const seedRequests: Request[] = [
  { name: 'Maya', initials: 'M', text: 'Add dark mode' },
  { name: 'James', initials: 'J', text: 'Make the dashboard mobile responsive' },
];

const activity = [
  ['Maya', 'proposed “Add dark mode”', false],
  ['James', 'proposed “Make the dashboard mobile responsive”', false],
  ['Planning Agent', 'is synthesizing the team’s requests', true],
  ['Research Agent', 'is analyzing the impact', true],
  ['Planning Agent', 'updated the project plan to v5', true],
] as const;

export default function App() {
  const [requests, setRequests] = useState(seedRequests);
  const [draft, setDraft] = useState('');

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setRequests((items) => [...items, { name: 'You', initials: 'Y', text }]);
    setDraft('');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span><span>Reason</span></div>
        <div className="project-label">PROJECT</div>
        <div className="project-name">Acme Support Dashboard</div>
        <nav>
          <a className="active"><Activity size={16} /> Overview</a>
          <a><CircleDot size={16} /> Planning Queue <span className="count">{requests.length}</span></a>
          <a><Bot size={16} /> Current Plan</a>
          <a><Check size={16} /> Decisions</a>
        </nav>
        <div className="sidebar-team">
          <div className="project-label">TEAM</div>
          <div className="team-row"><span className="avatar maya">M</span> Maya <span className="role">Product</span></div>
          <div className="team-row"><span className="avatar james">J</span> James <span className="role">Engineering</span></div>
          <div className="team-row"><span className="avatar sarah">S</span> Sarah <span className="role">Lead</span></div>
        </div>
        <div className="sidebar-footer"><Users size={15} /> 3 teammates online</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">TEAM WORKSPACE</div><h1>Acme Support Dashboard</h1></div>
          <div className="top-actions"><div className="agents-online"><span className="live-dot" /> 3 agents active</div><button className="primary" onClick={() => document.getElementById('composer')?.focus()}><Plus size={16} /> Propose Change</button></div>
        </header>

        <section className="workspace-grid">
          <div className="column">
            <SectionHeader title="Planning Queue" subtitle={`${requests.length} requests`} />
            <div className="request-list">
              {requests.map((request, i) => <div className="request-card" key={`${request.text}-${i}`}>
                <div className={`avatar ${request.initials === 'M' ? 'maya' : request.initials === 'J' ? 'james' : 'you'}`}>{request.initials}</div>
                <div className="request-content"><div className="request-meta"><strong>{request.name}</strong><span>just now</span></div><div className="request-text">{request.text}</div><span className="status new">New request</span></div>
              </div>)}
            </div>
          </div>

          <div className="column activity-column">
            <SectionHeader title="Live Activity" subtitle="What’s happening now" />
            <div className="activity-feed">
              {activity.map(([name, text, agent], i) => <div className="activity-item" key={i}>
                <div className={`activity-icon ${agent ? 'agent-icon' : ''}`}>{agent ? <Bot size={15} /> : name[0]}</div>
                <div><div className="activity-text"><strong>{name}</strong> {text}</div><div className="activity-time">{i < 2 ? '2 min ago' : i === 4 ? 'just now' : 'working now'}</div></div>
              </div>)}
            </div>
            <div className="agents-card"><div className="card-title">Agents</div>
              <Agent name="Planning Agent" task="Synthesizing requests" active />
              <Agent name="Research Agent" task="Analyzing impact" active />
              <Agent name="Coding Agent" task="Waiting for approval" />
            </div>
          </div>

          <div className="column state-column">
            <SectionHeader title="Project State" subtitle="Current workflow" />
            <div className="state-card">
              {['Requests', 'Planning', 'Research', 'Plan Review', 'Execution', 'Coding', 'Complete'].map((step, i) => <div className={`workflow-step ${i < 3 ? 'done' : i === 3 ? 'current' : ''}`} key={step}>
                <div className="step-marker">{i < 3 ? <Check size={12} /> : i === 3 ? <CircleDot size={11} /> : ''}</div><span>{step}</span>{i === 3 && <span className="now">NOW</span>}
              </div>)}
            </div>
            <div className="plan-card"><div className="plan-top"><span>Current Plan</span><span className="version">v5</span></div><div className="plan-title">2 requests incorporated</div><p>Dark mode + responsive dashboard</p><div className="plan-link">Review proposed plan <ChevronRight size={14} /></div></div>
          </div>
        </section>

        <div className="composer-wrap">
          <div className="composer">
            <div className="composer-icon"><Plus size={17} /></div>
            <input id="composer" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Suggest an idea or change for the team…" />
            <button className="send" onClick={submit} aria-label="Send"><Send size={16} /></button>
          </div>
          <div className="composer-hint">Ideas are added to the shared planning queue</div>
        </div>
      </main>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="section-header"><div><h2>{title}</h2><span>{subtitle}</span></div></div>;
}

function Agent({ name, task, active = false }: { name: string; task: string; active?: boolean }) {
  return <div className="agent-row"><div className="agent-avatar"><Bot size={15} /></div><div className="agent-info"><strong>{name}</strong><span>{task}</span></div><div className={`agent-status ${active ? 'active' : ''}`}><span />{active ? 'Active' : 'Idle'}</div></div>;
}
