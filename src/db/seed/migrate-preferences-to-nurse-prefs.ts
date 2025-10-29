import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

/**
 * Migrate existing preferences from tenant_configs to nurse_preferences
 */
async function migratePreferencesToNursePrefs() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔄 Starting migration from tenant_configs to nurse_preferences...\n');

    const tenantId = '3760b5ec-462f-443c-9a90-4a2b2e295e9d';

    // 1. Get all preferences from tenant_configs
    const configs = await sql`
      SELECT config_key, config_value
      FROM tenant_configs
      WHERE tenant_id = ${tenantId}
        AND config_key LIKE 'preferences_%'
    `;

    console.log(`✅ Found ${configs.length} preference records in tenant_configs\n`);

    if (configs.length === 0) {
      console.log('ℹ️  No preferences to migrate');
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const config of configs) {
      // Extract employeeId from config_key (format: preferences_<employeeId>)
      const employeeId = config.config_key.replace('preferences_', '');
      const prefs = config.config_value as any;

      try {
        // Get user's department_id
        const user = await sql`
          SELECT id, name, department_id
          FROM users
          WHERE id = ${employeeId}
          LIMIT 1
        `;

        if (user.length === 0) {
          console.log(`⚠️  Skipping ${employeeId}: User not found`);
          skipped++;
          continue;
        }

        const departmentId = user[0].department_id;

        // Check if already exists in nurse_preferences
        const existing = await sql`
          SELECT nurse_id
          FROM nurse_preferences
          WHERE nurse_id = ${employeeId}
          LIMIT 1
        `;

        if (existing.length > 0) {
          console.log(`⏭️  Skipping ${user[0].name}: Already exists in nurse_preferences`);
          skipped++;
          continue;
        }

        // Map ComprehensivePreferences to nurse_preferences format
        const workPreferences = prefs.workPreferences || {};
        const preferredShifts = workPreferences.preferredShifts || [];

        const nursePrefsData = {
          tenant_id: tenantId,
          nurse_id: employeeId,
          department_id: departmentId,
          work_pattern_type: workPreferences.workPatternType || 'three-shift',
          preferred_shift_types: {
            D: preferredShifts.includes('day') ? 10 : 0,
            E: preferredShifts.includes('evening') ? 10 : 0,
            N: preferredShifts.includes('night') ? 10 : 0,
          },
          max_consecutive_days_preferred: workPreferences.maxConsecutiveDays || 5,
          max_consecutive_nights_preferred: null,
        };

        // Insert into nurse_preferences
        await sql`
          INSERT INTO nurse_preferences (
            tenant_id,
            nurse_id,
            department_id,
            work_pattern_type,
            preferred_shift_types,
            max_consecutive_days_preferred,
            max_consecutive_nights_preferred
          ) VALUES (
            ${nursePrefsData.tenant_id},
            ${nursePrefsData.nurse_id},
            ${nursePrefsData.department_id},
            ${nursePrefsData.work_pattern_type},
            ${sql.json(nursePrefsData.preferred_shift_types)},
            ${nursePrefsData.max_consecutive_days_preferred},
            ${nursePrefsData.max_consecutive_nights_preferred}
          )
        `;

        console.log(`✅ Migrated ${user[0].name}:`);
        console.log(`   - work_pattern_type: ${nursePrefsData.work_pattern_type}`);
        console.log(`   - preferred_shift_types: ${JSON.stringify(nursePrefsData.preferred_shift_types)}`);
        migrated++;

      } catch (error) {
        console.error(`❌ Error migrating ${employeeId}:`, error);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${configs.length}\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  migratePreferencesToNursePrefs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { migratePreferencesToNursePrefs };
