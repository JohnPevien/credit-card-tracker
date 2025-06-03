import { NextRequest, NextResponse } from 'next/server';
import { 
  SITE_ACCESS_COOKIE_NAME, 
  SITE_ACCESS_COOKIE_VALUE, 
  PUBLIC_PATHS 
} from '@/lib/constants/constants';

export function middleware(request: NextRequest) {
  // Skip middleware if SITE_PASSWORD is not set
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword || sitePassword === '') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  
  // Check if path is public or static asset
  const isPublicPath = PUBLIC_PATHS.some(path => pathname.startsWith(path));
  const isStaticAsset = pathname.startsWith('/_next/') || 
                         pathname.startsWith('/favicon.ico') ||
                         pathname.startsWith('/images/');
  
  // Allow access to public paths and static assets
  if (isPublicPath || isStaticAsset) {
    return NextResponse.next();
  }
    // Check for authentication cookie
  const accessCookie = request.cookies.get(SITE_ACCESS_COOKIE_NAME);
  
  // Redirect to password entry page if not authenticated
  if (!accessCookie || accessCookie.value !== SITE_ACCESS_COOKIE_VALUE) {
    const url = new URL('/enter-password', request.url);
    return NextResponse.redirect(url);
  }
  
  // User is authenticated, allow access
  return NextResponse.next();
}

// Define which paths the middleware should be executed on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /_next (Next.js internals)
     * 2. /api/site-auth (API endpoint for authentication)
     * 3. /enter-password (Password entry page)
     * 4. /favicon.ico, /images (Static files)
     */
    '/((?!_next|favicon.ico|images|api/site-auth|enter-password).*)',
  ],
};
