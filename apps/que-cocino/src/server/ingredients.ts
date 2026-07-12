import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeText } from "@/domain/text-parser";

type Db = PrismaClient | Prisma.TransactionClient;
export async function findIngredient(db: Db, name: string) {
  const ingredients = await db.ingredient.findMany({ include: { equivalences: true } });
  const target = normalizeText(name);
  return ingredients.find((ingredient) => [ingredient.canonicalName, ...ingredient.aliases].some((value) => normalizeText(value) === target)) ?? null;
}
