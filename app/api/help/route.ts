import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@clerk/nextjs/server';
import { runPipeline } from '@/lib/pipeline';
import { getRedis } from '@/lib/redis';
import { getUserPlan, getQueryCount, monthlyLimit, incrementQueryCount } from '@/lib/plan';

export const maxDuration = 30;
export const runtime = 'nodejs';

const CACHE_TTL = 86400; // 24 hours

export async function POST(req: Request) {
  try {
    const { input } = await req.json();

    if (!input || typeof input !== 'string' || input.trim().length === 0) {
      return NextResponse.json({ error: 'empty_input' }, { status: 400 });
    }
    if (input.length > 4000) {
      return NextResponse.json({ error: 'input_too_long' }, { status: 400 });
    }

    const trimmed = input.trim();

    // Plan-based query limit for authenticated users
    const { userId } = await auth();
    if (userId) {
      const [planData, used] = await Promise.all([getUserPlan(userId), getQueryCount(userId)]);
      const limit = monthlyLimit(planData.plan);
      if (used >= limit) {
        return NextResponse.json(
          { error: 'limit_reached', plan: planData.plan, queriesUsed: used, queriesLimit: limit },
          { status: 402 }
        );
      }
    }

    // Return cached result for identical inputs
    const cacheKey = `cache:${createHash('sha256').update(trimmed).digest('hex').slice(0, 16)}`;
    try {
      const cached = await getRedis().get<{ text: string; bucket: string }>(cacheKey);
      if (cached) {
        if (userId) incrementQueryCount(userId).catch(() => {});
        return NextResponse.json(cached);
      }
    } catch {
      // cache miss — proceed
    }

    const result = await runPipeline(trimmed);
    const payload = { text: result.finalText, bucket: result.bucket };

    // fire-and-forget: increment count, cache result, log
    if (userId) incrementQueryCount(userId).catch(() => {});
    const r = getRedis();
    r.set(cacheKey, payload, { ex: CACHE_TTL }).catch(() => {});
    r.lpush('logs', JSON.stringify({ ts: Date.now(), bucket: result.bucket, len: trimmed.length })).catch(() => {});
    r.ltrim('logs', 0, 9999).catch(() => {});

    return NextResponse.json(payload);
  } catch (err) {
    console.error('Pipeline error:', err);
    return NextResponse.json({ error: 'pipeline_failure' }, { status: 500 });
  }
}
