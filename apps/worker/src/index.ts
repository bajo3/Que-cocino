import 'dotenv/config';
import http from 'node:http';
import { loadEnv, logger } from '@wma/shared';
import { startWorker, QUEUE_NAMES } from './queue.js';
import {
  processMessage,
  generateEmbedding,
  summarizeChat,
  transcribeAudioJob,
  classifyMessageJob,
  detectTaskJob,
} from './processors.js';

const env = loadEnv();
const healthPort = env.PORT ?? env.WORKER_HEALTH_PORT ?? 3002;

let workers: ReturnType<typeof startWorker>[] = [];

function startQueueWorkers() {
  if (env.DISABLE_REDIS_QUEUES) {
    logger.warn('DISABLE_REDIS_QUEUES=true — queue workers disabled');
    return;
  }

  workers = [
    startWorker(QUEUE_NAMES.processMessage, processMessage),
    startWorker(QUEUE_NAMES.classifyMessage, classifyMessageJob),
    startWorker(QUEUE_NAMES.detectTask, detectTaskJob),
    startWorker(QUEUE_NAMES.generateEmbedding, generateEmbedding),
    startWorker(QUEUE_NAMES.summarizeChat, summarizeChat),
    startWorker(QUEUE_NAMES.transcribeAudio, transcribeAudioJob),
  ];

  for (const w of workers) {
    w.on('failed', (job, err) => logger.error({ queue: w.name, jobId: job?.id, err: err.message }, 'job failed'));
    w.on('completed', (job) => logger.debug({ queue: w.name, jobId: job.id }, 'job completed'));
  }

  logger.info({ queues: workers.map((w) => w.name) }, 'worker started');
}

// Health endpoint.
http
  .createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'worker', queues: workers.map((w) => w.name) }));
      return;
    }
    res.writeHead(404).end();
  })
  .listen(healthPort, () => {
    logger.info({ port: healthPort }, 'worker health up');
    startQueueWorkers();
  });

async function shutdown() {
  logger.info('worker shutting down');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
