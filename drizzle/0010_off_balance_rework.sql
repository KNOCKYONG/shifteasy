-- Add department and allocation columns to off_balance_ledger
ALTER TABLE "off_balance_ledger"
  ADD COLUMN "department_id" uuid,
  ADD COLUMN "accumulated_off_days" integer NOT NULL DEFAULT 0,
  ADD COLUMN "allocated_to_accumulation" integer NOT NULL DEFAULT 0,
  ADD COLUMN "allocated_to_allowance" integer NOT NULL DEFAULT 0,
  ADD COLUMN "allocation_status" text NOT NULL DEFAULT 'pending',
  ADD COLUMN "allocation_updated_at" timestamp,
  ADD COLUMN "allocation_updated_by" uuid;

-- Backfill accumulated_off_days with previous remaining values for existing rows
UPDATE "off_balance_ledger"
SET "accumulated_off_days" = COALESCE("remaining_off_days", 0)
WHERE "accumulated_off_days" = 0;

-- Reference departments and users for new columns
ALTER TABLE "off_balance_ledger"
  ADD CONSTRAINT "off_balance_ledger_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments" ("id") ON DELETE SET NULL,
  ADD CONSTRAINT "off_balance_ledger_allocation_updated_by_fkey"
    FOREIGN KEY ("allocation_updated_by") REFERENCES "users" ("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "off_balance_ledger_department_idx"
  ON "off_balance_ledger" ("department_id");

-- Remove off-balance columns from nurse_preferences (moved to ledger)
ALTER TABLE "nurse_preferences"
  DROP COLUMN IF EXISTS "accumulated_off_days",
  DROP COLUMN IF EXISTS "allocated_to_accumulation",
  DROP COLUMN IF EXISTS "allocated_to_allowance";
