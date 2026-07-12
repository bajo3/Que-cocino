import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, expectedToken } from './src/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && token === expectedToken()) {
    return NextResponse.next();
  }
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
