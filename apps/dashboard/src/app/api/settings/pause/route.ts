import { NextResponse } from 'next/server';
import * as db from '@wma/db';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await db.setListenPaused(true);
    return NextResponse.json({ ok: true, listenPaused: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
