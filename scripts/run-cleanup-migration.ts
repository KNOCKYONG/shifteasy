import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

async function runMigration() {
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    console.log('🧹 Starting database cleanup migration...');

    // Read the migration SQL
    const migrationPath = join(__dirname, '..', 'src', 'db', 'migrations', '0003_drop_legacy_tables.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      if (statement.includes('DROP TABLE') || statement.includes('DROP TYPE') || statement.includes('ALTER TABLE')) {
        try {
          console.log(`Executing: ${statement.substring(0, 50)}...`);
          await sql.unsafe(statement + ';');
          console.log('✅ Success');
        } catch (error: any) {
          if (error.message.includes('does not exist')) {
            console.log('⏩ Skipped (already removed)');
          } else {
            console.error('❌ Error:', error.message);
          }
        }
      }
    }

    // Verify cleanup
    console.log('\n📊 Verifying cleanup...');
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    console.log('\n✨ Current tables in database:');
    tables.forEach(t => console.log(`  - ${t.tablename}`));

    // Check for legacy tables
    const legacyTables = ['hospitals', 'wards', 'staff', 'staff_compatibility', 'shifts', 'ward_schedules', 'ward_assignments', 'preferences', 'requests'];
    const remainingLegacy = tables
      .map(t => t.tablename)
      .filter(name => legacyTables.includes(name));

    if (remainingLegacy.length > 0) {
      console.log('\n⚠️  Warning: Some legacy tables still exist:', remainingLegacy);
    } else {
      console.log('\n✅ All legacy tables have been successfully removed!');
    }

    console.log('\n🎉 Database cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration().catch(console.error);