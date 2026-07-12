import { getPool, query } from './pool.js';

export async function recentOwnMessages(limit = 80): Promise<string[]> {
  const { rows } = await query<{ text_content: string }>(
    `select text_content
     from wa_messages
     where from_me = true and text_content is not null and length(trim(text_content)) > 1
     order by timestamp desc
     limit $1`,
    [limit],
  );
  return rows.map((row) => row.text_content).reverse();
}

export async function getStyleProfile() {
  const { rows } = await query(`select * from wa_style_profiles where id = 'owner'`);
  return rows[0] ?? null;
}

export async function upsertStyleProfile(profile: string, sampleCount: number, model: string): Promise<void> {
  await query(
    `insert into wa_style_profiles(id, profile, sample_count, model, updated_at)
     values ('owner', $1, $2, $3, now())
     on conflict (id) do update set
       profile = excluded.profile,
       sample_count = excluded.sample_count,
       model = excluded.model,
       updated_at = now()`,
    [profile, sampleCount, model],
  );
}

export async function upsertReplyDraft(params: {
  chatId: string;
  sourceMessageId: string;
  text: string;
  confidence?: number | null;
  model?: string | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into wa_reply_drafts(chat_id, source_message_id, draft_text, confidence, model)
     values ($1,$2,$3,$4,$5)
     on conflict (source_message_id) do update set
       draft_text = excluded.draft_text,
       confidence = excluded.confidence,
       model = excluded.model,
       status = case when wa_reply_drafts.status = 'pending' then 'pending' else wa_reply_drafts.status end,
       updated_at = now()
     returning id`,
    [params.chatId, params.sourceMessageId, params.text, params.confidence ?? null, params.model ?? null],
  );
  return rows[0]!.id;
}

export async function listReplyDrafts(status = 'pending', limit = 100) {
  const { rows } = await query(
    `select d.*, coalesce(c.name, c.push_name, c.business_name, ch.name, d.chat_id) as chat_name,
            m.text_content as source_text
     from wa_reply_drafts d
     join wa_chats ch on ch.id = d.chat_id
     left join wa_contacts c on c.id = d.chat_id
     left join wa_messages m on m.id = d.source_message_id
     where d.status = $1
     order by d.created_at desc
     limit $2`,
    [status, limit],
  );
  return rows;
}

export async function getReplyDraft(id: string) {
  const { rows } = await query(`select * from wa_reply_drafts where id = $1`, [id]);
  return rows[0] ?? null;
}

export async function updateReplyDraft(
  id: string,
  patch: { status?: string; text?: string; sentAt?: Date | null },
) {
  const { rows } = await query(
    `update wa_reply_drafts set
       status = coalesce($2, status),
       draft_text = coalesce($3, draft_text),
       sent_at = coalesce($4, sent_at),
       updated_at = now()
     where id = $1 returning *`,
    [id, patch.status ?? null, patch.text ?? null, patch.sentAt ?? null],
  );
  return rows[0] ?? null;
}

export async function recordAIUsage(params: {
  provider: string;
  model: string;
  feature: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  success?: boolean;
  error?: string | null;
  sourceMessageId?: string | null;
  chatId?: string | null;
}): Promise<void> {
  await query(
    `insert into wa_ai_usage(
       provider, model, feature, input_tokens, cached_input_tokens, output_tokens,
       cost_usd, duration_ms, success, error, source_message_id, chat_id
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      params.provider,
      params.model,
      params.feature,
      params.inputTokens ?? 0,
      params.cachedInputTokens ?? 0,
      params.outputTokens ?? 0,
      params.costUsd ?? 0,
      params.durationMs ?? null,
      params.success ?? true,
      params.error ?? null,
      params.sourceMessageId ?? null,
      params.chatId ?? null,
    ],
  );
}

export async function aiUsageSummary(days = 30) {
  const { rows: totals } = await query(
    `select coalesce(sum(input_tokens),0)::int as input_tokens,
            coalesce(sum(cached_input_tokens),0)::int as cached_input_tokens,
            coalesce(sum(output_tokens),0)::int as output_tokens,
            coalesce(sum(cost_usd),0)::numeric as cost_usd,
            count(*)::int as calls
     from wa_ai_usage where created_at >= now() - ($1::text || ' days')::interval`,
    [days],
  );
  const { rows: byModel } = await query(
    `select model, feature, count(*)::int as calls,
            sum(input_tokens)::int as input_tokens,
            sum(output_tokens)::int as output_tokens,
            sum(cost_usd)::numeric as cost_usd
     from wa_ai_usage
     where created_at >= now() - ($1::text || ' days')::interval
     group by model, feature
     order by cost_usd desc, calls desc`,
    [days],
  );
  return { totals: totals[0], byModel };
}

