import { feed } from '../workflow';

const glyph: Record<string, string> = { go: '✓', warn: '!', hold: '‖', stop: '✕', info: '◈' };

export default function EventFeed() {
  return (
    <section className="feed">
      <div className="sec-head">
        Live Event Feed
        <span className="count">{feed.length} events</span>
      </div>
      <div className="feed-rail">
        {feed.map((e) => (
          <article className="ev" key={e.at + e.type}>
            <div className={`ev-ico tone-${e.tone}`}>{glyph[e.tone]}</div>
            <div>
              <div className={`ev-type tone-${e.tone}`} style={{ background: 'none', border: 0, padding: 0 }}>
                {e.type}
              </div>
              <div className="ev-meta">
                {e.at} · {e.actor} · {e.tag}
              </div>
              <div className="ev-detail">{e.detail}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
