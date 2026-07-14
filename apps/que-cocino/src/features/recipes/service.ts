import type { UserPreferences } from "@prisma/client";
import { calculateCompatibility } from "@/domain/compatibility";
import { recipeMatchesPreferences } from "@/domain/recipe-preferences";
import { getPrisma } from "@/server/prisma";

type RecipeFilters = {
  servings?: number;
  maxTime?: number;
  difficulty?: string;
  mode?: string;
  include?: string[];
  exclude?: string[];
  expiringFirst?: boolean;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es-AR");
}

async function loadRecipeMatches(userId: string, filters: RecipeFilters, knownPreferences?: UserPreferences | null) {
  const db = getPrisma();
  const [recipes, inventory, preferences] = await Promise.all([
    db.recipe.findMany({ include: { ingredients: { include: { ingredient: true } } } }),
    db.inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } }),
    knownPreferences === undefined ? db.userPreferences.findUnique({ where: { userId } }) : Promise.resolve(knownPreferences),
  ]);
  const servings = filters.servings ?? preferences?.householdSize ?? 2;
  return recipes
    .filter((recipe) => recipeMatchesPreferences(recipe, preferences))
    .map((recipe) => ({ recipe, compatibility: calculateCompatibility(recipe, inventory, servings) }));
}

type RecipeMatch = Awaited<ReturnType<typeof loadRecipeMatches>>[number];

function ingredientNames(match: RecipeMatch) {
  return match.recipe.ingredients.map((item) => normalize(item.ingredient.canonicalName));
}

function passesIngredientFilters(match: RecipeMatch, filters: RecipeFilters) {
  const names = ingredientNames(match);
  const include = (filters.include ?? []).map(normalize).filter(Boolean);
  const exclude = (filters.exclude ?? []).map(normalize).filter(Boolean);
  if (include.length && !include.some((name) => names.includes(name))) return false;
  if (exclude.some((name) => names.includes(name))) return false;
  return true;
}

function passesBasicFilters(match: RecipeMatch, filters: RecipeFilters) {
  if (!passesIngredientFilters(match, filters)) return false;
  if (filters.maxTime && match.recipe.prepTime + match.recipe.cookTime > filters.maxTime) return false;
  if (filters.difficulty && match.recipe.difficulty !== filters.difficulty) return false;
  return true;
}

function matchesMode(match: RecipeMatch, mode?: string) {
  const tags = match.recipe.tags.map(normalize);
  if (!mode || mode === "IN_STOCK") return match.compatibility.canCook;
  if (mode === "ONE_MISSING") return match.compatibility.missing.length <= 2;
  if (mode === "FIT") return tags.includes("fit");
  if (mode === "HIGH_PROTEIN") return tags.includes("alto en proteinas");
  if (mode === "BUDGET") return tags.includes("economico");
  if (mode === "QUICK") return tags.includes("rapido");
  if (mode === "FREEZER") return tags.includes("para freezer");
  return true;
}

function sortMatches(matches: RecipeMatch[], filters: RecipeFilters) {
  return [...matches].sort((a, b) => {
    if (filters.expiringFirst && a.compatibility.expiringIngredients.length !== b.compatibility.expiringIngredients.length) {
      return b.compatibility.expiringIngredients.length - a.compatibility.expiringIngredients.length;
    }
    if (a.compatibility.canCook !== b.compatibility.canCook) return a.compatibility.canCook ? -1 : 1;
    if (a.compatibility.missing.length !== b.compatibility.missing.length) return a.compatibility.missing.length - b.compatibility.missing.length;
    return b.compatibility.score - a.compatibility.score;
  });
}

export async function getCompatibleRecipes(userId: string, filters: RecipeFilters, knownPreferences?: UserPreferences | null) {
  const matches = await loadRecipeMatches(userId, filters, knownPreferences);
  return sortMatches(matches.filter((match) => passesBasicFilters(match, filters) && matchesMode(match, filters.mode)), filters);
}

export async function getRecipeRecommendations(userId: string, filters: RecipeFilters, knownPreferences?: UserPreferences | null) {
  const matches = await loadRecipeMatches(userId, filters, knownPreferences);
  const exact = sortMatches(matches.filter((match) => passesBasicFilters(match, filters) && matchesMode(match, filters.mode)), filters);
  const relaxedMode = sortMatches(matches.filter((match) => passesBasicFilters(match, filters) && !exact.some((exactMatch) => exactMatch.recipe.id === match.recipe.id)), filters);
  const excluded = (filters.exclude ?? []).map(normalize).filter(Boolean);
  const broader = sortMatches(matches.filter((match) => {
    if (exact.some((item) => item.recipe.id === match.recipe.id) || relaxedMode.some((item) => item.recipe.id === match.recipe.id)) return false;
    const names = ingredientNames(match);
    return !excluded.some((name) => names.includes(name));
  }), filters);
  const annotate = (items: RecipeMatch[], tier: "EXACT" | "RELAXED" | "DISCOVER") => items.map((item) => ({ ...item, recommendation: { tier, matchesFilters: tier === "EXACT" } }));
  const results = [...annotate(exact, "EXACT"), ...annotate(relaxedMode, "RELAXED"), ...annotate(broader, "DISCOVER")];
  return {
    results,
    summary: {
      exactMatches: exact.length,
      totalSuggestions: results.length,
      relaxed: results.length > exact.length,
    },
  };
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
  const [recipe, inventory, preferences] = await Promise.all([
    db.recipe.findUnique({ where: { slug }, include: { ingredients: { include: { ingredient: true } } } }),
    db.inventoryItem.findMany({ where: { userId, normalizedQuantity: { gt: 0 } }, include: { ingredient: true } }),
    db.userPreferences.findUnique({ where: { userId } }),
  ]);
  if (!recipe || !recipeMatchesPreferences(recipe, preferences)) return null;
  const requestedServings = servings ?? preferences?.householdSize ?? recipe.servings;
  return { recipe, requestedServings, compatibility: calculateCompatibility(recipe, inventory, requestedServings) };
}
