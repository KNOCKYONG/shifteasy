import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTenantContext } from '@/lib/auth/clerk-integration';
import { Permission, PermissionChecker } from '@/lib/auth/rbac';
import { ensureStripeCustomer, getTenantById } from '@/lib/payments/billing-service';
import {
  defaultCancelUrl,
  defaultSuccessUrl,
  getStripeClient,
  isStripeConfigured,
  resolvePriceId,
} from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';

const CheckoutSessionSchema = z.object({
  priceId: z.string().min(1).optional(),
  quantity: z.number().int().positive().max(500).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  billingEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured for this environment' },
      { status: 501 }
    );
  }

  const context = await getCurrentTenantContext();
  if (!context?.tenantId || !context.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checker = new PermissionChecker(context.role);
  if (!checker.hasPermission(Permission.TENANT_BILLING)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = CheckoutSessionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const tenant = await getTenantById(context.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const resolvedPriceId = resolvePriceId(parsed.data.priceId);
  if (!resolvedPriceId) {
    return NextResponse.json(
      { error: 'No Stripe price configured. Set STRIPE_PRICE_* env vars.' },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripeClient();
    const customerId = await ensureStripeCustomer(tenant, {
      email: parsed.data.billingEmail,
    });

    const seatQuantity =
      parsed.data.quantity ??
      Math.max(
        tenant.billingMetadata?.seatQuantity ||
          tenant.settings?.maxUsers ||
          1,
        1
      );

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: tenant.id,
      metadata: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
      subscription_data: {
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        },
      },
      success_url: parsed.data.successUrl ?? defaultSuccessUrl(),
      cancel_url: parsed.data.cancelUrl ?? defaultCancelUrl(),
      line_items: [
        {
          price: resolvedPriceId,
          quantity: seatQuantity,
        },
      ],
    });

    return NextResponse.json({
      id: session.id,
      url: session.url,
      status: session.status,
    });
  } catch (error) {
    console.error('Stripe checkout session failed', error);
    return NextResponse.json(
      { error: 'Unable to create checkout session' },
      { status: 500 }
    );
  }
}
