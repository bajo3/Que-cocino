import { query } from './pool.js';

export interface ContactSearchRow {
  contactId: string;
  chatId: string;
  displayName: string;
  phone: string | null;
  name: string | null;
  pushName: string | null;
  alias: string | null;
  lastMessageAt: string | null;
}

/**
 * Raw candidate fetch used by ContactResolver. Returns non-group contacts that
 * match the term across name / push_name / business_name / phone / alias, plus
 * recency info for scoring. Resolver does the scoring; this just gathers rows.
 */
export async function findContactCandidates(term: string): Promise<ContactSearchRow[]> {
  const like = `%${term.toLowerCase()}%`;
  const digits = term.replace(/\D/g, '');
  const phoneLike = digits ? `%${digits}%` : '__no_phone__';

  const { rows } = await query<ContactSearchRow>(
    `select
        c.id as "contactId",
        c.id as "chatId",
        coalesce(c.name, c.push_name, c.business_name, c.phone, c.id) as "displayName",
        c.phone as phone,
        c.name as name,
        c.push_name as "pushName",
        a.alias as alias,
        ch.last_message_at::text as "lastMessageAt"
     from wa_contacts c
     left join wa_contact_aliases a on a.contact_id = c.id
     left join wa_chats ch on ch.id = c.id
     where c.id not like '%@g.us'
       and (
         lower(coalesce(c.name,'')) like $1
         or lower(coalesce(c.push_name,'')) like $1
         or lower(coalesce(c.business_name,'')) like $1
         or coalesce(c.phone,'') like $2
         or lower(coalesce(a.alias,'')) like $1
       )
     limit 50`,
    [like, phoneLike],
  );
  return rows;
}

/** Exact JID lookup (highest-confidence path for the resolver). */
export async function findContactByExactJid(jid: string): Promise<ContactSearchRow | null> {
  const { rows } = await query<ContactSearchRow>(
    `select c.id as "contactId", c.id as "chatId",
            coalesce(c.name, c.push_name, c.business_name, c.phone, c.id) as "displayName",
            c.phone, c.name, c.push_name, null as alias, ch.last_message_at::text as "lastMessageAt"
     from wa_contacts c left join wa_chats ch on ch.id = c.id
     where c.id = $1 limit 1`,
    [jid],
  );
  return rows[0] ?? null;
}

