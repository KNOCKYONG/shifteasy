import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const sql = postgres(process.env.SESSION_URL || process.env.DIRECT_URL, {
  ssl: 'require'
});

async function createTeamsTable() {
  try {
    console.log('Creating teams table...');

    // Create teams table
    await sql`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#3B82F6',
        display_order INTEGER NOT NULL DEFAULT 0,
        is_active TEXT NOT NULL DEFAULT 'true',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `;

    console.log('✓ Teams table created');

    // Create indexes
    console.log('Creating indexes...');

    await sql`CREATE INDEX IF NOT EXISTS teams_tenant_id_idx ON teams(tenant_id)`;
    await sql`CREATE INDEX IF NOT EXISTS teams_department_id_idx ON teams(department_id)`;
    await sql`CREATE INDEX IF NOT EXISTS teams_code_idx ON teams(code)`;

    console.log('✓ Indexes created');
    console.log('\n✅ Teams table setup complete!');

  } catch (error) {
    console.error('❌ Error creating teams table:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

createTeamsTable();
