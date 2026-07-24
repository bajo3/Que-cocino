import { z } from 'zod';

/**
 * Centralised, validated environment access.
 *
 * Secrets are NEVER hard-coded — they come from process.env only.
 * Call `loadEnv()` once at process start. Most fields are optional so that
 * individual services can boot with only the config they need (and so tests
 * can run without credentials).
 */

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
  });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().optional(),

  DATABASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('whatsapp-media'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default('gpt-4o-mini-transcribe'),
  AUDIO_TRANSCRIPTION_PROMPT: z
    .string()
    .default(
      'El audio está hablado en español rioplatense de Argentina. Transcribí literalmente y no traduzcas a otro idioma. Vocabulario frecuente: Felipe, Feli, Jesús, Paco, Ricky, Cruz, Citroën, C4 Cactus, Sprinter, Mercedes-Benz, motorhome, Mercado Libre, catálogo, USD, dólares, veterinario.',
    ),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // Optional OpenAI-compatible chat provider (e.g. Z.AI / GLM). When set, it is
  // preferred over OpenAI for chat completions. Embeddings/transcription still
  // require OpenAI (most third-party coding endpoints don't expose them).
  ZAI_API_KEY: z.string().optional(),
  ZAI_MODEL: z.string().default('glm-4.6'),
  ZAI_FAST_MODEL: z.string().default('glm-4.7-flash'),
  ZAI_TRANSCRIPTION_MODEL: z.string().default('glm-asr-2512'),
  ZAI_BASE_URL: z.string().default('https://api.z.ai/api/paas/v4'),

  REDIS_URL: z.string().optional(),
  DISABLE_REDIS_QUEUES: boolish.default(false),

  DOLAR_API_URL: z.string().url().default('https://dolarapi.com/v1/dolares/blue'),
  DOLAR_API_FALLBACK_URL: z.string().url().default('https://api.argentinadatos.com/v1/cotizaciones/dolares/blue'),
  DOLAR_RATE_CACHE_MS: z.coerce.number().default(5 * 60 * 1000),

  WA_AUTH_DIR: z.string().default('./.wa_auth'),
  CONTROL_CHAT_JID: z.string().optional(),
  OWNER_PHONE: z.string().optional(),
  // Link via an 8-char pairing code (using OWNER_PHONE) instead of a QR.
  WA_USE_PAIRING_CODE: boolish.default(false),

  APP_SECRET: z.string().default('insecure-dev-secret'),
  DASHBOARD_USER: z.string().default('admin'),
  DASHBOARD_PASSWORD: z.string().default('admin'),
  LISTENER_URL: z.string().optional(),
  RAILWAY_SERVICE_LISTENER_URL: z.string().optional(),

  CONFIRM_BEFORE_SEND: boolish.default(false),
  SEND_MAX_PER_HOUR: z.coerce.number().int().nonnegative().default(20),
  SEND_MAX_PER_CHAT_PER_HOUR: z.coerce.number().int().nonnegative().default(4),
  SEND_CHAT_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(45_000),
  SEND_DUPLICATE_WINDOW_MS: z.coerce.number().int().nonnegative().default(24 * 60 * 60 * 1000),
  SEND_MIN_DISPATCH_DELAY_MS: z.coerce.number().int().nonnegative().default(1_500),
  SEND_DELAY_PER_CHAR_MS: z.coerce.number().int().nonnegative().default(15),
  SEND_MAX_DISPATCH_DELAY_MS: z.coerce.number().int().nonnegative().default(12_000),
  ENABLE_AUDIO_TRANSCRIPTION: boolish.default(true),
  ENABLE_AUTO_SEND: boolish.default(true),
  ENABLE_MEDIA_DOWNLOAD: boolish.default(false),
  ENABLE_AUDIO_DOWNLOAD: boolish.default(true),

  LISTENER_HEALTH_PORT: z.coerce.number().optional(),
  WORKER_HEALTH_PORT: z.coerce.number().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  cached = EnvSchema.parse(source);
  return cached;
}

/** For tests: reset the cached env. */
export function resetEnvCache(): void {
  cached = null;
}
