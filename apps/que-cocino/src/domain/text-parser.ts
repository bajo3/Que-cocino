import type { Ingredient, IngredientEquivalence } from "@prisma/client";
import type { InterpretedItem } from "@/schemas/inventory";
import { convertToNormalized } from "@/domain/units";

type ParserIngredient = Ingredient & { equivalences: IngredientEquivalence[] };
export const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR").trim();
const numberWords: Record<string, number> = { un: 1, uno: 1, una: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const unitPatterns: Array<[RegExp, string]> = [[/\b(kilos?|kgs?)\b/, "kg"], [/\b(gramos?|grs?)\b/, "g"], [/\b(litros?|lts?)\b/, "l"], [/\b(mililitros?|ml)\b/, "ml"], [/\bmedias? tazas?\b/, "media taza"], [/\bcuartos? de taza\b/, "cuarto de taza"], [/\btazas?\b/, "taza"], [/\bcucharadas?\b/, "cucharada"], [/\bcucharaditas?\b/, "cucharadita"], [/\bvasos?\b/, "vaso"], [/\bpunados?\b/, "puñado"], [/\brodajas?\b/, "rodaja"], [/\bporciones?\b/, "porción"], [/\bpaquetes?\b/, "paquete"], [/\blatas?\b/, "lata"], [/\bbotellas?\b/, "botella"], [/\bunidades?\b/, "unidad"]];

function findIngredient(segment: string, ingredients: ParserIngredient[]) {
  const clean = normalizeText(segment);
  return ingredients.find((ingredient) => [ingredient.canonicalName, ...ingredient.aliases].map(normalizeText).some((name) => clean.includes(name)));
}

export function parseInventoryText(text: string, ingredients: ParserIngredient[]): InterpretedItem[] {
  const clean = normalizeText(text).replace(/^tengo\s+/, "").replace(/^agrega(me)?\s+/, "");
  const segments = clean.split(/,|\s+y\s+(?=(?:\d|un\b|una\b|medio\b|media\b|dos\b|tres\b|cuatro\b|cinco\b|seis\b))/).map((part) => part.trim()).filter(Boolean);
  return segments.flatMap((segment) => {
    const ingredient = findIngredient(segment, ingredients);
    if (!ingredient) return [];
    const numberMatch = segment.match(/\b(\d+(?:[.,]\d+)?|un|uno|una|medio|media|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
    const rawNumber = numberMatch?.[1] ?? "1";
    const quantity = numberWords[rawNumber] ?? Number(rawNumber.replace(",", "."));
    const unit = unitPatterns.find(([pattern]) => pattern.test(segment))?.[1] ?? "unidad";
    const normalized = convertToNormalized(quantity, unit, ingredient);
    return [{ name: ingredient.canonicalName, quantity, unit: unit as InterpretedItem["unit"], confidence: numberMatch ? 0.93 : 0.76, estimatedGrams: normalized.unit === "GRAM" ? normalized.quantity : null, estimatedMilliliters: normalized.unit === "MILLILITER" ? normalized.quantity : null, approximate: normalized.approximate }];
  });
}
