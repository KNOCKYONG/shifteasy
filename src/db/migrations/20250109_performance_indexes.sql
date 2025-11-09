-- Performance Optimization: Add Composite Indexes
-- Generated: 2025-01-09
-- Purpose: Improve query performance for schedule page and other frequently accessed data

-- Schedules table composite indexes
CREATE INDEX IF NOT EXISTS schedules_tenant_dept_date_idx
ON schedules(tenant_id, department_id, start_date, end_date)
WHERE deleted_flag IS NULL OR deleted_flag != 'X';

CREATE INDEX IF NOT EXISTS schedules_tenant_status_date_idx
ON schedules(tenant_id, status, start_date)
WHERE deleted_flag IS NULL OR deleted_flag != 'X';

-- Users table composite indexes for active users
CREATE INDEX IF NOT EXISTS users_tenant_dept_status_idx
ON users(tenant_id, department_id, status)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS users_active_idx
ON users(tenant_id, department_id, team_id)
WHERE status = 'active' AND deleted_at IS NULL;

-- Holidays table composite index
CREATE INDEX IF NOT EXISTS holidays_tenant_date_range_idx
ON holidays(tenant_id, date);

-- Special requests table composite index
CREATE INDEX IF NOT EXISTS special_requests_tenant_date_idx
ON special_requests(tenant_id, date, status);

-- Teams table composite index
CREATE INDEX IF NOT EXISTS teams_tenant_dept_active_idx
ON teams(tenant_id, department_id)
WHERE deleted_at IS NULL;

-- Configs table for faster lookups
CREATE INDEX IF NOT EXISTS configs_tenant_dept_key_idx
ON configs(tenant_id, department_id, config_key);

-- Add index on frequently queried columns
CREATE INDEX IF NOT EXISTS schedules_published_date_idx
ON schedules(published_at DESC)
WHERE status = 'published' AND (deleted_flag IS NULL OR deleted_flag != 'X');

COMMENT ON INDEX schedules_tenant_dept_date_idx IS 'Composite index for schedule queries by tenant, department, and date range';
COMMENT ON INDEX users_active_idx IS 'Partial index for active users only';
COMMENT ON INDEX schedules_published_date_idx IS 'Index for published schedules ordered by publication date';
