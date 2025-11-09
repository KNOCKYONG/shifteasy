-- ========================================
-- Supabase Migration: Remove experience_level column
-- Date: 2025-01-09
-- ========================================
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run"
--
-- ========================================

-- Check if experience_level column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'experience_level'
    ) THEN
        RAISE NOTICE 'experience_level column exists. Removing...';

        -- Remove the column
        ALTER TABLE users DROP COLUMN experience_level;

        RAISE NOTICE 'Successfully removed experience_level column';
    ELSE
        RAISE NOTICE 'experience_level column does not exist. Nothing to do.';
    END IF;
END $$;

-- Verify the column has been removed
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name = 'experience_level'
        )
        THEN 'ERROR: experience_level column still exists!'
        ELSE 'SUCCESS: experience_level column has been removed'
    END as verification_result;

-- Show current users table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
