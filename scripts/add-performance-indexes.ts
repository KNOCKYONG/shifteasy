/**
 * Add performance optimization indexes to improve query speed.
 * Based on Network analysis showing slow queries (>1s):
 * - handoff.list: 4.87s → target <500ms
 * - tenant.users.list: 4.18s → target <800ms
 * - department.patterns: 2.36s → target <500ms
 * - teams.getAll: 2.09s → target <400ms
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

config({ path: '.env.local' });

const connectionString =
  process.env.SESSION_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Database connection string is missing (.env.local)');
  process.exit(1);
}

const client = postgres(connectionString, {
  ssl: 'require',
  prepare: false,
});
const db = drizzle(client);

async function addUsersIndexes() {
  console.log('📊 Adding users table indexes...');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_tenant_status
      ON users(tenant_id, status)
      WHERE status IS NOT NULL;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_tenant_dept_status
      ON users(tenant_id, department_id, status);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_users_email
      ON users(email);
  `);
}

async function addSchedulesIndexes() {
  console.log('📅 Adding schedules table indexes...');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_schedules_tenant_dates
      ON schedules(tenant_id, start_date, end_date);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_schedules_tenant_dept_dates
      ON schedules(tenant_id, department_id, start_date, end_date);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_schedules_status
      ON schedules(tenant_id, status);
  `);
}

async function addPreferencesIndexes() {
  console.log('⚙️  Adding nurse_preferences table indexes...');

  // Critical: nurseId is used in LEFT JOIN with users table
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_nurse_preferences_nurse_id
      ON nurse_preferences(nurse_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_nurse_preferences_tenant
      ON nurse_preferences(tenant_id);
  `);

  // Composite index for common query pattern
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_nurse_preferences_tenant_nurse
      ON nurse_preferences(tenant_id, nurse_id);
  `);

  // JSONB GIN indexes for pattern matching
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_nurse_preferences_patterns
      ON nurse_preferences USING GIN (preferred_patterns);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_nurse_preferences_avoid
      ON nurse_preferences USING GIN (avoid_patterns);
  `);
}

async function addTeamsIndexes() {
  console.log('👥 Adding teams table indexes...');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_teams_tenant
      ON teams(tenant_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_teams_dept
      ON teams(department_id);
  `);

  // Team membership is tracked via users.team_id (no separate team_members table)
  console.log('  ℹ️  Team membership index already exists in users table');
}

async function addHandoffIndexes() {
  console.log('🏥 Adding handoffs table indexes (Critical: 4.87s → target <500ms)...');

  // Note: handoffs table already has indexes defined in schema
  // Just ensure composite indexes for common queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_handoffs_tenant_shift_date
      ON handoffs(tenant_id, shift_date DESC);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_handoffs_dept_shift_date
      ON handoffs(department_id, shift_date DESC);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_handoffs_status_date
      ON handoffs(status, shift_date DESC);
  `);
}

async function addDepartmentPatternsIndexes() {
  console.log('🏢 Adding department_patterns indexes (already handled by prepare script)...');
  // These are already created by prepare-department-patterns.ts
  // Just verify they exist
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_dept_patterns_tenant
      ON department_patterns(tenant_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_dept_patterns_dept
      ON department_patterns(department_id);
  `);
}

async function addConfigsIndexes() {
  console.log('⚙️  Adding configs table indexes...');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_configs_tenant_key
      ON configs(tenant_id, config_key);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_configs_dept
      ON configs(department_id);
  `);
}

async function addSpecialRequestsIndexes() {
  console.log('📝 Adding special_requests table indexes...');

  // Note: special_requests table already has basic indexes in schema
  // Add composite indexes for common query patterns
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_special_requests_tenant_date
      ON special_requests(tenant_id, date);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_special_requests_employee_date
      ON special_requests(employee_id, date);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_special_requests_tenant_status_date
      ON special_requests(tenant_id, status, date);
  `);
}

async function addHolidaysIndexes() {
  console.log('🎉 Adding holidays table indexes...');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_holidays_tenant_dates
      ON holidays(tenant_id, date);
  `);
}

async function addSwapRequestsIndexes() {
  console.log('🔄 Adding swap_requests table indexes...');

  // Note: swap_requests table already has basic indexes in schema
  // Add composite indexes for common query patterns
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_swap_requests_tenant_status_date
      ON swap_requests(tenant_id, status, date DESC);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_swap_requests_requester_status
      ON swap_requests(requester_id, status);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_swap_requests_target_user_status
      ON swap_requests(target_user_id, status)
      WHERE target_user_id IS NOT NULL;
  `);
}

async function analyzeTablesForOptimization() {
  console.log('🔬 Analyzing tables to update query planner statistics...');

  const tables = [
    'users',
    'schedules',
    'nurse_preferences',
    'teams',
    'handoffs',
    'department_patterns',
    'configs',
    'special_requests',
    'holidays',
    'swap_requests',
  ];

  for (const table of tables) {
    await db.execute(sql.raw(`ANALYZE ${table};`));
  }
}

async function main() {
  try {
    console.log('🚀 Starting performance index creation...\n');

    await addUsersIndexes();
    await addSchedulesIndexes();
    await addPreferencesIndexes();
    await addTeamsIndexes();
    await addHandoffIndexes();
    await addDepartmentPatternsIndexes();
    await addConfigsIndexes();
    await addSpecialRequestsIndexes();
    await addHolidaysIndexes();
    await addSwapRequestsIndexes();
    await analyzeTablesForOptimization();

    console.log('\n✅ Performance indexes added successfully!');
    console.log('\n📈 Expected improvements:');
    console.log('  - handoff.list: 4.87s → ~0.3s (94% faster)');
    console.log('  - tenant.users.list: 4.18s → ~0.6s (86% faster)');
    console.log('  - department.patterns: 2.36s → ~0.4s (83% faster)');
    console.log('  - teams.getAll: 2.09s → ~0.3s (86% faster)');
    console.log('  - Overall page load: 15-20s → 3-5s (75% faster)\n');
  } catch (error) {
    console.error('❌ Failed to add performance indexes');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
