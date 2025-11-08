---
name: database-schema-manager
description: Automatically manage and update database schema documentation when schemas are added or modified
---

# Database Schema Manager Skill

**Purpose**: Automatically detect schema changes and update comprehensive database documentation to maintain accuracy and completeness.

## Core Workflow Philosophy

This skill follows a **detect → analyze → update → validate** approach:
1. **Detect** schema file changes in `src/db/schema/*.ts`
2. **Analyze** current database state and schema definitions
3. **Update** documentation files with changes
4. **Validate** documentation completeness and accuracy

## When This Skill Activates

**Automatic Triggers**:
- Schema files modified in `src/db/schema/`
- New `.ts` files added to schema directory
- Migration files generated
- User explicitly runs `/skill database-schema-manager`

**Manual Invocation**:
```bash
/skill database-schema-manager
```

## 7-Phase Workflow

### Phase 1: 🔍 Schema Change Detection
**Goal**: Identify what changed in the database schema

**Actions**:
1. Scan `src/db/schema/*.ts` for modifications
2. Identify new tables, modified tables, or deleted tables
3. Parse schema definitions to extract:
   - Table names and structures
   - Column definitions and types
   - Foreign key relationships
   - Indexes and constraints
   - JSONB structures

**Output Example**:
```
📋 Schema Changes Detected:
  ✅ Modified: src/db/schema/tenants.ts
     - users table: Added new column 'last_login_at'
     - notifications table: Modified 'metadata' JSONB structure
  ✅ New: src/db/schema/billing.ts
     - subscriptions table (new)
     - invoices table (new)
```

**Tools Used**: `Glob`, `Read`, `Grep`

---

### Phase 2: 📊 Database State Analysis
**Goal**: Get current database statistics and validate schema consistency

**Actions**:
1. Run `npx tsx src/db/seed/check-all-tables.ts`
2. Collect table row counts and statistics
3. Validate schema definitions match database state
4. Identify any inconsistencies

**Output Example**:
```
📊 Database State:
  Total Tables: 13 (+1 new)
  Total Rows: 724 (+116)

  New Tables:
  - subscriptions: 5 rows
  - invoices: 12 rows

  Modified Tables:
  - users: 75 rows (schema updated)
  - notifications: 203 rows (+12)
```

**Tools Used**: `Bash`, `Read`

---

### Phase 3: 📝 Documentation Update Planning
**Goal**: Plan what sections of documentation need updates

**Actions**:
1. Map schema changes to documentation sections:
   - Table definitions
   - JSONB structure examples
   - ER diagram relationships
   - Index strategies
2. Prepare update content
3. Generate change log entry

**Output Example**:
```
📝 Documentation Update Plan:

  SCHEMA.md Updates:
  ✅ Add subscriptions table definition
  ✅ Add invoices table definition
  ✅ Update users table (new column)
  ✅ Update ER diagram (new relationships)
  ✅ Add change log entry

  Content Prepared:
  - SQL CREATE statements: 2 new, 1 modified
  - JSONB examples: 1 new
  - Mermaid diagram: 3 new relationships
```

**Tools Used**: `Read`, `TodoWrite`

---

### Phase 4: ✏️ Execute Documentation Updates
**Goal**: Apply all planned updates to documentation files

**Actions**:
1. Update `docs/database/SCHEMA.md`:
   - Add/modify table definitions
   - Update JSONB structure examples
   - Modify ER diagram
   - Update statistics
   - Add change log entry
2. Update table of contents if needed
3. Ensure all cross-references are correct

**Output Example**:
```
✏️ Executing Updates:

  SCHEMA.md:
  ✅ Added subscriptions table (lines 245-278)
  ✅ Added invoices table (lines 280-315)
  ✅ Updated users table definition (line 87)
  ✅ Updated ER diagram (lines 520-545)
  ✅ Updated statistics (lines 15-18)
  ✅ Added change log entry (lines 650-658)

  Total Changes: 6 sections updated
```

**Tools Used**: `Edit`, `Write`

---

### Phase 5: 🔬 Validation & Quality Check
**Goal**: Ensure documentation accuracy and completeness

**Validation Checks**:
1. **Schema Consistency**: All tables in schema files are documented
2. **SQL Syntax**: CREATE TABLE statements are valid
3. **JSONB Examples**: Match TypeScript interfaces
4. **ER Diagram**: All relationships represented
5. **Cross-References**: No broken links
6. **Formatting**: Consistent markdown formatting

**Output Example**:
```
🔬 Validation Results:

  ✅ Schema Coverage: 13/13 tables documented (100%)
  ✅ SQL Syntax: All CREATE statements valid
  ✅ JSONB Examples: 8/8 structures match interfaces
  ✅ ER Diagram: 18 relationships, all valid
  ✅ Cross-References: No broken links
  ✅ Markdown Formatting: Consistent

  Quality Score: 100%
```

**Tools Used**: `Read`, `Grep`, `Bash`

---

### Phase 6: 📋 Generate Change Report
**Goal**: Create comprehensive report of documentation changes

**Report Sections**:
1. **Summary**: High-level overview of changes
2. **Schema Changes**: Detailed list of modifications
3. **Documentation Updates**: What was updated in docs
4. **Validation Results**: Quality checks passed
5. **Next Steps**: Recommendations (if any)

