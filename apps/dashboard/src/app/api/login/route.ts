import { NextResponse } from 'next/server';
import { SESSION_COOKIE, expectedToken, checkCredentials } from '../../../lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { user, password } = await req.json().catch(() => ({ user: '', password: '' }));
  if (!checkCredentials(user, password)) {
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
