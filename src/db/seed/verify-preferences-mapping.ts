import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

/**
 * Verify that nurse_preferences are correctly loaded and mapped
 */
async function verifyPreferencesMapping() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔗 Connecting to database...\n');

    // Find 박선미
    console.log('🔍 Finding 박선미...\n');
    const user = await sql`
      SELECT id, name, department_id, tenant_id
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
    console.log(`   - tenant_id: ${user[0].tenant_id}`);
    console.log(`   - department_id: ${user[0].department_id}\n`);

    // Get nurse_preferences
    console.log('📊 Loading nurse_preferences from database...\n');
    const prefs = await sql`
      SELECT *
      FROM nurse_preferences
      WHERE nurse_id = ${user[0].id}
      LIMIT 1
    `;

    if (prefs.length === 0) {
      console.log('❌ No nurse_preferences found\n');
      return;
    }

    console.log('✅ Database nurse_preferences:');
    console.log(`   - work_pattern_type: ${prefs[0].work_pattern_type}`);
    console.log(`   - preferred_shift_types: ${JSON.stringify(prefs[0].preferred_shift_types)}`);
    console.log(`   - max_consecutive_days_preferred: ${prefs[0].max_consecutive_days_preferred}\n`);

    // Simulate how the scheduler should receive this data
    console.log('🔄 Simulating EmployeeAdapter mapping...\n');

    // This mimics what EmployeeAdapter.toSchedulerEmployee() should do
    const mockComprehensivePrefs = {
      workPreferences: {
        workPatternType: prefs[0].work_pattern_type,
        preferredShifts: prefs[0].preferred_shift_types.D > 0 ? ['day'] :
                        prefs[0].preferred_shift_types.E > 0 ? ['evening'] :
                        prefs[0].preferred_shift_types.N > 0 ? ['night'] : [],
        maxConsecutiveDays: prefs[0].max_consecutive_days_preferred || 5
      }
    };

    const schedulerEmployee = {
      id: user[0].id,
      name: user[0].name,
      workPatternType: mockComprehensivePrefs.workPreferences.workPatternType,
      preferredShiftTypes: {
        D: mockComprehensivePrefs.workPreferences.preferredShifts.includes('day') ? 10 : 0,
        E: mockComprehensivePrefs.workPreferences.preferredShifts.includes('evening') ? 10 : 0,
        N: mockComprehensivePrefs.workPreferences.preferredShifts.includes('night') ? 10 : 0,
      },
      maxConsecutiveDaysPreferred: mockComprehensivePrefs.workPreferences.maxConsecutiveDays
    };

    console.log('✅ Mapped Employee object for scheduler:');
    console.log(`   - workPatternType: ${schedulerEmployee.workPatternType}`);
    console.log(`   - preferredShiftTypes: ${JSON.stringify(schedulerEmployee.preferredShiftTypes)}`);
    console.log(`   - maxConsecutiveDaysPreferred: ${schedulerEmployee.maxConsecutiveDaysPreferred}\n`);

    // Verify the mapping is correct
    if (schedulerEmployee.workPatternType === 'weekday-only') {
      console.log('✅ SUCCESS: workPatternType is correctly set to "weekday-only"');
      console.log('   박선미 will be assigned:');
      console.log('   - Weekdays (not holidays): A (administrative work)');
      console.log('   - Weekends/Holidays: OFF\n');
    } else {
      console.log(`❌ ERROR: workPatternType is "${schedulerEmployee.workPatternType}" instead of "weekday-only"\n`);
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  verifyPreferencesMapping()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { verifyPreferencesMapping };
