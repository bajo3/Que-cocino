import OpenAI from 'openai';
import { loadEnv } from '@wma/shared';
import { recordAIUsage } from '@wma/db';

/**
 * AI providers. We split capabilities because OpenAI-compatible "coding"
 * endpoints (e.g. Z.AI / GLM) typically expose ONLY chat completions:
 *
 *  - chat   → Z.AI (if ZAI_API_KEY) else OpenAI (if OPENAI_API_KEY) else none
 *  - embed  → OpenAI only (else callers use a deterministic local embedding)
 *  - audio  → OpenAI only (Whisper-style); else transcription is skipped
 */

interface LLM {
  client: OpenAI;
  model: string;
}

export type ChatModelTier = 'fast' | 'smart';

let chatClientCached: OpenAI | null = null;
let openaiCached: OpenAI | null = null;

function rawOpenAI(): OpenAI | null {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) return null;
  if (!openaiCached) openaiCached = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openaiCached;
}

/** Chat LLM, preferring a configured Z.AI/GLM endpoint over OpenAI. */
export function getChatLLM(tier: ChatModelTier = 'smart'): LLM | null {
  const env = loadEnv();
  if (env.ZAI_API_KEY) {
    if (!chatClientCached) {
      chatClientCached = new OpenAI({ apiKey: env.ZAI_API_KEY, baseURL: env.ZAI_BASE_URL });
    }
    return {
      client: chatClientCached,
      model: tier === 'fast' ? env.ZAI_FAST_MODEL : env.ZAI_MODEL,
    };
  }
  const oa = rawOpenAI();
  if (oa) {
    return { client: oa, model: env.OPENAI_CHAT_MODEL };
  }
  return null;
}

/** Embeddings client — OpenAI only. Null → caller falls back to local embedding. */
export function getEmbeddingLLM(): LLM | null {
  const env = loadEnv();
  const oa = rawOpenAI();
  return oa ? { client: oa, model: env.OPENAI_EMBEDDING_MODEL } : null;
}

/** Transcription client — OpenAI/Whisper only. */
export function getTranscriptionLLM(): LLM | null {
  const env = loadEnv();
  const oa = rawOpenAI();
  return oa ? { client: oa, model: env.OPENAI_TRANSCRIPTION_MODEL } : null;
}

/** True when any chat provider is configured. */
export function hasChatProvider(): boolean {
  return getChatLLM() !== null;
}

/** Ask the chat model for a strict JSON object and parse it. */
export async function chatJson<T>(
  system: string,
  user: string,
  options: { tier?: ChatModelTier; maxTokens?: number; feature?: string } = {},
): Promise<T | null> {
  const tier = options.tier ?? 'fast';
  const llm = getChatLLM(tier);
  if (!llm) return null;

  const feature = options.feature ?? 'chat_json';
  const first = await requestJson<T>(llm, system, user, options.maxTokens, feature).catch(() => null);
  if (first || tier === 'smart') return first;

  const fallback = getChatLLM('smart');
  if (!fallback || fallback.model === llm.model) return null;
  return requestJson<T>(fallback, system, user, options.maxTokens, `${feature}_fallback`).catch(() => null);
}

/** Ask the chat model for plain text. */
export async function chatText(
  system: string,
  user: string,
  options: { tier?: ChatModelTier; maxTokens?: number; feature?: string; temperature?: number } = {},
): Promise<string | null> {
  const tier = options.tier ?? 'fast';
  const llm = getChatLLM(tier);
  if (!llm) return null;

  const feature = options.feature ?? 'chat_text';
  const first = await requestText(llm, system, user, options.maxTokens, feature, options.temperature).catch(() => null);
  if (first || tier === 'smart') return first;

  const fallback = getChatLLM('smart');
  if (!fallback || fallback.model === llm.model) return null;
  return requestText(fallback, system, user, options.maxTokens, `${feature}_fallback`, options.temperature).catch(() => null);
}

async function requestJson<T>(
  llm: LLM,
  system: string,
  user: string,
  maxTokens = 700,
  feature = 'chat_json',
): Promise<T | null> {
  const started = Date.now();
  let res: OpenAI.Chat.Completions.ChatCompletion;
  try {
    res = await llm.client.chat.completions.create(
      {
        model: llm.model,
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
        thinking: { type: 'disabled' };
      },
    );
  } catch (error) {
    await safeRecordUsage({
      provider: llm.model.startsWith('glm-') ? 'zai' : 'openai',
      model: llm.model,
      feature,
      durationMs: Date.now() - started,
      success: false,
      error: (error as Error).message.slice(0, 500),
    });
    throw error;
  }

  const inputTokens = res.usage?.prompt_tokens ?? 0;
  const outputTokens = res.usage?.completion_tokens ?? 0;
  const cachedInputTokens = res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  await safeRecordUsage({
    provider: llm.model.startsWith('glm-') ? 'zai' : 'openai',
    model: llm.model,
    feature,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    costUsd: estimateCost(llm.model, inputTokens, cachedInputTokens, outputTokens),
    durationMs: Date.now() - started,
    success: true,
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Some providers wrap JSON in prose/code fences — extract the first object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function requestText(
  llm: LLM,
  system: string,
  user: string,
  maxTokens = 350,
  feature = 'chat_text',
  temperature = 0.35,
): Promise<string | null> {
  const started = Date.now();
  let res: OpenAI.Chat.Completions.ChatCompletion;
  try {
    res = await llm.client.chat.completions.create(
      {
        model: llm.model,
        temperature,
        max_tokens: maxTokens,
        thinking: { type: 'disabled' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & {
        thinking: { type: 'disabled' };
      },
    );
  } catch (error) {
    await safeRecordUsage({
      provider: llm.model.startsWith('glm-') ? 'zai' : 'openai',
      model: llm.model,
      feature,
      durationMs: Date.now() - started,
      success: false,
      error: (error as Error).message.slice(0, 500),
    });
    throw error;
  }

  const inputTokens = res.usage?.prompt_tokens ?? 0;
  const outputTokens = res.usage?.completion_tokens ?? 0;
  const cachedInputTokens = res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  await safeRecordUsage({
    provider: llm.model.startsWith('glm-') ? 'zai' : 'openai',
    model: llm.model,
    feature,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    costUsd: estimateCost(llm.model, inputTokens, cachedInputTokens, outputTokens),
    durationMs: Date.now() - started,
    success: true,
  });

  return res.choices[0]?.message?.content?.trim() || null;
}

const MODEL_PRICES: Record<string, { input: number; cached: number; output: number }> = {
  'glm-5.2': { input: 1.4, cached: 0.26, output: 4.4 },
  'glm-5.1': { input: 1.4, cached: 0.26, output: 4.4 },
  'glm-5': { input: 1, cached: 0.2, output: 3.2 },
  'glm-4.7': { input: 0.6, cached: 0.11, output: 2.2 },
  'glm-4.7-flash': { input: 0, cached: 0, output: 0 },
  'glm-4.5-air': { input: 0.2, cached: 0.03, output: 1.1 },
};

function estimateCost(model: string, input: number, cached: number, output: number): number {
  const price = MODEL_PRICES[model.toLowerCase()];
  if (!price) return 0;
  const regularInput = Math.max(0, input - cached);
  return (regularInput * price.input + cached * price.cached + output * price.output) / 1_000_000;
}

async function safeRecordUsage(params: Parameters<typeof recordAIUsage>[0]): Promise<void> {
  try {
    await recordAIUsage(params);
  } catch {
    // Usage telemetry must never block the assistant.
  }
}
