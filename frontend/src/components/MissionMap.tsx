import { useMemo, useState } from 'react';
import { Check, CircleDot, Radio, Rocket, Target, Users } from 'lucide-react';
import {
  mission as defaultMission,
  missionProgress,
  offRoute,
  phaseStatus,
  route,
  routeIndex,
  type Mission,
  type Phase,
} from '../mission';

/** Chart coordinate space. Nodes and the SVG trajectory share it. */
const VB = { w: 1000, h: 240, padX: 78, midY: 122, amp: 40, viewY: 18, viewH: 212 };

function nodePoints() {
  const span = VB.w - VB.padX * 2;
  return route.map((phase, i) => {
    const t = i / (route.length - 1);
    return {
      phase,
      x: VB.padX + t * span,
      // A gentle wave keeps the route from reading as a plain progress bar.
      y: VB.midY + Math.sin(t * Math.PI * 2) * VB.amp,
    };
  });
}

/** Catmull-Rom through the waypoints, emitted as cubic beziers. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${
      p2.y - (p3.y - p1.y) / 6
    }, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function MissionMap({
  mission = defaultMission,
  compact = false,
  onOpen,
}: {
  mission?: Mission;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const pts = useMemo(nodePoints, []);
  const path = useMemo(() => smoothPath(pts), [pts]);
  const here = routeIndex(mission.currentState);
  const progress = missionProgress(mission.currentState);
  const detour = here < 0 ? offRoute[mission.currentState as 'on_hold' | 'exited'] : null;

  const [picked, setPicked] = useState<Phase['id'] | null>(null);
  const focus = route.find((p) => p.id === (picked ?? mission.currentState)) ?? route[0];
  const ship = pts[Math.max(here, 0)];

  return (
    <section className={`mission-map ${compact ? 'is-compact' : ''}`}>
      <header className="mission-head">
        <div className="mission-id">
          <span className="mission-badge">
            <Rocket size={13} />
          </span>
          <div>
            <div className="mission-codename">{mission.codename}</div>
            <h2>{mission.project}</h2>
          </div>
        </div>

        <div className="mission-facts">
          <Fact label="OBJECTIVE" value={mission.objective} wide />
          <Fact label="PLAN" value={`v${mission.planVersion}`} />
          <Fact label="COMMANDER" value={mission.leader} />
        </div>
      </header>

      <div className="mission-statusline">
        <span className={`mission-state ${detour ? 'is-detour' : ''}`}>
          <Radio size={11} /> {detour ? detour.callsign : route[here]?.callsign}
        </span>
        <span className="mission-repo">{mission.repo}</span>
        <span className="mission-progress-read">
          {detour ? 'OFF ROUTE' : `${Math.round(progress * 100)}% OF ROUTE`}
        </span>
      </div>

      <div className="chart-wrap">
        <svg className="chart" viewBox={`0 ${VB.viewY} ${VB.w} ${VB.viewH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <linearGradient id="mm-travelled" x1="0" x2="1">
              <stop offset="0%" stopColor="#61e7ff" />
              <stop offset="100%" stopColor="#a98cff" />
            </linearGradient>
            <filter id="mm-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Full trajectory, dim and dashed. */}
          <path className="chart-route" d={path} />
          {/* Travelled portion. pathLength=1 lets the dash array read as a fraction. */}
          {!detour && (
            <path
              className="chart-travelled"
              d={path}
              pathLength={1}
              strokeDasharray={`${progress} 1`}
              filter="url(#mm-glow)"
            />
          )}

          {pts.map(({ phase, x, y }) => {
            const status = detour ? 'upcoming' : phaseStatus(phase, mission.currentState);
            return (
              <g key={phase.id} className={`chart-node is-${status}`}>
                <circle className="node-orbit" cx={x} cy={y} r={19} />
                <circle className="node-core" cx={x} cy={y} r={7} />
                {status === 'current' && <circle className="node-pulse" cx={x} cy={y} r={19} />}
                <text className="node-code" x={x} y={y - 50}>
                  {phase.code}
                </text>
                <text className="node-label" x={x} y={y + 44}>
                  {phase.label}
                </text>
                {phase.at && <text className="node-time" x={x} y={y + 60}>{phase.at}</text>}
              </g>
            );
          })}

          {!detour && ship && (
            <g className="chart-ship" transform={`translate(${ship.x} ${ship.y})`}>
              <circle className="ship-halo" r={27} />
              <circle className="ship-dot" r={4} />
            </g>
          )}
        </svg>

        {/* Clickable overlay: keeps the SVG presentational and the hit targets real buttons. */}
        <div className="chart-hits">
          {pts.map(({ phase, x, y }) => {
            const status = detour ? 'upcoming' : phaseStatus(phase, mission.currentState);
            const crew = mission.crew.filter((c) => c.station === phase.id);
            return (
              <button
                key={phase.id}
                type="button"
                className={`hit is-${status} ${focus.id === phase.id ? 'is-focus' : ''}`}
                style={{ left: `${(x / VB.w) * 100}%`, top: `${((y - VB.viewY) / VB.viewH) * 100}%` }}
                onClick={() => setPicked(phase.id)}
                aria-label={`${phase.label} — ${status}`}
              >
                {crew.length > 0 && (
                  <span className="hit-crew">
                    {crew.map((c) => (
                      <span key={c.name} className={`crew-chip crew-${c.initials.toLowerCase()}`} title={`${c.name} — ${c.role}`}>
                        {c.initials}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {detour && (
        <div className="mission-detour">
          <CircleDot size={14} /> <strong>{detour.label}</strong> — {detour.blurb}
        </div>
      )}

      {!compact && (
        <div className="mission-detail">
          <div className="detail-main">
            <div className="detail-top">
              <span className="detail-code">{focus.code}</span>
              <div>
                <div className="detail-callsign">{focus.callsign}</div>
                <h3>{focus.label}</h3>
              </div>
              <StatusPill status={detour ? 'upcoming' : phaseStatus(focus, mission.currentState)} />
            </div>
            <p>{focus.blurb}</p>
            <div className="detail-meta">
              <span>
                <Users size={12} /> {focus.crew}
              </span>
              {focus.at && (
                <span>
                  <Check size={12} /> reached {focus.at}
                </span>
              )}
            </div>
          </div>

          <div className="detail-crew">
            <div className="detail-crew-title">
              <Target size={12} /> CREW STATIONS
            </div>
            {mission.crew.map((c) => {
              const at = route.find((p) => p.id === c.station);
              return (
                <div className="crew-row" key={c.name}>
                  <span className={`crew-chip crew-${c.initials.toLowerCase()}`}>{c.initials}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <span>{c.role}</span>
                  </div>
                  <span className="crew-station">{at?.label ?? '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {compact && onOpen && (
        <button className="mission-open" type="button" onClick={onOpen}>
          Open mission map
        </button>
      )}
    </section>
  );
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`fact ${wide ? 'is-wide' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: 'done' | 'current' | 'upcoming' }) {
  const copy = { done: 'CLEARED', current: 'ACTIVE', upcoming: 'PENDING' }[status];
  return <span className={`status-pill is-${status}`}>{copy}</span>;
}
