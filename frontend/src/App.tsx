import { useMemo, useState } from 'react';
import { Activity, Bot, Check, ChevronRight, CircleDot, Clock3, FileCode2, History, Plus, Send, Users, X, Zap } from 'lucide-react';
import { api } from './services/api';

type Request = { name: string; initials: string; text: string };
type Screen = 'overview' | 'plan' | 'execution' | 'coding' | 'results';

const seedRequests: Request[] = [
  { name: 'Maya', initials: 'M', text: 'Add dark mode' },
  { name: 'James', initials: 'J', text: 'Make the dashboard mobile responsive' },
];

const plan = {
  version: 5,
  summary: 'Frontend-only dark mode with persisted preference, without backend changes.',
  tasks: ['Add theme state and persistence', 'Build light/dark design tokens', 'Add theme toggle to workspace', 'Validate contrast and responsive behavior'],
  incorporated: ['Keep dark mode scoped to the frontend', 'Persist the user preference', 'No backend changes'],
  affectedAreas: ['frontend/src/App.tsx', 'frontend/src/styles.css', 'frontend/src/services/api.ts'],
  validation: ['Theme survives refresh', 'Primary workflow remains usable in both themes', 'No backend files changed'],
};

const decisions = [
  ['Plan v3', 'Leader requested frontend-only scope', '2:41 PM'],
  ['Plan v4', 'Planning Agent incorporated persistence', '2:44 PM'],
  ['Plan v5', 'Leader approved scope for execution review', '2:47 PM'],
];

export default function App() {
  const [requests, setRequests] = useState(seedRequests);
  const [draft, setDraft] = useState('');
  const [screen, setScreen] = useState<Screen>('overview');
  const [workflow, setWorkflow] = useState<'PLAN_APPROVAL' | 'EXECUTION_REVIEW' | 'CODING' | 'COMPLETE'>('PLAN_APPROVAL');
  const [feedback, setFeedback] = useState('');
  const [message, setMessage] = useState('');

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setRequests((items) => [...items, { name: 'You', initials: 'Y', text }]);
    setDraft('');
    setMessage('Request added to the shared planning queue.');
  }

  async function approvePlan() {
    await api.approvePlan();
    setWorkflow('EXECUTION_REVIEW'); setScreen('execution'); setMessage('Plan v5 approved. Ready for execution review.');
  }
  async function sendBack() {
    await api.sendBack(feedback || 'Please revise the plan.');
    setWorkflow('PLAN_APPROVAL'); setScreen('plan'); setMessage('Feedback sent directly to Planning Agent for a new plan version.');
    setFeedback('');
  }
  async function approveExecution() {
    await api.approveExecution();
    setWorkflow('CODING'); setScreen('coding'); setMessage('Execution approved. Coding Agent started.');
  }
  function finish() { setWorkflow('COMPLETE'); setScreen('results'); setMessage('Execution completed and Review Agent passed validation.'); }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Zap size={15} fill="currentColor" /></span><span>Weave</span></div>
        <div className="project-label">PROJECT</div><div className="project-name">Weave — Agentic Development Workspace</div>
        <nav>
          <a className={screen === 'overview' ? 'active' : ''} onClick={() => setScreen('overview')}><Activity size={16} /> Overview</a>
          <a><CircleDot size={16} /> Planning Queue <span className="count">{requests.length}</span></a>
          <a className={screen === 'plan' ? 'active' : ''} onClick={() => setScreen('plan')}><Bot size={16} /> Plan Review <span className="version">v5</span></a>
          <a className={screen === 'execution' ? 'active' : ''} onClick={() => setScreen('execution')}><Check size={16} /> Execution Review</a>
          <a className={screen === 'coding' ? 'active' : ''} onClick={() => setScreen('coding')}><FileCode2 size={16} /> Coding Progress</a>
          <a className={screen === 'results' ? 'active' : ''} onClick={() => setScreen('results')}><History size={16} /> Decision History</a>
        </nav>
        <div className="sidebar-team"><div className="project-label">TEAM</div><div className="team-row"><span className="avatar maya">M</span> Maya <span className="role">Product</span></div><div className="team-row"><span className="avatar james">J</span> James <span className="role">Engineering</span></div><div className="team-row"><span className="avatar sarah">S</span> Sarah <span className="role">Lead</span></div></div>
        <div className="sidebar-footer"><Users size={15} /> 3 teammates online</div>
      </aside>

      <main className="main">
        <header className="topbar"><div><div className="eyebrow">TEAM WORKSPACE</div><h1>Weave</h1></div><div className="top-actions"><div className="agents-online"><span className="live-dot" /> 3 agents active</div><button className="primary" onClick={() => document.getElementById('composer')?.focus()}><Plus size={16} /> Propose Change</button></div></header>

        {message && <div className="toast">{message}<button onClick={() => setMessage('')}><X size={13}/></button></div>}

        {screen === 'overview' && <Overview requests={requests} onPlan={() => setScreen('plan')} />}
        {screen === 'plan' && <PlanReview feedback={feedback} setFeedback={setFeedback} onApprove={approvePlan} onSendBack={sendBack} />}
        {screen === 'execution' && <ExecutionReview onApprove={approveExecution} onSendBack={() => { setScreen('plan'); setWorkflow('PLAN_APPROVAL'); }} />}
        {screen === 'coding' && <CodingProgress onFinish={finish} />}
        {screen === 'results' && <Results />}

        <div className="composer-wrap"><div className="composer"><div className="composer-icon"><Plus size={17} /></div><input id="composer" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="Suggest an idea or change for the team…" /><button className="send" onClick={submit} aria-label="Send"><Send size={16} /></button></div><div className="composer-hint">Ideas are added to the shared planning queue</div></div>
      </main>
    </div>
  );
}

