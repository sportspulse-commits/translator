'use client';
import { useState, useRef } from 'react';
import { VoiceButton } from '@/components/VoiceButton';
import { StarterExamples } from '@/components/StarterExamples';
import { CopyButton } from '@/components/CopyButton';

export default function Home() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStarters, setShowStarters] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 25000);

    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: ac.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setResponse(data.text);
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  function handleStarterPick(text: string) {
    setInput(text);
    setShowStarters(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleReset() {
    setInput('');
    setResponse(null);
    setError(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const helpDisabled = !input.trim() || loading;

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-semibold text-gray-900 self-start mb-6">
        What&apos;s going on?
      </h1>

      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value.slice(0, 4000))}
        placeholder="Tell us in your own words."
        className="w-full min-h-[180px] p-4 text-xl rounded-lg border-2 border-gray-700 focus:border-blue-700 focus:outline-none focus:ring-0"
        disabled={loading}
      />

      <div className="w-full mt-4">
        <VoiceButton onTranscript={(t) => setInput(prev => (prev ? prev + ' ' : '') + t)} />
      </div>

      <div className="w-full mt-4">
        <StarterExamples
          open={showStarters}
          onPick={handleStarterPick}
          onToggle={() => setShowStarters(s => !s)}
        />
      </div>

      {!loading && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={helpDisabled}
          className={`w-full mt-6 py-5 rounded-xl text-2xl font-medium ${
            helpDisabled
              ? 'bg-gray-200 text-gray-500'
              : 'bg-green-700 text-white'
          }`}
        >
          Help me
        </button>
      )}

      {loading && (
        <div className="mt-8 text-center" aria-live="polite">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900" />
          <p className="mt-4 text-xl text-gray-800">Working on it…</p>
        </div>
      )}

      {response && !loading && (
        <div className="mt-8 w-full">
          <p className="text-lg text-gray-700 mb-2">Here&apos;s your answer</p>
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-xl leading-relaxed whitespace-pre-wrap text-gray-900">
            {response}
          </div>
          <CopyButton text={response} />
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 w-full text-xl text-blue-700 underline text-center"
          >
            Start over
          </button>
        </div>
      )}

      {error && !loading && (
        <p className="mt-6 text-xl text-red-700" role="alert">{error}</p>
      )}
    </main>
  );
}
