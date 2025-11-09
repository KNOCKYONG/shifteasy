---
name: database-schema-manager
description: Automatically manage and update database schema documentation when schemas are added or modified (project)
---

# Database Schema Manager Skill

## Core Philosophy
This skill ensures all database schema changes are managed through Drizzle ORM, maintaining type safety and avoiding manual SQL migrations.

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
```

#### ✅ ALWAYS Do This
```typescript
// DO modify the TypeScript schema files in src/db/schema/
// DO use Drizzle's schema builder functions
// DO let Drizzle Kit generate migrations
// DO update the index.ts to export new schemas
```

### Step-by-Step Schema Modification Process

#### Step 1: Locate the Schema File
```bash
# Check which file contains the table
ls src/db/schema/

# Common mappings:
# - users, departments, schedules → tenants.ts
# - holidays → holidays.ts
# - special_requests → special-requests.ts
# - configs → configs.ts
# - teams → teams.ts
```

#### Step 2: Modify the Schema File

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

#### Step 3: Update Schema Index
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

#### Step 4: Generate Migration with Drizzle Kit
```bash
# Generate migration based on schema changes
npx drizzle-kit generate

# This creates a migration file in src/db/migrations/
# Example: 0001_cool_doctor_doom.sql
```

#### Step 5: Review Generated Migration
```bash
# Check the latest migration file
ls -lt src/db/migrations/ | head -5

# Review the SQL
cat src/db/migrations/0001_*.sql
```

**Verify Migration Contents**:
- Correct table/column names
- Proper data types
- Indexes are created
- Foreign keys are set
- No unintended changes

#### Step 6: Apply Migration
```bash
# Push to database (development)
npx drizzle-kit push

# OR for production
npx drizzle-kit migrate
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

A schema change is complete when:
- [ ] Schema TypeScript files updated
- [ ] Migration generated and reviewed
- [ ] Migration applied to database
- [ ] TypeScript compiles without errors
- [ ] Related routers/components updated
- [ ] Tests pass
- [ ] No breaking changes or migrations handled
- [ ] Performance indexes added where needed
- [ ] Documentation updated

## Command Quick Reference

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Push schema directly to DB (dev only)
npx drizzle-kit push

# Run migrations
npx drizzle-kit migrate

# Check schema
npx drizzle-kit check

# Open Drizzle Studio (DB GUI)
npx drizzle-kit studio

# Introspect existing database
npx drizzle-kit introspect
```

## Integration with Other Skills

This skill works with:
- **Vercel Build Validator**: Ensures schema changes don't break builds
- **Code Review**: Reviews schema changes for best practices
- **Testing**: Validates migrations don't break functionality
