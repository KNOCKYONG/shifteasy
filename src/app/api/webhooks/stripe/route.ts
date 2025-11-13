import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handleStripeEvent } from '@/lib/payments/billing-service';
import {
  getStripeClient,
  isStripeConfigured,
  isStripeWebhookConfigured,
} from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isStripeConfigured() || !isStripeWebhookConfigured()) {
    return NextResponse.json(
      { error: 'Stripe webhook is not configured' },
      { status: 501 }
    );
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature header' }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (error) {
    console.error('Stripe webhook signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Stripe webhook processing failed for event ${event.id}`, error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
