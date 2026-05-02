'use client';
import { useRef, useState } from 'react';

async function resizeToBase64(file: File, maxDim = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load_failed')); };
    img.src = url;
  });
}

const ScanIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

const LockIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export function ScanButton({ onText, locked = false }: { onText: (text: string) => void; locked?: boolean }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (locked) {
    return (
      <a href="/account" className="tx-scan tx-scan-locked" aria-label="Upgrade to Pro to scan documents">
        <ScanIcon size={22} />
        <span>Scan a letter</span>
        <span className="tx-locked-badge"><LockIcon size={13} /> Pro</span>
      </a>
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;

    setScanning(true);
    setError(null);

    try {
      const { base64, mimeType } = await resizeToBase64(file);
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      if (res.status === 401) { window.location.href = '/sign-in'; return; }
      if (res.status === 403) { window.location.href = '/account'; return; }
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'failed');
      onText(data.text);
    } catch {
      setError("Couldn't read that image. Try typing your question instead.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        aria-hidden="true"
        onChange={handleFile}
      />
      <button
        type="button"
        className={`tx-scan${scanning ? ' tx-scan-loading' : ''}`}
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        aria-label="Scan a letter or document"
      >
        <ScanIcon size={22} />
        <span>{scanning ? 'Reading your letter…' : 'Scan a letter'}</span>
      </button>
      {error && <p className="tx-scan-error" role="status">{error}</p>}
    </>
  );
}
