import { apiError, readJson } from "@/server/api";
import { HttpError, requireUserId } from "@/server/authz";
import { completeShoppingSchema } from "@/schemas/shopping";
import { getPrisma } from "@/server/prisma";
import { convertToNormalized } from "@/domain/units";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId(); const { id } = await params; const input = completeShoppingSchema.parse(await readJson(request)); const db = getPrisma();
    const result = await db.$transaction(async (tx) => {
      const item = await tx.shoppingItem.findFirst({ where: { id, userId }, include: { ingredient: { include: { equivalences: true } } } });
      if (!item) throw new HttpError(404, "Producto de compra no encontrado.");
      const normalized = convertToNormalized(input.quantity, input.unit, item.ingredient);
      const inventory = await tx.inventoryItem.create({ data: { userId, ingredientId: item.ingredientId, customName: item.customName, quantity: input.quantity, unit: input.unit, normalizedQuantity: normalized.quantity, normalizedUnit: normalized.unit, location: input.location, expirationDate: input.expirationDate ? new Date(input.expirationDate) : null } });
      await tx.shoppingItem.update({ where: { id }, data: { completed: true, completedAt: new Date(), quantity: input.quantity, unit: input.unit } });
      return inventory;
    });
    return Response.json({ inventoryItem: result });
  } catch (error) { return apiError(error); }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const userId = await requireUserId(); const { id } = await params; const result = await getPrisma().shoppingItem.deleteMany({ where: { id, userId } }); if (!result.count) throw new HttpError(404, "Producto no encontrado."); return new Response(null, { status: 204 }); }
  catch (error) { return apiError(error); }
}
