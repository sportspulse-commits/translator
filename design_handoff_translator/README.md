# Handoff: Translator — single-screen AI helper for older adults

## Overview

**Translator** is a single-screen web app that accepts unstructured natural-language input from older users (60s–80s) and returns a finished, plain-language, copy-ready response. Between input and output sits a hidden 4-stage prompt pipeline (classify → optimize → answer → flatten) that is intentionally invisible to the user. The product is a "translator" between the messy real world (letters, scams, decisions, replies) and clear English the user can copy and use.

The mocks in this folder are the **design** — color, type, spacing, hierarchy, copy, motion — not the implementation. Backend wiring (Anthropic SDK, Upstash Redis, Web Speech) is described separately in `Translator_Execution_Blueprint.md`, which is the source of truth for the pipeline architecture.

## About the design files

The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look and behavior. They are **not production code to copy directly**. The task is to **recreate these designs in your target codebase's environment** using its established patterns:

- If the repo is **Next.js / React** (per the blueprint): rebuild the components in TSX with whatever styling library the repo already uses (Tailwind, CSS modules, vanilla-extract, etc.).
- If the repo uses a **different framework**: translate the JSX/CSS into that framework's idioms. The visual contract — tokens, spacing, type scale, motion — must survive the translation.
- If the repo has **no UI yet**: the blueprint recommends Next.js 14 App Router; build the design there.

Do not ship the prototype HTML. It uses `<script type="text/babel">` and inline-CDN React, which are demo-only.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, interactions, and copy. Recreate pixel-faithfully, then conform component primitives (buttons, inputs) to the repo's existing design system if one exists.

## The single screen

There is exactly one screen. It has four phases of state:

1. **Idle** — empty textarea, voice button, examples-toggle, disabled "Help me" primary
2. **Loading** — recap of "you said …", three pulsing dots, italic "Working on it…"
3. **Answer** — collapsed recap, eyebrow label, answer card (one of three tones), copy button, start-over link, disclaimer
4. **Error** — full-width red-700 message, primary re-enabled (handled inline, no separate route)

There are no other routes. No history, no settings, no auth. The blueprint is firm on this.

### Layout (mobile, 393px iPhone width)

```
┌─────────────────────────────────────────────┐
│ Translator.                                  │ ← 18px top / 14px bottom padding
│                                              │   1px rule below
├─────────────────────────────────────────────┤
│  (28px top padding)                          │
│                                              │
│  What's going on?                            │ ← Source Serif 4, 40px, weight 400
│                                              │
│  Tell us in your own words.                  │ ← Inter, 18px, ink-soft
│  We'll write something clear back.           │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │                                     │     │ ← Textarea
│  │  Start typing here…                 │     │   white, 2px ink border, r:12
│  │                                     │     │   Source Serif 4 20px, italic placeholder
│  │                                     │     │   min-height 160px, padding 18/20
│  └─────────────────────────────────────┘     │
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │   🎤  Talk instead of typing         │     │ ← Pill, 60px, 2px ink border, white
│  └─────────────────────────────────────┘     │   Inter 18px medium, mic icon left
│                                              │
│  Show me what to ask                         │ ← Inter 17px medium, accent, underlined
│                                              │
│  ┌─────────────────────────────────────┐     │
│  │           Help me                    │     │ ← Primary, 68px, accent bg, r:14
│  └─────────────────────────────────────┘     │   Inter 22px medium, white
└─────────────────────────────────────────────┘
```

### Layout (desktop, ≥760px)

Same structure, scaled up:
- Question becomes 56px
- Stage max-width 760px (centered)
- Stage horizontal padding 56px
- Header padding 20/56
- Wordmark 24px
- Input min-height 180px, font 22px
- Answer body 22px

## Tokens

