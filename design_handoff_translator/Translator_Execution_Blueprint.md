# Translator — Full Execution Blueprint

> Generated for Kobe Peery. Working name: **Translator**. Single-screen AI app for older adults.

---

## Pushback (read first)

Before the blueprint, three things in the spec that will cause real problems if not surfaced now:

**1. The 4-stage pipeline blows the latency budget.** Four sequential Claude calls — Haiku classifier, Haiku optimizer, Sonnet answer, Haiku post-processor — at realistic API latencies (700ms–2.5s each) gives a p50 around 5–7 seconds and p95 well over 10. The ≤6s budget is already tight at p50 and broken at p95. For a 70-year-old staring at a "Working on it…" spinner, p95 is what they remember. Phase 2 mitigations: collapse Stage 1+2 into one call, stream Stage 3, drop Stage 4 to deterministic regex+rules for most edits.

**2. Stage 4 (LLM post-processor) is the wrong tool.** Asking an LLM to "not alter factual content, only formatting and language" is asking it to do the one thing LLMs are worst at — bounded edits without drift. It will paraphrase a verbatim-preserved $4,732.18 into "about $4,700" roughly 2–5% of the time. For a VERIFY response telling someone they're being scammed, that's catastrophic. Stage 4 is 90% deterministic (regex strip of AI-tells, length truncation, reading-level check) with LLM fallback only when rules can't fix it.

**3. "No accounts, no database" in V1 means you cannot debug.** When test case #27 fails in production, you have no logs, no replay, no idea what the classifier returned. You don't need user accounts, but you need anonymous request logging from day one. Built in.

---

# 1. SYSTEM OVERVIEW

## What is being built

A single-screen web app that accepts unstructured natural-language input from older users and returns a finished, plain-language, copy-ready response. Between input and output sits a hidden 4-stage prompt pipeline that classifies the request, rewrites it into a structured expert prompt, generates an answer, and flattens the answer to 7th-8th grade reading level. The user sees none of the machinery.

## Why it works (mechanism-level)

Older users don't fail at AI because they lack capability. They fail at three specific friction points:

- **(a)** they don't know what to type
- **(b)** they hedge and ramble in ways that confuse models
- **(c)** they get back jargon-filled output that requires another round of decoding

This product solves each:

- **(a)** is solved by removing all categorical choices and offering 6 concrete starter examples instead of a blinking cursor.
- **(b)** is solved by Stage 2 — the optimizer rewrites their hedged, polite, fact-rich-but-disorganized input into a structured XML prompt that gives Sonnet 4.6 the scaffolding it needs to produce a high-quality answer.
- **(c)** is solved by Stage 4 — every response is forced through a flattening pass that strips AI tells, caps length, and enforces reading level.

The bucket classification is the load-bearing piece. A "decode this letter from Medicare" request and a "help me reply to my grandson" request need fundamentally different prompt structures. Generic ChatGPT-style single-prompt systems can't do this because they have no way to know which structure to apply. A router lets each bucket have its own purpose-built optimizer.

## Key risks and failure points (non-generic)

1. **Misclassification cascade.** If the classifier puts a VERIFY ("is this a scam?") request into EXPLAIN, the user gets a calm explanation of how Medicare fraud works instead of "this is a scam, do not call the number." Misclassification in this app has asymmetric downside.
2. **Stage 4 hallucination.** LLM post-processors paraphrase. The instruction "do not alter facts" is statistically ignored ~2-5% of the time.
3. **Verbatim preservation drift.** The user types "policy #4471-882-X" and somewhere across three model calls it becomes "policy #4471-882" or worse, "your policy number." This is the failure mode that makes the app dangerous in VERIFY and DECODE.
4. **First-token latency on Stage 3.** Sonnet answer generation for a 400-word PLAN response takes 3-5 seconds on its own. Combined with three other sequential calls, the total cold-path is brutal.
5. **Voice input failure on iOS Safari.** Web Speech API is inconsistent on iOS — the exact platform half your users will be on (iPhone-via-text-message-from-adult-child distribution).
6. **DECIDE bucket "no recommendation" rule erodes utility.** A 72-year-old asking "should I take the lump sum or the annuity?" wants an answer. Refusing to recommend is principled but may make the app feel useless. Worth A/B testing.
7. **Reading level vs. precision tradeoff in financial/medical content.** "Required Minimum Distribution" cannot be flattened to 7th-grade English without losing meaning. The system needs a glossary-style explain-on-first-use pattern, not blanket simplification.

---

# 2. FULL EXECUTION BLUEPRINT

## Phase 0 — Foundation Decisions

### Final architecture

- **Frontend:** Next.js 14 (App Router) deployed on Vercel. Single page, no router complexity needed, but Next gives you serverless API routes in the same project — meaning your "backend orchestrator" is just `/app/api/help/route.ts`. One repo, one deploy, one environment.
- **Backend:** Vercel serverless functions (Node runtime, not Edge — Edge has a 25s timeout but limited Node API support; Node functions on Vercel Pro give you 60s, plenty for a 6s pipeline plus retry headroom).
- **State/Logging:** Upstash Redis for anonymous request logging (you already use it). Each request gets a UUID, logs `{input, classifier_output, optimizer_output, answer, final, latency_per_stage, total_cost}`. 7-day TTL. No PII concerns because no accounts.
- **Voice:** Web Speech API as primary. Fallback messaging when unsupported (iOS < 14.5, some Android browsers).
- **Anthropic API:** Direct from serverless function. No proxy, no LangChain, no abstraction layer. You will read and modify these prompts weekly — keep them in flat `.md` files imported as strings.
- **No database in V1** for user data. Redis logs only.

### Tooling choices and tradeoffs

| Choice | Alternative considered | Why this wins |
|---|---|---|
| Next.js on Vercel | Separate React frontend + Express backend | One deploy, one env, one repo. You're solo, 4-8 hrs/wk. |
| Node serverless | Edge functions | Edge can't easily handle the Anthropic SDK and has stricter memory. 6s pipeline doesn't need Edge's cold-start advantage. |
| Upstash Redis | Postgres/Supabase | You don't need relational data. Redis is faster, cheaper, and you already use it. |
| Plain `.md` prompts in repo | LangSmith / PromptLayer / Helicone | You'll iterate prompts weekly. Git diff is the right tool. Add Helicone later only for cost monitoring. |
| Web Speech API | Whisper API | Free, instant, no extra latency. Trade reliability for speed and cost. Add Whisper fallback in Phase 2. |
| No auth in V1 | Magic-link auth | Spec says no accounts. Honor it. Adds friction for the exact users you can't afford to lose. |

### What is explicitly rejected from the spec

- **Stage 4 as a full LLM call for every response.** Replaced with a deterministic rules engine + LLM fallback. Detailed in Phase 2.
- **Stage 1 and Stage 2 as separate API calls.** Collapsed into a single Haiku call that returns both bucket and optimized prompt in one structured output. Saves ~1 round trip (~800ms) and ~$0.001/request.

This gives you a 3-stage effective pipeline (Classify+Optimize → Answer → Post-process) that fits in your 6s budget at p50 and is recoverable at p95.

---

## Phase 1 — Environment Setup

### Step 1.1 — Accounts (do these in order, one sitting, ~30 min)

