import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const checks = {
    anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'PLACEHOLDER_REPLACE_ME'),
    upstash_url: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_URL !== 'PLACEHOLDER_REPLACE_ME'),
    upstash_token: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN && process.env.UPSTASH_REDIS_REST_TOKEN !== 'PLACEHOLDER_REPLACE_ME'),
  };
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
