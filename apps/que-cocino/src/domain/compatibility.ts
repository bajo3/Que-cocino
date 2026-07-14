import type { InventoryItem, Recipe, RecipeIngredient, Ingredient } from "@prisma/client";

type RecipeWithIngredients = Recipe & { ingredients: Array<RecipeIngredient & { ingredient: Ingredient }> };
type InventoryWithIngredient = InventoryItem & { ingredient: Ingredient | null };

export function calculateCompatibility(recipe: RecipeWithIngredients, inventory: InventoryWithIngredient[], servings = recipe.servings) {
  const factor = servings / recipe.servings;
  const items = recipe.ingredients.map((required) => {
    const batches = inventory.filter((item) => item.ingredientId === required.ingredientId).sort((a, b) => !a.expirationDate ? 1 : !b.expirationDate ? -1 : a.expirationDate.getTime() - b.expirationDate.getTime());
    const needed = Number(required.normalizedQuantity) * factor;
    const stock = batches.reduce((sum, item) => sum + Number(item.normalizedQuantity), 0);
    return { ingredient: required.ingredient, required, needed, stock, missing: Math.max(0, needed - stock), batches };
  });
  const required = items.filter((item) => !item.required.optional);
  const coverage = required.reduce((sum, item) => sum + (item.needed > 0 ? Math.min(1, item.stock / item.needed) : 1), 0);
  const sevenDays = Date.now() + 7 * 86400000;
  const expiringIngredients = items.filter((item) => item.batches.some((batch) => batch.expirationDate && batch.expirationDate.getTime() <= sevenDays)).map((item) => item.ingredient);
  return { score: required.length ? Math.round((coverage / required.length) * 100) : 100, available: items.filter((item) => item.missing <= 0), partiallyAvailable: items.filter((item) => item.missing > 0 && item.stock > 0), missing: items.filter((item) => item.missing > 0), canCook: required.every((item) => item.missing <= 0), expiringIngredients };
}
