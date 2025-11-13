import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTenantContext } from '@/lib/auth/clerk-integration';
import { Permission, PermissionChecker } from '@/lib/auth/rbac';
import { ensureStripeCustomer, getTenantById } from '@/lib/payments/billing-service';
import { defaultSuccessUrl, getStripeClient, isStripeConfigured } from '@/lib/payments/stripe';

export const dynamic = 'force-dynamic';

const PortalSchema = z.object({
  returnUrl: z.string().url().optional(),
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

  const tenant = await getTenantById(context.tenantId);
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = PortalSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripeClient();
    const customerId = await ensureStripeCustomer(tenant);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: parsed.data.returnUrl ?? defaultSuccessUrl(),
    });

    return NextResponse.json({
      url: session.url,
      created: session.created,
    });
  } catch (error) {
    console.error('Stripe portal session failed', error);
    return NextResponse.json(
      { error: 'Unable to create customer portal session' },
      { status: 500 }
    );
  }
}
