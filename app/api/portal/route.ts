import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getUserPlan } from '@/lib/plan';

export const runtime = 'nodejs';

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const planData = await getUserPlan(userId);
  if (!planData.stripeCustomerId) {
    return NextResponse.json({ error: 'no_subscription' }, { status: 400 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: planData.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_URL}/account`,
  });

  return NextResponse.json({ url: session.url });
}
