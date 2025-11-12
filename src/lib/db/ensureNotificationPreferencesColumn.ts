import { db } from '@/db';
import { sql } from 'drizzle-orm';

const DEFAULT_NOTIFICATION_PREFS = {
  enabled: true,
  channels: { sse: true, push: false, email: false },
  types: {
    handoff_submitted: true,
    handoff_completed: true,
    handoff_critical_patient: true,
    handoff_reminder: true,
    schedule_published: true,
    schedule_updated: true,
    swap_requested: true,
    swap_approved: true,
    swap_rejected: true,
  },
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
} as const;

let ensurePromise: Promise<void> | null = null;

function toJsonLiteral(value: unknown) {
  return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
}

export async function ensureNotificationPreferencesColumn() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
    const columnExists = await db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'notification_preferences'
      LIMIT 1;
    `) as Array<Record<string, unknown>>;

    if (columnExists.length > 0) {
      return;
    }

    const defaultLiteral = toJsonLiteral(DEFAULT_NOTIFICATION_PREFS);

    await db.execute(sql.raw(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb;
    `));

    await db.execute(sql.raw(`
      ALTER TABLE "users"
      ALTER COLUMN "notification_preferences"
      SET DEFAULT ${defaultLiteral};
    `));

    await db.execute(sql.raw(`
      UPDATE "users"
      SET "notification_preferences" = ${defaultLiteral}
      WHERE "notification_preferences" IS NULL;
    `));

    console.log('[DB] Added missing notification_preferences column to users table');
  })().catch((error) => {
    ensurePromise = null;
    console.error('[DB] Failed to ensure notification_preferences column', error);
    throw error;
  });

  return ensurePromise;
}