1. **GitHub** — create new private repo `translator` (or final name).
2. **Vercel** — sign up with GitHub. Don't import a project yet.
3. **Anthropic Console** — create API key at console.anthropic.com. Set a $50 monthly spend limit immediately. Save key as `ANTHROPIC_API_KEY`.
4. **Upstash** — create a Redis database (free tier). Save `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
5. **Helicone** (optional, do in Phase 6, not now) — for cost dashboards.

### Step 1.2 — Local environment

```bash
# In a fresh folder
npx create-next-app@latest translator --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd translator
npm install @anthropic-ai/sdk @upstash/redis
npm install -D @types/node
```

Create `.env.local` in project root:

```
ANTHROPIC_API_KEY=sk-ant-...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Add `.env.local` to `.gitignore` (it's there by default but verify).

### Step 1.3 — Folder structure (exact)

```
/translator
├── app/
│   ├── api/
│   │   └── help/
│   │       └── route.ts              ← single API endpoint
│   ├── layout.tsx
│   ├── page.tsx                      ← the only screen
│   └── globals.css
├── lib/
│   ├── anthropic.ts                  ← Anthropic client + helpers
│   ├── redis.ts                      ← Upstash client
│   ├── pipeline.ts                   ← 4-stage orchestrator
│   ├── postprocess.ts                ← deterministic Stage 4 rules
│   ├── types.ts                      ← Bucket, PipelineRequest, etc.
│   └── starters.ts                   ← 6 starter examples
├── prompts/
│   ├── classifier-and-optimizer.md   ← combined Stage 1+2
│   ├── optimizer-decode.md
│   ├── optimizer-respond.md
│   ├── optimizer-compose.md
│   ├── optimizer-explain.md
│   ├── optimizer-decide.md
│   ├── optimizer-plan.md
│   ├── optimizer-verify.md
│   ├── optimizer-create.md
│   └── postprocessor-fallback.md
├── tests/
│   ├── test-cases.json               ← 40 cases with expected bucket
│   └── run-tests.ts
├── components/
│   ├── InputBox.tsx
│   ├── VoiceButton.tsx
│   ├── StarterExamples.tsx
│   ├── HelpButton.tsx
│   ├── Response.tsx
│   └── CopyButton.tsx
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
└── tsconfig.json
```

### Step 1.4 — First deploy (do this before writing real code)

```bash
git init
git add .
git commit -m "scaffold"
# Push to GitHub repo created in 1.1
git remote add origin git@github.com:<you>/translator.git
git push -u origin main
```

Then on vercel.com: New Project → Import the repo → Add the 3 env vars from `.env.local` → Deploy. You should have a live URL with the default Next.js page in under 5 minutes. **Do this before building anything else** so you never debug deployment and code at the same time.

---

## Phase 2 — Backend Orchestration

### 2.1 Type definitions (`lib/types.ts`)

```typescript
export type Bucket =
  | 'DECODE' | 'RESPOND' | 'COMPOSE' | 'EXPLAIN'
  | 'DECIDE' | 'PLAN' | 'VERIFY' | 'CREATE';

export interface PipelineRequest {
  userInput: string;
  requestId: string;  // UUID generated server-side
}

export interface ClassifierOptimizerOutput {
  bucket: Bucket;
  optimized_prompt: string;  // XML structured prompt for Stage 3
  preserved_tokens: string[];  // numbers, dates, names extracted verbatim
}

export interface PipelineResponse {
  finalText: string;
  bucket: Bucket;          // returned for logging only, not shown to user
  requestId: string;
  latencyMs: number;
}

export interface StageTimings {
  classify_optimize: number;
  answer: number;
  postprocess: number;
  total: number;
}
```

### 2.2 Pipeline orchestrator (`lib/pipeline.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { redis } from './redis';
import { runPostprocess } from './postprocess';
import type { Bucket, PipelineRequest, PipelineResponse } from './types';
import { CLASSIFIER_OPTIMIZER_PROMPT } from '@/prompts';
import { randomUUID } from 'crypto';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const VERIFY_MODEL = 'claude-sonnet-4-6';  // or opus-4-7 if budget allows
const ANSWER_MODEL = 'claude-sonnet-4-6';
const FAST_MODEL = 'claude-haiku-4-5-20251001';

const BUCKET_LENGTH_CAPS: Record<Bucket, number> = {
  DECODE: 150, RESPOND: 180, COMPOSE: 250, EXPLAIN: 200,
  DECIDE: 400, PLAN: 500, VERIFY: 450, CREATE: 400,
};

export async function runPipeline(input: string): Promise<PipelineResponse> {
  const requestId = randomUUID();
  const t0 = Date.now();
  const timings: any = {};

  // ──────────── STAGE 1+2: Classifier + Optimizer (combined) ────────────
  const t1 = Date.now();
  const classifyResult = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1500,
    temperature: 0,
    system: CLASSIFIER_OPTIMIZER_PROMPT,
    messages: [{ role: 'user', content: `<user_input>${input}</user_input>` }],
  });
  timings.classify_optimize = Date.now() - t1;

  const parsed = parseClassifierOutput(extractText(classifyResult));
  // parsed = { bucket, optimized_prompt, preserved_tokens }

  // ──────────── STAGE 3: Answer model ────────────
  const t2 = Date.now();
  const answerModel = parsed.bucket === 'VERIFY' ? VERIFY_MODEL : ANSWER_MODEL;
  const answerTemp = parsed.bucket === 'CREATE' ? 0.4 : 0;

  const answerResult = await anthropic.messages.create({
    model: answerModel,
    max_tokens: 2000,
    temperature: answerTemp,
    messages: [{ role: 'user', content: parsed.optimized_prompt }],
  });
  timings.answer = Date.now() - t2;
  const draft = extractText(answerResult);

  // ──────────── STAGE 4: Post-process (deterministic + LLM fallback) ────
  const t3 = Date.now();
  const final = await runPostprocess({
    draft,
    bucket: parsed.bucket,
    lengthCap: BUCKET_LENGTH_CAPS[parsed.bucket],
    preservedTokens: parsed.preserved_tokens,
  });
  timings.postprocess = Date.now() - t3;
  timings.total = Date.now() - t0;

  // ──────────── Logging ────────────
  await redis.setex(
    `req:${requestId}`,
    60 * 60 * 24 * 7,  // 7 days
    JSON.stringify({
      input, bucket: parsed.bucket,
      optimized: parsed.optimized_prompt,
      draft, final, timings,
    })
  );

  return { finalText: final, bucket: parsed.bucket, requestId, latencyMs: timings.total };
}

function extractText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('');
}

