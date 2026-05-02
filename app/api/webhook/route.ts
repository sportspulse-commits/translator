import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getUserPlan, setUserPlan } from '@/lib/plan';

export const runtime = 'nodejs';

let _stripe: Stripe | null = null;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) return NextResponse.json({ error: 'no_signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (userId && (plan === 'pro' || plan === 'family')) {
        await setUserPlan(userId, {
          plan,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (userId) {
        const current = await getUserPlan(userId);
        await setUserPlan(userId, {
          plan: 'free',
          stripeCustomerId: current.stripeCustomerId,
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
