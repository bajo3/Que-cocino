import type { z } from "zod";

/**
 * Z.AI/GLM expone Chat Completions compatibles con OpenAI, pero no la Responses
 * API ni JSON Schema estricto. Forzamos JSON object y luego lo validamos con Zod.
 */
function getStructuredAiClient() {
  const zaiKey = process.env.ZAI_API_KEY;
  if (zaiKey) {
    return {
      apiKey: zaiKey,
      baseURL: process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4/",
      // Las extracciones modifican datos propuestos al usuario: priorizamos el
      // modelo principal, más consistente con contratos JSON que el fast model.
      model: process.env.ZAI_MODEL ?? process.env.ZAI_FAST_MODEL ?? "glm-5",
      source: "zai" as const,
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return null;
  return { apiKey: openAiKey, baseURL: "https://api.openai.com/v1", model: process.env.OPENAI_MODEL ?? "gpt-5-mini", source: "openai" as const };
}

export async function generateStructuredObject<T>(schema: z.ZodType<T>, input: { system: string; prompt: string }) {
  const provider = getStructuredAiClient();
  if (!provider) return null;
  const response = await fetch(`${provider.baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
    model: provider.model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: input.system }, { role: "user", content: input.prompt }],
    ...(provider.source === "zai" ? { thinking: { type: "disabled" } } : {}),
    }),
  });
  if (!response.ok) throw new Error(`El proveedor de IA respondió ${response.status}.`);
  const completion = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error("El proveedor de IA no devolvió contenido.");
  const parsed = JSON.parse(raw) as unknown;
  const validation = schema.safeParse(parsed);
  if (!validation.success) {
    const keys = parsed && typeof parsed === "object" ? Object.keys(parsed as Record<string, unknown>).join(", ") : typeof parsed;
    throw new Error(`La IA devolvió una estructura incompatible. Claves recibidas: ${keys || "ninguna"}.`);
  }
  return { output: validation.data, source: provider.source };
}
