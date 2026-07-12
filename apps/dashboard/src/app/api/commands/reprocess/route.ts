import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, expectedToken } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value !== expectedToken()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { messageId } = await req.json();
    if (typeof messageId !== 'string' || !messageId.trim()) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const rawUrl = process.env.LISTENER_URL ?? process.env.RAILWAY_SERVICE_LISTENER_URL;
    const secret = process.env.APP_SECRET;
    if (!rawUrl || !secret) return NextResponse.json({ error: 'listener_not_configured' }, { status: 500 });

    const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const response = await fetch(`${baseUrl}/commands/reprocess`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-secret': secret,
      },
      body: JSON.stringify({ messageId }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: payload.error ?? 'listener_error' }, { status: response.status });
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
