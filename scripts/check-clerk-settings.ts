import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local file explicitly
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_BASE_URL = 'https://api.clerk.com/v1';

async function checkClerkSettings() {
  if (!CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not defined in environment variables.');
  }

  console.log('🔍 Checking Clerk instance settings...\n');

  // Get instance settings
  const instanceResponse = await fetch(`${CLERK_BASE_URL}/instance`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!instanceResponse.ok) {
    const errorBody = await instanceResponse.text();
    throw new Error(`Failed to get instance: ${instanceResponse.status} ${errorBody}`);
  }

  const instance = await instanceResponse.json();

  console.log('📋 Current Settings:');
  console.log('─────────────────────────────────────');
  console.log('Instance ID:', instance.id);
  console.log('Environment:', instance.environment_type);

  // Check sign-up settings
  if (instance.sign_up) {
    console.log('\n🔐 Sign-up Settings:');
    console.log('  Progressive sign-up:', instance.sign_up.progressive);
    console.log('  Require email:', instance.sign_up.require_email);
    console.log('  Require phone:', instance.sign_up.require_phone);
  }

  // Check email address settings
  if (instance.email_address) {
    console.log('\n📧 Email Settings:');
    console.log('  Verification required:', instance.email_address.verification_required);
    console.log('  Verification strategy:', instance.email_address.verification_strategy);
  }

  // Check restrictions
  if (instance.restrictions) {
    console.log('\n🚫 Restrictions:');
    console.log('  Allowlist enabled:', instance.restrictions.allowlist?.enabled);
    console.log('  Blocklist enabled:', instance.restrictions.blocklist?.enabled);
  }

  console.log('\n─────────────────────────────────────\n');

  // Check if email verification is required
  const needsFix = !instance.email_address?.verification_required;

  if (needsFix) {
    console.log('⚠️  Email verification is NOT required!');
    console.log('💡 Run: npm run clerk:fix-verification\n');
  } else {
    console.log('✅ Email verification is properly configured!\n');
  }

  return { instance, needsFix };
}

checkClerkSettings().catch((error) => {
  console.error('Failed to check Clerk settings:', error);
  process.exit(1);
});
