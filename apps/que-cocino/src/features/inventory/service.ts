import type { InventoryInput } from "@/schemas/inventory";
import { getPrisma } from "@/server/prisma";
import { findIngredient } from "@/server/ingredients";
import { convertToNormalized } from "@/domain/units";
import { HttpError } from "@/server/authz";

export async function listInventory(userId: string, query?: { search?: string; category?: string; location?: string; sort?: string }) {
  const db = getPrisma();
  const items = await db.inventoryItem.findMany({
    where: { userId, ...(query?.location ? { location: query.location as never } : {}), ...(query?.category ? { ingredient: { category: query.category as never } } : {}), ...(query?.search ? { OR: [{ customName: { contains: query.search, mode: "insensitive" } }, { ingredient: { canonicalName: { contains: query.search, mode: "insensitive" } } }] } : {}) },
    include: { ingredient: true },
    orderBy: query?.sort === "name" ? { ingredient: { canonicalName: "asc" } } : query?.sort === "quantity" ? { normalizedQuantity: "asc" } : [{ expirationDate: "asc" }, { createdAt: "desc" }],
  });
  return items;
}

export async function createInventoryItem(userId: string, input: InventoryInput) {
  const db = getPrisma();
  const ingredient = await findIngredient(db, input.name);
  const normalized = convertToNormalized(input.quantity, input.unit, ingredient);
  return db.inventoryItem.create({ data: { userId, ingredientId: ingredient?.id, customName: ingredient ? null : input.name, quantity: input.quantity, unit: input.unit, normalizedQuantity: normalized.quantity, normalizedUnit: normalized.unit, location: input.location, expirationDate: input.expirationDate ? new Date(input.expirationDate) : null, opened: input.opened, minimumStock: input.minimumStock ?? null }, include: { ingredient: true } });
}

export async function updateInventoryItem(userId: string, id: string, input: Partial<InventoryInput>) {
  const db = getPrisma();
  const current = await db.inventoryItem.findFirst({ where: { id, userId }, include: { ingredient: { include: { equivalences: true } } } });
  if (!current) throw new HttpError(404, "Producto no encontrado.");
  const ingredient = input.name ? await findIngredient(db, input.name) : current.ingredient;
  const quantity = input.quantity ?? Number(current.quantity);
  const unit = input.unit ?? current.unit;
  const normalized = convertToNormalized(quantity, unit, ingredient);
  return db.inventoryItem.update({ where: { id }, data: { ingredientId: ingredient?.id ?? null, customName: ingredient ? null : input.name ?? current.customName, quantity, unit, normalizedQuantity: normalized.quantity, normalizedUnit: normalized.unit, location: input.location, expirationDate: input.expirationDate === undefined ? undefined : input.expirationDate ? new Date(input.expirationDate) : null, opened: input.opened, minimumStock: input.minimumStock }, include: { ingredient: true } });
}

export async function deleteInventoryItem(userId: string, id: string) {
  const result = await getPrisma().inventoryItem.deleteMany({ where: { id, userId } });
  if (!result.count) throw new HttpError(404, "Producto no encontrado.");
}
