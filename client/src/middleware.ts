import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicRoutes = ['/login', '/signup'];
const protectedRoutes = ['/analytics', '/api-keys', '/subscribers', '/templates', '/rules', '/settings', '/dashboard']; // Dashboard fallback or base

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for API routes and static assets
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // The cookie is set by the backend. It tells us if the user *might* have a valid session.
  const hasRefreshToken = request.cookies.has('refreshToken');

  // If trying to access public auth routes while already logged in
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    if (hasRefreshToken) {
      return NextResponse.redirect(new URL('/analytics', request.url));
    }
    return NextResponse.next();
  }

  // If trying to access protected routes while NOT logged in
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url);
    // Optional: save the return url
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
