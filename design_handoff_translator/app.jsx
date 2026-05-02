// The Translator app — single-screen flow.
// State machine: idle -> typing -> loading -> answer (or error)
// Voice has its own substates: idle -> requesting -> listening -> done

const { useState, useRef, useEffect } = React;

// ──────────────────────────────────────────────────────────────────────
// Tokens — applied as CSS variables on the root container.
// Keeping them in JS so Tweaks can override them live.
// ──────────────────────────────────────────────────────────────────────
const PALETTE = {
  bg: "#faf7f2",        // warm off-white
  bgSunk: "#f1ece1",    // a touch deeper for the "page within page" feel
  ink: "#1a1714",       // deep warm ink
  inkSoft: "#4a443d",   // body soft
  inkMute: "#8a8278",   // hints, captions
  rule: "#1a1714",      // 2px borders
  ruleSoft: "#d9d2c4",  // dividers
  accent: "#1f5d4c",    // forest green — primary action, trust
  accentInk: "#0f3d31",
  cream: "#fdf6dd",     // answer card
  creamRule: "#e6d896",
  alert: "#a8472a",     // terra-cotta, VERIFY
  alertSoft: "#fbeee5",
  alertRule: "#dba488",
  warmCard: "#f5ecd9",  // RESPOND/COMPOSE/CREATE answer
  warmRule: "#d9c79a",
};

// ──────────────────────────────────────────────────────────────────────
// Icons — minimal, drawn small, no decoration
// ──────────────────────────────────────────────────────────────────────
const MicIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

