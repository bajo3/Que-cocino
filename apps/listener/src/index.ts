import './logFilter.js';
import 'dotenv/config';
import http from 'node:http';
import QRCode from 'qrcode';
import type { WASocket } from '@whiskeysockets/baileys';
import { loadEnv, logger, type SendRequest } from '@wma/shared';
import { MessageSender } from '@wma/whatsapp';
import {
  dueTaskReminders,
  markTaskReminded,
  insertAction,
  updateAction,
  tasksForDay,
  pendingTasks,
  financeSummary,
  getSetting,
  setSetting,
  getMessageById,
} from '@wma/db';
import { startConnection, connectionState } from './baileys.js';
import { bindHandlers, onReady } from './handlers.js';
import { startWorker, QUEUE_NAMES } from './queue.js';
import { buildDailyBriefText, handleControlCommand } from './control.js';
import { rememberControlEchoSendResult, rememberControlEchoText } from './controlEcho.js';

const env = loadEnv();
const healthPort = env.PORT ?? env.LISTENER_HEALTH_PORT ?? 3001;

let sock: WASocket | null = null;
let sendWorkerStarted = false;
let reminderLoopStarted = false;
let reminderCheckRunning = false;
let dailySummaryLoopStarted = false;

async function main() {
  startHealthServer();
  sock = await startConnection({
    bind: bindHandlers,
    onReady: (s) => {
      sock = s;
      void onReady(s);
      startSendWorker(s);
      startReminderLoop();
      startDailySummaryLoop();
    },
  });
}

