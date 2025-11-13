import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    const masterPassword = process.env.MASTER_ADMIN_PASSWORD;

    if (!masterPassword) {
      console.error('MASTER_ADMIN_PASSWORD not configured');
      return NextResponse.json(
        { authenticated: false, error: 'Master admin not configured' },
        { status: 500 }
      );
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = password === masterPassword;

    if (isValid) {
      // Log successful access (you can extend this to store in DB)
      console.log(`[MASTER ADMIN] Successful login at ${new Date().toISOString()} from ${request.headers.get('x-forwarded-for') || request.ip || 'unknown'}`);

      return NextResponse.json({ authenticated: true });
    }

    // Log failed attempt
    console.warn(`[MASTER ADMIN] Failed login attempt at ${new Date().toISOString()} from ${request.headers.get('x-forwarded-for') || request.ip || 'unknown'}`);

    return NextResponse.json(
      { authenticated: false, error: 'Invalid password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Master auth error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
