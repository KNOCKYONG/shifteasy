/**
 * Drop unused tables from database
 * - Old architecture remnants (hospitals, wards, staff, etc.)
 * - Skill management system
 * - Other unused tables
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.SESSION_URL || process.env.DIRECT_URL!;
const client = postgres(connectionString, {
  prepare: false,
  ssl: 'require',
});
const db = drizzle(client);

async function dropUnusedTables() {
  console.log('🗑️  Dropping unused tables from database...\n');

  const tablesToDrop = [
    // Old architecture (10 tables)
    'hospitals',
    'wards',
    'staff',
    'staff_compatibility',
    'preferences',
    'requests',
    'schedules',
    'ward_schedules',
    'shifts',
    'ward_assignments',

    // Skill management system (6 tables)
    'nurse_skills',
    'skills',
    'skill_assessments',
    'skill_categories',
    'skill_training_records',
    'unit_skill_requirements',

    // Other unused tables (4 tables)
    'preceptor_relationships',
    'schedule_requests',
    'shift_assignments',
    'patterns',
  ];

  try {
    for (const tableName of tablesToDrop) {
      try {
        console.log(`  Dropping table: ${tableName}...`);
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`));
        console.log(`  ✅ Dropped: ${tableName}`);
      } catch (error) {
        console.error(`  ❌ Error dropping ${tableName}:`, error);
      }
    }

    console.log('\n🎉 Finished dropping tables!');
    console.log(`\n📊 Total tables dropped: ${tablesToDrop.length}`);
    console.log('\nCategories:');
    console.log('  - Old architecture: 10 tables');
    console.log('  - Skill management: 6 tables');
    console.log('  - Other unused: 4 tables');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

dropUnusedTables();