function parseClassifierOutput(raw: string): {
  bucket: Bucket; optimized_prompt: string; preserved_tokens: string[];
} {
  const bucketMatch = raw.match(/<bucket>(\w+)<\/bucket>/);
  const promptMatch = raw.match(/<optimized_prompt>([\s\S]*?)<\/optimized_prompt>/);
  const tokensMatch = raw.match(/<preserved_tokens>([\s\S]*?)<\/preserved_tokens>/);
  if (!bucketMatch || !promptMatch) {
    throw new Error('Classifier output malformed');
  }
  return {
    bucket: bucketMatch[1] as Bucket,
    optimized_prompt: promptMatch[1].trim(),
    preserved_tokens: tokensMatch
      ? tokensMatch[1].split('|').map(s => s.trim()).filter(Boolean)
      : [],
  };
}
```

### 2.3 Deterministic post-processor (`lib/postprocess.ts`)

This is the heart of why Stage 4 doesn't hallucinate.

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Bucket } from './types';

const AI_TELLS = [
  /\bI hope this helps\b\.?/gi,
  /\bGreat question\b!?,?/gi,
  /\bSure,? I can help\b\.?/gi,
  /\bLet me know if\b[^.]*\./gi,
  /\bdelve\b/gi,
  /\bnavigate\b/gi,
  /\bin today's[^,.]*world\b/gi,
  /\bit's important to note that\b/gi,
  /\byou've got this\b!?/gi,
  /\bstay positive\b!?/gi,
  /—/g,  // em dash → period+space
];

const EM_DASH_REPLACEMENT = '. ';

export async function runPostprocess(args: {
  draft: string;
  bucket: Bucket;
  lengthCap: number;
  preservedTokens: string[];
}): Promise<string> {
  let text = args.draft.trim();

  // Rule 1: Strip AI tells (regex)
  for (const pattern of AI_TELLS) {
    text = text.replace(pattern,
      pattern.source === '—' ? EM_DASH_REPLACEMENT : '');
  }

  // Rule 2: Strip placeholder brackets like [Your Name]
  text = text.replace(/\[([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\]/g, '');

  // Rule 3: Collapse whitespace
  text = text.replace(/\s+/g, ' ').replace(/\s\./g, '.').trim();

  // Rule 4: Verbatim preservation check (CRITICAL)
  const missingTokens = args.preservedTokens.filter(
    tok => !text.includes(tok)
  );

  // Rule 5: Length cap (word count)
  const words = text.split(/\s+/);
  const overLength = words.length > args.lengthCap;

  // If clean, ship it. This is the path 90% of requests take.
  if (missingTokens.length === 0 && !overLength) {
    return text;
  }

  // Otherwise: LLM fallback to fix specifically what failed
  return await llmRepair(text, args, missingTokens, overLength);
}

async function llmRepair(
  text: string,
  args: { bucket: Bucket; lengthCap: number; preservedTokens: string[] },
  missing: string[],
  overLength: boolean,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const issues = [
    missing.length > 0 && `Missing required verbatim tokens: ${missing.join(', ')}. You must include these exact strings.`,
    overLength && `Text exceeds ${args.lengthCap} words. Cut to fit.`,
  ].filter(Boolean).join(' ');

  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    temperature: 0,
    system: `You are an editor. Fix only the issues stated. Do not add new content. Do not change facts. Output only the corrected text, no preamble.`,
    messages: [{
      role: 'user',
      content: `<text>${text}</text>\n<issues>${issues}</issues>\n<rules>Reading level: 7th-8th grade. No phrases like "I hope this helps" or em-dashes. Preserve all numbers, dates, names exactly.</rules>`,
    }],
  });
  return result.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('').trim();
}
```

### 2.4 API route (`app/api/help/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/pipeline';

export const maxDuration = 30;  // Vercel Pro: 60s, Hobby: 10s

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json(
        { error: 'empty_input' }, { status: 400 }
      );
    }
    if (input.length > 4000) {
      return NextResponse.json(
        { error: 'input_too_long' }, { status: 400 }
      );
    }

    const result = await runPipeline(input.trim());
    return NextResponse.json({ text: result.finalText });
    // Note: bucket and requestId NOT returned to client — never expose mechanics
  } catch (err) {
    console.error('Pipeline error:', err);
    return NextResponse.json(
      { error: 'pipeline_failure' }, { status: 500 }
    );
  }
}
```

### 2.5 Example payload trace (DECODE bucket)

**Frontend POST to `/api/help`:**
```json
{ "input": "I got a letter from Medicare saying my Part B premium is going up to $185.00 starting January 1st. The letter has policy number M-4471-882-X. I don't understand what they're asking me to do." }
```

**Stage 1+2 output (model returns this XML):**
```xml
<bucket>DECODE</bucket>
<preserved_tokens>$185.00 | January 1st | M-4471-882-X | Part B</preserved_tokens>
<optimized_prompt>
<task>Decode an official letter for a 70-year-old user. Explain plainly what the letter says and what (if anything) the user must do.</task>
<source_letter>
The user received a Medicare letter stating Part B premium increases to $185.00 effective January 1. Policy number M-4471-882-X.
</source_letter>
<requirements>
- Use 7th-8th grade language.
- Preserve verbatim: $185.00, January 1st, M-4471-882-X, Part B.
- State plainly: what the letter says, what changed, what the user must do (if anything), by when.
- Do not invent details. If the letter is informational with no required action, say so explicitly.
- Maximum 150 words.
</requirements>
</optimized_prompt>
```

**Stage 3 draft (Sonnet output):**
```
Your Medicare letter is telling you about a price change. Starting January 1st, your Part B premium will be $185.00 per month. That is the new amount Medicare will charge you.

You do not need to do anything. Medicare will start charging the new amount automatically. If your premium is taken out of your Social Security check, the change happens automatically there too.

Your policy number is M-4471-882-X. Keep this letter for your records.

If you want to confirm the change or have questions about your specific account, you can call Medicare at 1-800-MEDICARE.
```

**Stage 4 deterministic check:** All preserved tokens present (`$185.00`, `January 1st`, `M-4471-882-X`, `Part B`), word count 91 (under 150), no AI tells. Ship as-is. No LLM call needed.

**Final response to frontend:**
```json
{ "text": "Your Medicare letter is telling you about a price change..." }
```

### 2.6 Latency and cost controls

| Stage | Model | p50 latency | Max tokens | Cost (approx) |
|---|---|---|---|---|
| 1+2 combined | Haiku 4.5 | 1.2s | 1500 | $0.002 |
| 3 (answer) | Sonnet 4.6 | 2.5s | 2000 | $0.012 |
| 4 deterministic | none | <10ms | — | $0 |
| 4 LLM fallback (10% of requests) | Haiku 4.5 | 1.0s | 1500 | $0.002 |
| **Total p50** | | **~3.7s** | | **~$0.014** |
| **Total p95** | | **~6.5s** | | **~$0.018** |

This fits the spec's ≤6s p50 and ≤$0.02 budget. The original 4-stage spec did not.

**Hard timeouts:** Set 8-second timeout on each Anthropic call. If exceeded, return graceful error to user.

### 2.7 Error handling

```typescript
// In API route, wrap each stage:
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout:${label}`)), ms)
    ),
  ]);
}
```

User-facing errors (microcopy in Phase 3):
- Pipeline timeout → "This took longer than usual. Please try again."
- Classifier malformed → fallback to EXPLAIN bucket, log incident.
- Anthropic API 5xx → "Something went wrong. Please try again in a moment."

---

## Phase 3 — Frontend Build

### 3.1 Component structure

```
page.tsx (state owner)
├── <InputBox />           ← controlled textarea
├── <VoiceButton />        ← Web Speech API
├── <StarterExamples />    ← collapsible 6-item list
├── <HelpButton />         ← submits
├── <Response />           ← renders final text
└── <CopyButton />         ← clipboard write
```

