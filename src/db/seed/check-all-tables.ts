/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Check all tables in database and show row counts
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

async function checkAllTables() {
  console.log('🔍 Checking all tables in database...\n');

  try {
    // Get all table names from public schema
    const tablesResult = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = (tablesResult as any) as { table_name: string }[];

    console.log(`📊 Total tables found: ${tables.length}\n`);

    const emptyTables: string[] = [];
    const nonEmptyTables: { name: string; count: number }[] = [];

    // Check row count for each table
    for (const table of tables) {
      const countResult = await db.execute(
        sql.raw(`SELECT COUNT(*) as count FROM "${table.table_name}"`)
      ) as any;
      const count = Number(countResult[0].count);

      if (count === 0) {
        emptyTables.push(table.table_name);
      } else {
        nonEmptyTables.push({ name: table.table_name, count });
      }
    }

    // Display empty tables
    console.log('❌ Empty Tables (0 rows):');
    console.log('─'.repeat(50));
    if (emptyTables.length === 0) {
      console.log('  (No empty tables found)');
    } else {
      emptyTables.forEach(name => {
        console.log(`  • ${name}`);
      });
    }

    // Display non-empty tables
    console.log('\n✅ Non-Empty Tables:');
    console.log('─'.repeat(50));
    nonEmptyTables
      .sort((a, b) => b.count - a.count)
      .forEach(({ name, count }) => {
        console.log(`  • ${name.padEnd(40)} ${count.toLocaleString()} rows`);
      });

    console.log('\n📈 Summary:');
    console.log(`  Total tables: ${tables.length}`);
    console.log(`  Empty tables: ${emptyTables.length}`);
    console.log(`  Non-empty tables: ${nonEmptyTables.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkAllTables();
