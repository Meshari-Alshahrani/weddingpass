import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionCookieName, verifyAdminSessionToken } from '@/lib/security/adminSession';

/**
 * Next.js 16 Proxy (formerly Middleware).
 *
 * Responsibilities (deliberately minimal):
 * 1. Optimistic early gate for /admin pages — redirect to the login screen
 *    when no valid admin session cookie is present. This is a fast UX guard;
 *    REAL authorization always happens in the DAL and every API route.
 * 2. Hardened CSP with per-request nonce ('strict-dynamic') for scripts.
 *    Rollout is controlled by CSP_MODE: off | report-only | enforce.
 *    Default: report-only in production so the wedding-critical UI can be
 *    validated before enforcement flips on.
 */

const ADMIN_PREFIX = '/admin';
const ADMIN_LOGIN_PATH = '/admin/login';

function buildHardenedCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Inline style attributes are used heavily by Tailwind/Framer Motion; styles
    // are a materially lower XSS vector than scripts, so this stays pragmatic.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}

function resolveCspMode(isDev: boolean): 'off' | 'report-only' | 'enforce' {
  const raw = process.env.CSP_MODE || (isDev ? 'off' : 'report-only');
  if (raw !== 'off' && raw !== 'report-only' && raw !== 'enforce') {
    throw new Error('CSP_MODE must be one of: off, report-only, enforce');
  }
  return raw;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === 'development';

  // ------------------------------------------------------------------
  // 1. Optimistic admin page gate (authorization itself lives in the DAL)
  // ------------------------------------------------------------------
  if (pathname.startsWith(ADMIN_PREFIX) && pathname !== ADMIN_LOGIN_PATH) {
    const token = request.cookies.get(getAdminSessionCookieName())?.value;
    const session = token ? verifyAdminSessionToken(token) : null;
    if (!session || !session.eventId) {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_LOGIN_PATH;
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // ------------------------------------------------------------------
  // 2. Hardened CSP (nonce + strict-dynamic)
  //    Nonce-based CSP requires dynamic rendering; /admin/stress-test is a
  //    pure client utility page kept static, so it is exempt from the header
  //    while still passing the admin gate above.
  // ------------------------------------------------------------------
  const cspMode = resolveCspMode(isDev);
  const cspExempt = pathname.startsWith('/admin/stress-test');

  if (cspMode !== 'off' && !cspExempt) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = buildHardenedCsp(nonce, isDev);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(
      cspMode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      csp
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