### 3.2 Page state (`app/page.tsx`)

```typescript
'use client';
import { useState } from 'react';
// ... component imports

export default function Home() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStarters, setShowStarters] = useState(false);

  async function handleSubmit() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setResponse(data.text);
    } catch {
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function handleStarterPick(text: string) {
    setInput(text);
    setShowStarters(false);
  }

  function handleReset() {
    setInput('');
    setResponse(null);
    setError(null);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-8 max-w-2xl mx-auto">
      {/* Layout in section 3 below */}
    </main>
  );
}
```

### 3.3 Voice input (`components/VoiceButton.tsx`)

```typescript
'use client';
import { useState, useRef } from 'react';

export function VoiceButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  function start() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

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
      <p className="text-base text-gray-700">
        Voice typing isn't available on this device. Please type instead.
      </p>
    );
  }

  return (
    <button
      onClick={listening ? stop : start}
      className={`flex items-center justify-center gap-2 px-6 py-4 rounded-full text-xl font-medium border-2 ${
        listening ? 'bg-red-50 border-red-600 text-red-700' : 'bg-white border-gray-700 text-gray-900'
      }`}
      aria-label={listening ? 'Stop recording' : 'Start voice typing'}
    >
      <span aria-hidden>🎤</span>
      <span>{listening ? 'Listening… tap to stop' : 'Talk instead of typing'}</span>
    </button>
  );
}
```

### 3.4 Starter examples (`lib/starters.ts` + component)

```typescript
// lib/starters.ts
export const STARTERS: { label: string; prefill: string }[] = [
  { label: "I got a letter I don't understand",
    prefill: "I got a letter from " },
  { label: "Help me reply to a message",
    prefill: "I need to reply to this message: " },
  { label: "Is this a scam?",
    prefill: "I think this might be a scam. Here's what I got: " },
  { label: "Write a note for me",
    prefill: "I want to write a note to " },
  { label: "Explain something to me",
    prefill: "Can you explain " },
  { label: "Help me decide between two options",
    prefill: "I'm trying to decide between " },
];
```

```typescript
// components/StarterExamples.tsx
export function StarterExamples({
  open, onPick, onToggle,
}: { open: boolean; onPick: (s: string) => void; onToggle: () => void }) {
  return (
    <div className="w-full">
      <button
        onClick={onToggle}
        className="text-xl text-blue-700 underline py-3"
      >
        {open ? 'Hide examples' : 'Show me what to ask'}
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {STARTERS.map(s => (
            <li key={s.label}>
              <button
                onClick={() => onPick(s.prefill)}
                className="w-full text-left px-5 py-4 rounded-lg border-2 border-gray-300 text-xl hover:bg-gray-50"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 3.5 Loading and response rendering

```typescript
// In page.tsx render block:
{loading && (
  <div className="mt-8 text-center">
    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900" />
    <p className="mt-4 text-xl text-gray-800">Working on it…</p>
  </div>
)}

{response && !loading && (
  <div className="mt-8 w-full">
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 text-xl leading-relaxed whitespace-pre-wrap">
      {response}
    </div>
    <CopyButton text={response} />
    <button
      onClick={handleReset}
      className="mt-4 text-xl text-blue-700 underline"
    >
      Start over
    </button>
  </div>
)}

{error && !loading && (
  <p className="mt-6 text-xl text-red-700" role="alert">{error}</p>
)}
```

### 3.6 Copy button

```typescript
'use client';
import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <button
      onClick={copy}
      className="mt-4 w-full px-6 py-5 rounded-xl bg-green-700 text-white text-2xl font-medium"
      aria-live="polite"
    >
      {copied ? 'Copied!' : 'Copy this'}
    </button>
  );
}
```

---

## Phase 4 — Prompt System (Core IP)

The combined Stage 1+2 prompt in full plus the structural template for the 8 optimizers. Building all 8 in this document buries the architecture; the template plus 2 worked examples (DECODE, VERIFY) gives you the pattern to ship the rest in week 3.

### 4.1 Combined Classifier + Optimizer prompt (`prompts/classifier-and-optimizer.md`)

```
You are a routing and rewriting system. You receive raw input from a non-technical older adult and produce two things: a bucket label and an optimized prompt for an answer model.

Output exactly this XML structure and nothing else:

<bucket>ONE_OF: DECODE | RESPOND | COMPOSE | EXPLAIN | DECIDE | PLAN | VERIFY | CREATE</bucket>
<preserved_tokens>token1 | token2 | token3</preserved_tokens>
<optimized_prompt>
[a fully-formed prompt addressed to an expert answer model]
</optimized_prompt>

## Bucket definitions

DECODE: User received a document, letter, bill, email, or notice and wants to know what it means and what to do about it.

RESPOND: User received a message (email, text, voicemail) and needs help replying.

COMPOSE: User wants to write a message from scratch (a note, letter, email) — not in response to one.

EXPLAIN: User wants to understand a concept, term, situation, or how something works.

DECIDE: User is choosing between two or more options and wants help thinking it through. Never make the recommendation; lay out factors.

PLAN: User wants a step-by-step plan for accomplishing something.

VERIFY: User wants to know if something is real, legitimate, a scam, true, or trustworthy. Default to caution. If scam indicators are present, state plainly that it is a scam.

CREATE: User wants help generating creative content (a poem, toast, story, message of celebration).

## Preserved tokens

Extract every dollar amount, date, name, account number, policy number, phone number, address, and case-specific identifier from the user input. List them pipe-separated in <preserved_tokens>. These must appear in the final output verbatim.

## Optimized prompt rules

Every optimized prompt must contain:
- A <task> block stating the goal in one sentence.
- A <user_situation> block with the relevant facts.
- A <requirements> block including: 7th-8th grade reading level, verbatim preservation list, length cap (per bucket), and bucket-specific instructions.

Bucket-specific instructions to include in <requirements>:

DECODE: State plainly what the document says, what changed, what action is required (if any), by when. Maximum 150 words.

RESPOND: Match the tone and formality of the original message. Maximum 180 words. If the user wants a short reply, 120 words. Never include placeholder brackets like [Your Name].

COMPOSE: Match the formality the user asked for. Maximum 250 words.

EXPLAIN: Use one analogy if helpful. Maximum 200 words. Define jargon on first use.

DECIDE: Lay out factors for and against each option. Do not recommend. Maximum 400 words.

PLAN: Numbered steps. Maximum 500 words.

VERIFY: If scam/fraud indicators are present (urgency, requests for gift cards or wire transfers, threats, requests for SSN/passwords/Medicare numbers, payment via crypto, impersonation of government agencies), open with a plain statement that this is a scam. List the specific red flags. Tell the user not to engage. Maximum 450 words. Default to caution.

CREATE: Optimizer temperature is set to 0.4 by the system. Match the occasion. Maximum 400 words.

## Professional referrals

If the bucket is VERIFY (with money/identity stakes), or if the user input touches on medical decisions, legal matters, or financial decisions involving more than reading a document, the optimized prompt must require the answer to end with a referral to: a doctor (medical), a lawyer or legal aid (legal), or a fee-only financial advisor or CPA (financial).

## Forbidden output patterns (to put in optimized prompt requirements)

