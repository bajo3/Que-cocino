import { inventoryUpdateSchema } from "@/schemas/inventory";
import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { deleteInventoryItem, updateInventoryItem } from "@/features/inventory/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const userId = await requireUserId(); const { id } = await params; const input = inventoryUpdateSchema.parse(await readJson(request)); return Response.json({ item: await updateInventoryItem(userId, id, input) }); }
  catch (error) { return apiError(error); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const userId = await requireUserId(); const { id } = await params; await deleteInventoryItem(userId, id); return new Response(null, { status: 204 }); }
  catch (error) { return apiError(error); }
}
