import { confirmInterpretationSchema, inventoryInputSchema } from "@/schemas/inventory";
import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { createInventoryItem, listInventory } from "@/features/inventory/service";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const url = new URL(request.url);
    const items = await listInventory(userId, { search: url.searchParams.get("search") ?? undefined, category: url.searchParams.get("category") ?? undefined, location: url.searchParams.get("location") ?? undefined, sort: url.searchParams.get("sort") ?? undefined });
    return Response.json({ items });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await readJson(request);
    const bulk = confirmInterpretationSchema.safeParse(body);
    if (bulk.success) {
      const items = [];
      for (const input of bulk.data.items) items.push(await createInventoryItem(userId, input));
      return Response.json({ items }, { status: 201 });
    }
    const input = inventoryInputSchema.parse(body);
    return Response.json({ item: await createInventoryItem(userId, input) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
