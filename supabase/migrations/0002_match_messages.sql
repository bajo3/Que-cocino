-- Semantic search helper used by buildContext / /buscar.
-- Returns the most similar messages to a query embedding within a chat
-- (or across all chats when p_chat_id is null).

create or replace function match_messages(
  query_embedding vector(1536),
  match_count int default 8,
  p_chat_id text default null
)
returns table (
  message_id text,
  chat_id text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    e.message_id,
    e.chat_id,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity
  from wa_message_embeddings e
  where (p_chat_id is null or e.chat_id = p_chat_id)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