function startDailySummaryLoop() {
  if (dailySummaryLoopStarted) return;
  dailySummaryLoopStarted = true;

  const check = async () => {
    if (!sock || !connectionState.connected || !env.CONTROL_CHAT_JID) return;
    if ((await getSetting<boolean>('daily_summary_enabled')) === false) return;

    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    const date = `${value('year')}-${value('month')}-${value('day')}`;
    const hour = Number(value('hour'));
    const configuredHour = Number((await getSetting<number>('daily_summary_hour')) ?? 8);
    const lastDate = await getSetting<string>('daily_summary_last_date');
    if (hour < configuredHour || lastDate === date) return;

    const start = new Date(`${date}T00:00:00-03:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [today, pending, finances] = await Promise.all([
      tasksForDay(start.toISOString(), end.toISOString()),
      pendingTasks(10),
      financeSummary(date.slice(0, 7)),
    ]);
    const income = Number(finances.income ?? 0);
    const expenses = Number(finances.expenses ?? 0);
    const todayLines = today.length
      ? today.map((task: any) => `• ${new Date(task.due_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} ${task.title}`).join('\n')
      : '• Sin tareas con horario';
    const pendingLines = pending
      .filter((task: any) => !today.some((item: any) => item.id === task.id))
      .slice(0, 5)
      .map((task: any) => `• ${task.title}`)
      .join('\n') || '• Nada extra';
    const text = [
      '☀️ *Resumen diario*',
      '',
      '*Hoy*',
      todayLines,
      '',
      '*Otros pendientes*',
      pendingLines,
      '',
      `*Finanzas del mes*: $ ${(income - expenses).toLocaleString('es-AR')} de balance`,
    ].join('\n');
    const actionId = await insertAction({
      actionType: 'daily_summary',
      requestedBy: 'daily_summary_loop',
      sourceChatId: env.CONTROL_CHAT_JID,
      targetChatId: env.CONTROL_CHAT_JID,
      payload: { date, taskCount: today.length, pendingCount: pending.length },
      status: 'validated',
      confidence: 1,
    });
    try {
      await sendControlText(text);
      await updateAction(actionId, { status: 'sent', executedAt: new Date() });
      await setSetting('daily_summary_last_date', date);
    } catch (error) {
      await updateAction(actionId, { status: 'error', error: (error as Error).message });
      throw error;
    }
  };

  void check().catch((error) => logger.error({ err: (error as Error).message }, 'daily summary failed'));
  const timer = setInterval(
    () => void check().catch((error) => logger.error({ err: (error as Error).message }, 'daily summary failed')),
    60_000,
  );
  timer.unref();
  logger.info('daily summary loop started');
}

/**
 * Reminders are a separate, explicitly authorized notification channel.
 * They can only target CONTROL_CHAT_JID and never resolve arbitrary contacts.
 */
function startReminderLoop() {
  if (reminderLoopStarted) return;
  reminderLoopStarted = true;

  const check = async () => {
    if (reminderCheckRunning || !sock || !connectionState.connected || !env.CONTROL_CHAT_JID) return;
    reminderCheckRunning = true;
    try {
      const reminders = await dueTaskReminders(20);
      for (const task of reminders as any[]) {
        const actionId = await insertAction({
          actionType: 'task_reminder',
          requestedBy: 'reminder_loop',
          sourceChatId: env.CONTROL_CHAT_JID,
          targetChatId: env.CONTROL_CHAT_JID,
          payload: { taskId: task.id },
          status: 'validated',
          confidence: 1,
        });
        try {
          const due = task.due_at
            ? `\nVence: ${new Date(task.due_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}`
            : '';
          await sendControlText(`🔔 *Recordatorio*\n${task.title}${due}`);
          await markTaskReminded(task.id);
          await updateAction(actionId, { status: 'sent', executedAt: new Date() });
        } catch (err) {
          await updateAction(actionId, { status: 'error', error: (err as Error).message });
          logger.error({ actionId, taskId: task.id, err: (err as Error).message }, 'task reminder failed');
        }
      }
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'reminder check failed');
    } finally {
      reminderCheckRunning = false;
    }
  };

  void check();
  const timer = setInterval(() => void check(), 30_000);
  timer.unref();
  logger.info('task reminder loop started');
}

/**
 * The listener owns the WhatsApp socket, so it (not the worker) consumes the
 * send-message queue used by the dashboard. Control-chat sends go through the
 * same MessageSender directly in control.ts.
 */
function startSendWorker(s: WASocket) {
  if (sendWorkerStarted) return;
  sendWorkerStarted = true;
  if (env.DISABLE_REDIS_QUEUES) {
    logger.warn('DISABLE_REDIS_QUEUES=true — send-message queue worker disabled');
    return;
  }
  if (!env.REDIS_URL) {
    logger.warn('REDIS_URL not set — send-message queue worker disabled');
    return;
  }
  try {
    const sender = new MessageSender(s);
    const w = startWorker(QUEUE_NAMES.sendMessage, async (job) => {
      const req = job.data as SendRequest;
      const outcome = await sender.send(req);
      return outcome;
    });
    w.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'send job failed'));
    logger.info('send-message worker started');
  } catch (error) {
    logger.error({ err: (error as Error).message }, 'send-message worker disabled after startup failure');
  }
}

async function sendControlText(text: string): Promise<void> {
  if (!sock || !env.CONTROL_CHAT_JID) return;
  rememberControlEchoText(text);
  const result = await sock.sendMessage(env.CONTROL_CHAT_JID, { text });
  rememberControlEchoSendResult(result);
}

function startHealthServer() {
  http
    .createServer(async (req, res) => {
      // Auto-refreshing QR page: always renders the CURRENT QR (Baileys rotates
      // it), so there is no stale-QR problem. Open in a browser and scan.
      if (req.url === '/qr') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        if (connectionState.connected) {
          res.end(qrPage('<h2 style="color:#25D366">✅ WhatsApp vinculado</h2><p>Ya podés cerrar esta pestaña.</p>', false));
          return;
        }
        if (!connectionState.lastQr) {
          res.end(qrPage('<h2>Generando QR…</h2><p>Esperá unos segundos y la página se refresca sola.</p>', true));
          return;
        }
        try {
          const svg = await QRCode.toString(connectionState.lastQr, {
            type: 'svg',
            margin: 2,
            width: 320,
            color: { dark: '#000000', light: '#ffffff' },
          });
          res.end(qrPage(`<h2>Escaneá este QR con WhatsApp</h2><div style="background:#fff;padding:16px;border-radius:12px;display:inline-block">${svg}</div><p>WhatsApp → Dispositivos vinculados → Vincular un dispositivo</p>`, true));
        } catch {
          res.end(qrPage('<h2>Error generando el QR</h2>', true));
        }
        return;
      }
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, service: 'listener', connected: connectionState.connected }));
        return;
      }
      if (req.url === '/commands/reprocess' && req.method === 'POST') {
        const secret = req.headers['x-app-secret'];
        if (!env.APP_SECRET || secret !== env.APP_SECRET) {
          res.writeHead(401, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
        if (!sock || !connectionState.connected) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'whatsapp_not_connected' }));
          return;
        }
        try {
          const body = await readJsonBody(req);
          const messageId = typeof body.messageId === 'string' ? body.messageId : '';
          const message = messageId ? await getMessageById(messageId) : null;
          if (!message?.text_content || !message.chat_id) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'message_not_found' }));
            return;
          }
          const reply = await handleControlCommand(sock, message.text_content, message.id, message.chat_id);
          if (reply && env.CONTROL_CHAT_JID) await sendControlText(reply);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, reply }));
        } catch (error) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
        return;
      }
      if (req.url === '/notify' && req.method === 'POST') {
        const secret = req.headers['x-app-secret'];
        if (!env.APP_SECRET || secret !== env.APP_SECRET) {
          res.writeHead(401, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }
        if (!sock || !connectionState.connected || !env.CONTROL_CHAT_JID) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'whatsapp_not_connected' }));
          return;
        }
        try {
          const body = await readJsonBody(req);
          const text = typeof body.text === 'string' ? body.text.trim() : '';
          if (!text) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'text_required' }));
            return;
          }
          await sendControlText(text);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
        return;
      }
      if (req.url === '/status') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            connected: connectionState.connected,
            me: connectionState.meJid,
            lastConnectedAt: connectionState.lastConnectedAt,
            awaitingQr: !!connectionState.lastQr,
          }),
        );
        return;
      }
      res.writeHead(404).end();
    })
    .listen(healthPort, () => logger.info({ port: healthPort }, 'listener health up'));
}

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function qrPage(body: string, autoRefresh: boolean): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${autoRefresh ? '<meta http-equiv="refresh" content="4">' : ''}
<title>Vincular WhatsApp</title>
<style>body{font-family:system-ui,sans-serif;background:#0b141a;color:#e9edef;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center}p{color:#8696a0}</style>
</head><body><div>${body}</div></body></html>`;
}

main().catch((err) => {
  logger.error({ err: (err as Error).message }, 'listener failed to start');
  process.exit(1);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
