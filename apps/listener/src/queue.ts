import { Queue, Worker, type Processor, type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { loadEnv, QUEUE_NAMES, type QueueName } from '@wma/shared';

let connection: ConnectionOptions | null = null;

export function getConnection(): ConnectionOptions {
  if (connection) return connection;
  const env = loadEnv();
  if (env.DISABLE_REDIS_QUEUES) throw new Error('Redis queues disabled by DISABLE_REDIS_QUEUES.');
  if (!env.REDIS_URL) throw new Error('REDIS_URL is not set — queues unavailable.');
  connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;
  return connection;
}

const queues = new Map<QueueName, Queue>();
export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: getConnection() });
    queues.set(name, q);
  }
  return q;
}

export async function enqueue(name: QueueName, data: unknown, jobId?: string): Promise<void> {
  try {
    await getQueue(name).add(name, data, {
      jobId,
      removeOnComplete: 1000,
      removeOnFail: 5000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  } catch (err) {
    // Never let a queueing failure lose a message — it is already persisted.
    // The dashboard can re-trigger processing later.
    // eslint-disable-next-line no-console
    console.error('[listener] enqueue failed', name, (err as Error).message);
  }
}

export function startWorker(name: QueueName, processor: Processor): Worker {
  const worker = new Worker(name, processor, { connection: getConnection(), concurrency: 2 });
  worker.on('error', (err) => {
    // Keep queue errors from taking down the WhatsApp listener.
    // eslint-disable-next-line no-console
    console.error('[listener] worker error', name, err.message);
  });
  return worker;
}

export { QUEUE_NAMES };
