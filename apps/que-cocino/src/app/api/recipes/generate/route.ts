import { z } from "zod";
import { generatedRecipeSchema } from "@/schemas/cooking";
import { apiError, readJson } from "@/server/api";
import { HttpError, requireUserId } from "@/server/authz";
import { assertRateLimit } from "@/server/rate-limit";
import { getPrisma } from "@/server/prisma";
import { generateStructuredObject } from "@/server/ai";

const requestSchema = z.object({ prompt: z.string().trim().min(3).max(1_000), servings: z.number().int().min(1).max(20).default(4) });
export async function POST(request: Request) {
  try {
    const userId = await requireUserId(); assertRateLimit(`generate-recipe:${userId}`, 5);
    const input = requestSchema.parse(await readJson(request));
    const inventory = await getPrisma().inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } });
    const result = await generateStructuredObject(generatedRecipeSchema, { system: "Generá una receta segura y realista en español rioplatense. Devolvé exclusivamente un objeto JSON válido con nombre, descripción, porciones, tiempos, dificultad, tags, ingredientes, pasos y nutrición estimada. No asumas ingredientes fuera del inventario sin declararlos. Las medidas caseras son aproximadas.", prompt: `Pedido: ${input.prompt}\nPorciones: ${input.servings}\nInventario: ${inventory.map((item) => `${item.ingredient?.canonicalName ?? item.customName}: ${item.quantity} ${item.unit}`).join("; ")}` });
    if (!result) throw new HttpError(503, "Configurá un proveedor de IA para generar recetas nuevas.");
    return Response.json({ recipe: result.output, source: result.source });
  } catch (error) { return apiError(error); }
}
