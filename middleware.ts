import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const WINDOW_S = 3600;
const ANON_LIMIT = 10; // anonymous requests per hour per IP

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

const isProtectedPage = createRouteMatcher(['/account(.*)']);
// All API routes except health + webhook (Stripe calls webhook without auth)
const isApiRoute = createRouteMatcher(['/api/((?!health|webhook).*)']);

export default clerkMiddleware(async (auth, req) => {
  // Account page: redirect to sign-in if not authenticated
  if (isProtectedPage(req)) {
    await auth.protect();
  }

  // Anonymous API usage: enforce IP-based hourly rate limit
  // Authenticated users are limited per plan inside each route handler
  if (isApiRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      try {
        const ip =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req.headers.get('x-real-ip') ??
          '127.0.0.1';

        const key = `rl:${ip}`;
        const count = await redis().incr(key);
        if (count === 1) await redis().expire(key, WINDOW_S);

        if (count > ANON_LIMIT) {
          return NextResponse.json(
            { error: 'Too many requests. Sign in for more access.' },
            { status: 429 }
          );
        }
      } catch {
        // Redis unavailable — allow through
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