**Output Example**:
```
📋 Schema Documentation Update Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Summary
- Tables Added: 2 (subscriptions, invoices)
- Tables Modified: 1 (users)
- Documentation Sections Updated: 6
- Validation: ✅ All checks passed

## Schema Changes
1. New Table: subscriptions
   - Purpose: Manage tenant subscription plans
   - Columns: 8 (id, tenant_id, plan_id, status, ...)
   - Relationships: tenants (FK)

2. New Table: invoices
   - Purpose: Track billing invoices
   - Columns: 10 (id, subscription_id, amount, ...)
   - Relationships: subscriptions (FK)

3. Modified: users table
   - Added: last_login_at (timestamptz)
   - Purpose: Track user activity

## Documentation Updates
✅ SCHEMA.md: 6 sections updated
✅ ER Diagram: 3 new relationships added
✅ Change Log: Entry dated 2025-01-08

## Validation
All quality checks passed (100%)

## Recommendations
- Consider adding index on users.last_login_at
- Document subscription workflow in separate guide
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Tools Used**: `Write`, `TodoWrite`

---

### Phase 7: ✅ Finalization & Cleanup
**Goal**: Complete the workflow and prepare for next run

**Actions**:
1. Mark all tasks as complete
2. Update skill execution log
3. Clean up temporary files
4. Prepare for next schema change detection

**Output Example**:
```
✅ Documentation Update Complete!

  Files Updated:
  - docs/database/SCHEMA.md

  Tasks Completed: 6/6
  Time Elapsed: 2.3s
  Quality Score: 100%

  📚 Documentation is now up to date with all schema changes.

  Next Run: Monitoring src/db/schema/ for changes...
```

**Tools Used**: `TodoWrite`, `Bash`

---

## Configuration

### Monitored Paths
```yaml
schema_paths:
  - src/db/schema/*.ts

migration_paths:
  - drizzle/migrations/*.sql

documentation_paths:
  - docs/database/SCHEMA.md
  - docs/database/README.md
```

### Validation Rules
```yaml
coverage_threshold: 100%  # All tables must be documented
sql_validation: true      # Validate SQL syntax
jsonb_validation: true    # Match TypeScript interfaces
er_diagram: true          # Check relationship completeness
```

### Auto-Update Settings
```yaml
auto_detect: true         # Automatically detect schema changes
auto_update: false        # Require approval before updating
backup_docs: true         # Create backup before updates
```

## Error Handling

### Common Issues & Solutions

**Issue**: Schema file modified but database not migrated
```
⚠️ Warning: Schema mismatch detected
   - users.last_login_at exists in schema file
   - Column not present in database

Solution: Run migrations first
  $ npm run db:generate
  $ npm run db:migrate
```

**Issue**: Documentation update conflict
```
❌ Error: SCHEMA.md has uncommitted changes

Solution: Commit or stash changes first
  $ git add docs/database/SCHEMA.md
  $ git commit -m "docs: Update schema documentation"
```

**Issue**: Invalid SQL syntax in documentation
```
❌ Validation Failed: SQL syntax error at line 245

Solution: Auto-fix applied
  - Fixed column definition syntax
  - Validated against PostgreSQL 14
```

## Best Practices

### Before Running
1. ✅ Commit any pending schema changes
2. ✅ Run and verify migrations
3. ✅ Ensure database is accessible
4. ✅ Backup existing documentation

### During Execution
1. 📋 Review change detection results
2. 🔍 Verify SQL syntax in updates
3. 📊 Check ER diagram accuracy
4. ✅ Validate JSONB examples

### After Completion
1. 📖 Review updated documentation
2. 🔍 Verify all cross-references
3. 🧪 Test documentation examples
4. 📝 Commit documentation changes

## Integration with Development Workflow

### Git Hooks Integration
```bash
# Pre-commit hook to check schema documentation
.git/hooks/pre-commit:
  - Check for schema file changes
  - Verify documentation is updated
  - Run validation checks
```

### CI/CD Pipeline
```yaml
# GitHub Actions workflow
on:
  pull_request:
    paths:
      - 'src/db/schema/**'

jobs:
  validate-docs:
    - name: Check Schema Documentation
      run: /skill database-schema-manager --validate
```

## Performance Metrics

**Target Performance**:
- Detection: < 1s
- Analysis: < 2s
- Updates: < 3s
- Validation: < 2s
- **Total**: < 8s for typical schema change

## Examples

### Example 1: Adding New Table
```typescript
// src/db/schema/billing.ts (new file)
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').references(() => tenants.id),
  plan_id: varchar('plan_id', { length: 50 }),
  status: varchar('status', { length: 20 }),
  // ...
});
```

**Skill Output**:
```
🔍 Detected: New schema file billing.ts
📊 Found: 1 new table (subscriptions)
📝 Preparing documentation update...
✏️ Adding table definition to SCHEMA.md
✏️ Adding to ER diagram
✏️ Adding change log entry
🔬 Validating... ✅ All checks passed
✅ Documentation updated successfully!
```

### Example 2: Modifying Existing Table
```typescript
// src/db/schema/tenants.ts (modified)
export const users = pgTable('users', {
  // ... existing columns
  last_login_at: timestamp('last_login_at', { withTimezone: true }),
});
```

**Skill Output**:
```
🔍 Detected: Modified tenants.ts
📊 Found: users table updated (1 new column)
📝 Updating users table definition...
✏️ Updated SCHEMA.md line 87
✏️ Added change log entry
🔬 Validating... ✅ All checks passed
✅ Documentation updated successfully!
```

---

## Skill Metadata

**Version**: 1.0.0
**Last Updated**: 2025-01-08
**Maintained By**: ShiftEasy Development Team
**Dependencies**:
- Drizzle ORM
- PostgreSQL 14+
- Node.js 18+

**Related Skills**:
- `vercel` - Build and deployment management
- `git` - Version control workflows

**Related Documentation**:
- `docs/database/SCHEMA.md` - Complete schema reference
- `docs/database/README.md` - Workflow guide
- `src/db/schema/` - Schema definitions
