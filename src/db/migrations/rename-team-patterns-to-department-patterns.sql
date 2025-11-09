-- Migration: Rename team_patterns table to department_patterns
-- Date: 2025-01-09
-- Description: Rename team_patterns to department_patterns to better reflect the table's purpose

BEGIN;

-- Step 1: Rename the table
ALTER TABLE team_patterns RENAME TO department_patterns;

-- Step 2: Rename indexes
ALTER INDEX team_patterns_department_idx RENAME TO department_patterns_department_idx;
ALTER INDEX team_patterns_active_idx RENAME TO department_patterns_active_idx;

-- Step 3: (Optional) Add comment to new table
COMMENT ON TABLE department_patterns IS 'Department-level scheduling patterns including shift requirements and work patterns';

COMMIT;

-- Rollback script (if needed):
-- BEGIN;
-- ALTER TABLE department_patterns RENAME TO team_patterns;
-- ALTER INDEX department_patterns_department_idx RENAME TO team_patterns_department_idx;
-- ALTER INDEX department_patterns_active_idx RENAME TO team_patterns_active_idx;
-- COMMIT;
