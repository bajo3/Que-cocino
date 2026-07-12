import 'server-only';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUE_NAMES } from '@wma/shared';

let queue: Queue | null = null;

function getSendQueue(): Queue {
  if (queue) return queue;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL not set');
  const connection = new Redis(url, { maxRetriesPerRequest: null });
  queue = new Queue(QUEUE_NAMES.sendMessage, { connection: connection as any });
  return queue;
}

/** Enqueue a send for the listener (which owns the WhatsApp socket) to execute. */
export async function enqueueSend(payload: {
  targetType: 'contact' | 'group';
  target: string;
  message: string;
}): Promise<void> {
  await getSendQueue().add(QUEUE_NAMES.sendMessage, { ...payload, requestedBy: 'dashboard' });
}
