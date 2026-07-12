-- Selective ingestion: discover chats, but only persist/analyse message content
-- after the operator explicitly enables reading for that chat.

alter table wa_chats
  add column if not exists read_enabled boolean not null default false,
  add column if not exists read_enabled_at timestamptz;

create index if not exists idx_wa_chats_read_enabled
  on wa_chats(read_enabled)
  where read_enabled = true;

comment on column wa_chats.read_enabled is
  'Whether message content from this chat may be persisted and analysed.';