export async function insertFinanceEntry(params: {
  kind: 'income' | 'expense' | 'debt';
  amount: number;
  currency?: string;
  category?: string | null;
  description: string;
  occurredAt?: string | null;
  dueAt?: string | null;
  status?: string;
  sourceMessageId?: string | null;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into wa_finance_entries(
       kind, amount, currency, category, description, occurred_at, due_at, status, source_message_id
     ) values ($1,$2,$3,$4,$5,coalesce($6::timestamptz,now()),$7,$8,$9)
     on conflict (source_message_id) do update set updated_at = now()
     returning id`,
    [
      params.kind,
      params.amount,
      params.currency ?? 'ARS',
      params.category ?? null,
      params.description,
      params.occurredAt ?? null,
      params.dueAt ?? null,
      params.status ?? (params.kind === 'debt' ? 'pending' : 'paid'),
      params.sourceMessageId ?? null,
    ],
  );
  return rows[0]!.id;
}

export async function listFinanceEntries(limit = 200) {
  const { rows } = await query(
    `select * from wa_finance_entries order by occurred_at desc, created_at desc limit $1`,
    [limit],
  );
  return rows;
}

export async function financeSummary(month?: string) {
  const start = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null;
  const { rows } = await query(
    `select
       coalesce(sum(amount) filter (where kind='income' and status <> 'cancelled'),0)::numeric as income,
       coalesce(sum(amount) filter (where kind='expense' and status <> 'cancelled'),0)::numeric as expenses,
       coalesce(sum(amount) filter (where kind='debt' and status='pending'),0)::numeric as pending_debt
     from wa_finance_entries
     where ($1::date is null or occurred_at >= $1::date)
       and ($1::date is null or occurred_at < ($1::date + interval '1 month'))`,
    [start],
  );
  return rows[0]!;
}

export async function updateFinanceEntry(
  id: string,
  patch: { status?: string; amount?: number; description?: string; category?: string | null },
) {
  const { rows } = await query(
    `update wa_finance_entries set
       status = coalesce($2,status),
       amount = coalesce($3,amount),
       description = coalesce($4,description),
       category = coalesce($5,category),
       updated_at = now()
     where id=$1 returning *`,
    [id, patch.status ?? null, patch.amount ?? null, patch.description ?? null, patch.category ?? null],
  );
  return rows[0] ?? null;
}

export async function updateTask(
  id: string,
  patch: {
    title?: string;
    priority?: string;
    dueAt?: string | null;
    remindAt?: string | null;
    recurrence?: string | null;
    project?: string | null;
  },
) {
  const { rows } = await query(
    `update wa_tasks set
       title = coalesce($2,title),
       priority = coalesce($3,priority),
       due_at = case when $4::boolean then $5::timestamptz else due_at end,
       remind_at = case when $6::boolean then $7::timestamptz else remind_at end,
       recurrence = case when $8::boolean then $9 else recurrence end,
       project = case when $10::boolean then $11 else project end,
       reminded_at = case when $6::boolean then null else reminded_at end,
       updated_at = now()
     where id=$1 returning *`,
    [
      id,
      patch.title ?? null,
      patch.priority ?? null,
      Object.prototype.hasOwnProperty.call(patch, 'dueAt'),
      patch.dueAt ?? null,
      Object.prototype.hasOwnProperty.call(patch, 'remindAt'),
      patch.remindAt ?? null,
      Object.prototype.hasOwnProperty.call(patch, 'recurrence'),
      patch.recurrence ?? null,
      Object.prototype.hasOwnProperty.call(patch, 'project'),
      patch.project ?? null,
    ],
  );
  return rows[0] ?? null;
}

export async function snoozeTask(id: string, until: string) {
  const { rows } = await query(
    `update wa_tasks set
       snoozed_until=$2,
       remind_at=$2,
       reminded_at=null,
       updated_at=now()
     where id=$1 returning *`,
    [id, until],
  );
  return rows[0] ?? null;
}

export async function completeTask(id: string) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `update wa_tasks set status='done', completed_at=now(), updated_at=now()
       where id=$1 returning *`,
      [id],
    );
    const task = rows[0];
    if (!task) {
      await client.query('rollback');
      return null;
    }
    if (task.recurrence && task.due_at && ['daily', 'weekly', 'monthly'].includes(task.recurrence)) {
      const unit = task.recurrence === 'daily' ? '1 day' : task.recurrence === 'weekly' ? '1 week' : '1 month';
      await client.query(
        `insert into wa_tasks(
           chat_id, contact_id, title, description, status, priority, due_at,
           project, remind_at, source, recurrence, parent_task_id
         ) values (
           $1,$2,$3,$4,'pending',$5,$6::timestamptz + $7::interval,$8,
           case when $9::timestamptz is null then null else $9::timestamptz + $7::interval end,
           'recurring',$10,$11
         )`,
        [
          task.chat_id,
          task.contact_id,
          task.title,
          task.description,
          task.priority,
          task.due_at,
          unit,
          task.project,
          task.remind_at,
          task.recurrence,
          task.id,
        ],
      );
    }
    await client.query('commit');
    return task;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
