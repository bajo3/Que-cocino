import { NextResponse } from 'next/server';
import * as db from '@wma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await db.getContactDetail(decodeURIComponent(params.id));
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await db.deleteContactData(decodeURIComponent(params.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
