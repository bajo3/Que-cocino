import { NextResponse } from 'next/server';
import * as db from '@wma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const counts = await db.statusCounts();
    const listenPaused = await db.isListenPaused();
    const sendPaused = await db.isSendPaused();
    return NextResponse.json({ ...counts, listenPaused, sendPaused });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
