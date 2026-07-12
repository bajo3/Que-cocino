import { NextResponse } from 'next/server';
import * as db from '@wma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    if (!q.trim()) return NextResponse.json([]);
    const onlyAudio = url.searchParams.get('audios') === '1';
    return NextResponse.json(await db.searchMessagesText(q, { onlyAudio, limit: 50 }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
