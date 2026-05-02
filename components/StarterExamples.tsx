'use client';
import { STARTERS } from '@/lib/starters';

const ArrowIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" style={{ flexShrink: 0, color: 'var(--tx-ink-mute)' }}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export function StarterExamples({
  open, onPick, onToggle,
}: {
  open: boolean;
  onPick: (prefill: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="tx-starters">
      <button
        type="button"
        onClick={onToggle}
        className="tx-starters-toggle"
        aria-expanded={open}
      >
        {open ? 'Hide examples' : 'Show me what to ask'}
      </button>
      {open && (
        <ul className="tx-starters-list">
          {STARTERS.map(s => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => onPick(s.prefill)}
                className="tx-starter-item"
              >
                <span className="tx-starter-label">{s.label}</span>
                <ArrowIcon size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
