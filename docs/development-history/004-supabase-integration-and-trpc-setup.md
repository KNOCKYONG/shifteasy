# 004 - Supabase Integration and TRPC Setup

## Date: 2025-01-18

## Overview
Integrated Supabase as the primary database with TRPC for type-safe API layer. Migrated from mock data to real database operations.

## Changes Made

### 1. Database Setup
- **Supabase Configuration**:
  - Configured Supabase with PostgreSQL pooler connections
  - Fixed connection issues (aws-0 → aws-1 pooler migration)
  - Added JWT API keys for authentication

- **Schema Creation**:
  - Created core tables: tenants, users, departments, shift_types, schedules, shift_assignments, swap_requests, notifications, attendance
  - Implemented multi-tenant architecture with proper foreign key relationships
  - Added indexes for performance optimization

### 2. TRPC Implementation
- **Server Setup**:
  - Configured TRPC context with multi-tenant support
  - Implemented authentication middleware and role-based access control
  - Added rate limiting and audit logging

- **Routers**:
  - Created tenant router with full CRUD operations
  - Department management endpoints
  - User invitation and role management
  - Shift type configuration

### 3. Database Migration
- **Drizzle ORM Integration**:
  - Configured Drizzle with Supabase pooler
  - Created schema definitions with TypeScript types
  - Set up migration system

### 4. Client Updates
- **Team Management Page**:
  - Migrated from mock data to TRPC queries
  - Added real-time data fetching with React Query
  - Implemented optimistic updates for better UX

- **Removed Mock Data**:
  - Deleted all mock data files
  - Replaced with database queries

### 5. Test Data
- Created test tenant with initial data:
  - Test Company organization
  - 4 departments (ER, ICU, OR, Ward)
  - 5 users with different roles
  - 4 shift types (Day, Evening, Night, Off)

## Technical Details

### Environment Variables Added
```env
DEV_TENANT_ID=<tenant-uuid>
DATABASE_URL=postgresql://...@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
SESSION_POOL_URL=postgresql://...@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
SUPABASE_ANON_KEY=<jwt-key>
SUPABASE_SERVICE_ROLE_KEY=<jwt-key>
```

### Database Schema
```sql
- tenants: Multi-tenant organizations
- users: User accounts with roles
- departments: Organizational units
- shift_types: Shift definitions
- schedules: Schedule periods
- shift_assignments: User shift assignments
- swap_requests: Shift swap requests
- notifications: User notifications
- attendance: Attendance records
```

### TRPC Procedures
- `tenant.getStats`: Get tenant statistics
- `tenant.users.list`: List users with filters
- `tenant.users.invite`: Invite new users
- `tenant.departments.list`: List departments
- `tenant.departments.create`: Create department
- `tenant.shiftTypes.list`: List shift types

## Challenges Resolved
1. **Supabase Pooler Connection**: Fixed "Tenant or user not found" error by updating connection strings
2. **SSL Certificate Issues**: Configured SSL settings for secure connections
3. **IPv6 Connection Problems**: Forced IPv4 connections for compatibility

## Next Steps
- [ ] Implement authentication with Clerk
- [ ] Add real-time updates with Supabase Realtime
- [ ] Create schedule management endpoints
- [ ] Implement shift swap functionality
- [ ] Add notification system

## Files Modified
- `/src/app/team/page.tsx`: Migrated to TRPC
- `/src/server/api/routers/tenant.ts`: New tenant router
- `/src/server/trpc-context.ts`: TRPC context setup
- `/src/db/schema/*.ts`: Database schema definitions
- `/drizzle.config.ts`: Drizzle configuration
- `/.env.local`: Database connection strings

## Files Removed
- `/src/lib/mock/*.ts`: All mock data files
- Temporary script files