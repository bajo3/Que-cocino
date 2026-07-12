import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as db from '@wma/db';
import { SESSION_COOKIE, expectedToken } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value === expectedToken();
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await db.listFinanceEntries());
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const amount = Number(body.amount);
    if (!['income', 'expense', 'debt'].includes(body.kind) || !Number.isFinite(amount) || amount < 0 || !body.description?.trim()) {
      return NextResponse.json({ error: 'invalid_finance_entry' }, { status: 400 });
    }
    const id = await db.insertFinanceEntry({
      kind: body.kind,
      amount,
      description: body.description.trim(),
      category: body.category?.trim() || null,
      occurredAt: body.occurredAt || null,
      status: body.status || undefined,
    });
    revalidatePath('/finances');
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
