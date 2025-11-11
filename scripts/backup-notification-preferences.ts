/**
 * Backup notification_preferences column before drizzle-kit push removes it.
 * This is a safety measure to preserve data before schema migration.
 */
import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

config({ path: '.env.local' });

const connectionString =
  process.env.SESSION_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Database connection string is missing (.env.local)');
  process.exit(1);
}

const client = postgres(connectionString, {
  ssl: 'require',
  prepare: false,
});
const db = drizzle(client);

async function checkColumnExists(): Promise<boolean> {
  const result = (await db.execute(sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'notification_preferences'
    LIMIT 1;
  `)) as Array<Record<string, unknown>>;

  return result.length > 0;
}

async function backupNotificationPreferences() {
  const exists = await checkColumnExists();

  if (!exists) {
    console.log('ℹ️  notification_preferences column does not exist, skipping backup');
    return;
  }

  console.log('📦 Backing up notification_preferences data...');

  const result = (await db.execute(sql`
    SELECT
      id,
      email,
      name,
      notification_preferences
    FROM users
    WHERE notification_preferences IS NOT NULL;
  `)) as Array<{
    id: string;
    email: string;
    name: string | null;
    notification_preferences: unknown;
  }>;

  if (result.length === 0) {
    console.log('ℹ️  No notification preferences data to backup');
    return;
  }

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(backupDir, `notification-preferences-backup-${timestamp}.json`);

  fs.writeFileSync(filename, JSON.stringify(result, null, 2));

  console.log(`✅ Backed up ${result.length} records to: ${filename}`);
}

async function main() {
  try {
    await backupNotificationPreferences();
    console.log('✅ Backup complete\n');
  } catch (error) {
    console.error('❌ Failed to backup notification_preferences');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
