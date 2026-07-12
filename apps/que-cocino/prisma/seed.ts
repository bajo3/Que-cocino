import { PrismaClient, IngredientCategory, NormalizedUnit, Difficulty } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

type IngredientSeed = {
  name: string;
  category: IngredientCategory;
  unit: string;
  normalizedUnit: NormalizedUnit;
  aliases?: string[];
  gramsPerUnit?: number;
  density?: number;
  equivalences?: Array<{ unit: string; normalized: number; normalizedUnit?: NormalizedUnit; note?: string }>;
};

const ingredients: IngredientSeed[] = [
  { name: "papa", category: "VEGETABLE", unit: "g", normalizedUnit: "GRAM", aliases: ["papas"], gramsPerUnit: 200, equivalences: [{ unit: "unidad mediana", normalized: 200, note: "Una papa mediana" }] },
  { name: "cebolla", category: "VEGETABLE", unit: "g", normalizedUnit: "GRAM", aliases: ["cebollas"], gramsPerUnit: 150, equivalences: [{ unit: "unidad mediana", normalized: 150, note: "Una cebolla mediana" }] },
  { name: "morrón", category: "VEGETABLE", unit: "unidad", normalizedUnit: "UNIT", aliases: ["morron", "pimiento", "pimientos"], gramsPerUnit: 160, equivalences: [{ unit: "unidad mediana", normalized: 1, normalizedUnit: "UNIT" }] },
  { name: "tomate", category: "VEGETABLE", unit: "g", normalizedUnit: "GRAM", aliases: ["tomates"], gramsPerUnit: 150, equivalences: [{ unit: "unidad mediana", normalized: 150 }] },
  { name: "puré de tomate", category: "CANNED", unit: "g", normalizedUnit: "GRAM", aliases: ["pure de tomate", "tomate triturado"], gramsPerUnit: 520 },
  { name: "pollo", category: "MEAT", unit: "g", normalizedUnit: "GRAM", aliases: ["pollo entero"], gramsPerUnit: 1800, equivalences: [{ unit: "unidad", normalized: 1800, note: "Pollo entero promedio" }] },
  { name: "carne picada", category: "MEAT", unit: "g", normalizedUnit: "GRAM", aliases: ["carne molida"], equivalences: [{ unit: "taza", normalized: 225 }] },
  { name: "arroz", category: "GRAINS_PASTA", unit: "g", normalizedUnit: "GRAM", equivalences: [{ unit: "taza", normalized: 190, note: "Arroz crudo" }, { unit: "media taza", normalized: 95 }] },
  { name: "fideos", category: "GRAINS_PASTA", unit: "g", normalizedUnit: "GRAM", aliases: ["pasta"] },
  { name: "harina", category: "GRAINS_PASTA", unit: "g", normalizedUnit: "GRAM", equivalences: [{ unit: "taza", normalized: 125 }, { unit: "cucharada", normalized: 8 }] },
  { name: "leche", category: "DAIRY", unit: "ml", normalizedUnit: "MILLILITER", density: 1.03, equivalences: [{ unit: "taza", normalized: 240, normalizedUnit: "MILLILITER" }, { unit: "vaso", normalized: 250, normalizedUnit: "MILLILITER" }] },
  { name: "manteca", category: "DAIRY", unit: "g", normalizedUnit: "GRAM", aliases: ["mantequilla"], equivalences: [{ unit: "cucharada", normalized: 14 }] },
  { name: "aceite", category: "CONDIMENTS", unit: "ml", normalizedUnit: "MILLILITER", equivalences: [{ unit: "cucharada", normalized: 15, normalizedUnit: "MILLILITER" }, { unit: "cucharadita", normalized: 5, normalizedUnit: "MILLILITER" }] },
  { name: "huevo", category: "EGGS", unit: "unidad", normalizedUnit: "UNIT", aliases: ["huevos"], gramsPerUnit: 55 },
  { name: "queso", category: "DAIRY", unit: "g", normalizedUnit: "GRAM", equivalences: [{ unit: "taza", normalized: 110, note: "Queso rallado" }, { unit: "rodaja", normalized: 25 }] },
  { name: "lentejas", category: "LEGUMES", unit: "g", normalizedUnit: "GRAM", aliases: ["lenteja"], equivalences: [{ unit: "taza", normalized: 200, note: "Lentejas secas" }] },
  { name: "porotos", category: "LEGUMES", unit: "g", normalizedUnit: "GRAM", aliases: ["poroto", "frijoles", "frijol"], equivalences: [{ unit: "taza", normalized: 190, note: "Porotos secos" }] },
  { name: "zanahoria", category: "VEGETABLE", unit: "g", normalizedUnit: "GRAM", aliases: ["zanahorias"], gramsPerUnit: 100 },
  { name: "zapallo", category: "VEGETABLE", unit: "g", normalizedUnit: "GRAM", aliases: ["calabaza"] },
  { name: "ajo", category: "CONDIMENTS", unit: "unidad", normalizedUnit: "UNIT", aliases: ["diente de ajo", "dientes de ajo"], gramsPerUnit: 5 },
];

