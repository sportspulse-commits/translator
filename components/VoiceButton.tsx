'use client';
import { useState, useRef, useEffect } from 'react';

const MicIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

export function VoiceButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  function showError(msg: string) {
    setVoiceError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setVoiceError(null), 8000);
  }

  function start() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      onTranscript(e.results[0][0].transcript);
    };
    rec.onerror = () => {
      setListening(false);
      showError('Voice didn\'t work. Please type instead.');
    };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    setVoiceError(null);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // Still detecting support
  if (supported === null) return null;

  if (!supported) {
    return (
      <p className="tx-voice-unsupported">
        Voice typing isn&apos;t available on this device.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`tx-voice${listening ? ' tx-voice-on' : ''}`}
        aria-pressed={listening}
        aria-label={listening ? 'Stop voice typing' : 'Start voice typing'}
      >
        <span className="tx-voice-icon" aria-hidden="true">
          <MicIcon size={22} />
          {listening && <span className="tx-voice-pulse" />}
        </span>
        <span>{listening ? 'Listening… tap to stop' : 'Talk instead of typing'}</span>
      </button>
      {voiceError && (
        <p className="tx-voice-error" role="status">{voiceError}</p>
      )}
    </>
  );
}
