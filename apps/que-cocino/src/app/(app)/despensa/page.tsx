import { requirePageUser } from "@/server/authz";
import { listInventory } from "@/features/inventory/service";
import { InventoryScreen } from "@/components/inventory-screen";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";
export default async function PantryPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const user = await requirePageUser(); const params = await searchParams; const [items, leftovers] = await Promise.all([listInventory(user.id), getPrisma().leftover.findMany({ where: { userId: user.id, consumed: false }, orderBy: { expirationDate: "asc" } })]);
  return <InventoryScreen initialItems={JSON.parse(JSON.stringify(items))} leftovers={JSON.parse(JSON.stringify(leftovers))} autoOpen={params.add === "true"} />;
}
