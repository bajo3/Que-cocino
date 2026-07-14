import { calculateCompatibility } from "@/domain/compatibility";
import { recipeMatchesPreferences } from "@/domain/recipe-preferences";
import { buildShoppingPlan, shoppingPlanDays } from "@/domain/shopping-plan";
import { convertToNormalized } from "@/domain/units";
import { getPrisma } from "@/server/prisma";

export async function getShoppingPlans(userId: string) {
  const db = getPrisma();
  const [recipes, inventory, preferences, shoppingItems] = await Promise.all([
    db.recipe.findMany({ include: { ingredients: { include: { ingredient: true } } } }),
    db.inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } }),
    db.userPreferences.findUnique({ where: { userId } }),
    db.shoppingItem.findMany({
      where: { userId, completed: false, ingredientId: { not: null } },
      include: { ingredient: { include: { equivalences: true } } },
    }),
  ]);
  const householdSize = preferences?.householdSize ?? 2;
  const safeRecipes = recipes
    .filter((recipe) => recipeMatchesPreferences(recipe, preferences))
    .map((recipe) => ({ recipe, compatibility: calculateCompatibility(recipe, inventory, householdSize) }))
    .sort((a, b) => {
      if (a.compatibility.canCook !== b.compatibility.canCook) return a.compatibility.canCook ? -1 : 1;
      if (a.compatibility.score !== b.compatibility.score) return b.compatibility.score - a.compatibility.score;
      return (a.recipe.prepTime + a.recipe.cookTime) - (b.recipe.prepTime + b.recipe.cookTime);
    })
    .map(({ recipe }) => recipe);
  const shoppingStock = shoppingItems.flatMap((item) => {
    if (!item.ingredientId || !item.ingredient) return [];
    const normalized = convertToNormalized(Number(item.quantity), item.unit, item.ingredient);
    return [{ ingredientId: item.ingredientId, normalizedQuantity: normalized.quantity }];
  });

  return {
    householdSize,
    plans: shoppingPlanDays.map((days) => buildShoppingPlan({
      days,
      householdSize,
      recipes: safeRecipes,
      inventory,
      shopping: shoppingStock,
    })),
  };
}
