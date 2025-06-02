import { NextRequest, NextResponse } from 'next/server';

// Constants for authentication
const COOKIE_NAME = 'site_access_token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

export async function POST(request: NextRequest) {
  try {
    // Validate environment configuration
    const sitePassword = process.env.SITE_PASSWORD;
    
    if (!sitePassword) {
      return NextResponse.json(
        { message: 'Server misconfiguration: Site password not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { message: 'Password is required' },
        { status: 400 }
      );
    }

    if (password !== sitePassword) {
      return NextResponse.json(
        { message: 'Invalid password' },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      { message: 'Authentication successful' },
      { status: 200 }
    );
    
    // Set authentication cookie directly on the response
    response.cookies.set({
      name: COOKIE_NAME,
      value: 'authenticated',
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in site authentication:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
