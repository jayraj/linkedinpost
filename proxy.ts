import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Basic-auth guard for /dashboard (Next 16: this file convention replaced middleware.ts).
 * Runs before the route — env is read directly (no shared modules in proxy).
 * If DASHBOARD_USER / DASHBOARD_PASSWORD are unset, access is allowed (local dev convenience).
 */
export function proxy(request: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;

  if (user && pass) {
    const auth = request.headers.get('authorization');
    const expected = 'Basic ' + btoa(`${user}:${pass}`);
    if (auth !== expected) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Agile Post Agent Dashboard"' },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*',
};
