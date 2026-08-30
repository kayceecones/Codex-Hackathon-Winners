import { pipeline, phaseIndex, phaseStatus, type Phase, type WorkflowState } from '../workflow';

/** Chart space. Hexagons sit on one row, joined by short connectors. */
const W = 760;
const H = 132;
const R = 27;      // hex circumradius
const TOP = 46;    // hex centre y

/** Flat-top hexagon path centred on (cx, cy). */
function hex(cx: number, cy: number, r: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(cx + r * Math.sin(a + Math.PI / 2)).toFixed(2)},${(cy - r * Math.cos(a + Math.PI / 2)).toFixed(2)}`;
    })
    .join(' ');
}

export default function ObjectiveTracker({
  state,
  onPick,
  picked,
}: {
  state: WorkflowState;
  onPick?: (id: Phase['id']) => void;
  picked?: Phase['id'] | null;
}) {
  const here = phaseIndex(state);
  const step = (W - R * 2) / (pipeline.length - 1);
  const xs = pipeline.map((_, i) => R + i * step);

  return (
    <svg className="tracker" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Objective pipeline">
      {/* Connectors: lit only where the run has already passed. */}
      {xs.slice(0, -1).map((x, i) => (
        <line
          key={i}
          className={`trk-link ${here > i ? 'is-done' : ''}`}
          x1={x + R - 4}
          y1={TOP}
          x2={xs[i + 1] - R + 4}
          y2={TOP}
        />
      ))}

      {pipeline.map((phase, i) => {
        const status = phaseStatus(phase, state);
        const x = xs[i];
        return (
          <g key={phase.id} className={`trk-node is-${status}`}>
            {status === 'current' && <polygon className="trk-ring" points={hex(x, TOP, R + 6)} />}
            <polygon className="trk-hex" points={hex(x, TOP, R)} />
            <text className="trk-glyph" x={x} y={TOP + 6}>
              {phase.glyph}
            </text>
            <text className="trk-label" x={x} y={TOP + R + 22}>
              {phase.label}
            </text>
            {onPick && (
              <polygon
                className="trk-hit"
                points={hex(x, TOP, R + 4)}
                tabIndex={0}
                role="button"
                aria-label={`${phase.label} — ${status}`}
                aria-pressed={picked === phase.id}
                onClick={() => onPick(phase.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick(phase.id);
                  }
                }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
