import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

/**
 * Route protection middleware.
 * Auth state is held in React context (client-side), so the middleware cannot
 * read the token directly. We use a lightweight cookie `nerdco_role` that the
 * client sets on login and clears on logout to drive server-side redirects.
 *
 * Security note: this cookie is NOT used for API auth — the JWT token held in
 * React state handles that. The cookie only prevents brief flashes of
 * protected pages before the client context hydrates.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public auth pages
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const role = req.cookies.get('nerdco_role')?.value;

  // Unauthenticated → login
  if (!role) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Role-based path enforcement
  const isOpsPath   = pathname.startsWith('/dashboard') || pathname.startsWith('/incidents') || pathname.startsWith('/analytics') || pathname.startsWith('/admin');
  const isFleetPath = pathname.startsWith('/fleet');
  const isFieldPath = pathname.startsWith('/field');

  if (isOpsPath   && role !== 'system_admin') {
    return NextResponse.redirect(new URL(roleDashboard(role), req.url));
  }
  if (isFleetPath && role !== 'org_admin' && role !== 'system_admin') {
    return NextResponse.redirect(new URL(roleDashboard(role), req.url));
  }
  if (isFieldPath && role !== 'first_responder') {
    return NextResponse.redirect(new URL(roleDashboard(role), req.url));
  }

  return NextResponse.next();
}

function roleDashboard(role: string): string {
  if (role === 'system_admin')    return '/dashboard';
  if (role === 'org_admin')       return '/fleet/dashboard';
  if (role === 'first_responder') return '/field';
  return '/login';
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|api).*)'],
};
