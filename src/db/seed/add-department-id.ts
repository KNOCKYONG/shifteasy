/**
 * Add department_id column to nurse_preferences and special_requests
 * and populate with data from users table
 */

import { db } from '../index';
import { sql } from 'drizzle-orm';

async function addDepartmentIdColumns() {
  console.log('🔄 Adding department_id columns...\n');

  try {
    // 1. Add department_id column to nurse_preferences if not exists
    console.log('📋 Adding department_id to nurse_preferences...');

    await db.execute(sql`
      ALTER TABLE nurse_preferences
      ADD COLUMN IF NOT EXISTS department_id UUID
    `);

    console.log('✅ Column added to nurse_preferences\n');

    // 2. Add department_id column to special_requests if not exists
    console.log('📋 Adding department_id to special_requests...');

    await db.execute(sql`
      ALTER TABLE special_requests
      ADD COLUMN IF NOT EXISTS department_id UUID
    `);

    console.log('✅ Column added to special_requests\n');

    // 3. Create indexes
    console.log('📋 Creating indexes...');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS nurse_preferences_department_idx
      ON nurse_preferences(department_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS special_requests_department_idx
      ON special_requests(department_id)
    `);

    console.log('✅ Indexes created\n');

    // 4. Update nurse_preferences with department_id from users
    console.log('📋 Updating nurse_preferences with department_id...');

    const nursePrefsResult = await db.execute(sql`
      UPDATE nurse_preferences
      SET department_id = users.department_id
      FROM users
      WHERE nurse_preferences.nurse_id = users.id
      AND nurse_preferences.department_id IS NULL
    `);

    console.log(`✅ Updated ${nursePrefsResult.rowCount || 0} rows in nurse_preferences\n`);

    // 5. Update special_requests with department_id from users
    console.log('📋 Updating special_requests with department_id...');

    const specialReqsResult = await db.execute(sql`
      UPDATE special_requests
      SET department_id = users.department_id
      FROM users
      WHERE special_requests.employee_id = users.id
      AND special_requests.department_id IS NULL
    `);

    console.log(`✅ Updated ${specialReqsResult.rowCount || 0} rows in special_requests\n`);

    // 6. Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check nurse_preferences
    const nursePrefsCheck = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(department_id) as with_dept,
        COUNT(*) - COUNT(department_id) as without_dept
      FROM nurse_preferences
    `);

    const npStats = nursePrefsCheck.rows[0];
    console.log(`   nurse_preferences:`);
    console.log(`   - Total: ${npStats?.total || 0}`);
    console.log(`   - With department_id: ${npStats?.with_dept || 0}`);
    console.log(`   - Without department_id: ${npStats?.without_dept || 0}\n`);

    // Check special_requests
    const specialReqsCheck = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(department_id) as with_dept,
        COUNT(*) - COUNT(department_id) as without_dept
      FROM special_requests
    `);

    const srStats = specialReqsCheck.rows[0];
    console.log(`   special_requests:`);
    console.log(`   - Total: ${srStats?.total || 0}`);
    console.log(`   - With department_id: ${srStats?.with_dept || 0}`);
    console.log(`   - Without department_id: ${srStats?.without_dept || 0}\n`);

    // 7. Show sample data
    console.log('📊 Sample data:\n');

    const sampleNursePrefs = await db.execute(sql`
      SELECT
        np.id,
        u.name as nurse_name,
        np.department_id as pref_dept_id,
        u.department_id as user_dept_id,
        d.name as department_name
      FROM nurse_preferences np
      LEFT JOIN users u ON np.nurse_id = u.id
      LEFT JOIN departments d ON np.department_id = d.id
      LIMIT 5
    `);

    console.log('   nurse_preferences samples:');
    sampleNursePrefs.rows.forEach(row => {
      console.log(`   - ${row.nurse_name}: ${row.department_name || 'No department'}`);
    });

    const sampleSpecialReqs = await db.execute(sql`
      SELECT
        sr.id,
        u.name as employee_name,
        sr.department_id as req_dept_id,
        u.department_id as user_dept_id,
        d.name as department_name,
        sr.request_type,
        sr.start_date
      FROM special_requests sr
      LEFT JOIN users u ON sr.employee_id = u.id
      LEFT JOIN departments d ON sr.department_id = d.id
      LIMIT 5
    `);

    console.log('\n   special_requests samples:');
    sampleSpecialReqs.rows.forEach(row => {
      console.log(`   - ${row.employee_name}: ${row.department_name || 'No department'} (${row.request_type})`);
    });

    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addDepartmentIdColumns()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { addDepartmentIdColumns };