```css
/* Color */
--bg          #faf7f2   /* warm off-white page */
--bg-sunk     #f1ece1   /* hover/disabled depth */
--ink         #1a1714   /* primary text, primary borders */
--ink-soft    #4a443d   /* body subdued */
--ink-mute    #8a8278   /* hints, captions, eyebrow */
--rule        #1a1714   /* 2px borders */
--rule-soft   #d9d2c4   /* dividers, secondary borders */
--accent      #1f5d4c   /* forest green — primary action, links, focus */
--accent-ink  #0f3d31   /* accent hover/pressed */
--cream       #fdf6dd   /* DECODE/EXPLAIN/PLAN/DECIDE answer card */
--cream-rule  #e6d896
--warm-card   #f5ecd9   /* RESPOND/COMPOSE/CREATE answer card */
--warm-rule   #d9c79a
--alert       #a8472a   /* terra-cotta — VERIFY scam alert ONLY */
--alert-soft  #fbeee5   /* alert card background */
--alert-rule  #dba488

/* Typography */
--font-serif  "Source Serif 4", "Source Serif Pro", Georgia, serif
--font-sans   "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif

/* Type scale (mobile) */
question        Source Serif 4   400   40px / 1.1   tracking -0.02em
sub             Inter            400   18px / 1.45  ink-soft
input           Source Serif 4   400   20px / 1.45
button-primary  Inter            500   22px
button-pill     Inter            500   18px
link            Inter            500   17px         underline 1.5px, offset 4px
eyebrow         Inter            500   13px         uppercase, tracking 0.08em, ink-mute
answer-body     Source Serif 4   400   20px / 1.5
recap           Source Serif 4   400   17px / 1.45  ink-soft
disclaimer      Inter            400   14px italic  ink-mute

/* Radii */
--r-input  12px
--r-pill   999px
--r-card   16px
--r-button 14px

/* Borders */
primary borders        2px solid var(--ink)
secondary borders      2px solid var(--rule-soft)
hairline dividers      1px solid var(--rule-soft)

/* Touch targets */
voice / copy / starter row    min 60px
help me                       68px
input                         min 160px height

/* Motion */
hover transitions    120ms ease
loading delay        2400ms simulated; in production this is real pipeline latency
copy success         "Copied" persists 2500ms

/* Spacing */
stage horizontal padding (mobile)    24px
stage horizontal padding (desktop)   56px
stage top padding                    28px (mobile) / 64px (desktop)
between major elements               18–24px
between related elements             10–14px
```

## Components

### `<Header />`
- Sticky top, 18/24/14/24 padding, 1px ink-soft rule below
- "Translator" wordmark in serif 22px, weight 400, with a single accent-green period (`Translator.`) — keep the period accent green via `::after` pseudo or inline span
- Desktop: 20/56/18/56 padding, wordmark 24px

### `<Question />`
- `<h1>` Source Serif 4, 40px (mobile) / 56px (desktop), weight 400, line-height 1.1, tracking -0.02em
- Followed by sub-paragraph, Inter 18px, color ink-soft, max-width 32ch, line-height 1.45

### `<Input />`
- Controlled textarea, white bg, 2px ink border, radius 12
- Padding 18/20, font Source Serif 4 20px, italic placeholder color ink-mute
- Focus: border becomes accent, plus 3px rgba(31,93,76,0.18) outer ring
- min-height 160px (mobile), 180px (desktop), `resize: none`
- Hard cap 4000 chars with silent enforcement; show "Showing first 4000 characters" gray-600 hint at 3500+ (per blueprint §3.4)

### `<VoiceButton />`
- Pill, full-width, 60px min-height, white bg, 2px ink border
- Icon (mic, 22px) + label "Talk instead of typing" (Inter 18px medium)
- **Listening state**: `--alert-soft` bg, `--alert` border + text, label "Listening… tap to stop", animated 2px ring pulsing 1.4s (`scale 0.8→1.6, opacity 0.7→0`)
- **Unsupported state** (iOS Safari old, Firefox without API): hide the button entirely, replace with single line "Voice typing isn't available on this device." in Inter 18px gray-700
- Honor `prefers-reduced-motion`: disable pulse, no fallback animation needed

### `<StarterExamples />`
- Toggle: link-style button "Show me what to ask" / "Hide examples", Inter 17px medium, accent color, underlined
- When open: vertical list, 10px gap
- Each item: white bg, 2px rule-soft border (hover → 2px ink), radius 12, padding 16/18, Source Serif 4 19px, label left + right-arrow icon (18px, ink-mute), full-width
- 6 starter prefills (per blueprint §3.4):
  1. "I got a letter I don't understand" → prefill `"I got a letter from "`
  2. "Help me reply to a message" → `"I need to reply to this message: "`
  3. "Is this a scam?" → `"I think this might be a scam. Here's what I got: "`
  4. "Write a note for me" → `"I want to write a note to "`
  5. "Explain something to me" → `"Can you explain "`
  6. "Help me decide between two options" → `"I'm trying to decide between "`
- Tapping pre-fills the textarea, places the cursor at end, collapses the list, focuses the textarea

