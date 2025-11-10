/**
 * Ensures department_patterns has tenant_id populated before running drizzle push.
 * This avoids interactive prompts about truncating tables/data-loss.
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

async function columnExists() {
  const result = (await db.execute(sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'department_patterns'
      AND column_name = 'tenant_id'
    LIMIT 1;
  `)) as Array<Record<string, unknown>>;

  return result.length > 0;
}

async function ensureColumn() {
  if (await columnExists()) {
    console.log('ℹ️  tenant_id column already exists on department_patterns');
    return;
  }

  console.log('➕ Adding nullable tenant_id column to department_patterns...');
  await db.execute(sql`
    ALTER TABLE department_patterns
    ADD COLUMN tenant_id uuid;
  `);
}

async function backfillTenantId() {
  console.log('🧮 Backfilling tenant_id using related departments...');
  await db.execute(sql`
    UPDATE department_patterns AS dp
    SET tenant_id = d.tenant_id
    FROM departments AS d
    WHERE dp.department_id = d.id
      AND (dp.tenant_id IS NULL OR dp.tenant_id <> d.tenant_id);
  `);

  const remaining = (await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM department_patterns
    WHERE tenant_id IS NULL;
  `)) as Array<{ count: number }>;

  const count = Number(remaining[0]?.count ?? 0);
  if (count > 0) {
    throw new Error(
      `tenant_id backfill failed: ${count} rows in department_patterns still missing tenant_id`
    );
  }
}

async function ensureConstraint() {
  const fk = (await db.execute(sql`
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'department_patterns'
      AND constraint_name = 'department_patterns_tenant_id_tenants_id_fk'
    LIMIT 1;
  `)) as Array<Record<string, unknown>>;

  if (fk.length === 0) {
    console.log('🔗 Adding tenant_id foreign key constraint...');
    await db.execute(sql`
      ALTER TABLE department_patterns
      ADD CONSTRAINT department_patterns_tenant_id_tenants_id_fk
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    `);
  } else {
    console.log('ℹ️  tenant_id foreign key already exists');
  }
}

async function ensureIndexes() {
  console.log('📚 Ensuring tenant indexes exist...');
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS department_patterns_tenant_idx
    ON department_patterns (tenant_id);
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS department_patterns_tenant_department_idx
    ON department_patterns (tenant_id, department_id);
  `);
}

async function ensureNotNull() {
  console.log('🧱 Enforcing NOT NULL on tenant_id...');
  await db.execute(sql`
    ALTER TABLE department_patterns
    ALTER COLUMN tenant_id SET NOT NULL;
  `);
}

async function main() {
  try {
    await ensureColumn();
    await backfillTenantId();
    await ensureNotNull();
    await ensureConstraint();
    await ensureIndexes();
    console.log('✅ department_patterns tenant_id preparation complete.\n');
  } catch (error) {
    console.error('❌ Failed to prepare department_patterns tenant_id column');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
