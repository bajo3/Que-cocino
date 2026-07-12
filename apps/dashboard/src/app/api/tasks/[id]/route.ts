import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as db from '@wma/db';
import { SESSION_COOKIE, expectedToken } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (req.cookies.get(SESSION_COOKIE)?.value !== expectedToken()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    let updated;
    if (body.action === 'complete' || body.status === 'done') updated = await db.completeTask(params.id);
    else if (body.action === 'snooze' && body.until) updated = await db.snoozeTask(params.id, body.until);
    else updated = await db.updateTask(params.id, body);
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    revalidatePath('/tasks');
    revalidatePath('/calendar');
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
