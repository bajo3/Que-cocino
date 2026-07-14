import { PrismaClient, IngredientCategory, NormalizedUnit, Difficulty } from "@prisma/client";
import { hash } from "bcryptjs";

function getSeedDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "1");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

const seedDatabaseUrl = getSeedDatabaseUrl();
const prisma = new PrismaClient({ datasources: seedDatabaseUrl ? { db: { url: seedDatabaseUrl } } : undefined });

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
  {
    slug: "omelette-de-queso",
    name: "Omelette de queso",
    description: "Una opción rápida, cremosa y proteica para resolver cualquier comida.",
    servings: 2, prepTime: 5, cookTime: 10, difficulty: Difficulty.EASY,
    tags: ["rápido", "alto en proteínas", "vegetariano"], calories: 330, protein: 24,
    instructions: ["Batí los huevos con la leche.", "Volcá la mezcla en una sartén caliente y cociná a fuego bajo.", "Agregá el queso, doblá el omelette y terminá la cocción."],
    items: [["huevo", 4, "unidad"], ["queso", 100, "g"], ["leche", 40, "ml"]],
  },
  {
    slug: "milanesas-de-pollo-al-horno",
    name: "Milanesas de pollo al horno",
    description: "Milanesas livianas y crocantes con ingredientes básicos de la despensa.",
    servings: 4, prepTime: 20, cookTime: 25, difficulty: Difficulty.EASY,
    tags: ["alto en proteínas", "para freezer", "económico"], calories: 410, protein: 43,
    instructions: ["Cortá el pollo en bifes parejos.", "Pasalos por huevo batido y luego por harina condimentada.", "Rociá con aceite y horneá hasta que estén dorados y bien cocidos."],
    items: [["pollo", 800, "g"], ["huevo", 2, "unidad"], ["harina", 180, "g"], ["aceite", 20, "ml"]],
  },
  {
    slug: "arroz-con-huevo-y-verduras",
    name: "Arroz con huevo y verduras",
    description: "Un salteado completo, rápido y perfecto para aprovechar arroz y vegetales.",
    servings: 4, prepTime: 10, cookTime: 20, difficulty: Difficulty.EASY,
    tags: ["rápido", "económico", "vegetariano"], calories: 420, protein: 18,
    instructions: ["Cociná el arroz y dejalo entibiar.", "Salteá cebolla, morrón y zanahoria.", "Sumá los huevos, revolvé y terminá incorporando el arroz."],
    items: [["arroz", 320, "g"], ["huevo", 4, "unidad"], ["cebolla", 150, "g"], ["morrón", 1, "unidad"], ["zanahoria", 150, "g"], ["aceite", 20, "ml"]],
  },
  {
    slug: "crema-de-zapallo",
    name: "Crema de zapallo",
    description: "Sopa suave y reconfortante con pocos ingredientes y mucho sabor.",
    servings: 4, prepTime: 10, cookTime: 30, difficulty: Difficulty.EASY,
    tags: ["fit", "económico", "vegetariano"], calories: 230, protein: 8,
    instructions: ["Rehogá cebolla y ajo.", "Agregá el zapallo en cubos y cubrí con agua.", "Cociná hasta tiernizar, procesá y terminá con leche."],
    items: [["zapallo", 1000, "g"], ["cebolla", 150, "g"], ["ajo", 1, "unidad"], ["leche", 250, "ml"]],
  },
  {
    slug: "croquetas-de-lentejas",
    name: "Croquetas de lentejas",
    description: "Croquetas doradas, rendidoras y llenas de proteína vegetal.",
    servings: 4, prepTime: 20, cookTime: 20, difficulty: Difficulty.MEDIUM,
    tags: ["fit", "económico", "para freezer"], calories: 360, protein: 20,
    instructions: ["Cociná las lentejas y escurrilas bien.", "Procesalas con cebolla, zanahoria, huevo y harina.", "Formá las croquetas y cocinalas al horno o en sartén."],
    items: [["lentejas", 320, "g"], ["cebolla", 120, "g"], ["zanahoria", 120, "g"], ["huevo", 1, "unidad"], ["harina", 80, "g"]],
  },
  {
    slug: "pollo-salteado-con-verduras",
    name: "Pollo salteado con verduras",
    description: "Pollo jugoso con vegetales crocantes, listo en media hora.",
    servings: 4, prepTime: 15, cookTime: 15, difficulty: Difficulty.EASY,
    tags: ["rápido", "fit", "alto en proteínas"], calories: 390, protein: 46,
    instructions: ["Cortá el pollo y las verduras en tiras.", "Dorá el pollo a fuego fuerte y retiralo.", "Salteá los vegetales, devolvé el pollo y cociná todo junto unos minutos."],
    items: [["pollo", 700, "g"], ["cebolla", 150, "g"], ["morrón", 1, "unidad"], ["zanahoria", 180, "g"], ["ajo", 1, "unidad"], ["aceite", 20, "ml"]],
  },
  {
    slug: "albondigas-con-salsa",
    name: "Albóndigas con salsa",
    description: "Albóndigas tiernas en salsa de tomate, ideales con arroz o fideos.",
    servings: 4, prepTime: 25, cookTime: 30, difficulty: Difficulty.MEDIUM,
    tags: ["alto en proteínas", "para freezer", "económico"], calories: 480, protein: 35,
    instructions: ["Mezclá la carne con huevo, harina y cebolla picada.", "Formá las albóndigas y doralas.", "Agregá el puré de tomate y cociná a fuego suave hasta completar la cocción."],
    items: [["carne picada", 600, "g"], ["huevo", 1, "unidad"], ["harina", 60, "g"], ["cebolla", 150, "g"], ["puré de tomate", 500, "g"]],
  },
  {
    slug: "noquis-de-papa-con-salsa",
    name: "Ñoquis de papa con salsa",
    description: "Ñoquis caseros suaves con una salsa de tomate simple.",
    servings: 4, prepTime: 35, cookTime: 20, difficulty: Difficulty.MEDIUM,
    tags: ["económico", "vegetariano"], calories: 510, protein: 15,
    instructions: ["Herví las papas y prepará un puré seco.", "Sumá huevo y harina, uní sin amasar de más y cortá los ñoquis.", "Hervilos hasta que suban y servilos con la salsa de tomate y cebolla."],
    items: [["papa", 800, "g"], ["harina", 280, "g"], ["huevo", 1, "unidad"], ["puré de tomate", 500, "g"], ["cebolla", 120, "g"]],
  },
  {
    slug: "fideos-con-pollo",
    name: "Fideos con pollo",
    description: "Pasta con pollo y salsa suave para una comida completa y familiar.",
    servings: 4, prepTime: 12, cookTime: 25, difficulty: Difficulty.EASY,
    tags: ["rápido", "alto en proteínas", "económico"], calories: 560, protein: 37,
    instructions: ["Cociná los fideos hasta que estén al dente.", "Dorá el pollo en cubos con cebolla y ajo.", "Agregá tomate, cociná unos minutos y mezclá con la pasta."],
    items: [["fideos", 400, "g"], ["pollo", 500, "g"], ["cebolla", 150, "g"], ["ajo", 1, "unidad"], ["puré de tomate", 350, "g"]],
  },
  {
    slug: "arroz-con-lentejas",
    name: "Arroz con lentejas",
    description: "Plato económico y nutritivo que combina cereal, legumbre y verduras.",
    servings: 4, prepTime: 10, cookTime: 35, difficulty: Difficulty.EASY,
    tags: ["fit", "económico", "vegetariano"], calories: 440, protein: 21,
    instructions: ["Rehogá cebolla, zanahoria y ajo.", "Sumá arroz y lentejas con agua suficiente.", "Cociná a fuego bajo hasta que todo esté tierno."],
    items: [["arroz", 220, "g"], ["lentejas", 220, "g"], ["cebolla", 150, "g"], ["zanahoria", 150, "g"], ["ajo", 1, "unidad"]],
  },
  {
    slug: "tortilla-de-zapallo-y-queso",
    name: "Tortilla de zapallo y queso",
    description: "Tortilla húmeda y sabrosa para sumar verduras de otra manera.",
    servings: 4, prepTime: 15, cookTime: 25, difficulty: Difficulty.MEDIUM,
    tags: ["vegetariano", "económico", "alto en proteínas"], calories: 350, protein: 20,
    instructions: ["Cociná el zapallo y hacé un puré firme.", "Mezclalo con huevos, queso y cebolla rehogada.", "Cociná la tortilla a fuego bajo de ambos lados."],
    items: [["zapallo", 650, "g"], ["huevo", 5, "unidad"], ["queso", 120, "g"], ["cebolla", 120, "g"]],
  },
  {
    slug: "panqueques-salados-de-queso",
    name: "Panqueques salados de queso",
    description: "Panqueques simples y flexibles para una cena rápida o una vianda.",
    servings: 4, prepTime: 15, cookTime: 20, difficulty: Difficulty.EASY,
    tags: ["vegetariano", "económico", "rápido"], calories: 400, protein: 19,
    instructions: ["Mezclá huevo, leche y harina hasta obtener una masa lisa.", "Cociná panqueques finos en una sartén apenas aceitada.", "Rellenalos con queso y calentá hasta que se funda."],
    items: [["harina", 220, "g"], ["huevo", 2, "unidad"], ["leche", 450, "ml"], ["queso", 220, "g"], ["aceite", 10, "ml"]],
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
