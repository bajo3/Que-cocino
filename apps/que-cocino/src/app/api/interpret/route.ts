import { generateText, Output } from "ai";
import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { assertRateLimit } from "@/server/rate-limit";
import { getPrisma } from "@/server/prisma";
import { interpretRequestSchema, interpretationSchema } from "@/schemas/inventory";
import { parseInventoryText } from "@/domain/text-parser";
import { getStructuredAiModel } from "@/server/ai";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    assertRateLimit(`interpret:${userId}`);
    const { text } = interpretRequestSchema.parse(await readJson(request));
    const sanitized = text.replace(/[<>]/g, "");
    const ingredients = await getPrisma().ingredient.findMany({ include: { equivalences: true } });
    const fallback = parseInventoryText(sanitized, ingredients);
    const model = getStructuredAiModel();
    if (!model) return Response.json({ items: fallback, source: "local" });
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: interpretationSchema }),
        system: "Extraé alimentos de una frase en español rioplatense. Respondé sólo mediante el esquema. No inventes productos. Las conversiones caseras son aproximadas y dependen del catálogo.",
        prompt: `Catálogo permitido: ${ingredients.map((item) => `${item.canonicalName} (${item.aliases.join(", ")})`).join("; ")}\nTexto del usuario: ${sanitized}`,
      });
      return Response.json({ ...interpretationSchema.parse(output), source: "openai" });
    } catch (error) {
      console.error("Falló la interpretación con IA; se usa parser local", error);
      return Response.json({ items: fallback, source: "local" });
    }
  } catch (error) { return apiError(error); }
}
