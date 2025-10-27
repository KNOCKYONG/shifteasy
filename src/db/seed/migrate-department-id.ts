/**
 * Migrate department_id to nurse_preferences and special_requests
 * users 테이블의 department_id를 nurse_preferences와 special_requests에 복사
 */

import { db } from '../index';
import { nursePreferences, specialRequests } from '../schema/nurse-preferences';
import { users } from '../schema/tenants';
import { eq, sql } from 'drizzle-orm';

async function migrateDepartmentIds() {
  console.log('🔄 Starting department_id migration...\n');

  try {
    // 1. Update nurse_preferences with department_id from users
    console.log('📋 Updating nurse_preferences table...');

    const nursePrefsResult = await db.execute(sql`
      UPDATE nurse_preferences
      SET department_id = users.department_id
      FROM users
      WHERE nurse_preferences.nurse_id = users.id
      AND nurse_preferences.department_id IS NULL
    `);

    console.log(`✅ Updated ${nursePrefsResult.rowCount || 0} rows in nurse_preferences\n`);

    // 2. Update special_requests with department_id from users
    console.log('📋 Updating special_requests table...');

    const specialReqsResult = await db.execute(sql`
      UPDATE special_requests
      SET department_id = users.department_id
      FROM users
      WHERE special_requests.employee_id = users.id
      AND special_requests.department_id IS NULL
    `);

    console.log(`✅ Updated ${specialReqsResult.rowCount || 0} rows in special_requests\n`);

    // 3. Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check nurse_preferences
    const nursePrefsWithoutDept = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM nurse_preferences
      WHERE department_id IS NULL
    `);

    const nursePrefsCount = nursePrefsWithoutDept.rows[0]?.count || 0;
    console.log(`   - nurse_preferences without department_id: ${nursePrefsCount}`);

    // Check special_requests
    const specialReqsWithoutDept = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM special_requests
      WHERE department_id IS NULL
    `);

    const specialReqsCount = specialReqsWithoutDept.rows[0]?.count || 0;
    console.log(`   - special_requests without department_id: ${specialReqsCount}\n`);

    if (nursePrefsCount === 0 && specialReqsCount === 0) {
      console.log('✅ Migration completed successfully! All records have department_id.\n');
    } else {
      console.log('⚠️  Some records still missing department_id (users might not have department assigned)\n');
    }

    // 4. Show sample data
    console.log('📊 Sample data after migration:\n');

    const sampleNursePrefs = await db.execute(sql`
      SELECT
        np.id,
        np.nurse_id,
        np.department_id,
        u.name as nurse_name,
        u.department_id as user_dept_id
      FROM nurse_preferences np
      LEFT JOIN users u ON np.nurse_id = u.id
      LIMIT 5
    `);

    console.log('   nurse_preferences samples:');
    sampleNursePrefs.rows.forEach(row => {
      console.log(`   - Nurse: ${row.nurse_name}, Pref Dept: ${row.department_id}, User Dept: ${row.user_dept_id}`);
    });

    const sampleSpecialReqs = await db.execute(sql`
      SELECT
        sr.id,
        sr.employee_id,
        sr.department_id,
        u.name as employee_name,
        u.department_id as user_dept_id,
        sr.request_type,
        sr.start_date
      FROM special_requests sr
      LEFT JOIN users u ON sr.employee_id = u.id
      LIMIT 5
    `);

    console.log('\n   special_requests samples:');
    sampleSpecialReqs.rows.forEach(row => {
      console.log(`   - Employee: ${row.employee_name}, Req Dept: ${row.department_id}, User Dept: ${row.user_dept_id}, Type: ${row.request_type}`);
    });

    console.log('\n✅ Department ID migration completed!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateDepartmentIds()
    .then(() => {
      console.log('✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { migrateDepartmentIds };