- Do not open with "Great question," "Sure," "I can help," "I'd be happy to," or any acknowledgment.
- Do not include "I hope this helps," motivational filler, or em-dashes.
- Do not use jargon: "navigate," "delve," "leverage," "robust," "ecosystem," "in today's world."
- Do not include placeholder brackets like [Your Name] or [Date].
- Do not invent dollar amounts, dates, names, statistics, or facts not in the user input.

## Examples

[Include 2-3 worked examples here in week 3 once you have real test cases. Examples are the highest-leverage thing you can add.]
```

### 4.2 Bucket-specific optimizer template

For V1, the combined prompt above produces the optimized prompt directly. The 8 separate `optimizer-*.md` files in your folder structure are for **week 4 refinement** — once you have failure cases, you split out the buckets that are failing and give them more specific guidance.

This is a deliberate tradeoff: one combined prompt is faster to ship and iterate. Splitting into 8 files prematurely creates 8 places to maintain consistency. Split when you have evidence one bucket needs different treatment.

### 4.3 Post-processor fallback prompt (`prompts/postprocessor-fallback.md`)

Already shown inline in `lib/postprocess.ts` (the `llmRepair` function's system prompt). This only runs when deterministic rules can't fix the issue (length overflow or missing verbatim tokens).

### 4.4 How prompts connect across stages

```
USER INPUT (raw text)
    │
    ▼
[CLASSIFIER+OPTIMIZER PROMPT]
    │ produces:
    │   <bucket>DECODE</bucket>
    │   <preserved_tokens>$185.00 | M-4471-882-X</preserved_tokens>
    │   <optimized_prompt>...</optimized_prompt>
    ▼
[ANSWER MODEL receives only the <optimized_prompt> contents as user message]
    │ produces:
    │   draft text
    ▼
[DETERMINISTIC POSTPROCESS]
    │ checks:
    │   - all preserved_tokens present?
    │   - under length cap?
    │   - no AI tells?
    │
    ├─ YES → ship draft as final
    │
    └─ NO → [LLM REPAIR PROMPT] → final
```

---

## Phase 5 — Testing System

### 5.1 Test case structure (`tests/test-cases.json`)

```json
[
  {
    "id": "decode-001",
    "input": "I got a letter from Medicare saying my Part B premium is going up to $185.00 starting January 1st. Policy number M-4471-882-X. I don't understand what they want me to do.",
    "expected_bucket": "DECODE",
    "must_contain_verbatim": ["$185.00", "January 1st", "M-4471-882-X", "Part B"],
    "must_not_contain": ["I hope this helps", "Great question", "[Your Name]", "—"],
    "max_words": 150,
    "max_reading_level": 8.5
  },
  {
    "id": "verify-001",
    "input": "Someone called saying they're from the IRS and I owe $4,200 and need to pay in iTunes gift cards today or be arrested.",
    "expected_bucket": "VERIFY",
    "must_contain_verbatim": ["$4,200"],
    "must_contain_phrases": ["scam"],
    "must_not_contain": ["I hope this helps", "—"],
    "max_words": 450,
    "max_reading_level": 8.5
  }
]
```

Build out 5 cases per bucket = 40 total, matching your spec.

### 5.2 Test runner (`tests/run-tests.ts`)

```typescript
import cases from './test-cases.json';
import { runPipeline } from '@/lib/pipeline';

// Reading level: Flesch-Kincaid grade level
function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const syllables = countSyllables(text);
  if (sentences === 0 || words === 0) return 0;
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

function countSyllables(text: string): number {
  return text.toLowerCase().split(/\s+/)
    .map(w => w.replace(/[^a-z]/g, ''))
    .filter(Boolean)
    .reduce((sum, w) => sum + Math.max(1, (w.match(/[aeiouy]+/g) || []).length), 0);
}

async function main() {
  const results: any[] = [];
  for (const tc of cases) {
    const out = await runPipeline(tc.input);
    const grade = fleschKincaidGrade(out.finalText);
    const wordCount = out.finalText.split(/\s+/).length;

    const checks = {
      bucket_correct: out.bucket === tc.expected_bucket,
      verbatim_preserved: (tc.must_contain_verbatim || [])
        .every(t => out.finalText.includes(t)),
      forbidden_absent: (tc.must_not_contain || [])
        .every(t => !out.finalText.includes(t)),
      required_phrases: (tc.must_contain_phrases || [])
        .every(p => out.finalText.toLowerCase().includes(p.toLowerCase())),
      length_ok: wordCount <= tc.max_words,
      reading_level_ok: grade <= tc.max_reading_level,
    };
    const passed = Object.values(checks).every(Boolean);
    results.push({ id: tc.id, passed, checks, grade, wordCount, output: out.finalText });
    console.log(`${passed ? '✓' : '✗'} ${tc.id}`, !passed ? checks : '');
  }
  const passRate = results.filter(r => r.passed).length / results.length;
  console.log(`\nPass rate: ${(passRate * 100).toFixed(1)}%`);
  require('fs').writeFileSync(
    'tests/last-run.json',
    JSON.stringify(results, null, 2)
  );
}
main();
```

Run with `npx tsx tests/run-tests.ts`. Costs ~$0.60 for a full 40-case run. Run after every prompt change.

### 5.3 Pass/fail criteria

| Metric | Target | Hard fail at |
|---|---|---|
| Bucket classification accuracy | ≥95% | <90% |
| Verbatim preservation | 100% | any miss |
| Length compliance | 100% | any overflow >10% |
| Reading level | ≤8.5 grade | >9.5 grade |
| Forbidden phrase absence | 100% | any present |
| Required phrase presence (e.g. "scam" in scam VERIFY) | 100% | any miss |

Verbatim preservation and the "scam" phrase requirement in VERIFY are the only zero-tolerance rules. Everything else has soft thresholds.

---

## Phase 6 — Deployment

### 6.1 Production deploy

You already deployed in Phase 1.4. Now:

1. Add production env vars to Vercel project settings (same as `.env.local`).
2. In Vercel project: Settings → Functions → upgrade region to `iad1` (US East, lowest Anthropic latency).
3. Settings → Functions → Max Duration: 30s (Pro plan) or 10s (Hobby — risky, recommend Pro).
4. Settings → Domains: add custom domain when you pick a name.

### 6.2 Monitoring

Add Helicone in week 5 for cost/latency dashboards (proxy your Anthropic calls through it, ~10 lines of code change).

For week 1-4, use this hand-rolled approach:

```typescript
// In pipeline.ts, after logging to Redis:
console.log(JSON.stringify({
  type: 'pipeline_complete',
  requestId,
  bucket: parsed.bucket,
  timings,
  inputLength: input.length,
  outputLength: final.length,
}));
```

Vercel logs auto-capture these. Filter by `pipeline_complete` to get a stream of every request.

### 6.3 Cost tracking

Set Anthropic Console spend limit at $50/month while testing, $200/month at launch. Set Vercel spending limit at $20/month (you should be free tier under low traffic, Pro at $20 once it grows).

Build a daily cost-check Vercel cron job (week 6+):

```typescript
// app/api/cron/cost-check/route.ts
// Runs once daily, logs total request count and estimated spend from Redis.
```

---

# 3. UI/UX SYSTEM DESIGN

## 3.1 Screen layout (single screen, mobile-first)

```
┌─────────────────────────────────────────┐
│  [logo or app name — left aligned]       │  ← 56px header, 24px padding
│                                         │
│                                         │
│  What's going on?                        │  ← H1, 32px, dark gray
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │                                     │ │
│  │  (Tell us in your own words.)       │ │  ← Textarea
│  │                                     │ │     min-height 180px
│  │                                     │ │     20px text
│  │                                     │ │     2px border
│  └─────────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │   🎤  Talk instead of typing         │ │  ← Voice button
│  └─────────────────────────────────────┘ │     full width
│                                         │
│  Show me what to ask                     │  ← Underlined link
│                                         │
│  ┌─────────────────────────────────────┐ │
│  │                                     │ │
│  │           Help me                    │ │  ← Primary button
│  │                                     │ │     full width
│  └─────────────────────────────────────┘ │     72px tall
│                                         │     28px text
└─────────────────────────────────────────┘
```

After submission, the form scrolls up and the response appears below in a yellow-cream card with a green "Copy this" button.

## 3.2 Spacing, sizing, alignment rules

- Page max-width: 640px (centered on desktop).
- Horizontal padding: 20px on mobile, 32px on desktop.
- Vertical rhythm: 24px between major elements, 16px between related elements.
- All buttons: minimum 56px tall (Apple/Google a11y guideline) — this app uses 64-72px.
- All borders: 2px (1px is invisible to some users with cataracts/macular degeneration).
- Border radius: 12px on cards, 9999px on pill buttons, 8px on inputs.

## 3.3 Component breakdown

### Input box
- States: empty, focused, filled, disabled (during loading), error.
- Default: 2px solid `#374151` (gray-700) border, white background, `#111827` (gray-900) text.
- Focus: 3px solid `#1d4ed8` (blue-700) border.
- Error: 2px solid `#b91c1c` (red-700) border.
- Placeholder text: "Tell us in your own words."
- Auto-grow up to 400px, then scroll.
- Max length: 4000 chars (silently enforced; show "Keep it short for best results" at 3500+).

