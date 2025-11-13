import { db } from '@/db';
import { payments, type PaymentStatus, type PaymentMethod } from '@/db/schema/payments';
import { and, eq } from 'drizzle-orm';

type PaymentRecord = typeof payments.$inferSelect;

export async function upsertPayment(params: {
  tenantId: string;
  customerId?: string | null;
  orderId: string;
  amount: number;
  currency?: string;
  status?: PaymentStatus;
  method?: string;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    tenantId: params.tenantId,
    customerId: params.customerId ?? null,
    orderId: params.orderId,
    amount: params.amount,
    currency: params.currency ?? 'KRW',
    status: params.status ?? 'requested',
    method: (params.method as PaymentMethod) ?? 'card',
    metadata: params.metadata ?? {},
  } as Partial<PaymentRecord> & { tenantId: string; orderId: string; amount: number; currency: string; status: PaymentStatus; method: PaymentRecord['method']; };

  const [result] = await db
    .insert(payments)
    .values(payload)
    .onConflictDoUpdate({
      target: payments.orderId,
      set: {
        ...payload,
        updatedAt: new Date(),
      },
    })
    .returning();

  return result;
}

export async function updatePaymentByOrderId(orderId: string, patch: Partial<PaymentRecord>) {
  const [result] = await db
    .update(payments)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(payments.orderId, orderId))
    .returning();

  return result ?? null;
}

export async function findPaymentByOrderId(orderId: string) {
  const [result] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);

  return result ?? null;
}

export async function ensureTenantPayment(orderId: string, tenantId: string) {
  const [result] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.orderId, orderId),
        eq(payments.tenantId, tenantId)
      )
    )
    .limit(1);

  return result ?? null;
}
