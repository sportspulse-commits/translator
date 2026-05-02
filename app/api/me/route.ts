import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserPlan, getQueryCount, monthlyLimit } from '@/lib/plan';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ signedIn: false, plan: 'free', queriesUsed: 0, queriesLimit: 10 });
  }

  const planData = await getUserPlan(userId);
  const queriesUsed = await getQueryCount(userId);
  const limit = monthlyLimit(planData.plan);

  return NextResponse.json({
    signedIn: true,
    plan: planData.plan,
    queriesUsed,
    queriesLimit: limit,
  });
}
