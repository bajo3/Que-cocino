import { apiError } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { getPrisma } from "@/server/prisma";

export async function GET() {
  try { const userId = await requireUserId(); const events = await getPrisma().cookingEvent.findMany({ where: { userId }, include: { recipe: true, usages: { include: { ingredient: true } }, leftovers: true }, orderBy: { cookedAt: "desc" } }); return Response.json({ events }); }
  catch (error) { return apiError(error); }
}
