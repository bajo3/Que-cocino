export type RecipePreferenceInput = {
  allergies?: string[];
  intolerances?: string[];
  dislikedFoods?: string[];
  dietType?: string | null;
};

type RecipeIngredient = {
  ingredient: { canonicalName: string; aliases: string[]; category: string };
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").trim();

export function recipeMatchesPreferences(recipe: { ingredients: RecipeIngredient[] }, preferences: RecipePreferenceInput | null | undefined) {
  if (!preferences) return true;
  const avoided = [...(preferences.allergies ?? []), ...(preferences.intolerances ?? []), ...(preferences.dislikedFoods ?? [])].map(normalize).filter(Boolean);
  const diet = normalize(preferences.dietType ?? "");
  const excludedCategories = new Set<string>();
  if (diet.includes("vegetar")) excludedCategories.add("MEAT");
  if (diet.includes("vegana") || diet.includes("vegano")) ["MEAT", "DAIRY", "EGGS"].forEach((category) => excludedCategories.add(category));
  return recipe.ingredients.every(({ ingredient }) => {
    if (excludedCategories.has(ingredient.category)) return false;
    const names = [ingredient.canonicalName, ...ingredient.aliases].map(normalize);
    return !avoided.some((avoid) => names.some((name) => name === avoid || name.includes(avoid) || avoid.includes(name)));
  });
}
