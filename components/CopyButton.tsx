'use client';
import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2500); }
      finally { document.body.removeChild(ta); }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-4 w-full px-6 py-5 rounded-xl bg-green-700 text-white text-2xl font-medium"
      aria-live="polite"
    >
      {copied ? 'Copied!' : 'Copy this'}
    </button>
  );
}
