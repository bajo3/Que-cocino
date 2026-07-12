export const exactUnits = ["g", "kg", "ml", "l", "unidad", "paquete", "lata", "botella"] as const;
export const householdUnits = [
  "taza", "media taza", "cuarto de taza", "cucharada", "cucharadita", "vaso",
  "puñado", "rodaja", "porción", "unidad pequeña", "unidad mediana", "unidad grande",
] as const;
export const acceptedUnits = [...exactUnits, ...householdUnits] as const;
export const locations = ["FRIDGE", "FREEZER", "PANTRY"] as const;

export const categoryLabels: Record<string, string> = {
  MEAT: "Carnes", VEGETABLE: "Verduras", FRUIT: "Frutas", DAIRY: "Lácteos", EGGS: "Huevos",
  GRAINS_PASTA: "Cereales y pastas", LEGUMES: "Legumbres", CANNED: "Conservas",
  CONDIMENTS: "Condimentos", BEVERAGES: "Bebidas", FROZEN: "Congelados", OTHER: "Otros",
};
export const locationLabels: Record<string, string> = { FRIDGE: "Heladera", FREEZER: "Freezer", PANTRY: "Alacena" };
export const normalizedUnitLabels = { GRAM: "g", MILLILITER: "ml", UNIT: "unidad" } as const;
