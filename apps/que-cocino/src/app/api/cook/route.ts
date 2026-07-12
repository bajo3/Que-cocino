import { cookRecipeSchema } from "@/schemas/cooking";
import { apiError, readJson } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { cookRecipe } from "@/features/cooking/service";

export async function POST(request: Request) {
  try { const userId = await requireUserId(); const input = cookRecipeSchema.parse(await readJson(request)); return Response.json({ event: await cookRecipe(userId, input) }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