const CopyIcon = ({ size = 22, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);

const CheckIcon = ({ size = 22, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const AlertIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
  </svg>
);

// ──────────────────────────────────────────────────────────────────────
// Loading dots — three pulsing circles, slow rhythm
// ──────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────
// Voice button — mic icon + label, three states
// ──────────────────────────────────────────────────────────────────────
function VoiceButton({ listening, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`tx-voice ${listening ? "tx-voice-on" : ""}`}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice typing" : "Start voice typing"}
    >
      <span className="tx-voice-icon" aria-hidden="true">
        <MicIcon size={22} />
        {listening && <span className="tx-voice-pulse" />}
      </span>
      <span className="tx-voice-label">
        {listening ? "Listening… tap to stop" : "Talk instead of typing"}
      </span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Starter examples — collapsible list of 6 prefill options
// ──────────────────────────────────────────────────────────────────────
function StarterExamples({ open, onToggle, onPick }) {
  const items = window.SCENARIO_ORDER
    .slice(0, 6)
    .map((id) => window.SCENARIOS[id]);
  return (
    <div className="tx-starters">
      <button
        type="button"
        onClick={onToggle}
        className="tx-starters-toggle"
        aria-expanded={open}
      >
        {open ? "Hide examples" : "Show me what to ask"}
      </button>
      {open && (
        <ul className="tx-starters-list">
          {items.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="tx-starter-item"
              >
                <span className="tx-starter-label">{s.starter}</span>
                <ArrowIcon size={18} color={PALETTE.inkMute} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Answer card — renders the translated response
// Tone styling differs: alert (terra-cotta, scam), warm (correspondence),
// calm (everything else, the cream default)
// ──────────────────────────────────────────────────────────────────────
function AnswerCard({ tone, paragraphs, bucket }) {
  return (
    <div className={`tx-answer tx-answer-${tone}`}>
      {tone === "alert" && (
        <div className="tx-answer-flag">
          <AlertIcon size={20} />
          <span>Heads up</span>
        </div>
      )}
      <div className="tx-answer-body">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Demo picker — small footer-row of dots that lets you preview each
// scenario without typing the whole input. Hidden when Tweaks is on.
// ──────────────────────────────────────────────────────────────────────
function DemoPicker({ activeId, onPick }) {
  return (
    <div className="tx-demo">
      <div className="tx-demo-label">Try a scenario</div>
      <div className="tx-demo-row">
        {window.SCENARIO_ORDER.map((id) => {
          const s = window.SCENARIOS[id];
          return (
            <button
              key={id}
              type="button"
              className={`tx-demo-chip ${activeId === id ? "tx-demo-chip-on" : ""}`}
              onClick={() => onPick(s)}
              title={s.label}
            >
              {s.bucket}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Main app
// ──────────────────────────────────────────────────────────────────────
function TranslatorApp({ tweaks = {}, onResetSignal, hideDemoPicker = false }) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | answer | error
  const [activeScenario, setActiveScenario] = useState(null);
  const [showStarters, setShowStarters] = useState(false);
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);
  const loadingTimerRef = useRef(null);

  // External reset hook (used by canvas wrapper, if any)
  useEffect(() => {
    if (onResetSignal == null) return;
    handleReset();
  }, [onResetSignal]);

  function handleSubmit() {
    if (!input.trim()) return;
    setPhase("loading");
    setShowStarters(false);

    // Simulated pipeline latency — 2.4s
    clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setPhase("answer");
      // Scroll the answer into view smoothly inside the scroll container
      requestAnimationFrame(() => {
        const el = document.querySelector(".tx-answer");
        const scroller = document.querySelector(".tx-scroll");
        if (el && scroller) {
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
        }
      });
    }, 2400);
  }

  function handleReset() {
    clearTimeout(loadingTimerRef.current);
    setInput("");
    setActiveScenario(null);
    setPhase("idle");
    setListening(false);
    setShowStarters(false);
    setCopied(false);
    const scroller = document.querySelector(".tx-scroll");
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStarterPick(scenario) {
    setInput(scenario.prefill);
    setShowStarters(false);
    setTimeout(() => {
      textareaRef.current?.focus();
      const len = scenario.prefill.length;
      textareaRef.current?.setSelectionRange(len, len);
    }, 50);
  }

  function handleDemoPick(scenario) {
    // Demo shortcut: load the full input and run pipeline.
    setActiveScenario(scenario);
    setInput(scenario.input);
    setPhase("loading");
    setShowStarters(false);
    clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setPhase("answer");
      requestAnimationFrame(() => {
        const scroller = document.querySelector(".tx-scroll");
        if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
      });
    }, 2400);
  }

  function handleVoiceToggle() {
    // Simulated voice: tap once -> "listening", after 2.5s drop a transcript
    if (listening) {
      setListening(false);
      return;
    }
    setListening(true);
    setTimeout(() => {
      setListening(false);
      setInput((prev) =>
        (prev ? prev + " " : "") +
        "I got a letter from Medicare and I don't understand what they want me to do."
      );
      textareaRef.current?.focus();
    }, 2600);
  }

  async function handleCopy() {
    if (!activeScenario) return;
    const text = activeScenario.answer.join("\n\n");
    try {
      await navigator.clipboard?.writeText(text);
    } catch (e) {
      /* clipboard may be unavailable in iframe — visual feedback only */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // Resolve the response once we have an active scenario; otherwise show a
  // generic fallback (in case the user typed something that isn't in our
  // mock library).
  const resolvedScenario = activeScenario || guessScenario(input);
  const tone = resolvedScenario?.tone || "calm";

  // Detect submit-with-no-known-scenario: still works, just less interesting.
  function onSubmitClick() {
    if (!activeScenario) {
      const guessed = guessScenario(input);
      if (guessed) setActiveScenario(guessed);
    }
    handleSubmit();
  }

  // ──────────── render ────────────
  const fontScale = tweaks.fontScale ?? 1;
  const showVoice = tweaks.showVoice ?? true;

  return (
    <div className="tx-app" style={{ "--tx-font-scale": fontScale }}>
      <header className="tx-header">
        <div className="tx-wordmark">Translator</div>
      </header>

      <div className="tx-scroll">
        <div className="tx-stage">
          {phase === "idle" && (
            <>
              <h1 className="tx-question">What's going on?</h1>
              <p className="tx-sub">Tell us in your own words. We'll write something clear back.</p>

              <div className="tx-input-wrap">
                <textarea
                  ref={textareaRef}
                  className="tx-input"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (activeScenario) setActiveScenario(null);
                  }}
                  placeholder="Start typing here…"
                  rows={5}
                  spellCheck="true"
                  aria-label="What's going on"
                />
              </div>

              {showVoice && (
                <VoiceButton
                  listening={listening}
                  onToggle={handleVoiceToggle}
                />
              )}

              <StarterExamples
                open={showStarters}
                onToggle={() => setShowStarters((v) => !v)}
                onPick={handleStarterPick}
              />

              <button
                type="button"
                className="tx-help"
                disabled={!input.trim()}
                onClick={onSubmitClick}
              >
                Help me
              </button>

              {!hideDemoPicker && (
                <DemoPicker activeId={null} onPick={handleDemoPick} />
              )}
            </>
          )}

          {phase === "loading" && (
            <>
              <div className="tx-recap">
                <div className="tx-recap-label">You said</div>
                <p className="tx-recap-text">{input}</p>
              </div>
              <WorkingIndicator />
            </>
          )}

          {phase === "answer" && resolvedScenario && (
            <>
              <div className="tx-recap tx-recap-collapsed">
                <div className="tx-recap-label">You said</div>
                <p className="tx-recap-text">{input}</p>
              </div>

              <div className="tx-answer-label">Here's what to do</div>
              <AnswerCard
                tone={resolvedScenario.tone}
                paragraphs={resolvedScenario.answer}
                bucket={resolvedScenario.bucket}
              />

              <button
                type="button"
                className={`tx-copy ${copied ? "tx-copy-done" : ""}`}
                onClick={handleCopy}
              >
                {copied ? (
                  <><CheckIcon size={22} /> Copied</>
                ) : (
                  <><CopyIcon size={22} /> Copy this</>
                )}
              </button>

              <button
                type="button"
                className="tx-restart"
                onClick={handleReset}
              >
                Start over
              </button>

              <p className="tx-disclaimer">
                Translator gives you a starting point. For big decisions, talk to
                a person you trust.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Best-effort scenario lookup based on input content.
function guessScenario(input) {
  if (!input) return null;
  const lower = input.toLowerCase();
  for (const id of window.SCENARIO_ORDER) {
    const s = window.SCENARIOS[id];
    if (lower.includes(s.input.toLowerCase().slice(0, 30))) return s;
  }
  return null;
}

window.TranslatorApp = TranslatorApp;
window.PALETTE = PALETTE;
