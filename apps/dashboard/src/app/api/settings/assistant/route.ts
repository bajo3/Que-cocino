import { NextResponse, type NextRequest } from 'next/server';
import * as db from '@wma/db';
import { SESSION_COOKIE, expectedToken } from '../../../../lib/auth';

export async function PATCH(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value !== expectedToken()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const hour = Math.max(0, Math.min(23, Number(body.dailySummaryHour ?? 8)));
    await Promise.all([
      db.setSetting('daily_summary_enabled', body.dailySummaryEnabled === true),
      db.setSetting('daily_summary_hour', hour),
      db.setSetting('draft_replies_enabled', body.draftRepliesEnabled === true),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
