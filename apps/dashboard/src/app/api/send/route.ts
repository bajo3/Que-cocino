import { NextResponse } from 'next/server';
import { enqueueSend } from '../../../lib/queue';

export const runtime = 'nodejs';

/**
 * Enqueue an outbound message for the listener to execute. The listener applies
 * ALL security validations (auto-send flag, pause, resolution, ambiguity) — the
 * dashboard never sends directly and cannot bypass those checks.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { target, targetType, message } = body ?? {};
    if (!target || !message || !message.trim()) {
      return NextResponse.json({ error: 'target and message are required' }, { status: 400 });
    }
    await enqueueSend({
      target: String(target),
      targetType: targetType === 'group' ? 'group' : 'contact',
      message: String(message),
    });
    return NextResponse.json({ ok: true, queued: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
