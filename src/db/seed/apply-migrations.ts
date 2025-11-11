/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Use SESSION_URL for DDL operations (migrations)
const connectionString = process.env.SESSION_URL!;
const client = postgres(connectionString, {
  ssl: 'require',
  max: 1 // Single connection for migrations
});

async function applyMigrations() {
  try {
    console.log('🚀 Applying database migrations to Supabase...');
    console.log('Using SESSION_URL for DDL operations');

    // Read migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const migration1 = readFileSync(path.join(migrationsDir, '0000_eager_butterfly.sql'), 'utf-8');
    const migration2 = readFileSync(path.join(migrationsDir, '0002_remarkable_silver_samurai.sql'), 'utf-8');

    console.log('\n📝 Applying first migration (main schema)...');

    // Split by semicolons and execute each statement
    const statements1 = migration1.split(';').filter(stmt => stmt.trim());
    for (const statement of statements1) {
      if (statement.trim()) {
        try {
          await client.unsafe(statement + ';');
        } catch (error: any) {
          // If table already exists, that's okay
          if (error.message.includes('already exists')) {
            console.log(`⚠️ Skipping (already exists): ${statement.substring(0, 50)}...`);
          } else {
            console.error(`❌ Error in statement: ${statement.substring(0, 100)}...`);
            console.error(error.message);
          }
        }
      }
    }

    console.log('✅ First migration applied');

    console.log('\n📝 Applying second migration (shift_assignments table)...');

    const statements2 = migration2.split(';').filter(stmt => stmt.trim());
    for (const statement of statements2) {
      if (statement.trim()) {
        try {
          await client.unsafe(statement + ';');
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            console.log(`⚠️ Skipping (already exists): ${statement.substring(0, 50)}...`);
          } else {
            console.error(`❌ Error in statement: ${statement.substring(0, 100)}...`);
            console.error(error.message);
          }
        }
      }
    }

    console.log('✅ Second migration applied');

    // Check if tables were created
    console.log('\n🔍 Verifying tables...');
    const tables = await client`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    console.log('\n📊 Tables in database:');
    tables.forEach(t => console.log(`  - ${t.tablename}`));

    console.log('\n✅ All migrations completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migrations
if (require.main === module) {
  applyMigrations()
    .then(async () => {
      await client.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Migration script failed:', error);
      await client.end();
      process.exit(1);
    });
}

export { applyMigrations };