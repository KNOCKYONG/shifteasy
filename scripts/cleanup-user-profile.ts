/**
 * Removes legacy keys (skills, certifications, preferences) from users.profile
 * Run this once after deploying the schema change.
 */
import { config } from 'dotenv';
import postgres from 'postgres';

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

async function cleanupProfile() {
  try {
    console.log('🧹 Removing legacy profile keys (skills, certifications, preferences)...');

    await client`
      UPDATE users
      SET profile = profile - 'skills' - 'certifications' - 'preferences'
      WHERE profile IS NOT NULL AND (
        profile ? 'skills' OR profile ? 'certifications' OR profile ? 'preferences'
      )
    `;

    console.log('✅ Finished cleaning up user profile metadata.');
  } catch (error) {
    console.error('❌ Failed to clean up user profiles:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

cleanupProfile();
