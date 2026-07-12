import { shoppingInputSchema } from "@/schemas/shopping";
import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { getPrisma } from "@/server/prisma";
import { findIngredient } from "@/server/ingredients";

export async function GET() {
  try { const userId = await requireUserId(); const items = await getPrisma().shoppingItem.findMany({ where: { userId }, include: { ingredient: true }, orderBy: [{ completed: "asc" }, { priority: "desc" }, { createdAt: "desc" }] }); return Response.json({ items }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try { const userId = await requireUserId(); const input = shoppingInputSchema.parse(await readJson(request)); const db = getPrisma(); const ingredient = await findIngredient(db, input.name); const item = await db.shoppingItem.create({ data: { userId, ingredientId: ingredient?.id, customName: ingredient ? null : input.name, quantity: input.quantity, unit: input.unit, priority: input.priority, source: input.source }, include: { ingredient: true } }); return Response.json({ item }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