### Voice button
- States: idle, listening, error, unsupported.
- Idle: white bg, 2px gray border, mic icon + "Talk instead of typing".
- Listening: light red bg, red border, mic icon + "Listening… tap to stop".
- Error: shows below button "Voice didn't work. Please type instead." 8 sec auto-dismiss.
- Unsupported (iOS Safari old, Firefox): button hidden entirely. Replaced with a single line: "Voice typing isn't available on this device."

### Show me what to ask
- Closed state: text link "Show me what to ask" in blue, underlined.
- Open state: text link changes to "Hide examples", below it a vertical list of 6 options.
- Each option is a button (not a link) with 2px border, 18px padding, 20px text, left-aligned.
- Tapping pre-fills input box, collapses the list, focuses textarea.

### Help me button
- Default state: full-width, 72px tall, dark green (`#15803d`), white text 28px medium weight, 12px border-radius.
- Hover (desktop): slightly darker green.
- Disabled (empty input): light gray bg, dark gray text, no shadow.
- Loading: replaced by spinner + "Working on it…" text. Button itself disappears.

### Response display
- Cream/yellow card (`#fefce8` bg, `#fde68a` border).
- 24px padding.
- 22px text, 1.6 line height, dark gray (`#1f2937`).
- `whitespace-pre-wrap` so paragraph breaks render.
- Above the card: small "Here's your answer" label (24px, regular weight, gray-700).

### Copy button
- Below response card, 16px gap.
- Full width, 72px tall, green (`#15803d`).
- Default text: "Copy this" (28px white).
- After tap: "Copied!" for 2.5 sec, then reverts.

### Start over link
- Below copy button, 16px gap.
- Plain blue underlined text "Start over", 20px, centered.
- Clears state, scrolls to top, focuses textarea.

## 3.4 Interaction design

### Tap flows

**Happy path:**
1. User opens app → sees text box, voice button, examples link, help button (disabled).
2. User taps text box → keyboard opens, button stays disabled until first keystroke.
3. User types or taps voice button or picks an example.
4. As soon as input has content, "Help me" button enables (color shifts to green).
5. User taps "Help me" → button disappears, spinner + "Working on it…" appears.
6. After 3-6 sec → spinner replaced by response card + copy button + start over link.
7. User taps "Copy this" → button briefly says "Copied!", they switch to email/text app.

**Voice path:**
1. User taps voice button → browser permission prompt (first time only).
2. Permission granted → button shows "Listening…", user speaks.
3. After 1-2 sec of silence, recognition ends → text appears in textarea, button reverts.
4. User can edit, then tap "Help me".

**Example path:**
1. User taps "Show me what to ask".
2. List expands, 6 options visible.
3. User taps one → input box fills with the prefill text, cursor positioned at end, list collapses, textarea focused.
4. User completes the sentence and taps "Help me".

### Loading state
- Help button disappears.
- Center-aligned: spinner (48px gray border, dark top), 16px gap, "Working on it…" 22px gray-800.
- No "this might take a moment" copy — adds anxiety.
- Textarea remains visible above but grayed/disabled.
- Cancel button shown only after 8 seconds: "This is taking longer than usual. Cancel and try again." — 18px red-700 underlined.

### Error states
- Network error: "Something went wrong. Please try again in a moment." Red text, 20px, below input. Help button re-enables.
- Empty submission attempt: button stays disabled, no error needed.
- Voice failure: "Voice didn't work. Please type instead." 18px gray-700 below voice button, auto-dismiss in 8 sec.
- Input too long (>4000 chars): "Please shorten this a bit and try again." 18px red-700.

### Edge cases
- User pastes 10,000-character document into DECODE: hard cap at 4000, show counter "Showing first 4000 characters" in gray-600.
- User submits while voice is still listening: voice auto-stops, current transcript used.
- User leaves page mid-pipeline: pipeline still completes server-side (logged), but result lost. Acceptable in V1.
- User on iPad in landscape: layout still single-column, max-width centers.

## 3.5 Typography

### Font system
- Family: system font stack. `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- No custom fonts. Webfonts are an accessibility risk (FOUT, slow networks) and your users don't care about brand typography.

### Sizes (rem at 16px root)
- H1 (page question): 2rem (32px), weight 600.
- Section labels: 1.5rem (24px), weight 400.
- Body / response text: 1.375rem (22px), weight 400, line-height 1.6.
- Input text: 1.25rem (20px), weight 400.
- Button text (primary): 1.75rem (28px), weight 500.
- Button text (secondary/voice): 1.25rem (20px), weight 500.
- Examples list items: 1.25rem (20px), weight 400.
- Helper/error text: 1.125rem (18px), weight 400.

### Contrast rules
- All text on white: minimum `#374151` (gray-700) — 9.5:1 contrast.
- All text on yellow-cream (`#fefce8`): `#1f2937` (gray-800) — 13:1.
- Primary button: white on `#15803d` — 5.4:1, AAA for large text.
- Never gray-on-gray. Never colored text on colored bg without 4.5:1 minimum.

### Accessibility constraints
- All interactive elements: minimum 56px tap target (this app: 64-72px).
- All buttons have `aria-label` if icon-only.
- Loading state has `aria-live="polite"` so screen readers announce.
- Error state has `role="alert"`.
- Tab order: input → voice → examples toggle → help button.
- No reliance on color alone — error states have text + icon + color.
- Respects `prefers-reduced-motion` — disable spinner animation, use pulsing text instead.

