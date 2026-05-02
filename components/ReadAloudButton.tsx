'use client';
import { useState, useEffect } from 'react';
import { stripMarkdown } from '@/lib/stripMarkdown';

const SpeakerIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const StopIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="none" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" />
  </svg>
);

export function ReadAloudButton({ text }: { text: string }) {
  const [reading, setReading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Cancel and restart when text changes while reading
  useEffect(() => {
    if (reading) {
      window.speechSynthesis?.cancel();
      setReading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function read() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const plain = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    utterance.pitch = 1;
    utterance.onend = () => setReading(false);
    utterance.onerror = () => setReading(false);

    window.speechSynthesis.speak(utterance);
    setReading(true);
  }

  function stop() {
    window.speechSynthesis?.cancel();
    setReading(false);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`tx-read${reading ? ' tx-read-on' : ''}`}
      onClick={reading ? stop : read}
      aria-label={reading ? 'Stop reading aloud' : 'Read this answer aloud'}
      aria-pressed={reading}
    >
      {reading ? (
        <><StopIcon size={18} /><span>Stop reading</span></>
      ) : (
        <><SpeakerIcon size={20} /><span>Read this to me</span></>
      )}
    </button>
  );
}
