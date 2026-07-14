import { toDisplayUnit } from "@/domain/units";

export const shoppingPlanDays = [7, 15, 30] as const;
export type ShoppingPlanDays = (typeof shoppingPlanDays)[number];

type PlanIngredient = {
  id: string;
  canonicalName: string;
  category: string;
  normalizedUnit: "GRAM" | "MILLILITER" | "UNIT";
};

type NumericValue = number | string | { toString(): string };

export type ShoppingPlanRecipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: Array<{
    normalizedQuantity: NumericValue;
    optional: boolean;
    ingredient: PlanIngredient;
  }>;
};

type StockLine = { ingredientId: string | null; normalizedQuantity: NumericValue };

export type ShoppingPlan = {
  days: ShoppingPlanDays;
  mealCount: number;
  householdSize: number;
  items: Array<{
    ingredientId: string;
    name: string;
    category: string;
    quantity: number;
    unit: "g" | "kg" | "ml" | "l" | "unidad";
    normalizedQuantity: number;
    normalizedUnit: PlanIngredient["normalizedUnit"];
    mealUses: number;
    recipeNames: string[];
  }>;
  recipes: Array<{ id: string; name: string; times: number }>;
};

function roundedShoppingQuantity(quantity: number, unit: PlanIngredient["normalizedUnit"]) {
  if (unit === "UNIT") return Math.ceil(quantity);
  return Math.ceil(quantity / 50) * 50;
}

export function buildShoppingPlan({
  days,
  householdSize,
  recipes,
  inventory,
  shopping,
}: {
  days: ShoppingPlanDays;
  householdSize: number;
  recipes: ShoppingPlanRecipe[];
  inventory: StockLine[];
  shopping: StockLine[];
}): ShoppingPlan {
  const selected = recipes.length
    ? Array.from({ length: days }, (_, index) => recipes[index % recipes.length])
    : [];
  const recipeCounts = new Map<string, { id: string; name: string; times: number }>();
  const requirements = new Map<string, {
    ingredient: PlanIngredient;
    needed: number;
    mealUses: number;
    recipeNames: Set<string>;
  }>();

  for (const recipe of selected) {
    const summary = recipeCounts.get(recipe.id) ?? { id: recipe.id, name: recipe.name, times: 0 };
    summary.times += 1;
    recipeCounts.set(recipe.id, summary);
    const factor = householdSize / recipe.servings;
    for (const line of recipe.ingredients) {
      if (line.optional) continue;
      const current = requirements.get(line.ingredient.id) ?? {
        ingredient: line.ingredient,
        needed: 0,
        mealUses: 0,
        recipeNames: new Set<string>(),
      };
      current.needed += Number(line.normalizedQuantity) * factor;
      current.mealUses += 1;
      current.recipeNames.add(recipe.name);
      requirements.set(line.ingredient.id, current);
    }
  }

  const available = [...inventory, ...shopping].reduce((result, line) => {
    if (line.ingredientId) result.set(line.ingredientId, (result.get(line.ingredientId) ?? 0) + Number(line.normalizedQuantity));
    return result;
  }, new Map<string, number>());

  const items = [...requirements.entries()].flatMap(([ingredientId, requirement]) => {
    const missing = Math.max(0, requirement.needed - (available.get(ingredientId) ?? 0));
    if (missing <= 0.001) return [];
    const normalizedQuantity = roundedShoppingQuantity(missing, requirement.ingredient.normalizedUnit);
    const display = toDisplayUnit(normalizedQuantity, requirement.ingredient.normalizedUnit);
    return [{
      ingredientId,
      name: requirement.ingredient.canonicalName,
      category: requirement.ingredient.category,
      quantity: Number(display.quantity.toFixed(2)),
      unit: display.unit as ShoppingPlan["items"][number]["unit"],
      normalizedQuantity,
      normalizedUnit: requirement.ingredient.normalizedUnit,
      mealUses: requirement.mealUses,
      recipeNames: [...requirement.recipeNames],
    }];
  }).sort((a, b) => b.mealUses - a.mealUses || a.name.localeCompare(b.name, "es"));

  return {
    days,
    mealCount: selected.length,
    householdSize,
    items,
    recipes: [...recipeCounts.values()],
  };
}
