// Simple script to fix missing user - runs with plain node
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const STUCK_USER_CLERK_ID = 'user_34aGuals7cGqUNzSTKTes2NAqrG';
const DATABASE_URL = process.env.DATABASE_URL;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

console.log('🔧 Environment check:');
console.log('   CLERK_SECRET_KEY:', CLERK_SECRET_KEY ? '✅ Loaded' : '❌ Missing');
console.log('   DATABASE_URL:', DATABASE_URL ? `✅ ${DATABASE_URL.substring(0, 40)}...` : '❌ Missing');
console.log('');

if (!CLERK_SECRET_KEY || !DATABASE_URL) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize database client
const sql = postgres(DATABASE_URL, {
  prepare: false,
  ssl: 'require',
});

async function fixMissingUser() {
  try {
    console.log('🔍 Checking for user in database...');
    console.log(`   Clerk User ID: ${STUCK_USER_CLERK_ID}`);
    console.log('');

    // Check if user exists
    const existing = await sql`
      SELECT * FROM users
      WHERE clerk_user_id = ${STUCK_USER_CLERK_ID}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log('✅ User already exists in database!');
      console.log('   User ID:', existing[0].id);
      console.log('   Name:', existing[0].name);
      console.log('   Email:', existing[0].email);
      console.log('   Role:', existing[0].role);
      console.log('   Tenant ID:', existing[0].tenant_id);
      await sql.end();
      return;
    }

    console.log('❌ User NOT found in database');
    console.log('');

    // Fetch from Clerk
    console.log('🔍 Fetching user info from Clerk API...');
    const clerkResponse = await fetch(
      `https://api.clerk.com/v1/users/${STUCK_USER_CLERK_ID}`,
      {
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!clerkResponse.ok) {
      if (clerkResponse.status === 404) {
        console.error('❌ User does not exist in Clerk!');
        await sql.end();
        process.exit(1);
      }
      throw new Error(`Clerk API error: ${clerkResponse.status}`);
    }

    const clerkUser = await clerkResponse.json();
    console.log('✅ Found user in Clerk');

    const email = clerkUser.email_addresses?.[0]?.email_address;
    const firstName = clerkUser.first_name || '';
    const lastName = clerkUser.last_name || '';
    const name = firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || email?.split('@')[0] || 'User';

    console.log('   Email:', email);
    console.log('   Name:', name);
    console.log('');

    if (!email) {
      console.error('❌ No email address found');
      await sql.end();
      process.exit(1);
    }

    // Check for organization
    console.log('🔍 Fetching organization memberships...');
    const orgResponse = await fetch(
      `https://api.clerk.com/v1/users/${STUCK_USER_CLERK_ID}/organization_memberships`,
      {
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let tenantId = null;
    let departmentId = null;

    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      if (orgData.data && orgData.data.length > 0) {
        tenantId = orgData.data[0].organization.id;
        console.log('✅ Found organization:', tenantId);

        // Find first department
        const departments = await sql`
          SELECT * FROM departments
          WHERE tenant_id = ${tenantId}
          LIMIT 1
        `;

        if (departments.length > 0) {
          departmentId = departments[0].id;
          console.log('✅ Found department:', departmentId);
        }
      } else {
        console.log('⚠️  No organization membership found');
      }
    }
    console.log('');

    // Insert user
    console.log('📝 Creating user in database...');
    const result = await sql`
      INSERT INTO users (
        clerk_user_id,
        email,
        name,
        role,
        status,
        tenant_id,
        department_id,
        employee_id
      ) VALUES (
        ${STUCK_USER_CLERK_ID},
        ${email},
        ${name},
        'member',
        'active',
        ${tenantId},
        ${departmentId},
        ${email.split('@')[0]}
      )
      RETURNING *
    `;

    const newUser = result[0];
    console.log('✅ User created successfully!');
    console.log('   Database User ID:', newUser.id);
    console.log('   Name:', newUser.name);
    console.log('   Email:', newUser.email);
    console.log('   Role:', newUser.role);
    console.log('   Tenant ID:', newUser.tenant_id || 'NULL');
    console.log('   Department ID:', newUser.department_id || 'NULL');
    console.log('');
    console.log('✅ User should now be able to access the dashboard!');
    console.log('   Please refresh the dashboard page to verify.');

    await sql.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

fixMissingUser()
  .then(() => {
    console.log('');
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
