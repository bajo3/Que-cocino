import { requirePageUser } from "@/server/authz";
import { getPrisma } from "@/server/prisma";
import { ShoppingScreen } from "@/components/shopping-screen";
import { getShoppingUnlocks } from "@/features/recipes/service";
import { getShoppingPlans } from "@/features/shopping/service";

export const dynamic = "force-dynamic";
export default async function ShoppingPage() {
  const user = await requirePageUser();
  const db = getPrisma();
  const [items, unlocks, planning] = await Promise.all([
    db.shoppingItem.findMany({ where: { userId: user.id }, include: { ingredient: true }, orderBy: [{ completed: "asc" }, { priority: "desc" }] }),
    getShoppingUnlocks(user.id),
    getShoppingPlans(user.id),
  ]);
  return <ShoppingScreen initialItems={JSON.parse(JSON.stringify(items))} unlocks={unlocks} plans={planning.plans} householdSize={planning.householdSize} />;
}
