import { preferencesSchema } from "@/schemas/preferences";
import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { getPrisma } from "@/server/prisma";

export async function GET() {
  try { const userId = await requireUserId(); const preferences = await getPrisma().userPreferences.findUnique({ where: { userId } }); return Response.json({ preferences }); }
  catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try { const userId = await requireUserId(); const input = preferencesSchema.parse(await readJson(request)); const preferences = await getPrisma().userPreferences.upsert({ where: { userId }, create: { userId, ...input }, update: input }); return Response.json({ preferences }); }
  catch (error) { return apiError(error); }
}
