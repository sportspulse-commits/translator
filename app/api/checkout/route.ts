import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getUserPlan } from '@/lib/plan';

export const runtime = 'nodejs';

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  family: process.env.STRIPE_FAMILY_PRICE_ID,
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { plan } = await req.json();
  const priceId = PRICE_IDS[plan];
  if (!priceId) return NextResponse.json({ error: 'invalid_plan' }, { status: 400 });

  const [user, planData] = await Promise.all([currentUser(), getUserPlan(userId)]);

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    ...(planData.stripeCustomerId
      ? { customer: planData.stripeCustomerId }
      : { customer_email: user?.emailAddresses[0]?.emailAddress }),
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
    success_url: `${process.env.NEXT_PUBLIC_URL}/account?upgraded=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/account`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
