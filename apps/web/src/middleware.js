import { NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/accept-invite',
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Root is exact-matched; all other public paths are prefix-matched
  if (pathname === '/' || PUBLIC_PATHS.slice(1).some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('token');

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
