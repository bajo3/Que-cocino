import { requirePageUser } from "@/server/authz";
import { getCompatibleRecipes } from "@/features/recipes/service";
import { RecipeFinder } from "@/components/recipe-finder";
import { getPrisma } from "@/server/prisma";

export const dynamic = "force-dynamic";
export default async function CookPage() { const user = await requirePageUser(); const preferences = await getPrisma().userPreferences.findUnique({ where: { userId: user.id } }); const servings = preferences?.householdSize ?? 2; const results = await getCompatibleRecipes(user.id, { servings, mode: "IN_STOCK" }, preferences); return <RecipeFinder initialResults={JSON.parse(JSON.stringify(results))} defaultServings={servings} />; }
