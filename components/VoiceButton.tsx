'use client';
import { useState, useRef, useEffect } from 'react';

export function VoiceButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (typeof window !== 'undefined') &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) setSupported(false);
  }, []);

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
    rec.onresult = (e: any) => onTranscript(e.results[0][0].transcript);
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) {
    return (
      <p className="text-lg text-gray-700">
        Voice typing isn&apos;t available on this device. Please type instead.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-full text-xl font-medium border-2 ${
        listening ? 'bg-red-50 border-red-600 text-red-700' : 'bg-white border-gray-700 text-gray-900'
      }`}
      aria-label={listening ? 'Stop recording' : 'Start voice typing'}
    >
      <span aria-hidden>🎤</span>
      <span>{listening ? 'Listening… tap to stop' : 'Talk instead of typing'}</span>
    </button>
  );
}
