import { shoppingBatchInputSchema } from "@/schemas/shopping";
import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { findIngredient } from "@/server/ingredients";
import { getPrisma } from "@/server/prisma";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const { items } = shoppingBatchInputSchema.parse(await readJson(request));
    const db = getPrisma();
    const activeItems = await db.$transaction(async (tx) => {
      for (const input of items) {
        const ingredient = await findIngredient(tx, input.name);
        const existing = await tx.shoppingItem.findFirst({
          where: ingredient
            ? { userId, completed: false, ingredientId: ingredient.id, unit: input.unit }
            : { userId, completed: false, ingredientId: null, customName: input.name, unit: input.unit },
        });
        if (existing) {
          await tx.shoppingItem.update({
            where: { id: existing.id },
            data: { quantity: { increment: input.quantity }, priority: input.priority, source: input.source },
          });
        } else {
          await tx.shoppingItem.create({
            data: {
              userId,
              ingredientId: ingredient?.id,
              customName: ingredient ? null : input.name,
              quantity: input.quantity,
              unit: input.unit,
              priority: input.priority,
              source: input.source,
            },
          });
        }
      }
      return tx.shoppingItem.findMany({
        where: { userId },
        include: { ingredient: true },
        orderBy: [{ completed: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      });
    });
    return Response.json({ items: activeItems }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
