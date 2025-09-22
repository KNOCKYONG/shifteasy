-- Drop legacy tables migration
-- This migration removes old tables that have been replaced by the new multi-tenant structure

-- 1. Create backup schema (optional - uncomment if you want to backup data first)
-- CREATE SCHEMA IF NOT EXISTS backup_legacy;
-- CREATE TABLE IF NOT EXISTS backup_legacy.hospitals AS SELECT * FROM hospitals WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'hospitals');
-- CREATE TABLE IF NOT EXISTS backup_legacy.wards AS SELECT * FROM wards WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'wards');
-- CREATE TABLE IF NOT EXISTS backup_legacy.staff AS SELECT * FROM staff WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'staff');
-- CREATE TABLE IF NOT EXISTS backup_legacy.staff_compatibility AS SELECT * FROM staff_compatibility WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'staff_compatibility');
-- CREATE TABLE IF NOT EXISTS backup_legacy.shifts AS SELECT * FROM shifts WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'shifts');
-- CREATE TABLE IF NOT EXISTS backup_legacy.ward_schedules AS SELECT * FROM ward_schedules WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'ward_schedules');
-- CREATE TABLE IF NOT EXISTS backup_legacy.ward_assignments AS SELECT * FROM ward_assignments WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'ward_assignments');
-- CREATE TABLE IF NOT EXISTS backup_legacy.preferences AS SELECT * FROM preferences WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'preferences');
-- CREATE TABLE IF NOT EXISTS backup_legacy.requests AS SELECT * FROM requests WHERE EXISTS (SELECT FROM pg_tables WHERE tablename = 'requests');

-- 2. Drop legacy tables (if they exist)
DROP TABLE IF EXISTS "ward_assignments" CASCADE;
DROP TABLE IF EXISTS "assignments" CASCADE;
DROP TABLE IF EXISTS "hospitals" CASCADE;
DROP TABLE IF EXISTS "wards" CASCADE;
DROP TABLE IF EXISTS "staff" CASCADE;
DROP TABLE IF EXISTS "staff_compatibility" CASCADE;
DROP TABLE IF EXISTS "shifts" CASCADE;
DROP TABLE IF EXISTS "ward_schedules" CASCADE;
DROP TABLE IF EXISTS "preferences" CASCADE;
DROP TABLE IF EXISTS "requests" CASCADE;

-- 3. Drop legacy column from tenants table (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'tenants'
        AND column_name = 'billing_info'
    ) THEN
        ALTER TABLE "tenants" DROP COLUMN "billing_info";
    END IF;
END $$;

-- 4. Drop legacy types (if they exist)
DROP TYPE IF EXISTS "public"."staff_role" CASCADE;
DROP TYPE IF EXISTS "public"."shift_type" CASCADE;
DROP TYPE IF EXISTS "public"."schedule_status" CASCADE;
DROP TYPE IF EXISTS "public"."request_priority" CASCADE;
DROP TYPE IF EXISTS "public"."request_status" CASCADE;
DROP TYPE IF EXISTS "public"."request_type" CASCADE;

-- 5. Add comment to track migration
COMMENT ON SCHEMA public IS 'Legacy tables cleanup completed - migrated to multi-tenant structure';