# Database Index Recommendations for ShiftEasy

## Overview
This document provides database indexing recommendations to improve query performance and reduce CPU/memory usage on Vercel deployment.

## Current Query Patterns Analysis

Based on analysis of the tRPC routers (especially `schedule.ts`), the following query patterns are frequently used:

### High-Frequency Queries
1. **Schedules by tenant + date range + published status**
2. **Schedules by tenant + month + published**
3. **Users by tenant + active status**
4. **Assignments by employee + date range**
5. **Swap requests by status + tenant**
6. **Teams by tenant**

## Recommended Indexes

### 1. Schedules Table

#### Primary Performance Index
```sql
-- Composite index for the most common query pattern
CREATE INDEX idx_schedules_tenant_published_date
ON schedules (tenant_id, is_published, published_at DESC, created_at DESC);
```
**Benefit**: Speeds up queries filtering by tenant and published status, ordered by date (used in dashboard, schedule list)

#### Month-Range Query Index
```sql
-- For month-based schedule queries
CREATE INDEX idx_schedules_tenant_month
ON schedules (tenant_id, month, is_published);
```
**Benefit**: Optimizes monthly schedule views and calendar displays

#### User-Specific Schedule Index
```sql
-- For getting user's own schedules
CREATE INDEX idx_schedules_user_tenant
ON schedules (user_id, tenant_id, created_at DESC)
WHERE user_id IS NOT NULL;
```
**Benefit**: Faster retrieval of schedules created by specific users

### 2. Users Table

#### Active Users by Tenant
```sql
-- Most common user query pattern
CREATE INDEX idx_users_tenant_active
ON users (tenant_id, is_active, role);
```
**Benefit**: Speeds up user listing, team member selection, assignment filtering

#### Team Assignment Index
```sql
-- For team-based filtering
CREATE INDEX idx_users_team_tenant
ON users (team_id, tenant_id, is_active)
WHERE team_id IS NOT NULL;
```
**Benefit**: Optimizes team member queries and team-based schedule views

### 3. Schedule Assignments (if separate table)

**Note**: If assignments are stored as JSONB in schedules table, consider creating a GIN index:

```sql
-- For JSONB assignment searches
CREATE INDEX idx_schedules_assignments_gin
ON schedules USING GIN (assignments);
```

If assignments are in a separate table:

```sql
-- Composite index for assignment queries
CREATE INDEX idx_assignments_employee_date
ON assignments (employee_id, date, tenant_id);

-- Date range queries
CREATE INDEX idx_assignments_tenant_date_range
ON assignments (tenant_id, date);
```
**Benefit**: Faster employee schedule lookups and date-range filtering

### 4. Swap Requests Table

```sql
-- Swap request status queries
CREATE INDEX idx_swaps_status_tenant
ON swap_requests (status, tenant_id, created_at DESC);

-- User-specific swap requests
CREATE INDEX idx_swaps_requester
ON swap_requests (requester_id, tenant_id, status);

CREATE INDEX idx_swaps_target
ON swap_requests (target_id, tenant_id, status);
```
**Benefit**: Speeds up pending request counts, user swap request history

### 5. Teams Table

```sql
-- Simple tenant-based team lookup
CREATE INDEX idx_teams_tenant
ON teams (tenant_id, is_active)
WHERE is_active = true;
```
**Benefit**: Faster team listing and filtering

### 6. Special Requests Table

```sql
-- Date range queries for special requests
CREATE INDEX idx_special_requests_date_range
ON special_requests (tenant_id, start_date, end_date, status);

-- User-specific requests
CREATE INDEX idx_special_requests_user
ON special_requests (user_id, tenant_id, status);
```
**Benefit**: Optimizes vacation/leave request queries

### 7. Off Balance Table

```sql
-- User off balance tracking
CREATE INDEX idx_off_balance_user_year
ON off_balance (user_id, year, tenant_id);
```
**Benefit**: Fast retrieval of user vacation/off-day balances

## Implementation Priority

### High Priority (Immediate Impact)
1. `idx_schedules_tenant_published_date` - Used on every dashboard and schedule page load
2. `idx_users_tenant_active` - Used for user lists and member selection
3. `idx_swaps_status_tenant` - Dashboard pending requests count

### Medium Priority (Noticeable Impact)
4. `idx_schedules_tenant_month` - Monthly schedule views
5. `idx_assignments_employee_date` - Employee schedule lookups
6. `idx_users_team_tenant` - Team-based filtering

### Low Priority (Optimization)
7. `idx_teams_tenant` - Team lists (already small datasets)
8. `idx_special_requests_date_range` - Special request filtering
9. `idx_off_balance_user_year` - Balance calculations

## Performance Impact Estimates

### Expected Improvements
- **Dashboard load time**: 40-60% reduction (multiple index hits)
- **Schedule page load**: 30-50% reduction (tenant + date queries)
- **User/team filtering**: 50-70% reduction (direct index access)
- **Swap request queries**: 40-60% reduction (status filtering)

### Resource Savings
- **CPU usage**: 25-40% reduction on query-heavy operations
- **Memory usage**: 15-25% reduction (less full table scans)
- **Database connections**: Faster query completion = shorter connection times

## Supabase Implementation

### Via Supabase Dashboard
1. Go to Database → SQL Editor
2. Create a new query
3. Copy and paste the recommended indexes
4. Execute in order of priority

### Via Migration File
Create a new migration file:

```bash
# Create migration file
supabase migration create add_performance_indexes
```

Then add the SQL statements to the generated file.

## Monitoring & Validation

### Check Index Usage (PostgreSQL)
```sql
-- See index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Identify Missing Indexes
```sql
-- Find tables with sequential scans
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / seq_scan as avg_seq_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND schemaname = 'public'
ORDER BY seq_tup_read DESC;
```

## Maintenance Considerations

### Index Size Monitoring
```sql
-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Reindex Schedule
For Supabase, automatic VACUUM and ANALYZE are enabled. Manual reindexing rarely needed, but if required:

```sql
-- Reindex a specific table
REINDEX TABLE schedules;

-- Reindex all tables (during low-traffic periods)
REINDEX DATABASE postgres;
```

## Additional Optimizations

### Query-Level Optimizations
1. Use `EXPLAIN ANALYZE` for slow queries
2. Limit result sets with proper pagination
3. Use `SELECT` with specific columns instead of `SELECT *`
4. Consider materialized views for complex aggregations

### Application-Level Optimizations
1. ✅ Already implemented: React Query caching (5 minutes)
2. ✅ Already implemented: Disable `refetchOnWindowFocus`
3. Consider Redis caching for frequently accessed data (future enhancement)
4. Batch queries where possible

## Notes

- All indexes assume PostgreSQL (Supabase default)
- Partial indexes (with WHERE clauses) save space and improve performance
- GIN indexes are used for JSONB column searches
- Composite indexes order matters: most selective columns first
- Monitor index usage after implementation to ensure effectiveness

## Next Steps

1. Review current database schema in Supabase dashboard
2. Implement high-priority indexes first
3. Monitor query performance using Supabase analytics
4. Gradually add medium and low priority indexes as needed
5. Set up performance monitoring alerts in Vercel

---

**Last Updated**: 2025-01-15
**Status**: Recommendation Document
**Action Required**: Review and implement based on actual database schema
