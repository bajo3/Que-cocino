import { requirePageUser } from "@/server/authz";
import { getRecipeRecommendations } from "@/features/recipes/service";
import { RecipeFinder } from "@/components/recipe-finder";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";
export default async function CookPage() { const user = await requirePageUser(); const preferences = await getPrisma().userPreferences.findUnique({ where: { userId: user.id } }); const servings = preferences?.householdSize ?? 2; const recommendations = await getRecipeRecommendations(user.id, { servings, mode: "IN_STOCK", maxTime: 60 }, preferences); return <RecipeFinder initialData={JSON.parse(JSON.stringify(recommendations))} defaultServings={servings} />; }
