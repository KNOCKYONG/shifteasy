-- ============================================
-- ShiftEasy Performance Optimization
-- Database Indexes for Query Speed Improvement
-- ============================================

-- 1. Users table indexes
-- tenant.users.list query optimization
CREATE INDEX IF NOT EXISTS idx_users_tenant_status
  ON users(tenant_id, status)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_tenant_dept_status
  ON users(tenant_id, department_id, status);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

-- 2. Schedules table indexes
-- schedule.list query optimization
CREATE INDEX IF NOT EXISTS idx_schedules_tenant_dates
  ON schedules(tenant_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_schedules_tenant_dept_dates
  ON schedules(tenant_id, department_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_schedules_status
  ON schedules(tenant_id, status);

-- 3. Nurse preferences indexes
-- preferences.listAll query optimization
CREATE INDEX IF NOT EXISTS idx_nurse_preferences_tenant
  ON nurse_preferences(tenant_id);

CREATE INDEX IF NOT EXISTS idx_nurse_preferences_nurse
  ON nurse_preferences(nurse_id);

-- JSONB field indexes for pattern matching
CREATE INDEX IF NOT EXISTS idx_nurse_preferences_patterns
  ON nurse_preferences USING GIN (preferred_patterns);

CREATE INDEX IF NOT EXISTS idx_nurse_preferences_avoid
  ON nurse_preferences USING GIN (avoid_patterns);

-- 4. Teams table indexes
-- teams.getAll query optimization
CREATE INDEX IF NOT EXISTS idx_teams_tenant
  ON teams(tenant_id);

CREATE INDEX IF NOT EXISTS idx_teams_dept
  ON teams(department_id);

-- 5. Team members indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team
  ON team_members(team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_user
  ON team_members(user_id);

-- 6. Handoff indexes (4.87s → target <500ms)
-- handoff.list query optimization
CREATE INDEX IF NOT EXISTS idx_handoffs_tenant_date
  ON handoffs(tenant_id, handoff_date DESC);

CREATE INDEX IF NOT EXISTS idx_handoffs_dept_date
  ON handoffs(department_id, handoff_date DESC);

CREATE INDEX IF NOT EXISTS idx_handoffs_submitter
  ON handoffs(submitter_id);

-- 7. Department patterns indexes
-- department.patterns query optimization
CREATE INDEX IF NOT EXISTS idx_dept_patterns_tenant
  ON department_patterns(tenant_id);

CREATE INDEX IF NOT EXISTS idx_dept_patterns_dept
  ON department_patterns(department_id);

-- 8. Configs indexes
-- configs.getAll query optimization
CREATE INDEX IF NOT EXISTS idx_configs_tenant_key
  ON configs(tenant_id, config_key);

CREATE INDEX IF NOT EXISTS idx_configs_dept
  ON configs(department_id);

-- 9. Special requests indexes
CREATE INDEX IF NOT EXISTS idx_special_requests_tenant_dates
  ON special_requests(tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_special_requests_nurse_dates
  ON special_requests(nurse_id, date);

CREATE INDEX IF NOT EXISTS idx_special_requests_status
  ON special_requests(tenant_id, status);

-- 10. Holidays indexes
CREATE INDEX IF NOT EXISTS idx_holidays_tenant_dates
  ON holidays(tenant_id, date);

-- 11. Swap requests indexes
CREATE INDEX IF NOT EXISTS idx_swap_requests_tenant_status
  ON swap_requests(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_swap_requests_requester
  ON swap_requests(requester_id);

CREATE INDEX IF NOT EXISTS idx_swap_requests_target
  ON swap_requests(target_id);

-- ============================================
-- Analyze tables to update statistics
-- ============================================
ANALYZE users;
ANALYZE schedules;
ANALYZE nurse_preferences;
ANALYZE teams;
ANALYZE team_members;
ANALYZE handoffs;
ANALYZE department_patterns;
ANALYZE configs;
ANALYZE special_requests;
ANALYZE holidays;
ANALYZE swap_requests;

-- ============================================
-- Verification Queries
-- Run these to check if indexes are created
-- ============================================

-- Check all indexes on users table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';

-- Check query performance improvement
-- EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 'your-tenant-id' AND status = 'active';
