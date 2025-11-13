import { NextRequest, NextResponse } from 'next/server';
import { updatePaymentByOrderId } from '@/lib/payments/payment-service';
import { isTossWebhookConfigured, mapTossStatusToPayment, verifyTossSignature } from '@/lib/payments/toss';

type TossWebhookPayload = {
  data?: TossWebhookPayload;
  orderId?: string;
  paymentKey?: string;
  status?: string;
  approvedAt?: string;
  canceledAt?: string;
  failure?: {
    code?: string;
    message?: string;
  };
  [key: string]: unknown;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!isTossWebhookConfigured()) {
    return NextResponse.json(
      { error: 'Toss webhook is not configured' },
      { status: 501 }
    );
  }

  const signature = request.headers.get('toss-signature') || request.headers.get('x-toss-signature');
  const rawBody = await request.text();

  if (!verifyTossSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let payload: TossWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as TossWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const orderId = payload?.data?.orderId || payload?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
  }

  const tossStatus = payload?.data?.status || payload?.status;
  const mappedStatus = mapTossStatusToPayment(tossStatus);

  await updatePaymentByOrderId(orderId, {
    status: mappedStatus,
    tossPaymentKey: payload?.data?.paymentKey || payload?.paymentKey,
    failureCode: payload?.data?.failure?.code || payload?.failure?.code,
    failureMessage: payload?.data?.failure?.message || payload?.failure?.message,
    metadata: payload,
    paidAt:
      mappedStatus === 'paid'
        ? new Date(payload?.data?.approvedAt || payload?.approvedAt || Date.now())
        : undefined,
    canceledAt:
      mappedStatus === 'canceled'
        ? new Date(payload?.data?.canceledAt || payload?.canceledAt || Date.now())
        : undefined,
  });

  return NextResponse.json({ received: true });
}