function Overview({ requests, onPlan }: { requests: Request[]; onPlan: () => void }) {
  const activity = ['Maya proposed “Add dark mode”', 'Planning Agent synthesized the request', 'Research Agent analyzed frontend impact', 'Planning Agent updated the project plan to v5'];
  return <section className="workspace-grid"><div className="column"><SectionHeader title="Planning Queue" subtitle={`${requests.length} requests`} /><div className="request-list">{requests.map((r, i) => <div className="request-card" key={i}><div className={`avatar ${r.initials === 'M' ? 'maya' : r.initials === 'J' ? 'james' : 'you'}`}>{r.initials}</div><div className="request-content"><div className="request-meta"><strong>{r.name}</strong><span>just now</span></div><div className="request-text">{r.text}</div><span className="status new">New request</span></div></div>)}</div></div><div className="column activity-column"><SectionHeader title="Live Activity" subtitle="What’s happening now" /><div className="activity-feed">{activity.map((x, i) => <div className="activity-item" key={i}><div className="activity-icon">{i > 0 ? <Bot size={15}/> : 'M'}</div><div><div className="activity-text">{x}</div><div className="activity-time">{i === 3 ? 'just now' : '2 min ago'}</div></div></div>)}</div><div className="agents-card"><div className="card-title">Agents</div><Agent name="Planning Agent" task="Plan v5 ready for approval" active/><Agent name="Research Agent" task="Impact analysis complete" active/><Agent name="Coding Agent" task="Waiting for approval"/></div></div><div className="column state-column"><SectionHeader title="Project State" subtitle="Current workflow"/><div className="state-card">{['Requests','Planning','Research','Plan Review','Execution','Coding','Complete'].map((s,i)=><div className={`workflow-step ${i<3?'done':''} ${i===3?'current':''}`} key={s}><div className="step-marker">{i<3?<Check size={12}/>:i===3?<CircleDot size={11}/>:''}</div><span>{s}</span>{i===3&&<span className="now">NOW</span>}</div>)}</div><div className="plan-card"><div className="plan-top"><span>Current Plan</span><span className="version">v5</span></div><div className="plan-title">Frontend dark mode</div><p>2 requests incorporated • persistence included</p><button className="plan-link" onClick={onPlan}>Review proposed plan <ChevronRight size={14}/></button></div></div></section>;
}

function PlanReview({ feedback, setFeedback, onApprove, onSendBack }: { feedback: string; setFeedback: (s:string)=>void; onApprove:()=>void; onSendBack:()=>void }) {
  return <section className="review-workspace"><div className="review-header"><div><div className="eyebrow">HUMAN-IN-THE-LOOP</div><h2>Plan Review</h2><p>Review the Planning Agent’s latest version before anything is executed.</p></div><span className="big-version">PLAN v{plan.version}</span></div><div className="review-grid"><div><Panel title="Plan summary"><p className="lead">{plan.summary}</p><ul>{plan.tasks.map(t=><li key={t}>{t}</li>)}</ul></Panel><Panel title="Requests incorporated"><ul>{plan.incorporated.map(x=><li key={x}>{x}</li>)}</ul></Panel><Panel title="Approval history">{decisions.map(d=><div className="decision" key={d[0]}><span className="decision-check"><Check size={12}/></span><div><strong>{d[0]}</strong><p>{d[1]}</p><small>{d[2]}</small></div></div>)}</Panel></div><div><Panel title="Leader decision"><div className="decision-state"><CircleDot size={17}/> Awaiting approval</div><textarea value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Optional feedback for Planning Agent…"/><div className="decision-actions"><button className="secondary" onClick={onSendBack}><Send size={14}/> Send Back</button><button className="primary large" onClick={onApprove}><Check size={15}/> Approve Plan</button></div><p className="helper">Send Back routes your feedback directly to Planning and creates the next plan version. Approving unlocks execution review.</p></Panel></div></div></section>;
}