const recipes = [
  {
    slug: "pastel-de-papa",
    name: "Pastel de papa",
    description: "Un clásico rendidor con carne, cebolla y una cubierta cremosa de papa.",
    servings: 4, prepTime: 25, cookTime: 35, difficulty: Difficulty.MEDIUM,
    tags: ["económico", "para freezer", "alto en proteínas"], calories: 540, protein: 31,
    instructions: ["Herví las papas hasta que estén tiernas y prepará un puré con leche y manteca.", "Rehogá la cebolla y el morrón; sumá la carne picada y cociná por completo.", "Distribuí el relleno en una fuente, cubrí con puré y gratiná hasta dorar."],
    items: [["papa", 800, "g", "Aproximadamente 4 papas medianas"], ["carne picada", 500, "g"], ["cebolla", 200, "g", "Aproximadamente 1 cebolla grande"], ["morrón", 1, "unidad"], ["leche", 150, "ml", "Algo más de media taza"], ["manteca", 30, "g", "Aproximadamente 2 cucharadas"]],
  },
  {
    slug: "pollo-al-horno-con-papas",
    name: "Pollo al horno con papas",
    description: "Pollo dorado con papas, cebolla y ajo en una sola fuente.",
    servings: 4, prepTime: 15, cookTime: 55, difficulty: Difficulty.EASY,
    tags: ["alto en proteínas", "sin compras"], calories: 610, protein: 49,
    instructions: ["Calentá el horno a 200 °C.", "Cortá las papas y la cebolla, mezclalas con aceite y ajo.", "Acomodá el pollo encima, condimentá y horneá hasta que esté bien cocido."],
    items: [["pollo", 1200, "g"], ["papa", 800, "g", "Aproximadamente 4 papas medianas"], ["cebolla", 300, "g", "Aproximadamente 2 cebollas medianas"], ["ajo", 2, "unidad"], ["aceite", 30, "ml", "2 cucharadas"]],
  },
  {
    slug: "guiso-de-lentejas",
    name: "Guiso de lentejas",
    description: "Guiso casero de legumbres y verduras, ideal para cocinar de más.",
    servings: 4, prepTime: 15, cookTime: 45, difficulty: Difficulty.EASY,
    tags: ["económico", "fit", "para freezer"], calories: 430, protein: 23,
    instructions: ["Rehogá cebolla, morrón, zanahoria y ajo.", "Agregá tomate, lentejas y agua suficiente.", "Cociná a fuego suave hasta que las lentejas estén tiernas."],
    items: [["lentejas", 320, "g"], ["cebolla", 150, "g"], ["morrón", 1, "unidad"], ["zanahoria", 200, "g"], ["puré de tomate", 300, "g"], ["ajo", 1, "unidad"]],
  },
  {
    slug: "tortilla-de-papas",
    name: "Tortilla de papas",
    description: "Tortilla dorada y jugosa con pocos ingredientes.",
    servings: 4, prepTime: 15, cookTime: 25, difficulty: Difficulty.MEDIUM,
    tags: ["rápido", "económico", "vegetariano"], calories: 390, protein: 17,
    instructions: ["Cortá las papas y la cebolla finas.", "Cocinalas a fuego medio con aceite hasta tiernizar.", "Mezclá con huevos batidos y cociná la tortilla de ambos lados."],
    items: [["papa", 600, "g", "Aproximadamente 3 papas medianas"], ["cebolla", 150, "g", "1 cebolla mediana"], ["huevo", 6, "unidad"], ["aceite", 45, "ml", "3 cucharadas"]],
  },
  {
    slug: "arroz-con-pollo",
    name: "Arroz con pollo",
    description: "Plato completo, colorido y fácil de adaptar al stock disponible.",
    servings: 4, prepTime: 15, cookTime: 30, difficulty: Difficulty.EASY,
    tags: ["alto en proteínas", "económico"], calories: 520, protein: 38,
    instructions: ["Dorá el pollo cortado en cubos.", "Sumá cebolla y morrón y cociná hasta ablandar.", "Agregá arroz y líquido; cociná tapado hasta que el arroz esté listo."],
    items: [["pollo", 600, "g"], ["arroz", 300, "g", "Aproximadamente 1½ tazas"], ["cebolla", 150, "g"], ["morrón", 1, "unidad"], ["puré de tomate", 200, "g"]],
  },
  {
    slug: "fideos-con-salsa",
    name: "Fideos con salsa rápida",
    description: "Una comida simple y lista en menos de media hora.",
    servings: 4, prepTime: 8, cookTime: 20, difficulty: Difficulty.EASY,
    tags: ["rápido", "económico", "vegetariano"], calories: 470, protein: 16,
    instructions: ["Herví los fideos en agua con sal.", "Rehogá cebolla y ajo, agregá el puré de tomate y cociná 15 minutos.", "Mezclá con la pasta y terminá con queso si tenés."],
    items: [["fideos", 400, "g"], ["puré de tomate", 500, "g"], ["cebolla", 150, "g"], ["ajo", 1, "unidad"], ["queso", 80, "g"]],
  },
] as const;

