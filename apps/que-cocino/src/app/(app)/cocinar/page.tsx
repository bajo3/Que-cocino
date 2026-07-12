import { auth } from "@/auth";
import { getCompatibleRecipes } from "@/features/recipes/service";
import { RecipeFinder } from "@/components/recipe-finder";

export const dynamic = "force-dynamic";
export default async function CookPage() { const session = await auth(); const results = await getCompatibleRecipes(session!.user.id, { servings: 4, mode: "IN_STOCK" }); return <RecipeFinder initialResults={JSON.parse(JSON.stringify(results))} />; }
