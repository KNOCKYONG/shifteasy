import { pgTable, uuid, text, timestamp, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants, users } from './tenants';

export const PAYMENT_METHODS = ['card', 'virtual_account', 'transfer', 'mobile', 'tosspay'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const PAYMENT_STATUSES = ['requested', 'authorized', 'paid', 'failed', 'canceled', 'refunded'] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const SUBSCRIPTION_STATUSES = ['inactive', 'trialing', 'active', 'paused', 'canceled'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  customerId: uuid('customer_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: text('order_id').notNull(),
  paymentKey: text('payment_key'), // internal payment key, optional
  tossPaymentKey: text('toss_payment_key'),
  method: text('method').$type<PaymentMethod>().notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('KRW'),
  status: text('status').$type<PaymentStatus>().notNull(),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  orderIdIdx: index('payments_order_id_idx').on(table.orderId),
  tenantIdx: index('payments_tenant_idx').on(table.tenantId),
  statusIdx: index('payments_status_idx').on(table.status),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  customerId: uuid('customer_id').references(() => users.id, { onDelete: 'set null' }),
  plan: text('plan').notNull(),
  billingCycle: text('billing_cycle').$type<BillingCycle>().notNull().default('monthly'),
  status: text('status').$type<SubscriptionStatus>().notNull(),
  tossBillingKey: text('toss_billing_key'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  renewalAt: timestamp('renewal_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => ({
  uniqueActivePlanIdx: uniqueIndex('subscriptions_tenant_plan_idx')
    .on(table.tenantId, table.plan)
    .where(sql`status in ('active', 'trialing')`),
  statusIdx: index('subscriptions_status_idx').on(table.status),
}));
