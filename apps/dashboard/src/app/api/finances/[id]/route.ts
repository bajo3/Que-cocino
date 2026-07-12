import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as db from '@wma/db';
import { SESSION_COOKIE, expectedToken } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value === expectedToken();
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const amount = body.amount === undefined || body.amount === '' ? undefined : Number(body.amount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    }

    const updated = await db.updateFinanceEntry(params.id, {
      amount,
      description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : undefined,
      category: typeof body.category === 'string' ? body.category.trim() || null : undefined,
      status: typeof body.status === 'string' && body.status.trim() ? body.status.trim() : undefined,
    });
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    revalidatePath('/finances');
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const updated = await db.updateFinanceEntry(params.id, { status: 'cancelled' });
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    revalidatePath('/finances');
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