/** Group lookup by subject/name for /mandar-grupo. */
export async function findGroupsByName(term: string) {
  const like = `%${term.toLowerCase()}%`;
  const { rows } = await query<{ chatId: string; displayName: string; lastMessageAt: string | null }>(
    `select id as "chatId", coalesce(subject, name, id) as "displayName", last_message_at::text as "lastMessageAt"
     from wa_chats
     where is_group = true and (lower(coalesce(subject,'')) like $1 or lower(coalesce(name,'')) like $1)
     order by last_message_at desc nulls last
     limit 25`,
    [like],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Dashboard / command reads
// ---------------------------------------------------------------------------

export async function listChats(limit = 100) {
  const { rows } = await query(
    `select ch.id, ch.name, ch.subject, ch.is_group, ch.type, ch.last_message_at, ch.priority_score,
            ch.read_enabled, ch.read_enabled_at,
            coalesce(ch.subject, ct.name, ct.business_name, ct.push_name, ch.name) as display_name,
            ct.phone,
            (select count(*) from wa_tasks t where t.chat_id = ch.id and t.status = 'pending') as pending_tasks,
            (select from_me from wa_messages m where m.chat_id = ch.id order by m.timestamp desc limit 1) as last_from_me
     from wa_chats ch
     left join wa_contacts ct on ct.id = ch.id
     order by ch.last_message_at desc nulls last
     limit $1`,
    [limit],
  );
  return rows;
}

export async function listLidChatIds(limit = 500): Promise<string[]> {
  const { rows } = await query<{ id: string }>(
    `select id from wa_chats where id like '%@lid' order by updated_at desc limit $1`,
    [limit],
  );
  return rows.map((row) => row.id);
}

export async function getChatWithMessages(chatId: string, limit = 50) {
  const { rows: chat } = await query(
    `select ch.*,
            coalesce(ch.subject, ct.name, ct.business_name, ct.push_name, ch.name) as display_name,
            ct.phone
     from wa_chats ch
     left join wa_contacts ct on ct.id = ch.id
     where ch.id = $1`,
    [chatId],
  );
  if (!chat[0]) return null;
  const { rows: messages } = await query(
    `select id, sender_id, from_me, message_type, text_content, media_url, timestamp
     from wa_messages where chat_id = $1 order by timestamp desc limit $2`,
    [chatId, limit],
  );
  const { rows: summary } = await query(`select * from wa_chat_summaries where chat_id = $1 order by updated_at desc limit 1`, [chatId]);
  return { chat: chat[0], messages, summary: summary[0] ?? null };
}

export async function listContacts(limit = 200) {
  const { rows } = await query(
    `select id, name, push_name, business_name, phone, priority_score from wa_contacts
     where id not like '%@g.us' order by priority_score desc, updated_at desc limit $1`,
    [limit],
  );
  return rows;
}

export async function getContactDetail(contactId: string) {
  const { rows: contact } = await query(`select * from wa_contacts where id = $1`, [contactId]);
  if (!contact[0]) return null;
  const { rows: profile } = await query(`select * from wa_contact_profiles where contact_id = $1`, [contactId]);
  const { rows: tasks } = await query(`select * from wa_tasks where contact_id = $1 order by created_at desc limit 50`, [contactId]);
  const { rows: messages } = await query(
    `select id, from_me, text_content, message_type, timestamp from wa_messages where chat_id = $1 order by timestamp desc limit 30`,
    [contactId],
  );
  const { rows: audios } = await query(
    `select id, transcript, transcript_status, from_me, created_at from wa_audio_transcripts where chat_id = $1 order by created_at desc limit 20`,
    [contactId],
  );
  return { contact: contact[0], profile: profile[0] ?? null, tasks, messages, audios };
}

export async function listTasks(status?: string) {
  const { rows } = await query(
    `select t.*, coalesce(c.name, c.push_name, ch.subject, t.chat_id) as chat_name
     from wa_tasks t
     left join wa_chats ch on ch.id = t.chat_id
     left join wa_contacts c on c.id = t.contact_id
     where ($1::text is null or t.status = $1)
     order by t.created_at desc limit 200`,
    [status ?? null],
  );
  return rows;
}

export async function tasksForDay(startIso: string, endIso: string) {
  const { rows } = await query(
    `select t.*, coalesce(c.name, c.push_name, ch.subject, t.chat_id) as chat_name
     from wa_tasks t
     left join wa_chats ch on ch.id = t.chat_id
     left join wa_contacts c on c.id = t.contact_id
     where t.status = 'pending' and t.due_at >= $1 and t.due_at < $2
     order by t.due_at asc`,
    [startIso, endIso],
  );
  return rows;
}

export async function dueTaskReminders(limit = 20) {
  const { rows } = await query(
    `select id, title, project, due_at, remind_at
     from wa_tasks
     where status = 'pending'
       and remind_at is not null
       and remind_at <= now()
       and reminded_at is null
     order by remind_at asc
     limit $1`,
    [limit],
  );
  return rows;
}

export async function markTaskReminded(id: string): Promise<void> {
  await query(`update wa_tasks set reminded_at = now(), updated_at = now() where id = $1`, [id]);
}

export async function updateTaskStatus(id: string, status: string) {
  const { rows } = await query(`update wa_tasks set status = $2, updated_at = now() where id = $1 returning *`, [id, status]);
  return rows[0] ?? null;
}

export async function listHotLeads(limit = 50) {
  const { rows } = await query(
    `select c.id, coalesce(c.name, c.push_name, c.phone, c.id) as display_name, c.phone, c.priority_score,
            p.commercial_summary, p.last_intent
     from wa_contacts c
     left join wa_contact_profiles p on p.contact_id = c.id
     where c.priority_score > 0 and c.id not like '%@g.us'
     order by c.priority_score desc limit $1`,
    [limit],
  );
  return rows;
}

export async function listAudios(limit = 100) {
  const { rows } = await query(
    `select a.id, a.chat_id, a.from_me, a.transcript, a.transcript_status, a.audio_url, a.created_at,
            coalesce(c.name, c.push_name, ch.subject, a.chat_id) as chat_name
     from wa_audio_transcripts a
     left join wa_chats ch on ch.id = a.chat_id
     left join wa_contacts c on c.id = a.chat_id
     order by a.created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export async function countPendingAudios(): Promise<number> {
  const { rows } = await query<{ n: string }>(`select count(*)::text as n from wa_audio_transcripts where transcript_status in ('pending','error')`);
  return Number(rows[0]?.n ?? 0);
}

export async function searchMessagesText(q: string, opts: { onlyAudio?: boolean; limit?: number } = {}) {
  const limit = opts.limit ?? 50;
  if (opts.onlyAudio) {
    const { rows } = await query(
      `select a.id, a.chat_id, a.from_me, a.transcript, a.created_at,
              coalesce(c.name, c.push_name, ch.subject, a.chat_id) as chat_name
       from wa_audio_transcripts a
       left join wa_chats ch on ch.id = a.chat_id
       left join wa_contacts c on c.id = a.chat_id
       where a.transcript is not null
         and to_tsvector('spanish', coalesce(a.transcript,'')) @@ plainto_tsquery('spanish', $1)
       order by a.created_at desc limit $2`,
      [q, limit],
    );
    return rows;
  }
  const { rows } = await query(
    `select m.id, m.chat_id, m.from_me, m.text_content, m.timestamp,
            coalesce(c.name, c.push_name, ch.subject, m.chat_id) as chat_name
     from wa_messages m
     left join wa_chats ch on ch.id = m.chat_id
     left join wa_contacts c on c.id = m.chat_id
     where to_tsvector('spanish', coalesce(m.text_content,'')) @@ plainto_tsquery('spanish', $1)
     order by m.timestamp desc limit $2`,
    [q, limit],
  );
  return rows;
}

/** pgvector semantic search via the match_messages RPC (migration 0002). */
export async function matchMessagesByEmbedding(embedding: number[], chatId: string | null, count = 8) {
  const vec = `[${embedding.join(',')}]`;
  const { rows } = await query<{ message_id: string; chat_id: string; content: string; similarity: number }>(
    `select * from match_messages($1::vector, $2, $3)`,
    [vec, count, chatId],
  );
  return rows;
}

export async function pendingTasks(limit = 50) {
  return listTasks('pending').then((r) => r.slice(0, limit));
}

/** Chats where the last message is from the other party (i.e. you owe a reply). */
export async function unansweredChats(limit = 50) {
  const { rows } = await query(
    `select ch.id, coalesce(c.name, c.push_name, ch.subject, ch.id) as display_name, ch.last_message_at, ch.priority_score
     from wa_chats ch
     left join wa_contacts c on c.id = ch.id
     where exists (
       select 1 from wa_messages m where m.chat_id = ch.id
       order by m.timestamp desc limit 1
     )
     and (select from_me from wa_messages m where m.chat_id = ch.id order by m.timestamp desc limit 1) = false
     order by ch.priority_score desc, ch.last_message_at desc nulls last
     limit $1`,
    [limit],
  );
  return rows;
}

export async function todayMessages(limit = 500) {
  const { rows } = await query(
    `select m.chat_id, m.from_me, m.text_content, m.message_type, m.timestamp,
            coalesce(c.name, c.push_name, ch.subject, m.chat_id) as chat_name
     from wa_messages m
     left join wa_chats ch on ch.id = m.chat_id
     left join wa_contacts c on c.id = m.chat_id
     where m.timestamp >= date_trunc('day', now())
     order by m.timestamp asc limit $1`,
    [limit],
  );
  return rows;
}

export async function statusCounts() {
  const { rows } = await query<{ chats: string; contacts: string; pending_tasks: string; hot_leads: string }>(
    `select
       (select count(*) from wa_chats)::text as chats,
       (select count(*) from wa_contacts where id not like '%@g.us')::text as contacts,
       (select count(*) from wa_tasks where status = 'pending')::text as pending_tasks,
       (select count(*) from wa_contacts where priority_score > 0 and id not like '%@g.us')::text as hot_leads`,
  );
  const r = rows[0]!;
  const { rows: last } = await query<{ ts: string | null }>(`select max(timestamp)::text as ts from wa_messages`);
  return {
    chats: Number(r.chats),
    contacts: Number(r.contacts),
    pendingTasks: Number(r.pending_tasks),
    hotLeads: Number(r.hot_leads),
    pendingAudios: await countPendingAudios(),
    lastMessageAt: last[0]?.ts ?? null,
  };
}

export async function listActions(limit = 100) {
  const { rows } = await query(
    `select id, action_type, status, target_chat_id, requested_by, confidence, error, created_at, executed_at
     from wa_actions order by created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export async function listCommandLogs(limit = 100) {
  const { rows } = await query(
    `select cl.id, cl.source_message_id, cl.command_text, cl.parsed_intent, cl.status, cl.error, cl.created_at,
            m.chat_id, coalesce(c.name, c.push_name, ch.subject, m.chat_id) as chat_name
     from wa_command_logs cl
     left join wa_messages m on m.id = cl.source_message_id
     left join wa_chats ch on ch.id = m.chat_id
     left join wa_contacts c on c.id = m.chat_id
     order by cl.created_at desc
     limit $1`,
    [limit],
  );
  return rows;
}

export async function recentOwnTextMessages(limit = 80) {
  const { rows } = await query(
    `select m.id, m.chat_id, m.text_content, m.timestamp,
            coalesce(c.name, c.push_name, ch.subject, m.chat_id) as chat_name,
            exists(select 1 from wa_command_logs cl where cl.source_message_id = m.id) as has_command_log
     from wa_messages m
     left join wa_chats ch on ch.id = m.chat_id
     left join wa_contacts c on c.id = m.chat_id
     where m.from_me = true and m.text_content is not null and length(trim(m.text_content)) > 1
     order by m.timestamp desc
     limit $1`,
    [limit],
  );
  return rows;
}

export async function deleteChatData(chatId: string) {
  await query(`delete from wa_chats where id = $1`, [chatId]);
}

export async function deleteContactData(contactId: string) {
  await query(`delete from wa_contacts where id = $1`, [contactId]);
}
