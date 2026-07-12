import type { Job } from 'bullmq';
import { AIProcessor, transcribeAudio } from '@wma/ai';
import {
  getMessageById,
  recentMessages,
  applyClassification,
  insertTask,
  upsertEmbedding,
  upsertChatSummary,
  upsertContactProfile,
  completeTranscript,
  failTranscript,
  downloadMedia,
  query,
  getSetting,
  getStyleProfile,
  recentOwnMessages,
  upsertStyleProfile,
  upsertReplyDraft,
} from '@wma/db';
import { isGroupJid, logger, loadEnv } from '@wma/shared';
import { enqueue, QUEUE_NAMES } from './queue.js';

const ai = new AIProcessor();

// process-message: classify + detect tasks, then fan out embedding + summary.
export async function processMessage(job: Job): Promise<void> {
  const { messageId } = job.data as { messageId: string };
  const msg = await getMessageById(messageId);
  if (!msg) {
    logger.warn({ messageId }, 'process-message: message not found');
    return;
  }
  const text: string = msg.text_content ?? '';
  if (!text.trim()) return; // nothing to analyse (e.g. media without caption/transcript yet)

  const chatId: string = msg.chat_id;
  const fromMe: boolean = msg.from_me;
  const isGroup = isGroupJid(chatId);
  const contactId = isGroup ? null : chatId;

  const { classification, tasks } = await ai.analyzeMessage({ text, fromMe, isGroup });
  await applyClassification({ chatId, contactId, classification });

  for (const t of tasks) {
    await insertTask({ chatId, contactId, task: t, sourceMessageId: messageId });
  }

  if (fromMe && !isGroup) {
    await refreshStyleProfile().catch((error) =>
      logger.warn({ err: (error as Error).message }, 'style profile refresh skipped'),
    );
  }

  if (tasks.length > 0 && !fromMe && !isGroup) {
    await enqueue(
      QUEUE_NAMES.sendMessage,
      {
        targetType: 'contact',
        target: chatId,
        message: 'Dale, me lo agendo 👍',
        requestedBy: 'task_auto_ack',
        sourceChatId: chatId,
        confidence: 1,
      },
      `task_ack_${messageId.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    );
  }

  if (tasks.length === 0 && !fromMe && !isGroup && (await getSetting<boolean>('draft_replies_enabled')) !== false) {
    await createReplyDraft(chatId, messageId, text).catch((error) =>
      logger.warn({ messageId, chatId, err: (error as Error).message }, 'reply draft generation skipped'),
    );
  }

  await enqueue(QUEUE_NAMES.generateEmbedding, { messageId, chatId, text });
  // BullMQ forbids ':' in custom job ids — sanitize the chat id.
  await enqueue(QUEUE_NAMES.summarizeChat, { chatId, contactId }, `summary_${chatId.replace(/[^a-zA-Z0-9]/g, '_')}`);

  logger.info(
    { messageId, chatId, class: classification.class, hot: classification.isHotLead, tasks: tasks.length },
    'message processed',
  );
}

async function refreshStyleProfile(): Promise<void> {
  const messages = await recentOwnMessages(80);
  if (messages.length < 5) return;
  const existing = await getStyleProfile();
  if (existing && messages.length < Number(existing.sample_count ?? 0) + 10) return;
  const profile = await ai.buildStyleProfile(messages);
  if (!profile) return;
  const env = loadEnv();
  await upsertStyleProfile(profile, messages.length, env.ZAI_FAST_MODEL);
}

async function createReplyDraft(chatId: string, messageId: string, incomingText: string): Promise<void> {
  const [style, rows] = await Promise.all([getStyleProfile(), recentMessages(chatId, 12)]);
  const messages = rows
    .map((row: any) => ({ fromMe: !!row.from_me, text: row.text_content ?? '' }))
    .filter((message) => message.text.trim())
    .reverse();
  const draft = await ai.generateReplyDraft({
    contactName: chatId,
    incomingText,
    recentMessages: messages,
    styleProfile: style?.profile ?? null,
  });
  if (!draft.text.trim()) return;
  const env = loadEnv();
  await upsertReplyDraft({
    chatId,
    sourceMessageId: messageId,
    text: draft.text,
    confidence: draft.confidence,
    model: env.ZAI_FAST_MODEL,
  });
}

export async function generateEmbedding(job: Job): Promise<void> {
  const { messageId, chatId, text } = job.data as { messageId: string; chatId: string; text: string };
  if (!text?.trim()) return;
  const embedding = await ai.createEmbedding(text);
  await upsertEmbedding({ messageId, chatId, content: text.slice(0, 2000), embedding });
}

export async function summarizeChat(job: Job): Promise<void> {
  const { chatId, contactId } = job.data as { chatId: string; contactId: string | null };
  const rows = await recentMessages(chatId, 40);
  const messages = rows
    .map((r: any) => ({ fromMe: !!r.from_me, text: r.text_content ?? '' }))
    .filter((m) => m.text.trim())
    .reverse();
  if (messages.length === 0) return;

  const chatName = contactId ?? chatId;
  const summary = await ai.summarizeChat({ chatName, messages });
  await upsertChatSummary(chatId, summary, rows[0]?.id ?? null);

  if (contactId && !isGroupJid(chatId)) {
    const profile = await ai.updateContactProfile({ contactName: chatName, messages });
    await upsertContactProfile(contactId, profile);
  }
}

// transcribe-audio: pull file from Storage, transcribe, persist, re-process.
export async function transcribeAudioJob(job: Job): Promise<void> {
  const env = loadEnv();
  const { transcriptId, storagePath, mime, messageId, chatId } = job.data as {
    transcriptId: string;
    storagePath: string;
    mime: string;
    messageId: string;
    chatId: string;
  };

  if (!env.ENABLE_AUDIO_TRANSCRIPTION) {
    logger.info({ transcriptId }, 'transcription disabled — skipping');
    return;
  }

  try {
    const buffer = await downloadMedia(storagePath);
    const text = await transcribeAudio(buffer, { mime });
    if (!text) {
      await failTranscript(transcriptId, 'No transcript returned by the configured audio provider');
      return;
    }
    await completeTranscript(transcriptId, text);
    // Use the transcript as processable content for the message.
    await query('update wa_messages set text_content = $2, updated_at = now() where id = $1 and (text_content is null or text_content = $3)', [
      messageId,
      text,
      '',
    ]);
    await enqueue(QUEUE_NAMES.processMessage, { messageId, chatId });
    const message = await getMessageById(messageId);
    await reprocessControlAudioCommand({ messageId, chatId, fromMe: !!message?.from_me });
    logger.info({ transcriptId, messageId }, 'audio transcribed');
  } catch (err) {
    const m = (err as Error).message;
    await failTranscript(transcriptId, m);
    logger.error({ transcriptId, err: m }, 'transcription failed');
    // Do not rethrow indefinitely — the audio file is safely stored; surface as failed.
  }
}

async function reprocessControlAudioCommand(params: { messageId: string; chatId: string; fromMe: boolean }): Promise<void> {
  const env = loadEnv();
  if (!params.fromMe) return;
  if (!env.CONTROL_CHAT_JID || params.chatId !== env.CONTROL_CHAT_JID) return;
  const rawUrl = process.env.LISTENER_URL ?? process.env.RAILWAY_SERVICE_LISTENER_URL;
  if (!rawUrl || !env.APP_SECRET) return;
  const baseUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/commands/reprocess`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-secret': env.APP_SECRET,
      },
      body: JSON.stringify({ messageId: params.messageId }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      logger.warn({ messageId: params.messageId, status: response.status }, 'control audio reprocess rejected');
    }
  } catch (error) {
    logger.warn({ messageId: params.messageId, err: (error as Error).message }, 'control audio reprocess failed');
  }
}

// Standalone classify/detect jobs (kept for completeness / manual reprocessing).
export async function classifyMessageJob(job: Job): Promise<void> {
  await processMessage(job);
}
export async function detectTaskJob(job: Job): Promise<void> {
  await processMessage(job);
}
