import { describe, expect, it } from "vitest";
import { calculateCompatibility } from "@/domain/compatibility";

const egg = { id: "egg", canonicalName: "huevo", aliases: ["huevos"] };
const potato = { id: "potato", canonicalName: "papa", aliases: ["papas"] };
const recipe = { servings: 2, ingredients: [
  { ingredientId: "egg", normalizedQuantity: 2, optional: false, ingredient: egg },
  { ingredientId: "potato", normalizedQuantity: 400, optional: false, ingredient: potato },
] };

describe("calculateCompatibility", () => {
  it("reconoce stock por id de ingrediente y escala porciones", () => {
    const inventory = [
      { ingredientId: "egg", normalizedQuantity: 4, expirationDate: null, ingredient: egg },
      { ingredientId: "potato", normalizedQuantity: 800, expirationDate: null, ingredient: potato },
    ];
    const result = calculateCompatibility(recipe as never, inventory as never, 4);
    expect(result.canCook).toBe(true);
    expect(result.score).toBe(100);
  });
  it("marca ingredientes próximos a vencer sin alterar la compatibilidad", () => {
    const inventory = [
      { ingredientId: "egg", normalizedQuantity: 2, expirationDate: new Date(Date.now() + 86400000), ingredient: egg },
      { ingredientId: "potato", normalizedQuantity: 400, expirationDate: null, ingredient: potato },
    ];
    const result = calculateCompatibility(recipe as never, inventory as never);
    expect(result.canCook).toBe(true);
    expect(result.expiringIngredients.map((item) => item.canonicalName)).toEqual(["huevo"]);
  });
  it("reconoce cuando hay una parte del ingrediente y muestra progreso real", () => {
    const inventory = [
      { ingredientId: "egg", normalizedQuantity: 1, expirationDate: null, ingredient: egg },
      { ingredientId: "potato", normalizedQuantity: 400, expirationDate: null, ingredient: potato },
    ];
    const result = calculateCompatibility(recipe as never, inventory as never);
    expect(result.canCook).toBe(false);
    expect(result.score).toBe(75);
    expect(result.partiallyAvailable.map((item) => item.ingredient.canonicalName)).toEqual(["huevo"]);
    expect(result.missing[0].missing).toBe(1);
  });
});
