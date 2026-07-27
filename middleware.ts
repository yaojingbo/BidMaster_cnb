import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const authDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true';

export function middleware(request: NextRequest) {
  if (authDisabled) {
    return NextResponse.next();
  }

  const authStatus = request.cookies.get('auth_status');
  const isAuthenticated = authStatus?.value === '1';
  const pathname = request.nextUrl.pathname;

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/register'],
};
