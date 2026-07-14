import { cn } from "@/lib/utils";

const ingredientEmojis: Array<[string[], string]> = [
  [["papa"], "🥔"],
  [["cebolla"], "🧅"],
  [["morron", "pimiento"], "🫑"],
  [["tomate"], "🍅"],
  [["pollo"], "🍗"],
  [["carne"], "🥩"],
  [["arroz"], "🍚"],
  [["fideo", "pasta"], "🍝"],
  [["harina", "trigo"], "🌾"],
  [["leche"], "🥛"],
  [["manteca", "mantequilla"], "🧈"],
  [["aceite"], "🫒"],
  [["huevo"], "🥚"],
  [["queso"], "🧀"],
  [["lenteja", "poroto", "frijol"], "🫘"],
  [["zanahoria"], "🥕"],
  [["zapallo", "calabaza"], "🎃"],
  [["ajo"], "🧄"],
  [["manzana"], "🍎"],
  [["banana", "platano"], "🍌"],
  [["pescado", "atun"], "🐟"],
  [["pan"], "🍞"],
];

const categoryEmojis: Record<string, string> = {
  MEAT: "🥩",
  VEGETABLE: "🥬",
  FRUIT: "🍎",
  DAIRY: "🥛",
  EGGS: "🥚",
  GRAINS_PASTA: "🌾",
  LEGUMES: "🫘",
  CANNED: "🥫",
  CONDIMENTS: "🧂",
  BEVERAGES: "🥤",
  FROZEN: "❄️",
  OTHER: "🛒",
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR");
}

export function getIngredientEmoji(name: string, category?: string | null) {
  const normalized = normalize(name);
  return ingredientEmojis.find(([matches]) => matches.some((match) => normalized.includes(match)))?.[1] ?? categoryEmojis[category ?? "OTHER"] ?? categoryEmojis.OTHER;
}

export function IngredientIcon({ name, category, size = "md", className }: { name: string; category?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  return <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-2xl bg-secondary shadow-sm ring-1 ring-black/5", size === "sm" ? "size-8 text-lg" : size === "lg" ? "size-14 text-3xl" : "size-11 text-2xl", className)}>{getIngredientEmoji(name, category)}</span>;
}
