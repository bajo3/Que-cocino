import { auth } from "@/auth";
import { listInventory } from "@/features/inventory/service";
import { InventoryScreen } from "@/components/inventory-screen";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";
export default async function PantryPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const session = await auth(); const params = await searchParams; const [items, leftovers] = await Promise.all([listInventory(session!.user.id), getPrisma().leftover.findMany({ where: { userId: session!.user.id, consumed: false }, orderBy: { expirationDate: "asc" } })]);
  return <InventoryScreen initialItems={JSON.parse(JSON.stringify(items))} leftovers={JSON.parse(JSON.stringify(leftovers))} autoOpen={params.add === "true"} />;
}
