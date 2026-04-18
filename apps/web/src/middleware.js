import { NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/pricing',
  '/privacy',
  '/terms',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invite',
];

// Paths where an already-authenticated user should be bounced to the dashboard
const AUTH_PATHS = ['/', '/login', '/register'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token');

  // If user has a token and hits the landing page or auth pages, send them home
  if (token && AUTH_PATHS.some((p) => pathname === p)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Public paths — allow through regardless of token
  if (AUTH_PATHS.includes(pathname) || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|public).*)'],
};
