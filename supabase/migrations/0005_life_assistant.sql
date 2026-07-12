-- Life assistant suite: drafts, style, recurring tasks, AI usage and finances.

alter table wa_tasks
  add column if not exists recurrence text,
  add column if not exists parent_task_id uuid references wa_tasks(id) on delete set null,
  add column if not exists snoozed_until timestamptz,
  add column if not exists completed_at timestamptz;

create unique index if not exists idx_wa_tasks_source_title_unique
  on wa_tasks(source_message_id, lower(title))
  where source_message_id is not null;

create table if not exists wa_style_profiles (
  id text primary key default 'owner',
  profile text not null default '',
  sample_count int not null default 0,
  model text,
  updated_at timestamptz not null default now()
);

create table if not exists wa_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references wa_chats(id) on delete cascade,
  source_message_id text unique references wa_messages(id) on delete cascade,
  draft_text text not null,
  status text not null default 'pending',
  confidence numeric,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_wa_reply_drafts_status_created
  on wa_reply_drafts(status, created_at desc);

create table if not exists wa_ai_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  feature text not null,
  input_tokens int not null default 0,
  cached_input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(12,6) not null default 0,
  duration_ms int,
  success boolean not null default true,
  error text,
  source_message_id text references wa_messages(id) on delete set null,
  chat_id text references wa_chats(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_wa_ai_usage_created
  on wa_ai_usage(created_at desc);

create table if not exists wa_finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense', 'debt')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  category text,
  description text not null,
  occurred_at timestamptz not null default now(),
  due_at timestamptz,
  status text not null default 'pending',
  source_message_id text unique references wa_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wa_finance_entries_occurred
  on wa_finance_entries(occurred_at desc);
create index if not exists idx_wa_finance_entries_status_due
  on wa_finance_entries(status, due_at);

insert into wa_settings (key, value)
values
  ('daily_summary_enabled', 'true'::jsonb),
  ('daily_summary_hour', '8'::jsonb),
  ('daily_summary_last_date', 'null'::jsonb),
  ('draft_replies_enabled', 'true'::jsonb)
on conflict (key) do nothing;
