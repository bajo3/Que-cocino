import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { assertRateLimit } from "@/server/rate-limit";
import { getPrisma } from "@/server/prisma";
import { interpretRequestSchema, interpretationSchema } from "@/schemas/inventory";
import { parseInventoryText } from "@/domain/text-parser";
import { generateStructuredObject } from "@/server/ai";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    assertRateLimit(`interpret:${userId}`);
    const { text } = interpretRequestSchema.parse(await readJson(request));
    const sanitized = text.replace(/[<>]/g, "");
    const ingredients = await getPrisma().ingredient.findMany({ include: { equivalences: true } });
    const fallback = parseInventoryText(sanitized, ingredients);
    try {
      const result = await generateStructuredObject(interpretationSchema, {
        system: "Extraé alimentos de una frase en español rioplatense. Devolvé exclusivamente JSON sin texto adicional. El objeto raíz DEBE tener sólo la clave items: {\"items\":[{\"name\":\"papa\",\"quantity\":2,\"unit\":\"kg\",\"estimatedGrams\":2000,\"estimatedMilliliters\":null,\"confidence\":0.98,\"approximate\":false}]}. Nunca uses las claves ingredients, products ni alimentos. No inventes productos. Las conversiones caseras son aproximadas y dependen del catálogo.",
        prompt: `Catálogo permitido: ${ingredients.map((item) => `${item.canonicalName} (${item.aliases.join(", ")})`).join("; ")}\nTexto del usuario: ${sanitized}`,
      });
      if (!result) return Response.json({ items: fallback, source: "local" });
      return Response.json({ ...result.output, source: result.source });
    } catch (error) {
      console.error("Falló la interpretación con IA; se usa parser local", error);
      return Response.json({ items: fallback, source: "local" });
    }
  } catch (error) { return apiError(error); }
}
