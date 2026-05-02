import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const WINDOW_S = 3600;
const LIMIT = 30;

let _redis: Redis | null = null;
function redis() {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/api/') || pathname === '/api/health') {
    return NextResponse.next();
  }

  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      '127.0.0.1';

    const key = `rl:${ip}`;
    const count = await redis().incr(key);
    if (count === 1) await redis().expire(key, WINDOW_S);

    if (count > LIMIT) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a while before trying again.' },
        { status: 429 }
      );
    }
  } catch {
    // Redis unavailable — allow request through rather than blocking users
  }

  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
