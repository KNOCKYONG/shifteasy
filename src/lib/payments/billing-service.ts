import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { db } from '@/db';
import { tenants, type Tenant, type BillingStatus } from '@/db/schema/tenants';
import { getStripeClient } from './stripe';

type StripeSubscriptionStatus = Stripe.Subscription.Status;

const subscriptionStatusMap: Record<StripeSubscriptionStatus | 'default', BillingStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'past_due',
  incomplete: 'inactive',
  incomplete_expired: 'inactive',
  paused: 'past_due',
  default: 'inactive',
};

function mapStatus(status: StripeSubscriptionStatus): BillingStatus {
  return subscriptionStatusMap[status] ?? subscriptionStatusMap.default;
}

function mergeMetadata(tenant: Tenant, patch: Record<string, unknown>) {
  return {
    ...(tenant.billingMetadata || {}),
    ...patch,
  };
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const result = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return result[0] ?? null;
}

export async function ensureStripeCustomer(
  tenant: Tenant,
  opts?: { email?: string | null }
): Promise<string> {
  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: opts?.email ?? tenant.billingEmail ?? undefined,
    name: tenant.name,
    description: `ShiftEasy tenant ${tenant.name}`,
    metadata: {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    },
  });

  await db
    .update(tenants)
    .set({
      stripeCustomerId: customer.id,
      billingEmail: opts?.email ?? tenant.billingEmail ?? customer.email ?? null,
      billingMetadata: mergeMetadata(tenant, {
        lastEventId: `customer:${customer.id}`,
      }),
    })
    .where(eq(tenants.id, tenant.id));

  return customer.id;
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event);
      break;
    case 'invoice.payment_failed':
      await markInvoiceStatus(event, 'past_due');
      break;
    case 'invoice.payment_succeeded':
      await markInvoiceStatus(event, 'active');
      break;
    default:
      console.info(`Unhandled Stripe event: ${event.type}`);
  }
}

async function syncSubscription(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) {
    return;
  }

  const tenant = await getTenantByStripeCustomerId(customerId);
  if (!tenant) {
    return;
  }

  const status = mapStatus(subscription.status);
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  await db
    .update(tenants)
    .set({
      stripeSubscriptionId: subscription.id,
      billingStatus: status,
      billingPeriodEnd: periodEnd,
      billingMetadata: mergeMetadata(tenant, {
        lastEventId: event.id,
        seatQuantity:
          subscription.items?.data?.[0]?.quantity ?? tenant.billingMetadata?.seatQuantity,
        defaultPriceId:
          subscription.items?.data?.[0]?.price?.id ?? tenant.billingMetadata?.defaultPriceId,
      }),
    })
    .where(eq(tenants.id, tenant.id));
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const tenantId = (session.metadata?.tenantId as string) || session.client_reference_id;

  if (!tenantId) {
    return;
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return;
  }

  await db
    .update(tenants)
    .set({
      billingStatus: tenant.billingStatus === 'inactive' ? 'trialing' : tenant.billingStatus,
      billingMetadata: mergeMetadata(tenant, {
        lastEventId: event.id,
        checkoutSessionId: session.id,
      }),
    })
    .where(eq(tenants.id, tenantId));
}

async function getTenantByStripeCustomerId(customerId: string): Promise<Tenant | null> {
  const result = await db
    .select()
    .from(tenants)
    .where(eq(tenants.stripeCustomerId, customerId))
    .limit(1);

  return result[0] ?? null;
}

async function markInvoiceStatus(event: Stripe.Event, targetStatus: BillingStatus) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  if (!customerId) {
    return;
  }

  const tenant = await getTenantByStripeCustomerId(customerId);
  if (!tenant) {
    return;
  }

  const metadataPatch: Record<string, unknown> = {
    lastEventId: event.id,
    lastInvoiceId: invoice.id,
  };

  if (targetStatus === 'past_due') {
    metadataPatch.lastError =
      invoice.last_finalization_error?.message ??
      (typeof invoice.metadata?.last_error === 'string'
        ? invoice.metadata.last_error
        : undefined) ??
      'payment_failed';
  } else {
    metadataPatch.lastError = null;
  }

  await db
    .update(tenants)
    .set({
      billingStatus: targetStatus,
      billingMetadata: mergeMetadata(tenant, metadataPatch),
    })
    .where(eq(tenants.id, tenant.id));
}
