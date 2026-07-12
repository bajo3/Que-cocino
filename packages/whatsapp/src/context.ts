import {
  recentMessages,
  getChatSummary,
  getContactProfile,
  matchMessagesByEmbedding,
  query,
} from '@wma/db';
import { AIProcessor } from '@wma/ai';
import { isGroupJid, type BuiltContext, type ContextMessage, type DetectedTask } from '@wma/shared';

function toContextMessage(row: any): ContextMessage {
  return {
    id: row.id,
    fromMe: !!row.from_me,
    senderId: row.sender_id ?? null,
    text: row.text_content ?? '',
    timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : '',
  };
}

/**
 * Assemble bounded context for a chat (spec §12). Never dumps full history into
 * the model: last 20 messages + summary + profile + pending tasks + relevant
 * semantic matches + recent audio transcripts.
 */
export async function buildContext(chatId: string, opts: { query?: string; ai?: AIProcessor } = {}): Promise<BuiltContext> {
  const ai = opts.ai ?? new AIProcessor();

  const recentRows = await recentMessages(chatId, 20);
  const recent = recentRows.map(toContextMessage).reverse();

  const summaryRow = await getChatSummary(chatId);
  const chatSummary: string = summaryRow?.summary ?? '';
  const pendingTasks: DetectedTask[] = Array.isArray(summaryRow?.pending_tasks) ? summaryRow!.pending_tasks : [];

  let contactProfile = null;
  if (!isGroupJid(chatId)) {
    const p = await getContactProfile(chatId);
    if (p) {
      contactProfile = {
        commercialSummary: p.commercial_summary ?? '',
        interests: p.interests ?? [],
        vehicles: p.vehicles ?? [],
        promises: p.promises ?? [],
        objections: p.objections ?? [],
        lastIntent: p.last_intent ?? null,
        priorityScore: p.priority_score ?? 0,
      };
    }
  }

  // Semantic search seed: explicit query, else the latest inbound text.
  const seed = opts.query ?? recent.filter((m) => !m.fromMe).at(-1)?.text ?? '';
  let relevantSemanticMessages: ContextMessage[] = [];
  if (seed.trim()) {
    try {
      const embedding = await ai.createEmbedding(seed);
      const matches = await matchMessagesByEmbedding(embedding, chatId, 6);
      relevantSemanticMessages = matches.map((m) => ({
        id: m.message_id,
        fromMe: false,
        senderId: null,
        text: m.content,
        timestamp: '',
      }));
    } catch {
      relevantSemanticMessages = [];
    }
  }

  const { rows: audioRows } = await query(
    `select message_id, transcript, from_me, created_at from wa_audio_transcripts
     where chat_id = $1 and transcript is not null order by created_at desc limit 5`,
    [chatId],
  );
  const audioTranscripts: ContextMessage[] = audioRows.map((r: any) => ({
    id: r.message_id,
    fromMe: !!r.from_me,
    senderId: null,
    text: r.transcript ?? '',
    timestamp: r.created_at ? new Date(r.created_at).toISOString() : '',
  }));

  return { recentMessages: recent, chatSummary, contactProfile, pendingTasks, relevantSemanticMessages, audioTranscripts };
}
