import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentTenantContext } from '@/lib/auth/clerk-integration';
import { Permission, PermissionChecker } from '@/lib/auth/rbac';
import { PAYMENT_METHODS, type PaymentMethod } from '@/db/schema/payments';
import { findPaymentByOrderId, upsertPayment, updatePaymentByOrderId } from '@/lib/payments/payment-service';
import { TossPaymentsError, confirmTossPayment, isTossConfigured, mapTossStatusToPayment } from '@/lib/payments/toss';

export const dynamic = 'force-dynamic';

const ConfirmSchema = z.object({
  paymentKey: z.string().min(3),
  orderId: z.string().min(3),
  amount: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  if (!isTossConfigured()) {
    return NextResponse.json(
      { error: 'Toss Payments is not configured' },
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
  const parsed = ConfirmSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payment = await findPaymentByOrderId(parsed.data.orderId);
  if (payment && payment.tenantId !== context.tenantId) {
    return NextResponse.json({ error: 'Order does not belong to tenant' }, { status: 403 });
  }

  if (!payment) {
    await upsertPayment({
      tenantId: context.tenantId,
      customerId: context.userId,
      orderId: parsed.data.orderId,
      amount: parsed.data.amount,
      status: 'requested',
    });
  }

  try {
    const confirmation = await confirmTossPayment(parsed.data);
    const status = mapTossStatusToPayment(confirmation.status);

    const method = (PAYMENT_METHODS.includes(confirmation.method as PaymentMethod)
      ? (confirmation.method as PaymentMethod)
      : 'card') as PaymentMethod;

    const updated = await updatePaymentByOrderId(parsed.data.orderId, {
      status,
      paymentKey: parsed.data.paymentKey,
      tossPaymentKey: confirmation.paymentKey,
      method,
      amount: confirmation.totalAmount ?? parsed.data.amount,
      currency: (confirmation.currency as string) ?? 'KRW',
      metadata: confirmation,
      paidAt: confirmation.approvedAt ? new Date(confirmation.approvedAt) : new Date(),
    });

    return NextResponse.json({
      success: true,
      payment: {
        orderId: confirmation.orderId,
        status,
        amount: confirmation.totalAmount,
        currency: confirmation.currency,
        approvedAt: confirmation.approvedAt,
        method: confirmation.method,
      },
      record: updated,
    });
  } catch (error) {
    const details = error instanceof TossPaymentsError ? error.details : undefined;

    await updatePaymentByOrderId(parsed.data.orderId, {
      status: 'failed',
      failureMessage: (error as Error).message,
    });

    return NextResponse.json(
      {
        error: 'Payment confirmation failed',
        details,
      },
      { status: 502 }
    );
  }
}
