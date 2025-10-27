import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

config({ path: join(process.cwd(), '.env.local') });

async function runMigration() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔗 Connecting to database...\n');

    const sqlFile = join(process.cwd(), 'src/db/migrations/0002_make_holidays_global.sql');
    const migrationSql = readFileSync(sqlFile, 'utf8');

    console.log('📋 Making holidays global...\n');

    await sql.file(sqlFile);

    console.log('✅ Migration completed!\n');

    // Verify
    console.log('🔍 Verifying migration...\n');

    const result = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(tenant_id) as with_tenant,
        COUNT(*) - COUNT(tenant_id) as global
      FROM holidays
    `;

    console.log('Holidays statistics:');
    console.log(`  - Total: ${result[0].total}`);
    console.log(`  - With tenant: ${result[0].with_tenant}`);
    console.log(`  - Global (shared): ${result[0].global}\n`);

    // Show sample
    const samples = await sql`
      SELECT id, name, date, tenant_id
      FROM holidays
      ORDER BY date
      LIMIT 5
    `;

    console.log('Sample holidays:');
    samples.forEach(h => {
      const tenantDisplay = h.tenant_id ? h.tenant_id.substring(0, 8) + '...' : 'GLOBAL';
      console.log(`  - ${h.date}: ${h.name} (tenant: ${tenantDisplay})`);
    });

    console.log('\n✅ All done!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runMigration };