## 3.6 UX principles (non-generic)

### Removing fear of looking stupid

The mechanism: never show the user something that implies they should have asked differently. Concretely:

- No "Did you mean…?" suggestions — implies they typed wrong.
- No reformulating their question back at them ("So you want help with…?") — implies their question wasn't clear.
- No follow-up questions in V1 — every interaction is one shot. Asking back creates the feeling of being interviewed.
- Response opens with the answer, not "Based on what you described…" — that phrasing makes users feel like their description was the unit of analysis.
- If the model is uncertain, the response says so plainly ("This letter doesn't say what to do next. Call the number on the letter to ask.") — never frames uncertainty as the user's fault.

### Eliminating blank-screen anxiety

The mechanism: the user must always be able to see what to do next.

- Default state has 3 visible affordances (text box, voice button, examples link) and one disabled affordance (help button) that becomes active when they act.
- "Show me what to ask" is the most important UI element after the text box. It is not buried — it sits between voice and help.
- Examples are concrete and varied. Not "Help me with something" but "I got a letter I don't understand."
- Examples pre-fill a sentence starter, not the whole question. The user finishes it. This converts blank-screen into fill-in-the-blank.

### Reducing cognitive load

The mechanism: zero choices except input.

- No bucket selector, mode toggle, model picker, or settings. The only decisions are *what to say* and *whether to use voice*.
- No history sidebar, no past sessions, no folders. Each session is independent.
- One button labeled "Help me" — not "Submit," "Generate," "Ask," or "Send."
- Response renders as one block of text, not a dialog with multiple turns. Users don't have to track conversation context.
- Copy button labeled "Copy this" — not "Copy to clipboard" — removes the abstraction.

## 3.7 Microcopy

| Element | Text |
|---|---|
| Page heading | "What's going on?" |
| Input placeholder | "Tell us in your own words." |
| Voice button (idle) | "Talk instead of typing" |
| Voice button (active) | "Listening… tap to stop" |
| Voice unsupported | "Voice typing isn't available on this device." |
| Voice error | "Voice didn't work. Please type instead." |
| Examples toggle (closed) | "Show me what to ask" |
| Examples toggle (open) | "Hide examples" |
| Submit button (default) | "Help me" |
| Submit button (loading) | (button hidden, replaced by spinner) |
| Loading text | "Working on it…" |
| Long-loading cancel | "This is taking longer than usual. Cancel and try again." |
| Response label | "Here's your answer" |
| Copy button (default) | "Copy this" |
| Copy button (after tap) | "Copied!" |
| Reset link | "Start over" |
| Network error | "Something went wrong. Please try again in a moment." |
| Input too long | "Please shorten this a bit and try again." |
| Input pasted-and-truncated | "Showing first 4000 characters" |

**Words this product never uses anywhere in UI:** AI, prompt, model, generate, query, chat, smart, intelligent, assistant, neural, machine learning, GPT, Claude, language model.

---

# 4. SYSTEM CONSTRAINT ENFORCEMENT

| Constraint | How enforced | Where in code |
|---|---|---|
| No exposure of prompts/mechanics | API response only contains `{text}`. Never `bucket`, `optimized_prompt`, `model`, `requestId`. | `app/api/help/route.ts` |
| Bucket classification integrity | Stage 1+2 prompt validates bucket label against enum. Parser throws if missing or invalid. Logged to Redis for offline accuracy review. | `lib/pipeline.ts` `parseClassifierOutput` |
| Output length cap per bucket | Deterministic word count check in postprocess. Triggers LLM repair if exceeded. | `lib/postprocess.ts` |
| Reading level (7-8th grade) | Test suite enforces Flesch-Kincaid ≤8.5 on every test case. Prompt instructs reading level. Not enforced at runtime — caught in tests. | `tests/run-tests.ts` |
| AI-voice removal | Regex strip of 11 known patterns in deterministic postprocess. | `lib/postprocess.ts` `AI_TELLS` |
| Verbatim preservation | Stage 1+2 extracts tokens to `<preserved_tokens>`. Postprocess checks each is present in final output. If missing, LLM repair is given the explicit list to restore. | `lib/postprocess.ts` `missingTokens` |
| VERIFY safety behavior | Optimizer prompt has explicit scam-indicator list and instruction to default to caution and open with "this is a scam" when indicators present. VERIFY uses Sonnet 4.6 (not Haiku). Test cases include `must_contain_phrases: ["scam"]`. | `prompts/classifier-and-optimizer.md` + tests |
| No placeholder brackets | Regex strip in postprocess. | `lib/postprocess.ts` |
| No acknowledgment opens | Regex strip + prompt instruction. | Both |
| Professional referrals (medical/legal/financial) | Optimizer prompt requires referral sentence at end of relevant responses. Tested in test suite. | `prompts/classifier-and-optimizer.md` |
| Temperature 0 (except CREATE 0.4) | Hardcoded in `lib/pipeline.ts` based on bucket. | `lib/pipeline.ts` |
| Cost ceiling per request | Monitored via Redis logs and Helicone. Hard cap on max_tokens at each stage. | All stages |
| 6s latency budget | 8s timeout per stage, 30s total route timeout. | `app/api/help/route.ts` |

---

# 5. FAILURE MODES + MITIGATIONS

