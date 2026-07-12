import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRecipeForUser } from "@/features/recipes/service";
import { RecipeDetail } from "@/components/recipe-detail";

export const dynamic = "force-dynamic";
export default async function RecipePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ servings?: string }> }) { const session = await auth(); const { slug } = await params; const query = await searchParams; const result = await getRecipeForUser(session!.user.id, slug, Number(query.servings) || undefined); if (!result) notFound(); return <RecipeDetail data={JSON.parse(JSON.stringify(result))} />; }
