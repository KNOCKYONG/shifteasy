---
name: database-schema-manager
description: Automatically manage and update database schema documentation when schemas are added or modified (project)
---

# Database Schema Manager Skill

## 🚨 CRITICAL: Schema-First Philosophy

**EVERY database change MUST follow this exact workflow:**
1. **FIRST**: Modify TypeScript schema files in `src/db/schema/`
2. **SECOND**: Generate migration with `drizzle-kit generate`
3. **THIRD**: Review generated SQL
4. **FOURTH**: Apply to database with `drizzle-kit push/migrate`

**❌ NEVER:**
- Create SQL migration files manually
- Skip updating schema files
- Modify database without updating schema files

**✅ ALWAYS:**
- Update schema files FIRST
- Keep schema files and database synchronized
- Generate migrations from schema changes

## Core Philosophy
This skill ensures all database schema changes are managed through Drizzle ORM, maintaining type safety and avoiding manual SQL migrations. Schema files in `src/db/schema/` are the ONLY source of truth.

## Project Database Architecture

### Technology Stack
- **ORM**: Drizzle ORM (TypeScript-first)
- **Database**: PostgreSQL (Supabase)
- **Schema Location**: `src/db/schema/`
- **Migration Tool**: Drizzle Kit
- **Type Safety**: Full TypeScript inference

### Schema Directory Structure
```
src/db/schema/
├── index.ts              # Re-exports all schemas
├── tenants.ts            # Core multi-tenant tables (tenants, departments, users, schedules)
├── system.ts             # System tables (audit logs)
├── nurse-preferences.ts  # Nurse-specific preferences
├── team-patterns.ts      # Team patterns
├── holidays.ts           # Holiday management
├── special-requests.ts   # Special shift requests
├── configs.ts            # Configuration storage
└── teams.ts              # Team management
```

## Phase 1: Understanding Schema Change Requests

### Request Analysis Checklist
- [ ] What table(s) need modification?
- [ ] What type of change? (add column, modify column, add index, new table)
- [ ] Which schema file contains the table?
- [ ] Does this affect relationships with other tables?
- [ ] Are there breaking changes that need migration logic?
- [ ] Does this require updating types in related routers/components?

### Common Change Types
1. **Add Column**: New field to existing table
2. **Modify Column**: Change type, constraints, or default values
3. **Add Index**: Performance optimization
4. **Add Table**: New entity/feature
5. **Add Relationship**: Foreign keys and relations
6. **Remove Column**: Deprecation (prefer soft delete/nullable first)

## Phase 2: Schema Modification with Drizzle

### Critical Rules - READ CAREFULLY

#### ❌ NEVER Do This
```typescript
// DON'T create raw SQL files in migrations/
// DON'T bypass Drizzle schema definitions
// DON'T manually write SQL for schema changes
// DON'T modify only migration files without updating schema files
```

#### ✅ ALWAYS Do This - MANDATORY WORKFLOW
```typescript
// 1. FIRST: Modify TypeScript schema files in src/db/schema/
// 2. SECOND: Generate migration with drizzle-kit
// 3. THIRD: Verify generated SQL matches your intent
// 4. FOURTH: Apply migration to database
// 5. ALWAYS: Keep schema files and database in sync
```

#### 🚨 CRITICAL: Schema-Database Synchronization Rule
**EVERY schema change MUST follow this exact sequence:**

1. **Modify Schema File First** (`src/db/schema/*.ts`)
   - This is the source of truth
   - TypeScript types are generated from these files
   - Drizzle Kit uses these to generate migrations

2. **Generate Migration** (`npx drizzle-kit generate`)
   - Creates SQL migration from schema changes
   - Never skip this step
   - Review the generated SQL

3. **Apply to Database** (`npx drizzle-kit push` or `migrate`)
   - Updates actual database tables
   - Database structure must match schema files

**⚠️ WARNING**: If schema files and database don't match:
- TypeScript types will be incorrect
- Runtime errors will occur
- Queries will fail unexpectedly
- Data integrity issues may arise

### Step-by-Step Schema Modification Process

#### Step 0: VERIFY Current Schema State (DO THIS FIRST)
```bash
# 1. Check which schema file contains the table you want to modify
ls src/db/schema/

# 2. Read the current schema definition
cat src/db/schema/[table-file].ts

# 3. Verify database state matches schema (optional but recommended)
npx drizzle-kit introspect

# Common file mappings:
# - users, departments, schedules → tenants.ts
# - holidays → holidays.ts
# - special_requests → special-requests.ts
# - configs → configs.ts
# - teams → teams.ts
```

