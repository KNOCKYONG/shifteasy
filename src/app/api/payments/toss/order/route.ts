import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTenantContext } from '@/lib/auth/clerk-integration';
import { Permission, PermissionChecker } from '@/lib/auth/rbac';
import { upsertPayment } from '@/lib/payments/payment-service';

export const dynamic = 'force-dynamic';

const CreateOrderSchema = z.object({
  orderId: z.string().min(3).optional(),
  amount: z.number().int().positive(),
  currency: z.string().default('KRW').optional(),
  orderName: z.string().optional(),
  plan: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: NextRequest) {
  const context = await getCurrentTenantContext();
  if (!context?.tenantId || !context.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checker = new PermissionChecker(context.role);
  if (!checker.hasPermission(Permission.TENANT_BILLING)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = CreateOrderSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const orderId = parsed.data.orderId ?? `order_${context.tenantId}_${Date.now()}`;

  await upsertPayment({
    tenantId: context.tenantId,
    customerId: context.userId,
    orderId,
    amount: parsed.data.amount,
    currency: parsed.data.currency ?? 'KRW',
    metadata: {
      ...parsed.data.metadata,
      plan: parsed.data.plan,
      orderName: parsed.data.orderName,
    },
    status: 'requested',
  });

  return NextResponse.json({
    orderId,
    amount: parsed.data.amount,
    currency: parsed.data.currency ?? 'KRW',
    customerKey: context.tenantId,
    orderName: parsed.data.orderName ?? `ShiftEasy ${parsed.data.plan ?? 'plan'}`,
  });
}
