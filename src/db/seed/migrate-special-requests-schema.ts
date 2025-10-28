import postgres from 'postgres';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env.local') });

async function migrateSpecialRequestsSchema() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require'
  });

  try {
    console.log('🔗 Connecting to database...\n');

    // 1. Rename start_date to date
    console.log('🔄 Step 1: Renaming start_date column to date...');
    await sql`
      ALTER TABLE special_requests
      RENAME COLUMN start_date TO date
    `;
    console.log('✅ Renamed start_date to date\n');

    // 2. Drop end_date column
    console.log('🔄 Step 2: Dropping end_date column...');
    await sql`
      ALTER TABLE special_requests
      DROP COLUMN end_date
    `;
    console.log('✅ Dropped end_date column\n');

    // 3. Update index
    console.log('🔄 Step 3: Updating index...');
    await sql`
      DROP INDEX IF EXISTS special_requests_date_idx
    `;
    await sql`
      CREATE INDEX special_requests_date_idx ON special_requests (date)
    `;
    console.log('✅ Updated index\n');

    // 4. Verify final schema
    console.log('🔍 Verifying schema...');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'special_requests'
      ORDER BY ordinal_position
    `;

    console.log('Special requests table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

if (require.main === module) {
  migrateSpecialRequestsSchema()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { migrateSpecialRequestsSchema };
