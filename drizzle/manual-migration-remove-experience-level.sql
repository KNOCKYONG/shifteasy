-- Manual Migration: Remove experience_level column from users table
-- Date: 2025-01-09
-- Description: Remove experience_level field as it's no longer needed in career groups

-- Step 1: Remove experience_level column from users table
ALTER TABLE users DROP COLUMN IF EXISTS experience_level;

-- Verification: Check that column is removed
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'experience_level';
-- Should return 0 rows

-- Verify users table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
