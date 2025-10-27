-- Migration: Make holidays tenant_id nullable and set existing holidays as global
-- Date: 2025-10-27

-- 1. Make tenant_id column nullable
ALTER TABLE holidays
ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Set all existing holidays as global (tenant_id = NULL)
UPDATE holidays
SET tenant_id = NULL
WHERE tenant_id IS NOT NULL;

-- 3. Update index to support NULL tenant_id queries
-- The existing indexes will still work, but we can add a partial index for global holidays
CREATE INDEX IF NOT EXISTS holidays_global_idx
ON holidays(date)
WHERE tenant_id IS NULL;

-- Verification query (optional - comment out for production)
-- SELECT
--   COUNT(*) as total,
--   COUNT(tenant_id) as with_tenant,
--   COUNT(*) - COUNT(tenant_id) as global
-- FROM holidays;
