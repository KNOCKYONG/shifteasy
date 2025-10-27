/**
 * Direct PostgreSQL Migration Runner
 * Bypasses Drizzle to run SQL migrations directly
 */

import { readFileSync } from 'fs';
import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env.local') });

async function runMigration() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔗 Connecting to database...\n');
    console.log('✅ Connected successfully\n');

    const sqlFile = join(process.cwd(), 'src/db/migrations/0001_add_department_id.sql');
    const sqlContent = readFileSync(sqlFile, 'utf8');

    console.log('📋 Executing migration...\n');

    // Execute the SQL file using postgres.js file() method
    await sql.file(sqlFile);

    console.log('✅ Migration completed successfully!\n');

    // Verify the changes
    console.log('🔍 Verifying migration...\n');

    // Check nurse_preferences
    const npCheck = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(department_id) as with_dept,
        COUNT(*) - COUNT(department_id) as without_dept
      FROM nurse_preferences
    `;

    console.log('nurse_preferences:');
    console.log(`  - Total records: ${npCheck[0].total}`);
    console.log(`  - With department_id: ${npCheck[0].with_dept}`);
    console.log(`  - Without department_id: ${npCheck[0].without_dept}\n`);

    // Check special_requests
    const srCheck = await sql`
      SELECT
        COUNT(*) as total,
        COUNT(department_id) as with_dept,
        COUNT(*) - COUNT(department_id) as without_dept
      FROM special_requests
    `;

    console.log('special_requests:');
    console.log(`  - Total records: ${srCheck[0].total}`);
    console.log(`  - With department_id: ${srCheck[0].with_dept}`);
    console.log(`  - Without department_id: ${srCheck[0].without_dept}\n`);

    // Show sample data
    console.log('📊 Sample data:\n');

    const npSamples = await sql`
      SELECT
        np.id,
        u.name as nurse_name,
        np.department_id,
        d.name as department_name
      FROM nurse_preferences np
      LEFT JOIN users u ON np.nurse_id = u.id
      LEFT JOIN departments d ON np.department_id = d.id
      LIMIT 5
    `;

    console.log('nurse_preferences samples:');
    npSamples.forEach(row => {
      console.log(`  - ${row.nurse_name}: ${row.department_name || 'No department'}`);
    });

    const srSamples = await sql`
      SELECT
        sr.id,
        u.name as employee_name,
        sr.department_id,
        d.name as department_name,
        sr.request_type
      FROM special_requests sr
      LEFT JOIN users u ON sr.employee_id = u.id
      LEFT JOIN departments d ON sr.department_id = d.id
      LIMIT 5
    `;

    console.log('\nspecial_requests samples:');
    srSamples.forEach(row => {
      console.log(`  - ${row.employee_name}: ${row.department_name || 'No department'} (${row.request_type})`);
    });

    console.log('\n✅ All done!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runMigration };
