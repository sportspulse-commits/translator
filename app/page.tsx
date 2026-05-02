'use client';
import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VoiceButton } from '@/components/VoiceButton';
import { StarterExamples } from '@/components/StarterExamples';
import { CopyButton } from '@/components/CopyButton';
import { ScanButton } from '@/components/ScanButton';
import { RefineButtons } from '@/components/RefineButtons';
import { ReadAloudButton } from '@/components/ReadAloudButton';
import { ShareButton } from '@/components/ShareButton';

type Phase = 'idle' | 'loading' | 'answer' | 'error';
type Bucket = 'DECODE' | 'RESPOND' | 'COMPOSE' | 'EXPLAIN' | 'DECIDE' | 'PLAN' | 'VERIFY' | 'CREATE';
type Tone = 'calm' | 'warm' | 'alert';
type Plan = 'free' | 'pro' | 'family';

interface UserMeta {
  signedIn: boolean;
  plan: Plan;
  queriesUsed: number;
  queriesLimit: number;
}

function bucketToTone(bucket: Bucket | null): Tone {
  if (bucket === 'VERIFY') return 'alert';
  if (bucket === 'RESPOND' || bucket === 'COMPOSE' || bucket === 'CREATE') return 'warm';
  return 'calm';
}

function normalizeMarkdown(text: string): string {
  return text
    .replace(/([^\n])\s+(#{1,3}\s)/g, '$1\n\n$2')
    .replace(/([^\n-])\s+-\s(?=\S)/g, '$1\n- ')
    .trim();
}

const AlertIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
  </svg>
);

function WorkingIndicator() {
  return (
    <div className="tx-working" role="status" aria-live="polite">
      <div className="tx-working-dots" aria-hidden="true">
        <span className="tx-dot tx-dot-1" />
        <span className="tx-dot tx-dot-2" />
        <span className="tx-dot tx-dot-3" />
      </div>
      <p className="tx-working-text">Working on it…</p>
    </div>
  );
}

export default function Home() {
  const { isSignedIn } = useUser();
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [answer, setAnswer] = useState<string | null>(null);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [showStarters, setShowStarters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelShown, setCancelShown] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Fetch user plan whenever auth state changes
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(setUserMeta)
      .catch(() => {});
  }, [isSignedIn]);

  async function handleSubmit() {
    if (!input.trim()) return;

    setPhase('loading');
    setShowStarters(false);
    setError(null);
    setCancelShown(false);

    cancelTimerRef.current = setTimeout(() => setCancelShown(true), 8000);
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: abortRef.current.signal,
      });

      clearTimeout(cancelTimerRef.current!);

      if (res.status === 402) {
        setError('limit_reached');
        setPhase('error');
        return;
      }
      if (!res.ok) throw new Error('failed');

      const data = await res.json();
      setAnswer(data.text);
      setBucket(data.bucket ?? null);
      setPhase('answer');

      // Refresh usage count after a successful query
      fetch('/api/me').then(r => r.json()).then(setUserMeta).catch(() => {});

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    } catch (e: unknown) {
      clearTimeout(cancelTimerRef.current!);
      setCancelShown(false);
      if (e instanceof Error && e.name === 'AbortError') {
        setPhase('idle');
      } else {
        setError('Something went wrong. Please try again in a moment.');
        setPhase('error');
      }
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
    clearTimeout(cancelTimerRef.current!);
    setCancelShown(false);
    setPhase('idle');
  }

  function handleReset() {
    abortRef.current?.abort();
    clearTimeout(cancelTimerRef.current!);
    setInput('');
    setAnswer(null);
    setBucket(null);
    setPhase('idle');
    setError(null);
    setCancelShown(false);
    setShowStarters(false);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleStarterPick(prefill: string) {
    setInput(prefill);
    setShowStarters(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(prefill.length, prefill.length);
    }, 50);
  }

  const tone = bucketToTone(bucket);
  const featuresLocked = !userMeta?.signedIn || userMeta?.plan === 'free';
  const isLimitError = error === 'limit_reached';

  return (
    <div className="tx-app">
      <header className="tx-header">
        <div className="tx-wordmark">
          Translator<span className="tx-wordmark-dot">.</span>
        </div>
        <div className="tx-header-right">
          {isSignedIn ? (
            <a href="/account" className="tx-header-link">Account</a>
          ) : (
            <a href="/sign-in" className="tx-header-link">Sign in</a>
          )}
        </div>
      </header>

      <div className="tx-scroll" ref={scrollRef}>
        <div className="tx-stage">

          {/* ── IDLE ── */}
          {phase === 'idle' && (
            <>
              <h1 className="tx-question">What&apos;s going on?</h1>
              <p className="tx-sub">
                Tell us in your own words.<br />
                We&apos;ll write something clear back.
              </p>

              <div className="tx-input-wrap">
                <textarea
                  ref={textareaRef}
                  className="tx-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 4000))}
                  placeholder="Start typing here…"
                  rows={5}
                  spellCheck
                  aria-label="What's going on"
                />
                {input.length >= 3500 && (
                  <p className="tx-input-hint">Showing first 4,000 characters</p>
                )}
              </div>

              <ScanButton
                onText={(t) => setInput(prev => (prev ? prev + '\n\n' : '') + t)}
                locked={featuresLocked}
              />

              <VoiceButton
                onTranscript={(t) => setInput(prev => (prev ? prev + ' ' : '') + t)}
              />

              <StarterExamples
                open={showStarters}
                onPick={handleStarterPick}
                onToggle={() => setShowStarters(s => !s)}
              />

              {userMeta?.signedIn && userMeta.plan === 'free' && (
                <p className="tx-plan-indicator">
                  {userMeta.queriesUsed} of {userMeta.queriesLimit} free queries used this month.{' '}
                  <a href="/account">Upgrade</a>
                </p>
              )}

              <button
                type="button"
                className="tx-help"
                disabled={!input.trim()}
                onClick={handleSubmit}
              >
                Help me
              </button>
            </>
          )}

          {/* ── LOADING ── */}
          {phase === 'loading' && (
            <>
              <div className="tx-recap">
                <div className="tx-recap-label">You said</div>
                <p className="tx-recap-text">{input}</p>
              </div>
              <WorkingIndicator />
              {cancelShown && (
                <div className="tx-cancel">
                  <button type="button" className="tx-cancel-btn" onClick={handleCancel}>
                    This is taking longer than usual. Cancel and try again.
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── ANSWER ── */}
          {phase === 'answer' && answer && (
            <>
              <div className="tx-recap tx-recap-collapsed">
                <div className="tx-recap-label">You said</div>
                <p className="tx-recap-text">{input}</p>
              </div>

              <p className="tx-answer-label">Here&apos;s what to do</p>

              <div className={`tx-answer tx-answer-${tone}`}>
                {tone === 'alert' && (
                  <div className="tx-answer-flag">
                    <AlertIcon size={16} />
                    <span>Heads up</span>
                  </div>
                )}
                <div className="tx-answer-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {normalizeMarkdown(answer)}
                  </ReactMarkdown>
                </div>
              </div>

              <RefineButtons answer={answer} onRefined={setAnswer} locked={featuresLocked} />

              <CopyButton text={answer} />
              <ReadAloudButton text={answer} />
              <ShareButton text={answer} />

              <button type="button" className="tx-restart" onClick={handleReset}>
                Start over
              </button>

              <p className="tx-disclaimer">
                Translator gives you a starting point. For big decisions, talk to a person you trust.
              </p>
            </>
          )}

          {/* ── ERROR ── */}
          {phase === 'error' && (
            <>
              {isLimitError ? (
                <>
                  <p className="tx-error" role="alert">
                    You&apos;ve used all your queries for this month.
                  </p>
                  <a href="/account" className="tx-help" style={{ textDecoration: 'none', textAlign: 'center' }}>
                    See upgrade options →
                  </a>
                </>
              ) : (
                <>
                  <p className="tx-error" role="alert">{error}</p>
                  <button
                    type="button"
                    className="tx-help"
                    disabled={!input.trim()}
                    onClick={handleSubmit}
                  >
                    Help me
                  </button>
                </>
              )}
              <button type="button" className="tx-restart" onClick={handleReset}>
                Start over
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
