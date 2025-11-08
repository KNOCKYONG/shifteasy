-- Manual Migration: Rename tenant_configs to configs and add department_id
-- Date: 2025-01-08

-- Step 1: Delete all data from tenant_configs (already done via code)
DELETE FROM tenant_configs;

-- Step 2: Drop the old table
DROP TABLE IF EXISTS tenant_configs CASCADE;

-- Step 3: Create new configs table with department_id
CREATE TABLE IF NOT EXISTS configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 4: Create unique index (allowing NULL for department_id)
CREATE UNIQUE INDEX configs_tenant_dept_key_unique
ON configs(tenant_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid), config_key);

-- Step 5: Add comments
COMMENT ON TABLE configs IS 'Organization configuration settings supporting both tenant-level and department-level configs';
COMMENT ON COLUMN configs.tenant_id IS 'Tenant ID (required)';
COMMENT ON COLUMN configs.department_id IS 'Department ID (NULL for tenant-level config, non-NULL for department-specific config)';
COMMENT ON COLUMN configs.config_key IS 'Configuration key (e.g., shift_types, positions, departments)';
COMMENT ON COLUMN configs.config_value IS 'Configuration value as JSON';

-- Verification
SELECT
  COUNT(*) as total_configs,
  COUNT(DISTINCT tenant_id) as tenants,
  COUNT(DISTINCT department_id) as departments_with_configs
FROM configs;
