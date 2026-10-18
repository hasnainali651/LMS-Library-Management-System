import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Security headers applied to every response
const baseSecurityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const randomValues = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...Array.from(randomValues)));
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || apiUrl.replace(/\/api(\/v1)?\/?$/, '');
  const apiOrigin = new URL(apiUrl, request.url);
  const socketOrigin = new URL(socketUrl, request.url);
  const connectSources = new Set(["'self'"]);

  if (apiOrigin.protocol === 'http:' || apiOrigin.protocol === 'https:') {
    connectSources.add(apiOrigin.origin);
  }
  if (['http:', 'https:', 'ws:', 'wss:'].includes(socketOrigin.protocol)) {
    const secure = socketOrigin.protocol === 'https:' || socketOrigin.protocol === 'wss:';
    connectSources.add(`${secure ? 'https:' : 'http:'}//${socketOrigin.host}`);
    connectSources.add(`${secure ? 'wss:' : 'ws:'}//${socketOrigin.host}`);
  }
  if (process.env.NODE_ENV === 'development') {
    connectSources.add(`${request.nextUrl.protocol === 'https:' ? 'wss:' : 'ws:'}//${request.nextUrl.host}`);
  }

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: covers.openlibrary.org books.google.com images.unsplash.com",
    `connect-src ${Array.from(connectSources).join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  const securityHeaders = {
    ...baseSecurityHeaders,
    'Content-Security-Policy': csp,
  };
  const requestHeaders = new Headers(request.headers);
  // Next reads the request CSP to nonce its framework and hydration scripts.
  requestHeaders.set('Content-Security-Policy', csp);
  requestHeaders.set('x-nonce', nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // ─── Apply security headers to all responses ────────────────────────────────
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // ─── Route protection: only dashboard routes need auth checks ───────────────
  if (!pathname.startsWith('/dashboard')) {
    return response;
  }

  // 1. Check authentication token
  const token = request.cookies.get('auth_token')?.value;
  const role = request.cookies.get('auth_role')?.value || 'student';

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    Object.entries(securityHeaders).forEach(([key, value]) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  // 2. Redirect /dashboard root by role
  if (pathname === '/dashboard') {
    let redirectPath: string;
    if (role === 'admin') {
      redirectPath = '/dashboard/analytics';
    } else if (role === 'librarian') {
      redirectPath = '/dashboard/circulation';
    } else {
      // Student stays on /dashboard
      return response;
    }
    const redirectResponse = NextResponse.redirect(new URL(redirectPath, request.url));
    Object.entries(securityHeaders).forEach(([key, value]) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  // 3. Block admin-only routes for non-admins
  const adminRoutes = [
    '/dashboard/admin',
    '/dashboard/analytics',
    '/dashboard/settings',
    '/dashboard/audit-log',
    '/dashboard/users',
    '/dashboard/fines',
  ];
  const isAdminRoute = adminRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isAdminRoute && role !== 'admin') {
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
    Object.entries(securityHeaders).forEach(([key, value]) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  // 4. Block librarian routes for students
  const librarianRoutes = [
    '/dashboard/librarian',
    '/dashboard/circulation',
    '/dashboard/books',
    '/dashboard/members',
    '/dashboard/overdue',
  ];
  const isLibrarianRoute = librarianRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isLibrarianRoute && role === 'student') {
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
    Object.entries(securityHeaders).forEach(([key, value]) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
