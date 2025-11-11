import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

async function runMigration() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔗 Connecting to database...\n');

    const sqlFile = join(process.cwd(), 'src/db/migrations/0003_add_shift_types_department_id.sql');

    console.log('📋 Adding department_id to shift_types...\n');

    await sql.file(sqlFile);

    console.log('✅ Migration completed!\n');

    // Verify
    console.log('🔍 Verifying migration...\n');

    const result = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(department_id) as with_dept,
        COUNT(*) - COUNT(department_id) as without_dept
      FROM shift_types
    `;

    console.log('Shift types statistics:');
    console.log(`  - Total: ${result[0].total}`);
    console.log(`  - With department: ${result[0].with_dept}`);
    console.log(`  - Without department (global): ${result[0].without_dept}\n`);

    // Show sample
    const samples = await sql`
      SELECT id, code, name, tenant_id, department_id
      FROM shift_types
      ORDER BY sort_order
      LIMIT 10
    `;

    console.log('Sample shift types:');
    samples.forEach(s => {
      const deptDisplay = s.department_id ? s.department_id.substring(0, 8) + '...' : 'GLOBAL';
      console.log(`  - ${s.code} (${s.name}): dept=${deptDisplay}`);
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
