import { NextResponse, type NextRequest } from 'next/server';
import * as db from '@wma/db';
import { SESSION_COOKIE, expectedToken } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthenticated(req: NextRequest): boolean {
  return req.cookies.get(SESSION_COOKIE)?.value === expectedToken();
}

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated(req)) return unauthorized();
  try {
    const data = await db.getChatWithMessages(decodeURIComponent(params.id), 100);
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated(req)) return unauthorized();
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.readEnabled !== 'boolean') {
      return NextResponse.json({ error: 'readEnabled must be a boolean' }, { status: 400 });
    }
    const updated = await db.setChatReadEnabled(decodeURIComponent(params.id), body.readEnabled);
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, readEnabled: body.readEnabled });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthenticated(req)) return unauthorized();
  try {
    await db.deleteChatData(decodeURIComponent(params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
