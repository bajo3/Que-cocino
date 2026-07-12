import { NextResponse } from 'next/server';
import { Redis } from 'ioredis';
import * as db from '@wma/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    listener: await checkListener(),
    queuesDisabled: String(process.env.DISABLE_REDIS_QUEUES ?? 'false').toLowerCase() === 'true',
  };

  const ok = checks.database.ok && checks.redis.ok && checks.listener.ok && !checks.queuesDisabled;
  return NextResponse.json({ ok, checks });
}

async function checkDatabase() {
  try {
    await db.query('select 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function checkRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return { ok: false, error: 'REDIS_URL not set' };
  const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await redis.connect();
    const pong = await redis.ping();
    return { ok: pong === 'PONG' };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  } finally {
    redis.disconnect();
  }
}

async function checkListener() {
  const rawUrl = process.env.LISTENER_URL ?? process.env.RAILWAY_SERVICE_LISTENER_URL;
  if (!rawUrl) return { ok: false, connected: false, error: 'listener url not set' };
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  try {
    const response = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
    const payload = await response.json();
    return { ok: response.ok && payload.connected === true, connected: payload.connected === true };
  } catch (error) {
    return { ok: false, connected: false, error: (error as Error).message };
  }
}
