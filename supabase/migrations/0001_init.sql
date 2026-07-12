-- WhatsApp Memory Assistant — initial schema
-- Idempotent: safe to run multiple times.

-- 4.1 Extensions -----------------------------------------------------------
create extension if not exists vector;
create extension if not exists pgcrypto;

-- 4.2 Tables ---------------------------------------------------------------

create table if not exists wa_accounts (
  id uuid primary key default gen_random_uuid(),
  phone text,
  display_name text,
  jid text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wa_chats (
  id text primary key,
  account_id uuid references wa_accounts(id) on delete cascade,
  type text not null default 'unknown',
  name text,
  subject text,
  is_group boolean default false,
  is_archived boolean default false,
  last_message_at timestamptz,
  unread_count int default 0,
  priority_score int default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wa_contacts (
  id text primary key,
  account_id uuid references wa_accounts(id) on delete cascade,
  phone text,
  name text,
  push_name text,
  business_name text,
  notes text,
  priority_score int default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wa_group_participants (
  group_id text references wa_chats(id) on delete cascade,
  contact_id text references wa_contacts(id) on delete cascade,
  role text,
  joined_at timestamptz,
  updated_at timestamptz default now(),
  primary key (group_id, contact_id)
);

create table if not exists wa_messages (
  id text primary key,
  account_id uuid references wa_accounts(id) on delete cascade,
  chat_id text references wa_chats(id) on delete cascade,
  sender_id text,
  from_me boolean default false,
  message_type text,
  text_content text,
  quoted_message_id text,
  media_url text,
  media_mime_type text,
  media_file_size bigint,
  raw_json jsonb,
  timestamp timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wa_audio_transcripts (
  id uuid primary key default gen_random_uuid(),
  message_id text references wa_messages(id) on delete cascade,
  chat_id text references wa_chats(id) on delete cascade,
  sender_id text,
  from_me boolean default false,
  audio_url text,
  duration_seconds int,
  transcript text,
  transcript_status text default 'pending',
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wa_message_embeddings (
  id uuid primary key default gen_random_uuid(),
  message_id text references wa_messages(id) on delete cascade,
  chat_id text references wa_chats(id) on delete cascade,
  content text,
  embedding vector(1536),
  created_at timestamptz default now()
);

create table if not exists wa_chat_summaries (
  id uuid primary key default gen_random_uuid(),
  chat_id text references wa_chats(id) on delete cascade,
  summary text,
  facts jsonb default '{}'::jsonb,
  pending_tasks jsonb default '[]'::jsonb,
  last_message_id text,
  updated_at timestamptz default now()
);

create table if not exists wa_contact_profiles (
  contact_id text primary key references wa_contacts(id) on delete cascade,
  commercial_summary text,
  interests jsonb default '[]'::jsonb,
  vehicles jsonb default '[]'::jsonb,
  promises jsonb default '[]'::jsonb,
  objections jsonb default '[]'::jsonb,
  last_intent text,
  priority_score int default 0,
  updated_at timestamptz default now()
);

create table if not exists wa_tasks (
  id uuid primary key default gen_random_uuid(),
  chat_id text references wa_chats(id) on delete cascade,
  contact_id text references wa_contacts(id) on delete set null,
  title text not null,
  description text,
  status text default 'pending',
  priority text default 'normal',
  due_at timestamptz,
  source_message_id text references wa_messages(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists wa_contact_aliases (
  id uuid primary key default gen_random_uuid(),
  contact_id text references wa_contacts(id) on delete cascade,
  alias text not null,
  created_at timestamptz default now()
);

create table if not exists wa_actions (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  requested_by text,
  source_chat_id text,
  target_chat_id text,
  target_contact_id text,
  payload jsonb default '{}'::jsonb,
  status text default 'pending',
  confidence numeric,
  error text,
  created_at timestamptz default now(),
  executed_at timestamptz
);

create table if not exists wa_command_logs (
  id uuid primary key default gen_random_uuid(),
  source_message_id text references wa_messages(id) on delete set null,
  command_text text,
  parsed_intent text,
  parsed_payload jsonb default '{}'::jsonb,
  status text,
  error text,
  created_at timestamptz default now()
);

create table if not exists wa_labels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz default now()
);

create table if not exists wa_chat_labels (
  chat_id text references wa_chats(id) on delete cascade,
  label_id uuid references wa_labels(id) on delete cascade,
  primary key (chat_id, label_id)
);

create table if not exists wa_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 4.3 Indexes --------------------------------------------------------------
create index if not exists idx_wa_messages_chat_timestamp on wa_messages(chat_id, timestamp desc);
create index if not exists idx_wa_messages_sender on wa_messages(sender_id);
create index if not exists idx_wa_messages_from_me on wa_messages(from_me);
create index if not exists idx_wa_messages_text_search on wa_messages using gin(to_tsvector('spanish', coalesce(text_content, '')));
create index if not exists idx_wa_tasks_status on wa_tasks(status);
create index if not exists idx_wa_tasks_due_at on wa_tasks(due_at);
create index if not exists idx_wa_chats_last_message_at on wa_chats(last_message_at desc);
create index if not exists idx_wa_message_embeddings_vector on wa_message_embeddings using ivfflat (embedding vector_cosine_ops);

-- Seed default safety settings (listen + send active by default).
insert into wa_settings (key, value)
values
  ('listen_paused', 'false'::jsonb),
  ('send_paused', 'false'::jsonb)
on conflict (key) do nothing;