async function main() {
  const ingredientIds = new Map<string, string>();
  for (const item of ingredients) {
    const ingredient = await prisma.ingredient.upsert({
      where: { canonicalName: item.name },
      update: { category: item.category, defaultUnit: item.unit, normalizedUnit: item.normalizedUnit, aliases: item.aliases ?? [], gramsPerUnit: item.gramsPerUnit, density: item.density },
      create: { canonicalName: item.name, category: item.category, defaultUnit: item.unit, normalizedUnit: item.normalizedUnit, aliases: item.aliases ?? [], gramsPerUnit: item.gramsPerUnit, density: item.density },
    });
    ingredientIds.set(item.name, ingredient.id);
    for (const eq of item.equivalences ?? []) {
      await prisma.ingredientEquivalence.upsert({
        where: { ingredientId_householdUnit_householdQuantity: { ingredientId: ingredient.id, householdUnit: eq.unit, householdQuantity: 1 } },
        update: { normalizedQuantity: eq.normalized, normalizedUnit: eq.normalizedUnit ?? item.normalizedUnit, note: eq.note },
        create: { ingredientId: ingredient.id, householdUnit: eq.unit, householdQuantity: 1, normalizedQuantity: eq.normalized, normalizedUnit: eq.normalizedUnit ?? item.normalizedUnit, note: eq.note },
      });
    }
  }

  for (const recipe of recipes) {
    const saved = await prisma.recipe.upsert({
      where: { slug: recipe.slug },
      update: { name: recipe.name, description: recipe.description, servings: recipe.servings, prepTime: recipe.prepTime, cookTime: recipe.cookTime, difficulty: recipe.difficulty, instructions: recipe.instructions, tags: [...recipe.tags], estimatedCalories: recipe.calories, estimatedProtein: recipe.protein, source: "seed" },
      create: { slug: recipe.slug, name: recipe.name, description: recipe.description, servings: recipe.servings, prepTime: recipe.prepTime, cookTime: recipe.cookTime, difficulty: recipe.difficulty, instructions: recipe.instructions, tags: [...recipe.tags], estimatedCalories: recipe.calories, estimatedProtein: recipe.protein, source: "seed" },
    });
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: saved.id } });
    await prisma.recipeIngredient.createMany({ data: recipe.items.map(([name, quantity, unit, householdMeasure]) => ({ recipeId: saved.id, ingredientId: ingredientIds.get(name)!, quantity, unit, normalizedQuantity: quantity, normalizedUnit: ingredients.find((i) => i.name === name)!.normalizedUnit, householdMeasure: householdMeasure ?? null })) });
  }

  const email = "demo@quecocino.app";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Feli", email, passwordHash: await hash("demo1234", 12) },
  });
  await prisma.userPreferences.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, householdSize: 4 } });

  if ((await prisma.inventoryItem.count({ where: { userId: user.id } })) === 0) {
    const demo = [["papa", 2000, "g", "PANTRY"], ["cebolla", 1000, "g", "PANTRY"], ["pollo", 1500, "g", "FREEZER"], ["huevo", 8, "unidad", "FRIDGE"], ["leche", 1000, "ml", "FRIDGE"]] as const;
    await prisma.inventoryItem.createMany({ data: demo.map(([name, quantity, unit, location], index) => ({ userId: user.id, ingredientId: ingredientIds.get(name)!, quantity, unit, normalizedQuantity: quantity, normalizedUnit: ingredients.find((i) => i.name === name)!.normalizedUnit, location, expirationDate: index < 2 ? new Date(Date.now() + (index + 2) * 86400000) : null })) });
  }
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
