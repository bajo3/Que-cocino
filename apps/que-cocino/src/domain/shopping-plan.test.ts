import { describe, expect, it } from "vitest";
import { buildShoppingPlan } from "@/domain/shopping-plan";

const potato = { id: "potato", canonicalName: "papa", category: "VEGETABLE", normalizedUnit: "GRAM" as const };
const egg = { id: "egg", canonicalName: "huevo", category: "EGGS", normalizedUnit: "UNIT" as const };
const recipe = {
  id: "tortilla",
  name: "Tortilla",
  servings: 2,
  ingredients: [
    { normalizedQuantity: 400, optional: false, ingredient: potato },
    { normalizedQuantity: 2, optional: false, ingredient: egg },
  ],
};

describe("buildShoppingPlan", () => {
  it("planifica una comida por día y escala por personas", () => {
    const plan = buildShoppingPlan({ days: 7, householdSize: 4, recipes: [recipe], inventory: [], shopping: [] });
    expect(plan.mealCount).toBe(7);
    expect(plan.recipes).toEqual([{ id: "tortilla", name: "Tortilla", times: 7 }]);
    expect(plan.items.find((item) => item.name === "papa")).toMatchObject({ quantity: 5.6, unit: "kg", mealUses: 7 });
    expect(plan.items.find((item) => item.name === "huevo")).toMatchObject({ quantity: 28, unit: "unidad" });
  });

  it("descuenta la despensa y lo que ya está en la lista", () => {
    const plan = buildShoppingPlan({
      days: 7,
      householdSize: 2,
      recipes: [recipe],
      inventory: [{ ingredientId: "potato", normalizedQuantity: 1000 }],
      shopping: [{ ingredientId: "potato", normalizedQuantity: 500 }, { ingredientId: "egg", normalizedQuantity: 4 }],
    });
    expect(plan.items.find((item) => item.name === "papa")).toMatchObject({ quantity: 1.3, unit: "kg" });
    expect(plan.items.find((item) => item.name === "huevo")).toMatchObject({ quantity: 10, unit: "unidad" });
  });

  it("omite ingredientes opcionales y devuelve un plan vacío sin recetas seguras", () => {
    const optionalRecipe = { ...recipe, ingredients: [{ normalizedQuantity: 1, optional: true, ingredient: egg }] };
    expect(buildShoppingPlan({ days: 15, householdSize: 2, recipes: [optionalRecipe], inventory: [], shopping: [] }).items).toEqual([]);
    expect(buildShoppingPlan({ days: 30, householdSize: 2, recipes: [], inventory: [], shopping: [] }).mealCount).toBe(0);
  });
});