### `<HelpButton />` (primary)
- Full-width, 68px, accent bg, white text, Inter 22px medium, radius 14
- Hover: bg accent-ink
- Disabled state (empty input): bg-sunk, ink-mute text, rule-soft border, no shadow, `cursor: not-allowed`
- Replaced entirely (not just disabled) by `<WorkingIndicator />` during loading

### `<WorkingIndicator />`
- Centered column, 28/16 padding
- Three 12px circles in a row, 10px gap, accent color, opacity-and-scale pulse (`opacity 0.25→1, scale 0.85→1.05`, 1.4s, staggered 0.2s, 0.4s)
- Below: italic Source Serif 4 20px ink-soft "Working on it…"
- `aria-live="polite"`
- `prefers-reduced-motion`: hold static at opacity 0.6

### `<Recap />`
- Eyebrow "YOU SAID" (Inter 13px medium uppercase tracking 0.08em ink-mute)
- Followed by user input as Source Serif 4 17px ink-soft
- Left border 3px rule-soft, padding 16/18
- After answer arrives, switch to **collapsed** variant: clamp to 2 lines, font drops to 15px

### `<AnswerCard tone={"calm"|"warm"|"alert"} />`
- Eyebrow "HERE'S WHAT TO DO" above the card (Inter 13px uppercase ink-mute)
- Card padding 26/26/24, radius 16, 2px border
- Body Source Serif 4 20px (22px desktop), line-height 1.5
- Paragraphs 14px gap; last paragraph no margin
- **calm** (default — DECODE, EXPLAIN, PLAN, DECIDE): bg `--cream`, border `--cream-rule`
- **warm** (RESPOND, COMPOSE, CREATE): bg `--warm-card`, border `--warm-rule`
- **alert** (VERIFY when scam detected): bg `--alert-soft`, border `--alert-rule`. Above the body: a "HEADS UP" pill (alert bg, white text, Inter 13px weight 600 uppercase tracking 0.04em) with an alert-triangle icon, 6/12/6/10 padding, radius 999, 14px bottom margin

The bucket label (DECODE/VERIFY/etc.) is **never shown** to the user. It exists internally for routing only. The tonal color shift is the only visual cue.

### `<CopyButton />`
- Full-width, 60px min-height, white bg, 2px ink border, radius 12
- Default: copy icon (22px) + "Copy this" (Inter 18px medium ink)
- After click: bg accent, text white, border accent, content becomes check icon + "Copied" — persists 2.5s, then reverts
- Calls `navigator.clipboard.writeText(answerText)`

### `<Restart />`
- Full-width text button, accent, Inter 17px medium, underlined, 14/0 padding
- Label: "Start over"
- Resets all state, scrolls stage to top, focuses textarea

### `<Disclaimer />`
- Top-bordered (1px rule-soft), 16px top margin, 12px top padding
- Inter 14px italic ink-mute
- Text: "Translator gives you a starting point. For big decisions, talk to a person you trust."
- The blueprint requires referrals to professionals (doctor / lawyer / fee-only advisor or CPA) for medical, legal, and financial decisions — those referrals are produced by the **answer model** based on optimized-prompt requirements, not by the disclaimer. Keep the disclaimer constant.

## Interactions & flows

### Idle → Loading → Answer (happy path)
1. User types or taps a starter or uses voice
2. `Help me` enables on first non-whitespace character
3. Tap `Help me` → primary button is replaced by `<WorkingIndicator />`, recap appears above
4. Pipeline returns (real prod: 3.7s p50 / 6.5s p95 per blueprint §2.6) — the prototype simulates 2.4s
5. Recap collapses, eyebrow + answer card + copy + restart + disclaimer render in that order
6. Auto-scroll the stage scroller to the bottom (smooth)

### Voice
- First tap → if browser supports `SpeechRecognition` / `webkitSpeechRecognition`, prompt for mic permission, start recognition (lang `en-US`, `interimResults: false`, `continuous: false`)
- During recognition: button enters "listening" state with pulsing ring
- On result: append transcript to textarea (do not replace), focus textarea
- On end / error: revert to idle. Errors show "Voice didn't work. Please type instead." (Inter 18px gray-700, 8s auto-dismiss) below the button
- If unsupported: render the unsupported-line variant instead of the button — never show a non-working button

### Empty submission
- Button stays disabled. No error message, no toast. Quiet.

### Cancel
- After 8s of loading, render a small underlined link "This is taking longer than usual. Cancel and try again." (Inter 18px alert color) below the spinner. Clicking aborts the in-flight request and returns to idle.

