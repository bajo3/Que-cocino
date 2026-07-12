import { NextResponse, type NextRequest } from 'next/server';
import * as db from '@wma/db';
import { enqueueSend } from '../../../../lib/queue';
import { SESSION_COOKIE, expectedToken } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (req.cookies.get(SESSION_COOKIE)?.value !== expectedToken()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const draft = await db.getReplyDraft(params.id);
    if (!draft) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (body.action === 'dismiss') {
      return NextResponse.json(await db.updateReplyDraft(params.id, { status: 'dismissed' }));
    }
    if (body.action !== 'send') return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
    const text = typeof body.text === 'string' ? body.text.trim() : draft.draft_text;
    if (!text) return NextResponse.json({ error: 'empty_message' }, { status: 400 });
    await enqueueSend({ targetType: 'contact', target: draft.chat_id, message: text });
    await db.updateReplyDraft(params.id, { status: 'queued', text, sentAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
