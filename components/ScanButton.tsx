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

export function ScanButton({ onText }: { onText: (text: string) => void }) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        <span className="tx-voice-icon" aria-hidden="true">
          <ScanIcon size={22} />
        </span>
        <span>{scanning ? 'Reading your letter…' : 'Scan a letter'}</span>
      </button>
      {error && <p className="tx-scan-error" role="status">{error}</p>}
    </>
  );
}