| Failure | Why it happens | Mitigation |
|---|---|---|
| Misclassification: VERIFY routed as EXPLAIN | Scam request phrased as a question ("Is this real?") looks like an EXPLAIN request to a fast classifier. | Classifier prompt has explicit precedence rule: "If input contains any of: 'scam', 'fraud', 'is this real', 'they're asking for money', 'gift card', 'wire transfer', urgency markers — route to VERIFY." Test case `verify-001` covers this. |
| Stage 1+2 returns malformed XML | Haiku occasionally drops a closing tag or adds preamble. | `parseClassifierOutput` throws on malformed; route catches and falls back to a single-stage Sonnet call with the user input directly + a generic safety-aware prompt. User still gets a usable answer. |
| Verbatim drift ($4,732.18 → $4,700) | Sonnet rounds numbers when paraphrasing for plain language. | (a) Optimized prompt explicitly lists preserved tokens with instruction "use these exact strings." (b) Postprocess checks all tokens present. (c) If missing, LLM repair is given the explicit list and re-runs. |
| Total latency exceeds 6s at p95 | Sonnet response generation for PLAN bucket can take 5+ seconds alone. | (a) Stage 1+2 collapsed (saved 800ms). (b) Stage 4 deterministic by default (saved 1.0s on 90% of requests). (c) Frontend shows "Working on it…" with no time estimate, so 7s feels acceptable. (d) Long-load cancel after 8s. |
| Cost overrun | Bug causes max_tokens to balloon, or someone discovers the endpoint and spams it. | (a) Hard `max_tokens` per stage. (b) Anthropic Console spend limit at $50/$200. (c) Rate limit per IP at API route (Upstash rate-limit, week 5). (d) No streaming = no infinite loops. |
| Voice fails on iOS Safari | Web Speech API support is patchy on iOS, requires user gesture, and breaks in WebView (e.g., when opened from text app). | Detection at component mount. If unsupported, hide voice button entirely and show single line "Voice typing isn't available on this device." Never break the page. |
| User pastes a confusing block of text | Long forwarded email with headers, signatures, disclaimers. Stage 1+2 has to find the actual content. | Optimizer prompt: "If input contains email headers, signatures, or legal disclaimers, identify the substantive content and ignore the rest." Test case for this in DECODE bucket. |
| User makes a request that doesn't fit any bucket | "What time is it in Tokyo?" — no bucket. | Classifier defaults to EXPLAIN. EXPLAIN handles factual questions gracefully. |
| LLM repair (Stage 4 fallback) itself fails verbatim check | Even repair pass drops a token. | Maximum 1 repair attempt. If still failing, ship the draft with a warning logged. Decision: usable-but-flawed answer beats no answer. Reviewed weekly via logs. |
| User asks medical question requiring specific dosing | "Is 800mg ibuprofen okay with my blood thinner?" Bucket EXPLAIN, but safety risk if model gets it wrong. | Optimizer prompt: medical questions involving dosing, drug interactions, or symptoms get a referral sentence + cautious framing. No specific dose recommendations. Tested. |
| User in real distress | "I think I'm having a heart attack." | Classifier prompt has hard rule: any indication of medical emergency → response opens with "Call 911 now." Sonnet handles this well; test it. |
| Frontend deployed but Anthropic key missing in production | First production request 500s. | Test the deployment from Phase 1.4 with a real request before any user traffic. Add a `/api/health` route that confirms env vars are loaded and Anthropic responds. |
| Spinner spins forever (frontend timeout shorter than backend) | Browser fetch has no default timeout; Vercel route times out at 30s. If pipeline hangs, browser sees nothing. | AbortController on fetch with 25s timeout. After 8s, show "This is taking longer than usual" UI. After 25s, show error and re-enable Help button. |

---

# 6. PRIORITIZED BUILD ORDER

Assumes 4-8 hrs/week, 6 hrs/week average, MVP in 4 weeks, weeks 5-6 hardening. Total: 24-36 hours of work.

### Week 1 — Foundation (6 hrs)

- **Hour 1:** Phase 1.1 — create all accounts (GitHub, Vercel, Anthropic, Upstash). Set Anthropic spending cap.
- **Hours 2-3:** Phase 1.2 — local Next.js scaffold, install deps, env vars, push to GitHub, deploy to Vercel. Confirm default page is live.
- **Hours 4-6:** Build static frontend in `app/page.tsx` — text box, voice button placeholder (stub), examples placeholder (stub), Help me button. No API calls yet. Hardcode a fake response on submit so you can iterate UI. Push & deploy. **End of week 1: a beautiful static page lives on the internet.**

**What to ignore this week:** prompts, pipeline, voice, examples logic, real responses.

### Week 2 — Pipeline backbone (6 hrs)

- **Hours 1-2:** Build `lib/anthropic.ts` and `lib/pipeline.ts` with Stage 1+2 + Stage 3 only (skip Stage 4 for now). Use a stub classifier prompt that just routes to EXPLAIN for everything.
- **Hours 3-4:** Build `app/api/help/route.ts`. Wire frontend to call it. Test with real Anthropic API. **End of hour 4: app actually answers questions, badly.**
- **Hours 5-6:** Write the full classifier+optimizer prompt (`prompts/classifier-and-optimizer.md`). Test 5 inputs by hand. See how often bucket is right.

**What to ignore this week:** post-processing, verbatim preservation, voice, starters, copy button. Just get the spine working.

### Week 3 — Quality (8 hrs — push hard)

- **Hours 1-2:** Build `lib/postprocess.ts` (deterministic + LLM fallback). Wire into pipeline.
- **Hour 3:** Build `lib/starters.ts` and `<StarterExamples />`. Wire pre-fill behavior.
- **Hours 4-5:** Build `<VoiceButton />` with Web Speech API. Test on iOS Safari and Chrome.
- **Hour 6:** Build `<CopyButton />` and response card layout.
- **Hours 7-8:** Write 40 test cases (5 per bucket) in `tests/test-cases.json`. Build `tests/run-tests.ts`. Run it. Fix the worst classifier failures by adding examples to the prompt.

**What to ignore this week:** Helicone, custom domain, marketing, analytics.

### Week 4 — Iteration (6 hrs)

- **Hours 1-3:** Run test suite. For every failure, decide: prompt fix, postprocess rule fix, or accept. Iterate prompts. Aim for 90%+ pass rate.
- **Hour 4:** Write `/api/health` route. Deploy. Test on real iPhone, real Android, real desktop.
- **Hour 5:** Show it to 3 actual older adults. Watch them use it without instructions. Note every confusion.
- **Hour 6:** Fix the top 3 confusions from user testing. Redeploy.

**What to ignore this week:** Phase 2 features (OCR, TTS, saved letters), Phase 3 (family mode, paid tier).

### Week 5 — Hardening (4-6 hrs)

- Add Helicone for cost monitoring.
- Add Upstash rate limiting on API route (10 req/IP/min).
- Add `/api/health` monitoring (UptimeRobot, free).
- Pick a domain name. Configure DNS. Add to Vercel.
- Build a simple landing page or just a one-line "what is this" above the input box.
- Tighten error states based on logs from week 4.

### Week 6 — Distribution prep (4-6 hrs)

- Decide: how do users find this? The honest answer is text-message-from-adult-child. Build a "share with someone who needs this" link that auto-opens iMessage with prefilled text.
- Add basic analytics (Vercel Analytics, free).
- Set up a feedback widget — single textarea, posts to your email via Resend or similar.
- Stress-test: simulate 100 simultaneous requests (artillery or k6). Confirm Vercel scales, Anthropic doesn't 429, costs stay sane.

### Stop conditions before Phase 2

You don't move to Phase 2 features (OCR, TTS, saved letters) until:
- 50+ real users have used the app.
- You've reviewed 200+ requests in Redis logs.
- Test pass rate is sustained ≥95% across 2 weeks.
- You have at least one piece of evidence that current users *want* a Phase 2 feature, not that you assume they will.

---

# Final notes — pushback to hear

1. **The DECIDE "no recommendation" rule is the one piece of the spec to A/B test in week 5.** Older users explicitly seeking help often *want* a recommendation. The principled stance ("we don't tell you what to do") is defensible, but if usage data shows DECIDE responses get the fewest copies and the most start-overs, the rule is costing you product-market fit, not earning you trust.

2. **You're going to feel pressure to add features in week 4. Don't.** The test pass rate and the user-watching session will reveal that the prompts need 2-3 more weeks of iteration, not new features. Phase 2 features added before prompts are stable will mask the real failures.

3. **Distribution is the unsolved problem, not the product.** A 70-year-old does not download apps. They use what their daughter texted them. Your week 6 work on the share link is the most leveraged thing you'll do. A mediocre product with a good share loop beats a great product with no path in.

4. **You'll be tempted to use Opus 4.7 for VERIFY for "safety."** It's twice the cost and ~30% slower than Sonnet 4.6, with marginal quality difference at this task. Use Sonnet 4.6 unless your test data shows specific VERIFY failures Opus fixes. Don't pay for vibes.
