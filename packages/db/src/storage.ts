import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from '@wma/shared';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const env = loadEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — Storage unavailable.');
  }
  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return client;
}

/**
 * Upload a media buffer to Supabase Storage and return a stable storage path.
 * Naming follows the spec: whatsapp-audio/{chatId}/{messageId}.{ext}
 */
export async function uploadMedia(params: {
  folder: 'whatsapp-audio' | 'whatsapp-media';
  chatId: string;
  messageId: string;
  ext: string;
  contentType: string;
  data: Buffer | Uint8Array;
}): Promise<{ path: string; publicUrl: string | null }> {
  const env = loadEnv();
  const supabase = getSupabase();
  const safeChat = params.chatId.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const path = `${params.folder}/${safeChat}/${params.messageId}.${params.ext}`;

  const { error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, params.data, {
      contentType: params.contentType,
      upsert: true,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data?.publicUrl ?? null };
}

/** Download a stored object (used by the worker to transcribe). */
export async function downloadMedia(path: string): Promise<Buffer> {
  const env = loadEnv();
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .download(path);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