### Reduced motion
- Disable spinner pulse, voice ring pulse. Smooth-scroll stays smooth (it's not in the motion budget).

### Tab order
input → voice → starters toggle → starter rows (when open) → help me

## State management

```ts
type Phase = "idle" | "loading" | "answer" | "error";

interface ScreenState {
  input: string;          // controlled textarea
  phase: Phase;
  answer: string | null;  // final post-processed text from /api/help
  bucket: Bucket | null;  // received from server for tone selection ONLY
  showStarters: boolean;
  listening: boolean;     // voice substate
  copied: boolean;        // 2.5s timeout window
  error: string | null;
}
```

`bucket` drives only the tone of `<AnswerCard>`:
- `VERIFY` when the answer text contains a scam call-out → `tone="alert"`
- `RESPOND | COMPOSE | CREATE` → `tone="warm"`
- everything else → `tone="calm"`

Per blueprint §2.4 the API does **not** return the bucket today (`{ text }` only). To drive tone, the server should add `bucket` to the response — this is a deliberate tweak to the spec and worth raising in PR review. Alternatively, derive tone from content (presence of "scam" → alert, presence of greeting like "Dear" → warm) but bucket-driven is cleaner.

`copied` clears via `setTimeout(2500)`; cancel the timer on unmount.

## Accessibility constraints (non-negotiable)

- All interactive elements ≥56px tap target (this design: 60–68)
- All text on white: ≥9.5:1 contrast (gray-700 on white)
- All text on cream: ≥13:1 (ink on cream)
- All text on accent green: ≥5.4:1 (white on accent — AAA for large text)
- All text on alert-soft: ≥7:1 (ink on alert-soft)
- Never gray-on-gray; never relying on color alone — the alert state has the HEADS UP pill, the icon, and the color
- `<button>` for every action; no `<div onClick>`
- `aria-live="polite"` on `<WorkingIndicator />`
- `role="alert"` on error message
- Voice button has `aria-pressed` and `aria-label` reflecting current state
- Honor `prefers-reduced-motion`

## What is NOT in the design (and shouldn't be added)

- No "Did you mean…?" suggestions
- No reformulation ("So you want help with…?")
- No follow-up questions
- No bucket selector, mode toggle, model picker
- No history, no past sessions, no folders
- No conversation threads — each session is one shot
- No emoji, no decorative imagery
- No dark mode (in V1 — the audience and use case don't call for it; the blueprint is silent and we should not add it without user research)

## Files in this bundle

- `Translator.html` — the prototype canvas (hero + palette + iPhone interactive + desktop interactive + states reference)
- `app.jsx` — `TranslatorApp` component, all phases, all components inline, ~310 lines
- `scenarios.jsx` — eight realistic scenario fixtures (input + finished answer per bucket) that drove the design's content; useful as test cases for your real pipeline
- `styles.css` — tokens + every component class, BEM-ish naming with `tx-` prefix
- `ios-frame.jsx` — iPhone bezel used in the prototype only; do not ship
- `tweaks-panel.jsx` — design-time tweaks panel; do not ship
- `Translator_Execution_Blueprint.md` — the architecture document; the source of truth for the pipeline, prompts, latency budget, cost budget, and testing system. Read this first.

## Recommended implementation order

1. Tokens — port the CSS variables to your styling layer (Tailwind config, vanilla-extract theme, or a `tokens.css` import)
2. Type system — load Source Serif 4 + Inter from Google Fonts (weights: Serif 400/500; Inter 400/500/600). Self-hosting is preferred for production.
3. `<Header />`, `<Question />`, `<Input />` — get the idle screen pixel-faithful before touching state
4. `<HelpButton />` enabling on input — the whole interaction hinges on this microstate
5. `<VoiceButton />` with real Web Speech API (graceful degradation per spec)
6. `<StarterExamples />` and prefill flow
7. `<WorkingIndicator />` and `<Recap />`
8. `<AnswerCard />` — wire all three tones; test with `scenarios.jsx` fixtures
9. `<CopyButton />` and `<Restart />`
10. Real `/api/help` integration per blueprint Phase 2

## Open questions to surface in PR

- Bucket exposure on `/api/help` response — required for tone, currently missing
- Whether to A/B test "DECIDE never recommends" — the blueprint's pushback section flagged this as eroding utility
- Print stylesheet — older users will physically print the answer card; not designed yet
- "Change the tone" affordance on the answer screen (shorter / warmer / more formal regenerate) — explicitly out of V1 but commonly requested in user testing of similar tools
