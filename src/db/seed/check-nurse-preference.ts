import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

async function checkNursePreference() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔗 Connecting to database...\n');

    // Find 박선미
    console.log('🔍 Finding 박선미...\n');
    const user = await sql`
      SELECT id, name, department_id
      FROM users
      WHERE name = '박선미'
      LIMIT 1
    `;

    if (user.length === 0) {
      console.log('❌ User 박선미 not found\n');
      return;
    }

    console.log(`✅ Found user: ${user[0].name}`);
    console.log(`   - user_id: ${user[0].id}`);
    console.log(`   - department_id: ${user[0].department_id}\n`);

    // Check nurse_preferences
    console.log('📊 Checking nurse_preferences...\n');
    const prefs = await sql`
      SELECT *
      FROM nurse_preferences
      WHERE nurse_id = ${user[0].id}
      LIMIT 1
    `;

    if (prefs.length === 0) {
      console.log('❌ No nurse_preferences found for 박선미\n');
      console.log('Creating default nurse_preferences...\n');

      // Create default preferences with weekday-only pattern
      const created = await sql`
        INSERT INTO nurse_preferences (
          tenant_id,
          nurse_id,
          department_id,
          work_pattern_type
        )
        VALUES (
          (SELECT tenant_id FROM users WHERE id = ${user[0].id}),
          ${user[0].id},
          ${user[0].department_id},
          'weekday-only'
        )
        RETURNING *
      `;

      console.log('✅ Created nurse_preferences with weekday-only pattern\n');
      console.log(created[0]);
    } else {
      console.log('✅ Found nurse_preferences:');
      console.log(`   - id: ${prefs[0].id}`);
      console.log(`   - work_pattern_type: ${prefs[0].work_pattern_type}`);
      console.log(`   - preferred_shift_types: ${JSON.stringify(prefs[0].preferred_shift_types)}`);
      console.log(`   - max_consecutive_days_preferred: ${prefs[0].max_consecutive_days_preferred}`);

      if (prefs[0].work_pattern_type !== 'weekday-only') {
        console.log('\n⚠️ Work pattern is not "weekday-only", updating...\n');

        await sql`
          UPDATE nurse_preferences
          SET
            work_pattern_type = 'weekday-only',
            updated_at = NOW()
          WHERE id = ${prefs[0].id}
        `;

        console.log('✅ Updated work_pattern_type to "weekday-only"\n');
      }
    }

    console.log('\n✅ Check completed!\n');

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  checkNursePreference()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { checkNursePreference };
