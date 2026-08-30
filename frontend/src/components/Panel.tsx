import type { ReactNode } from 'react';

/** Notched panel. Outer element paints the edge, inner paints the fill. */
export default function Panel({
  title,
  count,
  tone,
  children,
}: {
  title?: string;
  count?: string;
  tone?: 'accent' | 'go';
  children: ReactNode;
}) {
  return (
    <div className={`panel ${tone ? `is-${tone}` : ''}`}>
      <div className="panel-in">
        {title && (
          <div className="sec-head">
            {title}
            {count && <span className="count">{count}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