function ExecutionReview({ onApprove, onSendBack }: {onApprove:()=>void; onSendBack:()=>void}) { return <section className="review-workspace"><div className="review-header"><div><div className="eyebrow">GOVERNANCE GATE</div><h2>Execution Review</h2><p>The approved plan becomes the execution contract for Coding Agent.</p></div><span className="big-version">APPROVED v5</span></div><div className="review-grid"><div><Panel title="Implementation tasks"><ul>{plan.tasks.map(t=><li key={t}>{t}</li>)}</ul></Panel><Panel title="Affected areas"><ul>{plan.affectedAreas.map(x=><li key={x}><code>{x}</code></li>)}</ul></Panel><Panel title="Validation requirements"><ul>{plan.validation.map(x=><li key={x}>{x}</li>)}</ul></Panel></div><div><Panel title="Ready to execute"><div className="ready-card"><Check size={18}/><div><strong>Plan approved</strong><p>No coding has started yet.</p></div></div><button className="primary execute" onClick={onApprove}><Zap size={15}/> Approve &amp; Execute</button><button className="secondary full" onClick={onSendBack}><Send size={14}/> Send back to Plan Review</button></Panel></div></div></section>; }

function CodingProgress({ onFinish }: {onFinish:()=>void}) { const [progress,setProgress]=useState(42); useMemo(()=>{ if(progress===42) setTimeout(()=>setProgress(78),700); },[]); return <section className="review-workspace"><div className="review-header"><div><div className="eyebrow">EXECUTION</div><h2>Coding Progress</h2><p>Coding Agent is executing the approved contract through Runloop.</p></div><span className="big-version live">RUNNING</span></div><Panel title="Execution timeline"><div className="execution-line"><ExecStep title="Execution contract created" done/><ExecStep title="Repository inspected" done/><ExecStep title="Theme implementation" active/><ExecStep title="Tests and validation"/><ExecStep title="Review Agent"/></div><div className="progress"><span style={{width:`${progress}%`}}/></div><div className="terminal"><div>$ runloop inspect frontend</div><div>✓ repository context loaded</div><div>$ runloop test</div><div>→ running frontend validation…</div></div></Panel><button className="primary large finish" onClick={onFinish}><Check size={15}/> Simulate Completed Run</button></section>; }

function Results() { return <section className="review-workspace"><div className="review-header"><div><div className="eyebrow">COMPLETE</div><h2>Results &amp; Decision History</h2><p>Implementation passed validation and is associated with Plan v5.</p></div><span className="big-version success"><Check size={14}/> PASSED</span></div><div className="review-grid"><div><Panel title="Completion summary"><div className="ready-card"><Check size={18}/><div><strong>Dark mode shipped</strong><p>Frontend implementation completed successfully.</p></div></div></Panel><Panel title="Files / areas changed"><ul>{plan.affectedAreas.map(x=><li key={x}><code>{x}</code></li>)}</ul></Panel><Panel title="Test results"><div className="test-row"><Check size={14}/> Theme persistence — passed</div><div className="test-row"><Check size={14}/> Contrast validation — passed</div><div className="test-row"><Check size={14}/> Frontend regression checks — passed</div></Panel></div><div><Panel title="Decision history">{decisions.map(d=><div className="decision" key={d[0]}><span className="decision-check"><Check size={12}/></span><div><strong>{d[0]}</strong><p>{d[1]}</p><small>Leader • {d[2]}</small></div></div>)}<div className="decision"><span className="decision-check"><Check size={12}/></span><div><strong>Execution approved</strong><p>Approved &amp; Execute</p><small>Leader • 2:49 PM</small></div></div></Panel></div></div></section>; }

function Panel({title,children}:{title:string;children:React.ReactNode}) { return <div className="panel"><div className="panel-title">{title}</div>{children}</div>; }
function ExecStep({title,done=false,active=false}:{title:string;done?:boolean;active?:boolean}) { return <div className={`exec-step ${done?'done':''} ${active?'active':''}`}><span>{done?<Check size={11}/>:active?<Clock3 size={11}/>:''}</span>{title}</div>; }
function SectionHeader({title,subtitle}:{title:string;subtitle:string}) { return <div className="section-header"><div><h2>{title}</h2><span>{subtitle}</span></div></div>; }
function Agent({name,task,active=false}:{name:string;task:string;active?:boolean}) { return <div className="agent-row"><div className="agent-avatar"><Bot size={15}/></div><div className="agent-info"><strong>{name}</strong><span>{task}</span></div><div className={`agent-status ${active?'active':''}`}><span/>{active?'Active':'Idle'}</div></div>; }