#### Step 1: Modify the Schema File (MANDATORY FIRST STEP)
**⚠️ NEVER skip this step - Schema files in `src/db/schema/` are the ONLY source of truth**

**Example: Adding a Column**
```typescript
// src/db/schema/tenants.ts
import { pgTable, uuid, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),

  // ✅ Add new column
  phoneNumber: text('phone_number'), // nullable by default
  // OR
  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Example: Adding an Index**
```typescript
export const users = pgTable('users', {
  // ... columns
}, (table) => ({
  // Existing indexes
  tenantIdx: index('users_tenant_id_idx').on(table.tenantId),

  // ✅ Add new index
  phoneIdx: index('users_phone_number_idx').on(table.phoneNumber),

  // ✅ Add composite index
  tenantEmailIdx: index('users_tenant_email_idx').on(table.tenantId, table.email),
}));
```

**Example: Adding a New Table**
```typescript
// src/db/schema/notifications.ts
import { pgTable, uuid, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, tenants } from './tenants';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),

  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'info', 'warning', 'error', 'success'
  isRead: boolean('is_read').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('notifications_tenant_id_idx').on(table.tenantId),
  userIdx: index('notifications_user_id_idx').on(table.userId),
  isReadIdx: index('notifications_is_read_idx').on(table.isRead),
}));

// Add relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
}));
```

**Example: Adding a Relationship**
```typescript
// In the parent table file
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),

  // ✅ Add new relationship
  notifications: many(notifications),
}));
```

#### Step 2: Update Schema Index (If Adding New Table)
```typescript
// src/db/schema/index.ts

// Core multi-tenant schema
export * from './tenants';
export * from './system';

// Domain schemas
export * from './nurse-preferences';
export * from './team-patterns';
export * from './holidays';
export * from './special-requests';
export * from './configs';
export * from './teams';

// ✅ Add new schema export
export * from './notifications';
```

#### Step 3: Generate Migration with Drizzle Kit (MANDATORY)
**🚨 CRITICAL: This step generates SQL from your schema changes**
```bash
# Generate migration based on schema changes
npx drizzle-kit generate
# OR use npm script
npm run db:generate

# This creates a migration file in src/db/migrations/
# Example: 0001_cool_doctor_doom.sql
```

#### Step 4: Review Generated Migration (MANDATORY)
**⚠️ ALWAYS review the SQL before applying to database**

```bash
# Check the latest migration file
ls -lt src/db/migrations/ | head -5

# Review the SQL
cat src/db/migrations/0001_*.sql
```

**Verify Migration Contents**:
- ✅ Correct table/column names match schema file
- ✅ Proper data types match TypeScript definitions
- ✅ Indexes are created as defined
- ✅ Foreign keys are set correctly
- ✅ No unintended changes included
- ⚠️ Check for DROP statements (data loss risk)
- ⚠️ Verify ALTER statements won't break existing data

#### Step 5: Apply Migration to Database (FINAL STEP)

⚠️ **IMPORTANT: Choose the Right Method**

**Method 1: `drizzle-kit push` (Development Only)**
```bash
npm run db:push
# OR
npx drizzle-kit push
```

**When to use:**
- ✅ Local development
- ✅ Quick prototyping
- ✅ Database is empty or test data only

**⚠️ WARNING:**
- ❌ Skips migration history
- ❌ Can cause data loss
- ❌ Not reversible
- ❌ **NEVER use in production**

**Method 2: `drizzle-kit migrate` (Recommended)**
```bash
npm run db:migrate
# OR
npx drizzle-kit migrate
```

**When to use:**
- ✅ Production deployments
- ✅ When you need migration history
- ✅ When data preservation is critical
- ✅ Team collaboration

**Benefits:**
- ✅ Creates migration history
- ✅ Safer for production
- ✅ Can be rolled back (manually)
- ✅ Trackable changes

**Our Project Recommendation:**
```bash
# Development workflow:
1. npm run db:generate    # Generate migration
2. Review the SQL file    # Check changes
3. npm run db:migrate     # Apply migration (preferred)
# OR
3. npm run db:push        # Quick push (dev only)
```

## Phase 3: Type Safety Validation

### Check TypeScript Compilation
```bash
# Ensure no type errors
npx tsc --noEmit

