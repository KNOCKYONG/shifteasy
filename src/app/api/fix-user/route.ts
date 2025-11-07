import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, departments } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * API endpoint to fix missing user in database
 * This user exists in Clerk but not in the database, causing infinite loading
 *
 * Usage: POST http://localhost:3002/api/fix-user
 * Body: { "clerkUserId": "user_34aGuals7cGqUNzSTKTes2NAqrG" }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerkUserId } = body;

    if (!clerkUserId) {
      return NextResponse.json(
        { error: 'clerkUserId is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking for user in database...');
    console.log(`   Clerk User ID: ${clerkUserId}`);

    // Check if user already exists in database
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'User already exists in database',
        user: {
          id: existingUser[0].id,
          name: existingUser[0].name,
          email: existingUser[0].email,
          role: existingUser[0].role,
          tenantId: existingUser[0].tenantId,
        },
      });
    }

    console.log('❌ User NOT found in database');

    // Fetch user from Clerk using REST API
    console.log('🔍 Fetching user info from Clerk API...');

    const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
    if (!CLERK_SECRET_KEY) {
      return NextResponse.json(
        { error: 'CLERK_SECRET_KEY not configured' },
        { status: 500 }
      );
    }

    const clerkResponse = await fetch(
      `https://api.clerk.com/v1/users/${clerkUserId}`,
      {
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!clerkResponse.ok) {
      if (clerkResponse.status === 404) {
        return NextResponse.json(
          { error: 'User does not exist in Clerk' },
          { status: 404 }
        );
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

    if (!email) {
      return NextResponse.json(
        { error: 'No email address found in Clerk' },
        { status: 400 }
      );
    }

    // Check if user has an organization
    console.log('🔍 Fetching organization memberships...');
    const orgResponse = await fetch(
      `https://api.clerk.com/v1/users/${clerkUserId}/organization_memberships`,
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

        // Try to find the first department in this tenant
        const firstDepartment = await db
          .select()
          .from(departments)
          .where(eq(departments.tenantId, tenantId))
          .limit(1);

        if (firstDepartment.length > 0) {
          departmentId = firstDepartment[0].id;
          console.log('✅ Found department:', departmentId);
        }
      } else {
        console.log('⚠️  No organization membership found');
      }
    }

    // Create user in database
    console.log('📝 Creating user in database...');
    const [newUser] = await db
      .insert(users)
      .values({
        clerkUserId,
        email,
        name,
        role: 'member', // Default role
        status: 'active',
        tenantId,
        departmentId,
        employeeId: email.split('@')[0], // Use email prefix as employee ID
      })
      .returning();

    console.log('✅ User created successfully!');

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        tenantId: newUser.tenantId,
        departmentId: newUser.departmentId,
      },
    });

  } catch (error: any) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
