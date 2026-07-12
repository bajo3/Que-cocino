import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Z.AI/GLM expone una API compatible con OpenAI. Se prefiere cuando está
 * configurada para reutilizar la cuenta del usuario; OpenAI queda como fallback.
 */
export function getStructuredAiModel(): LanguageModel | null {
  const zaiKey = process.env.ZAI_API_KEY;
  if (zaiKey) {
    const provider = createOpenAI({ apiKey: zaiKey, baseURL: process.env.ZAI_BASE_URL });
    // Z.AI expone Chat Completions, pero no la Responses API de OpenAI.
    return provider.chat(process.env.ZAI_FAST_MODEL ?? process.env.ZAI_MODEL ?? "glm-4.7-flash");
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return null;
  const provider = createOpenAI({ apiKey: openAiKey });
  return provider(process.env.OPENAI_MODEL ?? "gpt-5-mini");
}
