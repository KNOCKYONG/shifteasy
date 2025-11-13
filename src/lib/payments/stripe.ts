import Stripe from 'stripe';

const apiVersion: Stripe.LatestApiVersion = '2024-06-20';
let client: Stripe | null = null;

export type StripePriceMap = {
  proMonthly?: string | null;
  proYearly?: string | null;
  enterprise?: string | null;
};

export const BILLING_PRICE_IDS: StripePriceMap = {
  proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
  proYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? null,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
};

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion,
      appInfo: {
        name: 'ShiftEasy',
      },
    });
  }

  return client;
}

export function resolvePriceId(preferredPriceId?: string | null): string | null {
  if (preferredPriceId) {
    return preferredPriceId;
  }

  return (
    BILLING_PRICE_IDS.proMonthly ||
    BILLING_PRICE_IDS.proYearly ||
    BILLING_PRICE_IDS.enterprise ||
    null
  );
}

export function getAppBaseUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function defaultSuccessUrl(): string {
  return `${getAppBaseUrl()}/settings/billing?state=success`;
}

export function defaultCancelUrl(): string {
  return `${getAppBaseUrl()}/settings/billing?state=cancelled`;
}
