'use client';
import { useState } from 'react';
import type { Plan } from '@/lib/plan';

export function AccountActions({ plan }: { plan: Plan; hasStripe: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(targetPlan: 'pro' | 'family') {
    setLoading(targetPlan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  async function portal() {
    setLoading('portal');
    try {
      const res = await fetch('/api/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  if (plan !== 'free') {
    return (
      <div className="tx-account-actions">
        <button
          type="button"
          className="tx-manage-btn"
          onClick={portal}
          disabled={loading !== null}
        >
          {loading === 'portal' ? 'Opening…' : 'Manage subscription'}
        </button>
      </div>
    );
  }

  return (
    <div className="tx-account-actions">
      <div className="tx-upgrade-option">
        <div className="tx-upgrade-name">Pro — $8 / month</div>
        <div className="tx-upgrade-desc">
          100 queries · Scan documents · Shorter / More detail
        </div>
        <button
          type="button"
          className="tx-upgrade-btn"
          onClick={() => checkout('pro')}
          disabled={loading !== null}
        >
          {loading === 'pro' ? 'Redirecting…' : 'Upgrade to Pro'}
        </button>
      </div>

      <div className="tx-upgrade-option tx-upgrade-option-alt">
        <div className="tx-upgrade-name">Family — $18 / month</div>
        <div className="tx-upgrade-desc">
          Unlimited queries · All features · Up to 5 family members (coming soon)
        </div>
        <button
          type="button"
          className="tx-upgrade-btn tx-upgrade-btn-alt"
          onClick={() => checkout('family')}
          disabled={loading !== null}
        >
          {loading === 'family' ? 'Redirecting…' : 'Upgrade to Family'}
        </button>
      </div>
    </div>
  );
}
