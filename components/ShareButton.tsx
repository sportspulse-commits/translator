'use client';
import { useState } from 'react';
import { stripMarkdown } from '@/lib/stripMarkdown';

const ShareIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const CheckIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function ShareButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);

  async function share() {
    const plain = stripMarkdown(text);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'From Translator', text: plain });
        flash();
        return;
      } catch {
        // user cancelled — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(plain);
      flash();
    } catch {
      // silent fail — clipboard blocked (e.g. iframe)
    }
  }

  function flash() {
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <button
      type="button"
      className={`tx-share${done ? ' tx-share-done' : ''}`}
      onClick={share}
      aria-label="Share this answer"
    >
      {done ? (
        <><CheckIcon size={20} /><span>Shared!</span></>
      ) : (
        <><ShareIcon size={20} /><span>Share with family</span></>
      )}
    </button>
  );
}
