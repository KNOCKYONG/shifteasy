import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local file explicitly
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_BASE_URL = 'https://api.clerk.com/v1';

async function fixEmailVerification() {
  if (!CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not defined in environment variables.');
  }

  console.log('🔧 Updating Clerk instance to require email verification...\n');

  const response = await fetch(`${CLERK_BASE_URL}/instance`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: {
        verification_required: true,
        verification_strategy: 'from_email_code', // OTP code via email
      },
      sign_up: {
        progressive: false, // Disable progressive sign-up to enforce email verification
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to update instance: ${response.status} ${errorBody}`);
  }

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : {};

  console.log('✅ Email verification requirement updated successfully!\n');
  console.log('📋 Updated Settings:');
  console.log('─────────────────────────────────────');
  console.log('Email verification required:', data.email_address?.verification_required);
  console.log('Verification strategy:', data.email_address?.verification_strategy);
  console.log('Progressive sign-up:', data.sign_up?.progressive);
  console.log('─────────────────────────────────────\n');

  console.log('💡 Next steps:');
  console.log('1. Test sign-up flow with a new email');
  console.log('2. Verify that email verification is required');
  console.log('3. Check custom email template is being used\n');
}

fixEmailVerification().catch((error) => {
  console.error('Failed to fix email verification:', error);
  process.exit(1);
});
