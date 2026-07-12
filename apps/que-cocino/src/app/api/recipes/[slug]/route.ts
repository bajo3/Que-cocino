import { apiError } from "@/server/api";
import { HttpError, requireUserId } from "@/server/authz";
import { getRecipeForUser } from "@/features/recipes/service";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { const userId = await requireUserId(); const { slug } = await params; const servings = Number(new URL(request.url).searchParams.get("servings") || 0) || undefined; const result = await getRecipeForUser(userId, slug, servings); if (!result) throw new HttpError(404, "Receta no encontrada."); return Response.json(result); }
  catch (error) { return apiError(error); }
}
