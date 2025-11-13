-- Create payments table for Toss Payments integration
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "order_id" text NOT NULL,
  "payment_key" text,
  "toss_payment_key" text,
  "method" text NOT NULL, -- card, virtual_account, etc.
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'KRW',
  "status" text NOT NULL, -- inactive, trialing, active, paused, canceled
  "failure_code" text,
  "failure_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "paid_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments" ("order_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_idx" ON "payments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments" ("status");

-- Table to store subscription/billing key data (for recurring billing via Toss)
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "plan" text NOT NULL,
  "billing_cycle" text NOT NULL DEFAULT 'monthly',
  "status" text NOT NULL, -- requested, authorized, paid, failed, canceled, refunded
  "toss_billing_key" text,
  "started_at" timestamp with time zone,
  "renewal_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_tenant_plan_idx"
  ON "subscriptions" ("tenant_id", "plan")
  WHERE "status" IN ('active', 'trialing');

CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions" ("status");
