import { calculateCompatibility } from "@/domain/compatibility";
import { recipeMatchesPreferences } from "@/domain/recipe-preferences";
import { getPrisma } from "@/server/prisma";

type RecipeFilters = { servings?: number; maxTime?: number; difficulty?: string; mode?: string; include?: string[]; exclude?: string[]; expiringFirst?: boolean };

export async function getCompatibleRecipes(userId: string, filters: RecipeFilters) {
  const db = getPrisma();
  const [recipes, inventory, preferences] = await Promise.all([
    db.recipe.findMany({ where: { ...(filters.difficulty ? { difficulty: filters.difficulty as never } : {}), ...(filters.maxTime ? { AND: [{ prepTime: { lte: filters.maxTime } }, { cookTime: { lte: filters.maxTime } }] } : {}) }, include: { ingredients: { include: { ingredient: true } } } }),
    db.inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } }),
    db.userPreferences.findUnique({ where: { userId } }),
  ]);
  const servings = filters.servings ?? preferences?.householdSize ?? 2;
  return recipes.map((recipe) => ({ recipe, compatibility: calculateCompatibility(recipe, inventory, servings) })).filter(({ recipe, compatibility }) => {
    if (!recipeMatchesPreferences(recipe, preferences)) return false;
    if (filters.maxTime && recipe.prepTime + recipe.cookTime > filters.maxTime) return false;
    const names = recipe.ingredients.map((item) => item.ingredient.canonicalName.toLocaleLowerCase());
    const tags = recipe.tags.map((tag) => tag.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR"));
    if (filters.include?.length && !filters.include.some((name) => names.includes(name.toLocaleLowerCase()))) return false;
    if (filters.exclude?.some((name) => names.includes(name.toLocaleLowerCase()))) return false;
    if (filters.mode === "IN_STOCK" && !compatibility.canCook) return false;
    if (filters.mode === "ONE_MISSING" && compatibility.missing.length > 2) return false;
    if (filters.mode === "FIT" && !tags.includes("fit")) return false;
    if (filters.mode === "HIGH_PROTEIN" && !tags.includes("alto en proteinas")) return false;
    if (filters.mode === "BUDGET" && !tags.includes("economico")) return false;
    if (filters.mode === "QUICK" && !tags.includes("rapido")) return false;
    if (filters.mode === "FREEZER" && !tags.includes("para freezer")) return false;
    return true;
  }).sort((a, b) => {
    if (filters.expiringFirst && a.compatibility.expiringIngredients.length !== b.compatibility.expiringIngredients.length) return b.compatibility.expiringIngredients.length - a.compatibility.expiringIngredients.length;
    return b.compatibility.score - a.compatibility.score;
  });
}

export async function getShoppingUnlocks(userId: string) {
  const results = await getCompatibleRecipes(userId, { mode: "ONE_MISSING" });
  const unlocked = new Map<string, Set<string>>();
  for (const { recipe, compatibility } of results) {
    if (compatibility.canCook || compatibility.missing.length !== 1) continue;
    const name = compatibility.missing[0].ingredient.canonicalName;
    const recipeIds = unlocked.get(name) ?? new Set<string>();
    recipeIds.add(recipe.id);
    unlocked.set(name, recipeIds);
  }
  return Object.fromEntries([...unlocked.entries()].map(([name, recipeIds]) => [name, recipeIds.size]));
}

export async function getRecipeForUser(userId: string, slug: string, servings?: number) {
  const db = getPrisma();
  const [recipe, inventory, preferences] = await Promise.all([db.recipe.findUnique({ where: { slug }, include: { ingredients: { include: { ingredient: true } } } }), db.inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } }), db.userPreferences.findUnique({ where: { userId } })]);
  if (!recipe || !recipeMatchesPreferences(recipe, preferences)) return null;
  const requestedServings = servings ?? preferences?.householdSize ?? recipe.servings;
  return { recipe, requestedServings, compatibility: calculateCompatibility(recipe, inventory, requestedServings) };
}
