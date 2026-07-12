import { calculateCompatibility } from "@/domain/compatibility";
import { getPrisma } from "@/server/prisma";

export async function getCompatibleRecipes(userId: string, filters: { servings: number; maxTime?: number; difficulty?: string; mode?: string; include?: string[]; exclude?: string[]; expiringFirst?: boolean }) {
  const db = getPrisma();
  const [recipes, inventory] = await Promise.all([
    db.recipe.findMany({ where: { ...(filters.difficulty ? { difficulty: filters.difficulty as never } : {}), ...(filters.maxTime ? { AND: [{ prepTime: { lte: filters.maxTime } }, { cookTime: { lte: filters.maxTime } }] } : {}) }, include: { ingredients: { include: { ingredient: true } } } }),
    db.inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } }),
  ]);
  return recipes.map((recipe) => ({ recipe, compatibility: calculateCompatibility(recipe, inventory, filters.servings) })).filter(({ recipe, compatibility }) => {
    if (filters.maxTime && recipe.prepTime + recipe.cookTime > filters.maxTime) return false;
    const names = recipe.ingredients.map((item) => item.ingredient.canonicalName.toLocaleLowerCase());
    if (filters.include?.length && !filters.include.some((name) => names.includes(name.toLocaleLowerCase()))) return false;
    if (filters.exclude?.some((name) => names.includes(name.toLocaleLowerCase()))) return false;
    if (filters.mode === "IN_STOCK" && !compatibility.canCook) return false;
    if (filters.mode === "ONE_MISSING" && compatibility.missing.length > 2) return false;
    if (filters.mode === "FIT" && !recipe.tags.includes("fit")) return false;
    if (filters.mode === "HIGH_PROTEIN" && !recipe.tags.includes("alto en proteínas")) return false;
    if (filters.mode === "BUDGET" && !recipe.tags.includes("económico")) return false;
    if (filters.mode === "QUICK" && !recipe.tags.includes("rápido")) return false;
    if (filters.mode === "FREEZER" && !recipe.tags.includes("para freezer")) return false;
    return true;
  }).sort((a, b) => b.compatibility.score - a.compatibility.score);
}

export async function getRecipeForUser(userId: string, slug: string, servings?: number) {
  const db = getPrisma();
  const [recipe, inventory] = await Promise.all([db.recipe.findUnique({ where: { slug }, include: { ingredients: { include: { ingredient: true } } } }), db.inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } })]);
  if (!recipe) return null;
  return { recipe, requestedServings: servings ?? recipe.servings, compatibility: calculateCompatibility(recipe, inventory, servings ?? recipe.servings) };
}
