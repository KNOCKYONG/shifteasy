-- Stripe billing scaffold for tenants
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "billing_email" text,
  ADD COLUMN IF NOT EXISTS "billing_status" text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "billing_period_end" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "billing_metadata" jsonb DEFAULT '{}'::jsonb;

ALTER TABLE "tenants"
  ADD CONSTRAINT IF NOT EXISTS "tenants_stripe_customer_id_unique"
    UNIQUE ("stripe_customer_id");

ALTER TABLE "tenants"
  ADD CONSTRAINT IF NOT EXISTS "tenants_stripe_subscription_id_unique"
    UNIQUE ("stripe_subscription_id");

CREATE INDEX IF NOT EXISTS "tenants_billing_status_idx"
  ON "tenants" ("billing_status");
