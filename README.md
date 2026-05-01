# Translator

Single-screen helper for older adults. Hidden 3-stage pipeline rewrites natural-language input into a plain-language answer.

## Run locally

1. Copy `.env.example` to `.env.local` and fill in real values
2. `npm install`
3. `npm run dev`
4. Visit http://localhost:3000

## Run tests

`npm test` — requires real API credentials in `.env.local`

## Architecture

- Frontend: Next.js 14 App Router on Vercel
- Pipeline: Haiku 4.5 classifier+optimizer → Sonnet 4.5 answer → deterministic postprocess (regex + Haiku fallback)
- Logging: Upstash Redis, 7-day TTL, anonymous

See `Translator_Execution_Blueprint.md` for full details.