# Check Drizzle types
npx drizzle-kit check
```

### Update Related Code
When schema changes, update:
1. **tRPC Routers**: Update input/output types
2. **Components**: Update type imports
3. **Utilities**: Update helper functions
4. **Tests**: Update test fixtures

## Phase 4: Documentation & Testing

### Update Schema Documentation
```typescript
// Add JSDoc comments to schema
export const users = pgTable('users', {
  /**
   * User's phone number for notifications and 2FA
   * @example '+82-10-1234-5678'
   */
  phoneNumber: text('phone_number'),
});
```

### Test Checklist
- [ ] Migration applies without errors
- [ ] TypeScript compiles successfully
- [ ] Related queries still work
- [ ] Foreign keys enforce correctly
- [ ] Indexes improve query performance
- [ ] No data loss or corruption

## Common Scenarios

### Scenario 1: Add New Column to Existing Table

**Request**: "Add phone number field to users table"

**Steps**:
1. Open `src/db/schema/tenants.ts`
2. Add column to `users` table:
   ```typescript
   phoneNumber: text('phone_number'),
   ```
3. Run `npx drizzle-kit generate`
4. Review migration, then `npx drizzle-kit push`

### Scenario 2: Add Index for Performance

**Request**: "Add index on schedules for faster date range queries"

**Steps**:
1. Open `src/db/schema/tenants.ts`
2. Add index to `schedules` table:
   ```typescript
   dateRangeIdx: index('schedules_date_range_idx').on(table.startDate, table.endDate),
   ```
3. Run `npx drizzle-kit generate`
4. Review and apply migration

### Scenario 3: Create New Table

**Request**: "Create notifications table"

**Steps**:
1. Create `src/db/schema/notifications.ts`
2. Define table schema with proper types
3. Add relations to related tables
4. Export from `src/db/schema/index.ts`
5. Run `npx drizzle-kit generate`
6. Review and apply migration

### Scenario 4: Modify Existing Column

**Request**: "Make email unique in users table"

**Steps**:
1. Open `src/db/schema/tenants.ts`
2. Modify column:
   ```typescript
   // Before
   email: text('email').notNull(),

   // After
   email: text('email').notNull().unique(),
   ```
3. Run `npx drizzle-kit generate`
4. **IMPORTANT**: Check for duplicate emails first!
5. Apply migration

## Drizzle Column Types Reference

### Common Types
```typescript
import {
  text,           // VARCHAR/TEXT
  integer,        // INTEGER
  boolean,        // BOOLEAN
  timestamp,      // TIMESTAMP
  date,          // DATE
  uuid,          // UUID
  jsonb,         // JSONB
  serial,        // SERIAL (auto-increment)
  varchar,       // VARCHAR(n)
  numeric,       // NUMERIC/DECIMAL
} from 'drizzle-orm/pg-core';

