import { describe, expect, it } from "vitest";
import { recipeMatchesPreferences } from "@/domain/recipe-preferences";

const tortilla = { ingredients: [{ ingredient: { canonicalName: "huevo", aliases: ["huevos"], category: "EGGS" } }, { ingredient: { canonicalName: "papa", aliases: ["papas"], category: "VEGETABLE" } }] };
const pollo = { ingredients: [{ ingredient: { canonicalName: "pollo", aliases: [], category: "MEAT" } }] };

describe("recipeMatchesPreferences", () => {
  it("excluye ingredientes indicados por el usuario incluso en plural", () => expect(recipeMatchesPreferences(tortilla, { dislikedFoods: ["huevos"] })).toBe(false));
  it("respeta dietas vegetariana y vegana", () => {
    expect(recipeMatchesPreferences(pollo, { dietType: "vegetariana" })).toBe(false);
    expect(recipeMatchesPreferences(tortilla, { dietType: "vegana" })).toBe(false);
  });
});
