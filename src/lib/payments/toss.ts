import crypto from 'node:crypto';

const TOSS_API_BASE_URL = process.env.TOSS_API_BASE_URL ?? 'https://api.tosspayments.com';

export interface TossConfirmParams {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface TossPayment {
  orderId: string;
  paymentKey: string;
  status: string;
  totalAmount: number;
  method: string;
  approvedAt?: string;
  requestedAt?: string;
  suppliedAmount?: number;
  vat?: number;
  currency?: string;
  failures?: {
    code?: string;
    message?: string;
  };
  [key: string]: unknown;
}

export function isTossConfigured() {
  return Boolean(process.env.TOSS_SECRET_KEY);
}

export function isTossWebhookConfigured() {
  return Boolean(process.env.TOSS_WEBHOOK_SECRET);
}

function getAuthorizationHeader() {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    throw new Error('TOSS_SECRET_KEY is not configured');
  }
  const encoded = Buffer.from(`${secretKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

export class TossPaymentsError extends Error {
  constructor(message: string, public details?: unknown, public status?: number) {
    super(message);
    this.name = 'TossPaymentsError';
  }
}

export async function confirmTossPayment(payload: TossConfirmParams): Promise<TossPayment> {
  const response = await fetch(`${TOSS_API_BASE_URL}/v1/payments/confirm`, {
    method: 'POST',
    headers: {
      Authorization: getAuthorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new TossPaymentsError(
      data?.message || 'Toss payment confirmation failed',
      data,
      response.status
    );
  }

  return data as TossPayment;
}

export function verifyTossSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }
  const secret = process.env.TOSS_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const computed = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  return computed === signature;
}

export function mapTossStatusToPayment(status?: string) {
  switch (status) {
    case 'READY':
      return 'requested';
    case 'IN_PROGRESS':
      return 'authorized';
    case 'DONE':
      return 'paid';
    case 'CANCELED':
      return 'canceled';
    case 'PARTIAL_CANCELED':
      return 'refunded';
    case 'FAILED':
      return 'failed';
    default:
      return 'requested';
  }
}
