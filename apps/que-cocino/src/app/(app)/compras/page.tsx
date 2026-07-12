import { auth } from "@/auth";
import { getPrisma } from "@/server/prisma";
import { ShoppingScreen } from "@/components/shopping-screen";

export const dynamic = "force-dynamic";
export default async function ShoppingPage() {
  const session = await auth(); const db = getPrisma(); const [items, recipes] = await Promise.all([db.shoppingItem.findMany({ where: { userId: session!.user.id }, include: { ingredient: true }, orderBy: [{ completed: "asc" }, { priority: "desc" }] }), db.recipe.findMany({ include: { ingredients: { include: { ingredient: true } } } })]);
  const unlocks = Object.fromEntries(recipes.flatMap((recipe) => recipe.ingredients.map((item) => item.ingredient.canonicalName)).reduce((map, name) => map.set(name, (map.get(name) ?? 0) + 1), new Map<string, number>()));
  return <ShoppingScreen initialItems={JSON.parse(JSON.stringify(items))} unlocks={unlocks} />;
}
