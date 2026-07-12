import type { Ingredient, IngredientEquivalence, NormalizedUnit } from "@prisma/client";

type ConvertibleIngredient = Pick<Ingredient, "normalizedUnit" | "gramsPerUnit" | "density"> & { equivalences?: Array<Pick<IngredientEquivalence, "householdUnit" | "householdQuantity" | "normalizedQuantity" | "normalizedUnit">> };
const normalizeUnit = (unit: string) => unit.trim().toLocaleLowerCase("es-AR");

export function inferNormalizedUnit(unit: string): NormalizedUnit {
  if (["ml", "l", "botella", "vaso"].includes(normalizeUnit(unit))) return "MILLILITER";
  if (["unidad", "unidad pequeña", "unidad mediana", "unidad grande"].includes(normalizeUnit(unit))) return "UNIT";
  return "GRAM";
}

export function convertToNormalized(quantity: number, unit: string, ingredient?: ConvertibleIngredient | null) {
  const cleanUnit = normalizeUnit(unit);
  if (cleanUnit === "kg") return { quantity: quantity * 1000, unit: "GRAM" as const, approximate: false };
  if (cleanUnit === "g") return { quantity, unit: "GRAM" as const, approximate: false };
  if (cleanUnit === "l") return { quantity: quantity * 1000, unit: "MILLILITER" as const, approximate: false };
  if (cleanUnit === "ml") return { quantity, unit: "MILLILITER" as const, approximate: false };
  const equivalence = ingredient?.equivalences?.find((item) => normalizeUnit(item.householdUnit) === cleanUnit);
  if (equivalence) return { quantity: quantity * Number(equivalence.normalizedQuantity) / Number(equivalence.householdQuantity), unit: equivalence.normalizedUnit, approximate: true };
  if (["unidad", "paquete", "lata", "botella", "unidad pequeña", "unidad mediana", "unidad grande"].includes(cleanUnit)) {
    if (ingredient?.normalizedUnit === "GRAM" && ingredient.gramsPerUnit) return { quantity: quantity * Number(ingredient.gramsPerUnit), unit: "GRAM" as const, approximate: true };
    return { quantity, unit: ingredient?.normalizedUnit ?? "UNIT", approximate: cleanUnit !== "unidad" };
  }
  return { quantity, unit: ingredient?.normalizedUnit ?? inferNormalizedUnit(unit), approximate: true };
}

export function toDisplayUnit(quantity: number, normalizedUnit: NormalizedUnit) {
  if (normalizedUnit === "GRAM" && quantity >= 1000) return { quantity: quantity / 1000, unit: "kg" };
  if (normalizedUnit === "MILLILITER" && quantity >= 1000) return { quantity: quantity / 1000, unit: "l" };
  return { quantity, unit: normalizedUnit === "GRAM" ? "g" : normalizedUnit === "MILLILITER" ? "ml" : "unidad" };
}
