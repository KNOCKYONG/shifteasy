import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    const masterPassword = process.env.MASTER_ADMIN_PASSWORD?.trim();

    if (!masterPassword) {
      console.error('MASTER_ADMIN_PASSWORD not configured');
      return NextResponse.json(
        { authenticated: false, error: 'Master admin not configured' },
        { status: 500 }
      );
    }

    // Debug log (remove after testing)
    console.log('[DEBUG] Password lengths:', {
      input: password?.length,
      stored: masterPassword?.length,
      inputFirst10: password?.substring(0, 10),
      storedFirst10: masterPassword?.substring(0, 10),
    });

    // Trim input password and compare
    const trimmedPassword = password?.trim();
    const isValid = trimmedPassword === masterPassword;

    if (isValid) {
      console.log(`[MASTER ADMIN] Successful login at ${new Date().toISOString()} from ${request.headers.get('x-forwarded-for') || request.ip || 'unknown'}`);
      return NextResponse.json({ authenticated: true });
    }

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
