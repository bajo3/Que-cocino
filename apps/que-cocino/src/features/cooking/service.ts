import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { cookRecipeSchema } from "@/schemas/cooking";
import { getPrisma } from "@/server/prisma";
import { HttpError } from "@/server/authz";

type CookInput = z.infer<typeof cookRecipeSchema>;
export async function cookRecipe(userId: string, input: CookInput) {
  const db = getPrisma();
  return db.$transaction(async (tx) => {
    const recipe = await tx.recipe.findUnique({ where: { id: input.recipeId }, include: { ingredients: true } });
    if (!recipe) throw new HttpError(404, "Receta no encontrada.");
    const requiredIngredientIds = recipe.ingredients.filter((item) => !item.optional).map((item) => item.ingredientId);
    const recipeIngredientIds = new Set(recipe.ingredients.map((item) => item.ingredientId));
    const suppliedIngredientIds = new Set(input.usages.map((usage) => usage.ingredientId));
    if (input.usages.some((usage) => !recipeIngredientIds.has(usage.ingredientId))) throw new HttpError(400, "Sólo podés descontar ingredientes de esta receta.");
    if (requiredIngredientIds.some((ingredientId) => !suppliedIngredientIds.has(ingredientId))) throw new HttpError(400, "Falta confirmar uno o más ingredientes obligatorios.");
    if (new Set(input.usages.map((usage) => usage.inventoryItemId)).size !== input.usages.length) throw new HttpError(400, "Un lote no puede descontarse dos veces.");
    const verified = [] as Array<{ id: string; ingredientId: string; planned: number; actual: number }>;
    for (const usage of input.usages) {
      const item = await tx.inventoryItem.findFirst({ where: { id: usage.inventoryItemId, userId, ingredientId: usage.ingredientId } });
      if (!item) throw new HttpError(404, "Uno de los productos ya no está disponible.");
      if (Number(item.normalizedQuantity) < usage.actualQuantity) throw new HttpError(409, `No hay stock suficiente de ${item.customName ?? "un ingrediente"}.`);
      const updated = await tx.inventoryItem.updateMany({ where: { id: item.id, userId, normalizedQuantity: { gte: usage.actualQuantity } }, data: { normalizedQuantity: { decrement: usage.actualQuantity } } });
      if (!updated.count) throw new HttpError(409, "El stock cambió mientras confirmabas. Revisá las cantidades.");
      verified.push({ id: item.id, ingredientId: usage.ingredientId, planned: usage.plannedQuantity, actual: usage.actualQuantity });
    }
    const event = await tx.cookingEvent.create({ data: { userId, recipeId: recipe.id, servings: input.servings, notes: input.notes, estimatedCalories: recipe.estimatedCalories ? Math.round(recipe.estimatedCalories * input.servings / recipe.servings) : null, estimatedProtein: recipe.estimatedProtein ? Number(recipe.estimatedProtein) * input.servings / recipe.servings : null, adjustments: input.usages } });
    await tx.cookingUsage.createMany({ data: verified.map((usage) => ({ cookingEventId: event.id, inventoryItemId: usage.id, ingredientId: usage.ingredientId, plannedQuantity: usage.planned, actualQuantity: usage.actual, normalizedQuantity: usage.actual })) });
    if (input.leftover) await tx.leftover.create({ data: { userId, cookingEventId: event.id, name: recipe.name, portions: input.leftover.portions, location: input.leftover.location, expirationDate: input.leftover.expirationDate ? new Date(input.leftover.expirationDate) : null, notes: input.leftover.notes } });
    return event;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
