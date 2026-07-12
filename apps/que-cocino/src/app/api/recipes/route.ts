import { apiError } from "@/server/api";
import { requireUserId } from "@/server/authz";
import { recipeFiltersSchema } from "@/schemas/cooking";
import { getCompatibleRecipes } from "@/features/recipes/service";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId(); const url = new URL(request.url);
    const filters = recipeFiltersSchema.parse({ servings: url.searchParams.get("servings") ?? 4, maxTime: url.searchParams.get("maxTime") ?? undefined, difficulty: url.searchParams.get("difficulty") ?? undefined, mealType: url.searchParams.get("mealType") ?? undefined, mode: url.searchParams.get("mode") ?? "IN_STOCK", include: url.searchParams.get("include")?.split(",").filter(Boolean) ?? [], exclude: url.searchParams.get("exclude")?.split(",").filter(Boolean) ?? [], expiringFirst: url.searchParams.get("expiringFirst") === "true" });
    return Response.json({ results: await getCompatibleRecipes(userId, filters) });
  } catch (error) { return apiError(error); }
}
