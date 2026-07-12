import { NextResponse, type NextRequest } from 'next/server';
import * as db from '@wma/db';
import { SESSION_COOKIE, expectedToken } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value === expectedToken();
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const status = new URL(req.url).searchParams.get('status') ?? undefined;
  return NextResponse.json(await db.listTasks(status));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.title?.trim()) return NextResponse.json({ error: 'title_required' }, { status: 400 });
    const chatId = process.env.CONTROL_CHAT_JID;
    if (!chatId) return NextResponse.json({ error: 'CONTROL_CHAT_JID_not_set' }, { status: 500 });
    const id = await db.insertTask({
      chatId,
      task: {
        title: body.title.trim(),
        priority: body.priority ?? 'normal',
        dueAt: body.dueAt || null,
      },
      remindAt: body.remindAt || null,
      project: body.project?.trim() || null,
      recurrence: body.recurrence || null,
      source: 'dashboard',
    });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
