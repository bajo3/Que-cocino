import { NextResponse } from 'next/server';
import * as db from '@wma/db';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await db.setSendPaused(false);
    return NextResponse.json({ ok: true, sendPaused: false });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
