'use client';
import { useState } from 'react';

const ShorterIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="5" x2="21" y2="5" />
    <line x1="3" y1="10" x2="16" y2="10" />
    <line x1="3" y1="15" x2="11" y2="15" />
  </svg>
);

const LongerIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="5" x2="21" y2="5" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="3" y1="20" x2="14" y2="20" />
  </svg>
);

const LockIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export function RefineButtons({
  answer,
  onRefined,
  locked = false,
}: {
  answer: string;
  onRefined: (text: string) => void;
  locked?: boolean;
}) {
  const [loading, setLoading] = useState<'shorter' | 'longer' | null>(null);

  if (locked) {
    return (
      <div className="tx-refine-row">
        <a href="/account" className="tx-refine-btn tx-refine-locked" aria-label="Upgrade to Pro for Shorter / More detail">
          <ShorterIcon size={17} />
          <span>Shorter / More detail</span>
          <span className="tx-locked-badge"><LockIcon size={13} /> Pro</span>
        </a>
      </div>
    );
  }

  async function refine(direction: 'shorter' | 'longer') {
    if (loading) return;
    setLoading(direction);
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer, direction }),
      });
      if (res.status === 401) { window.location.href = '/sign-in'; return; }
      if (res.status === 403) { window.location.href = '/account'; return; }
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      if (data.text) onRefined(data.text);
    } catch {
      // keep original on failure
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="tx-refine-row">
      <button
        type="button"
        className="tx-refine-btn"
        onClick={() => refine('shorter')}
        disabled={loading !== null}
        aria-label="Make the answer shorter"
      >
        <ShorterIcon size={17} />
        <span>{loading === 'shorter' ? 'Shortening…' : 'Shorter'}</span>
      </button>
      <button
        type="button"
        className="tx-refine-btn"
        onClick={() => refine('longer')}
        disabled={loading !== null}
        aria-label="Add more detail to the answer"
      >
        <LongerIcon size={17} />
        <span>{loading === 'longer' ? 'Expanding…' : 'More detail'}</span>
      </button>
    </div>
  );
}