// Examples
text('name').notNull()
integer('age').default(0)
boolean('is_active').notNull().default(true)
timestamp('created_at').defaultNow().notNull()
uuid('id').primaryKey().defaultRandom()
jsonb('metadata').$type<{ key: string }>()
```

### Column Constraints
```typescript
.notNull()              // NOT NULL
.default(value)         // DEFAULT value
.defaultRandom()        // DEFAULT gen_random_uuid() for UUID
.defaultNow()          // DEFAULT now() for timestamps
.unique()              // UNIQUE constraint
.primaryKey()          // PRIMARY KEY
.references(() => table.column, { onDelete: 'cascade' })  // Foreign key
```

## Best Practices

### 1. Multi-Tenant Isolation
```typescript
// ✅ Always include tenantId for multi-tenant data
export const myTable = pgTable('my_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  // ... other columns
}, (table) => ({
  tenantIdx: index('my_table_tenant_id_idx').on(table.tenantId),  // Always index tenantId
}));
```

### 2. Soft Deletes
```typescript
// ✅ Prefer soft deletes over hard deletes
export const users = pgTable('users', {
  // ... columns
  deletedAt: timestamp('deleted_at'),  // NULL = not deleted
});
```

### 3. Timestamps
```typescript
// ✅ Always include audit timestamps
export const myTable = pgTable('my_table', {
  // ... columns
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

### 4. Indexes for Performance
```typescript
// ✅ Index foreign keys
// ✅ Index frequently queried columns
// ✅ Use composite indexes for multi-column queries
export const schedules = pgTable('schedules', {
  // ... columns
}, (table) => ({
  tenantIdx: index('schedules_tenant_id_idx').on(table.tenantId),
  departmentIdx: index('schedules_department_id_idx').on(table.departmentId),
  dateRangeIdx: index('schedules_date_range_idx').on(table.startDate, table.endDate),
  tenantDeptDateIdx: index('schedules_tenant_dept_date_idx').on(table.tenantId, table.departmentId, table.startDate),
}));
```

## Troubleshooting

### Migration Conflicts
```bash
# If migrations are out of sync
npx drizzle-kit drop      # Careful! Drops all tables
npx drizzle-kit generate  # Regenerate from schema
npx drizzle-kit push      # Apply to database
```

### Type Errors After Schema Change
```bash
# Clear TypeScript cache
rm -rf .next
rm -rf node_modules/.cache

# Rebuild
npm run build
```

### Database Connection Issues
```bash
# Check environment variables
cat .env.local | grep DATABASE_URL

# Test connection
npx drizzle-kit introspect
```

## Emergency Procedures

### Rollback Migration
```bash
# Manual rollback (no built-in rollback in Drizzle)
# 1. Restore database from backup
# 2. Revert schema changes in code
# 3. Delete bad migration file
# 4. Regenerate migrations
```

### Data Migration Required
```typescript
// For complex data transformations, use a separate script
// src/db/migrations/scripts/migrate-phone-numbers.ts
import { db } from '@/db';
import { users } from '@/db/schema';

async function migratePhoneNumbers() {
  // Custom migration logic
  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    // Transform data
    await db.update(users)
      .set({ phoneNumber: formatPhone(user.oldPhone) })
      .where(eq(users.id, user.id));
  }
}
```

## Success Criteria

**🚨 CRITICAL: A schema change is ONLY complete when ALL of the following are done:**

### 1. Schema File Changes (Source of Truth)
- [ ] **MANDATORY**: Schema TypeScript files in `src/db/schema/` updated
- [ ] New tables exported in `src/db/schema/index.ts`
- [ ] Column types match intended database types
- [ ] Indexes and foreign keys defined
- [ ] Relations added if needed

### 2. Migration Management
- [ ] **MANDATORY**: Migration generated with `drizzle-kit generate`
- [ ] **MANDATORY**: Generated SQL reviewed and verified
- [ ] **MANDATORY**: Migration applied to database (`push` or `migrate`)
- [ ] Migration file saved in `src/db/migrations/`

### 3. Code Synchronization
- [ ] TypeScript compiles without errors
- [ ] Related tRPC routers updated to use new schema
- [ ] Related React components updated if needed
- [ ] No type mismatches between schema and usage

### 4. Quality Assurance
- [ ] Tests pass (if applicable)
- [ ] No breaking changes or migration strategy documented
- [ ] Performance indexes added where needed
- [ ] Database and schema files are in sync

### 5. Verification Steps
```bash
# Verify TypeScript compilation
npx tsc --noEmit

# Verify database matches schema
npx drizzle-kit introspect

# Test queries work
npm run dev
```

**⚠️ WARNING: If you skip Step 1 (schema file update), your changes will cause:**
- TypeScript type errors in routers and components
- Runtime query failures
- Database-code mismatch issues
- Difficult debugging sessions

**✅ ALWAYS follow this order:**
1. Update schema files (`src/db/schema/*.ts`)
2. Generate migration (`drizzle-kit generate`)
3. Review SQL
4. Apply to database (`drizzle-kit push/migrate`)
5. Verify everything works

## Command Quick Reference

**🚨 MANDATORY WORKFLOW - Always in this order:**

```bash
# Step 1: Edit schema files in src/db/schema/
# (Use your editor, NOT commands)

# Step 2: Generate migration from schema changes
npx drizzle-kit generate
# OR
npm run db:generate

# Step 3: Review the generated SQL migration file
cat src/db/migrations/[latest-file].sql

# Step 4: Apply to database
npx drizzle-kit push      # Dev only - fast but no history
# OR
npx drizzle-kit migrate   # Recommended - creates history
# OR
npm run db:push          # Dev shortcut
npm run db:migrate       # Recommended shortcut
```

**Other useful commands:**
```bash
# Check schema for issues
npx drizzle-kit check

# Open Drizzle Studio (DB GUI)
npx drizzle-kit studio

# Introspect existing database (verify sync)
npx drizzle-kit introspect
```

**⚠️ CRITICAL REMINDERS:**
- NEVER run `drizzle-kit generate` without first updating schema files
- NEVER manually edit migration SQL files (regenerate instead)
- ALWAYS review generated SQL before applying
- ALWAYS verify TypeScript compiles after schema changes

## Integration with Other Skills

This skill works with:
- **Vercel Build Validator**: Ensures schema changes don't break builds
- **Code Review**: Reviews schema changes for best practices
- **Testing**: Validates migrations don't break functionality
