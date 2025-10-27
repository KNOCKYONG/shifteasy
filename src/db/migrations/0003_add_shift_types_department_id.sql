-- Migration: Add department_id to shift_types
-- Date: 2025-10-27

-- 1. Add department_id column to shift_types
ALTER TABLE shift_types
ADD COLUMN IF NOT EXISTS department_id UUID;

-- 2. Add foreign key constraint
ALTER TABLE shift_types
ADD CONSTRAINT shift_types_department_id_fkey
FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- 3. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS shift_types_department_id_idx
ON shift_types(department_id);

CREATE INDEX IF NOT EXISTS shift_types_tenant_dept_code_idx
ON shift_types(tenant_id, department_id, code);

-- 4. Populate shift_types.department_id
-- For now, set to NULL (department-agnostic shift types)
-- Later, tenant-specific shift types can be created with department_id

-- Verification query (optional - comment out for production)
-- SELECT
--   COUNT(*) as total,
--   COUNT(department_id) as with_dept,
--   COUNT(*) - COUNT(department_id) as without_dept
-- FROM shift_types;
