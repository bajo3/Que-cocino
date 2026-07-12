import { query } from './pool.js';
import type {
  NormalizedMessage,
  ChatUpsert,
  ContactUpsert,
  ChatSummary,
  ContactProfile,
  DetectedTask,
  MessageClassification,
} from '@wma/shared';
import { isGroupJid } from '@wma/shared';

// ---------------------------------------------------------------------------
// Accounts / chats / contacts
// ---------------------------------------------------------------------------

export async function ensureAccount(jid: string, phone?: string, displayName?: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into wa_accounts(jid, phone, display_name)
     values ($1, $2, $3)
     on conflict (jid) do update set
       phone = coalesce(excluded.phone, wa_accounts.phone),
       display_name = coalesce(excluded.display_name, wa_accounts.display_name),
       updated_at = now()
     returning id`,
    [jid, phone ?? null, displayName ?? null],
  );
  return rows[0]!.id;
}

export async function upsertChat(c: ChatUpsert, accountId?: string | null): Promise<void> {
  await query(
    `insert into wa_chats(id, account_id, type, name, subject, is_group, last_message_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (id) do update set
       account_id = coalesce(excluded.account_id, wa_chats.account_id),
       type = coalesce(excluded.type, wa_chats.type),
       name = coalesce(excluded.name, wa_chats.name),
       subject = coalesce(excluded.subject, wa_chats.subject),
       is_group = excluded.is_group,
       last_message_at = greatest(coalesce(excluded.last_message_at, wa_chats.last_message_at), wa_chats.last_message_at),
       updated_at = now()`,
    [
      c.id,
      accountId ?? null,
      c.type ?? (c.isGroup ? 'group' : 'private'),
      c.name ?? null,
      c.subject ?? null,
      c.isGroup,
      c.lastMessageAt ?? null,
    ],
  );
}

/** Whether the operator explicitly allowed message ingestion for this chat. */
export async function isChatReadEnabled(chatId: string): Promise<boolean> {
  const { rows } = await query<{ read_enabled: boolean }>(
    `select read_enabled from wa_chats where id = $1`,
    [chatId],
  );
  return rows[0]?.read_enabled === true;
}

/** Enable/disable future ingestion without deleting previously saved history. */
export async function setChatReadEnabled(chatId: string, enabled: boolean): Promise<boolean> {
  const { rowCount } = await query(
    `update wa_chats
     set read_enabled = $2,
         read_enabled_at = case when $2 then now() else null end,
         updated_at = now()
     where id = $1`,
    [chatId, enabled],
  );
  return (rowCount ?? 0) > 0;
}

export async function upsertContact(c: ContactUpsert, accountId?: string | null): Promise<void> {
  await query(
    `insert into wa_contacts(id, account_id, phone, name, push_name, business_name, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (id) do update set
       account_id = coalesce(excluded.account_id, wa_contacts.account_id),
       phone = coalesce(excluded.phone, wa_contacts.phone),
       name = coalesce(excluded.name, wa_contacts.name),
       push_name = coalesce(excluded.push_name, wa_contacts.push_name),
       business_name = coalesce(excluded.business_name, wa_contacts.business_name),
       updated_at = now()`,
    [c.id, accountId ?? null, c.phone ?? null, c.name ?? null, c.pushName ?? null, c.businessName ?? null],
  );

  // Chats and contacts can share a LID. Keep the chat display name in sync
  // whenever WhatsApp later sends richer contact metadata.
  await query(
    `update wa_chats ch
     set name = coalesce(ct.name, ct.business_name, ct.push_name, ch.name),
         updated_at = now()
     from wa_contacts ct
     where ch.id = $1 and ct.id = $1 and ch.is_group = false`,
    [c.id],
  );
}

/**
 * Link WhatsApp's private LID identity to its phone-number JID and propagate
 * the best known contact name to the LID-backed chat.
 */
export async function linkContactIdentity(
  lid: string,
  phoneJid: string,
  accountId?: string | null,
): Promise<void> {
  const phone = phoneJid.split('@')[0]?.split(':')[0] ?? null;

  await query(
    `insert into wa_contacts(id, account_id, phone, updated_at)
     values ($1, $3, $4, now()), ($2, $3, $4, now())
     on conflict (id) do update set
       account_id = coalesce(excluded.account_id, wa_contacts.account_id),
       phone = coalesce(excluded.phone, wa_contacts.phone),
       updated_at = now()`,
    [lid, phoneJid, accountId ?? null, phone],
  );

  await query(
    `update wa_contacts lid
     set phone = coalesce(pn.phone, lid.phone, $3),
         name = coalesce(pn.name, lid.name),
         push_name = coalesce(lid.push_name, pn.push_name),
         business_name = coalesce(pn.business_name, lid.business_name),
         updated_at = now()
     from wa_contacts pn
     where lid.id = $1 and pn.id = $2`,
    [lid, phoneJid, phone],
  );

  await query(
    `update wa_chats ch
     set name = coalesce(ct.name, ct.business_name, ct.push_name, ch.name),
         updated_at = now()
     from wa_contacts ct
     where ch.id = $1 and ct.id = $1 and ch.is_group = false`,
    [lid],
  );
}

export async function upsertGroupParticipant(groupId: string, contactId: string, role?: string): Promise<void> {
  await query(
    `insert into wa_group_participants(group_id, contact_id, role, updated_at)
     values ($1, $2, $3, now())
     on conflict (group_id, contact_id) do update set role = coalesce(excluded.role, wa_group_participants.role), updated_at = now()`,
    [groupId, contactId, role ?? null],
  );
}

// ---------------------------------------------------------------------------
// Messages  (security rule: persist FIRST, process later)
// ---------------------------------------------------------------------------

export async function insertMessage(m: NormalizedMessage, accountId?: string | null): Promise<boolean> {
  const { rowCount } = await query(
    `insert into wa_messages(
       id, account_id, chat_id, sender_id, from_me, message_type, text_content,
       quoted_message_id, media_mime_type, media_file_size, raw_json, timestamp, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12, now())
     on conflict (id) do nothing`,
    [
      m.id,
      accountId ?? null,
      m.chatId,
      m.senderId,
      m.fromMe,
      m.messageType,
      m.textContent,
      m.quotedMessageId,
      m.mediaMimeType,
      m.mediaFileSize,
      JSON.stringify(m.raw ?? null),
      m.timestamp,
    ],
  );
  return (rowCount ?? 0) > 0;
}

export async function setMessageMediaUrl(messageId: string, url: string): Promise<void> {
  await query('update wa_messages set media_url = $2, updated_at = now() where id = $1', [messageId, url]);
}

export async function getMessageById(id: string) {
  const { rows } = await query(`select * from wa_messages where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function recentMessages(chatId: string, limit = 20) {
  const { rows } = await query(
    `select id, sender_id, from_me, message_type, text_content, timestamp
     from wa_messages where chat_id = $1 order by timestamp desc limit $2`,
    [chatId, limit],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Audio transcripts
// ---------------------------------------------------------------------------

export async function createAudioTranscript(params: {
  messageId: string;
  chatId: string;
  senderId: string | null;
  fromMe: boolean;
  durationSeconds?: number | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into wa_audio_transcripts(message_id, chat_id, sender_id, from_me, duration_seconds, transcript_status)
     values ($1,$2,$3,$4,$5,'pending')
     returning id`,
    [params.messageId, params.chatId, params.senderId, params.fromMe, params.durationSeconds ?? null],
  );
  return rows[0]!.id;
}

export async function setAudioUrl(id: string, audioUrl: string): Promise<void> {
  await query('update wa_audio_transcripts set audio_url = $2, updated_at = now() where id = $1', [id, audioUrl]);
}

export async function completeTranscript(id: string, transcript: string): Promise<void> {
  await query(
    `update wa_audio_transcripts set transcript = $2, transcript_status = 'done', error = null, updated_at = now() where id = $1`,
    [id, transcript],
  );
}

export async function failTranscript(id: string, error: string): Promise<void> {
  await query(
    `update wa_audio_transcripts set transcript_status = 'error', error = $2, updated_at = now() where id = $1`,
    [id, error.slice(0, 500)],
  );
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export async function upsertEmbedding(params: {
  messageId: string;
  chatId: string;
  content: string;
  embedding: number[];
}): Promise<void> {
  const vec = `[${params.embedding.join(',')}]`;
  await query(
    `insert into wa_message_embeddings(message_id, chat_id, content, embedding)
     values ($1, $2, $3, $4::vector)`,
    [params.messageId, params.chatId, params.content, vec],
  );
}

// ---------------------------------------------------------------------------
// Summaries / profiles
// ---------------------------------------------------------------------------

export async function getChatSummary(chatId: string) {
  const { rows } = await query(`select * from wa_chat_summaries where chat_id = $1 order by updated_at desc limit 1`, [
    chatId,
  ]);
  return rows[0] ?? null;
}

export async function upsertChatSummary(chatId: string, s: ChatSummary, lastMessageId?: string | null): Promise<void> {
  const existing = await getChatSummary(chatId);
  if (existing) {
    await query(
      `update wa_chat_summaries set summary = $2, facts = $3::jsonb, pending_tasks = $4::jsonb, last_message_id = $5, updated_at = now() where id = $1`,
      [existing.id, s.summary, JSON.stringify(s.facts ?? {}), JSON.stringify(s.pendingTasks ?? []), lastMessageId ?? null],
    );
  } else {
    await query(
      `insert into wa_chat_summaries(chat_id, summary, facts, pending_tasks, last_message_id)
       values ($1, $2, $3::jsonb, $4::jsonb, $5)`,
      [chatId, s.summary, JSON.stringify(s.facts ?? {}), JSON.stringify(s.pendingTasks ?? []), lastMessageId ?? null],
    );
  }
}

export async function getContactProfile(contactId: string) {
  const { rows } = await query(`select * from wa_contact_profiles where contact_id = $1`, [contactId]);
  return rows[0] ?? null;
}

export async function upsertContactProfile(contactId: string, p: ContactProfile): Promise<void> {
  await query(
    `insert into wa_contact_profiles(contact_id, commercial_summary, interests, vehicles, promises, objections, last_intent, priority_score, updated_at)
     values ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8, now())
     on conflict (contact_id) do update set
       commercial_summary = excluded.commercial_summary,
       interests = excluded.interests,
       vehicles = excluded.vehicles,
       promises = excluded.promises,
       objections = excluded.objections,
       last_intent = excluded.last_intent,
       priority_score = excluded.priority_score,
       updated_at = now()`,
    [
      contactId,
      p.commercialSummary,
      JSON.stringify(p.interests ?? []),
      JSON.stringify(p.vehicles ?? []),
      JSON.stringify(p.promises ?? []),
      JSON.stringify(p.objections ?? []),
      p.lastIntent,
      p.priorityScore ?? 0,
    ],
  );
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function insertTask(params: {
  chatId: string;
  contactId?: string | null;
  task: DetectedTask;
  sourceMessageId?: string | null;
  project?: string | null;
  remindAt?: string | null;
  source?: string;
  recurrence?: string | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into wa_tasks(
       chat_id, contact_id, title, description, priority, due_at,
       source_message_id, project, remind_at, source, recurrence
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (source_message_id, lower(title)) where source_message_id is not null
     do update set updated_at = now()
     returning id`,
    [
      params.chatId,
      params.contactId ?? null,
      params.task.title,
      params.task.description ?? null,
      params.task.priority ?? 'normal',
      params.task.dueAt ?? null,
      params.sourceMessageId ?? null,
      params.project ?? null,
      params.remindAt ?? null,
      params.source ?? 'detected',
      params.recurrence ?? null,
    ],
  );
  return rows[0]!.id;
}

// ---------------------------------------------------------------------------
// Classification side-effects (priority bumping for hot leads)
// ---------------------------------------------------------------------------

export async function applyClassification(params: {
  chatId: string;
  contactId: string | null;
  classification: MessageClassification;
}): Promise<void> {
  const bump = params.classification.isHotLead ? 10 : params.classification.priority === 'urgent' ? 8 : 1;
  await query(`update wa_chats set priority_score = priority_score + $2, updated_at = now() where id = $1`, [
    params.chatId,
    bump,
  ]);
  if (params.contactId && !isGroupJid(params.contactId)) {
    await query(
      `update wa_contacts set priority_score = priority_score + $2, updated_at = now() where id = $1`,
      [params.contactId, bump],
    );
  }
}

// ---------------------------------------------------------------------------
// Actions / command logs (audit trail)
// ---------------------------------------------------------------------------

export async function insertAction(params: {
  actionType: string;
  requestedBy?: string | null;
  sourceChatId?: string | null;
  targetChatId?: string | null;
  targetContactId?: string | null;
  payload?: unknown;
  status?: string;
  confidence?: number | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into wa_actions(action_type, requested_by, source_chat_id, target_chat_id, target_contact_id, payload, status, confidence)
     values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
     returning id`,
    [
      params.actionType,
      params.requestedBy ?? null,
      params.sourceChatId ?? null,
      params.targetChatId ?? null,
      params.targetContactId ?? null,
      JSON.stringify(params.payload ?? {}),
      params.status ?? 'pending',
      params.confidence ?? null,
    ],
  );
  return rows[0]!.id;
}

export async function updateAction(
  id: string,
  patch: { status?: string; error?: string | null; executedAt?: Date | null },
): Promise<void> {
  await query(
    `update wa_actions set
       status = coalesce($2, status),
       error = $3,
       executed_at = coalesce($4, executed_at)
     where id = $1`,
    [id, patch.status ?? null, patch.error ?? null, patch.executedAt ?? null],
  );
}

export async function outboundSafetySnapshot(params: {
  targetChatId: string;
  messageHash: string;
  since: Date;
  duplicateSince: Date;
}): Promise<{
  sentGloballyInWindow: number;
  sentToTargetInWindow: number;
  lastSentToTargetAt: Date | null;
  duplicateSentAt: Date | null;
}> {
  const { rows } = await query<{
    global_count: string;
    target_count: string;
    last_target_sent_at: Date | null;
    duplicate_sent_at: Date | null;
  }>(
    `select
       count(*) filter (
         where status = 'sent'
           and action_type in ('send_message', 'send_group')
           and executed_at >= $2
       )::text as global_count,
       count(*) filter (
         where status = 'sent'
           and action_type in ('send_message', 'send_group')
           and target_chat_id = $1
           and executed_at >= $2
       )::text as target_count,
       max(executed_at) filter (
         where status = 'sent'
           and action_type in ('send_message', 'send_group')
           and target_chat_id = $1
       ) as last_target_sent_at,
       max(executed_at) filter (
         where status = 'sent'
           and action_type in ('send_message', 'send_group')
           and target_chat_id = $1
           and payload->>'messageHash' = $4
           and executed_at >= $3
       ) as duplicate_sent_at
     from wa_actions`,
    [params.targetChatId, params.since, params.duplicateSince, params.messageHash],
  );

  const row = rows[0];
  return {
    sentGloballyInWindow: Number(row?.global_count ?? 0),
    sentToTargetInWindow: Number(row?.target_count ?? 0),
    lastSentToTargetAt: row?.last_target_sent_at ? new Date(row.last_target_sent_at) : null,
    duplicateSentAt: row?.duplicate_sent_at ? new Date(row.duplicate_sent_at) : null,
  };
}

export async function insertCommandLog(params: {
  sourceMessageId?: string | null;
  commandText: string;
  parsedIntent?: string | null;
  parsedPayload?: unknown;
  status?: string;
  error?: string | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into wa_command_logs(source_message_id, command_text, parsed_intent, parsed_payload, status, error)
     values ($1,$2,$3,$4::jsonb,$5,$6)
     returning id`,
    [
      params.sourceMessageId ?? null,
      params.commandText,
      params.parsedIntent ?? null,
      JSON.stringify(params.parsedPayload ?? {}),
      params.status ?? 'received',
      params.error ?? null,
    ],
  );
  return rows[0]!.id;
}

export async function updateCommandLog(id: string, patch: { status?: string; error?: string | null }): Promise<void> {
  await query(`update wa_command_logs set status = coalesce($2, status), error = $3 where id = $1`, [
    id,
    patch.status ?? null,
    patch.error ?? null,
  ]);
}
