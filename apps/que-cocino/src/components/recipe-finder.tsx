"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChefHat, Clock3, CookingPot, Lightbulb, ShoppingBasket, SlidersHorizontal, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { IngredientIcon } from "@/components/ingredient-icon";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { normalizedUnitLabels } from "@/domain/catalog";

type Ingredient = { canonicalName: string; category: string };
type MissingLine = { ingredient: Ingredient; missing: number; stock: number; needed: number; required: { normalizedUnit: keyof typeof normalizedUnitLabels } };
type Result = {
  recipe: { id: string; slug: string; name: string; description: string; servings: number; prepTime: number; cookTime: number; difficulty: string; tags: string[]; ingredients: Array<{ ingredient: Ingredient }> };
  compatibility: { score: number; canCook: boolean; available: Array<{ ingredient: Ingredient }>; partiallyAvailable: MissingLine[]; missing: MissingLine[]; expiringIngredients: Ingredient[] };
  recommendation: { tier: "EXACT" | "RELAXED" | "DISCOVER"; matchesFilters: boolean };
};
type RecommendationData = { results: Result[]; summary: { exactMatches: number; totalSuggestions: number; relaxed: boolean } };

export function RecipeFinder({ initialData, defaultServings }: { initialData: RecommendationData; defaultServings: number }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [servings, setServings] = useState(defaultServings);
  const [maxTime, setMaxTime] = useState(60);
  const [difficulty, setDifficulty] = useState("");
  const [mode, setMode] = useState("IN_STOCK");
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [expiring, setExpiring] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ servings: String(servings), maxTime: String(maxTime), mode, ...(difficulty ? { difficulty } : {}), ...(include ? { include } : {}), ...(exclude ? { exclude } : {}), expiringFirst: String(expiring) });
      const response = await fetch(`/api/recipes?${params}`);
      const result = await response.json();
      if (!response.ok) return toast.error(result.error);
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  const now = data.results.filter((item) => item.compatibility.canCook);
  const almost = data.results.filter((item) => !item.compatibility.canCook && item.compatibility.missing.length <= 2);
  const ideas = data.results.filter((item) => item.compatibility.missing.length > 2);
  const topMissing = useMemo(() => {
    const counts = new Map<string, { ingredient: Ingredient; count: number }>();
    for (const result of data.results.slice(0, 8)) {
      for (const line of result.compatibility.missing) {
        const current = counts.get(line.ingredient.canonicalName);
        counts.set(line.ingredient.canonicalName, { ingredient: line.ingredient, count: (current?.count ?? 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [data.results]);

  return <>
    <PageHeader eyebrow="Sugerencias inteligentes" title="¿Qué cocinamos hoy?" description="Siempre vas a ver una salida: lo que podés hacer, lo que está a una compra y nuevas ideas para completar tu cocina." />
    <Card className="mb-6 overflow-hidden border-primary/15 bg-gradient-to-br from-primary/10 via-card to-amber-100/60">
      <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div><Badge className="mb-3 bg-card text-foreground">Tu panorama</Badge><h2 className="text-2xl font-extrabold tracking-tight">{now.length ? `${now.length} ${now.length === 1 ? "receta lista" : "recetas listas"} para cocinar` : "Todavía no alcanza para una receta completa"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{now.length ? `Además encontramos ${almost.length} opciones a las que les falta muy poco.` : "No te dejamos en cero: abajo tenés las opciones más cercanas y exactamente qué faltaría sumar."}</p></div>
        {topMissing.length > 0 && <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">{topMissing.map(({ ingredient, count }) => <span key={ingredient.canonicalName} className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2 text-xs font-bold shadow-sm"><IngredientIcon name={ingredient.canonicalName} category={ingredient.category} size="sm" />{ingredient.canonicalName}{count > 1 && <Badge>{count} ideas</Badge>}</span>)}</div>}
      </CardContent>
    </Card>
    <Card className="mb-8"><CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-5 text-primary" />Ajustá tu comida</CardTitle><CardDescription>Los filtros priorizan resultados; si no hay una coincidencia exacta, mostramos las alternativas seguras más cercanas.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><Label>Personas</Label><Input type="number" min="1" max="20" value={servings} onChange={(event) => setServings(Number(event.target.value))} /></div><div><Label>Tiempo máximo</Label><Select value={maxTime} onChange={(event) => setMaxTime(Number(event.target.value))}><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option></Select></div><div><Label>Dificultad</Label><Select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">Cualquiera</option><option value="EASY">Fácil</option><option value="MEDIUM">Media</option><option value="HARD">Difícil</option></Select></div><div><Label>Prioridad</Label><Select value={mode} onChange={(event) => setMode(event.target.value)}><option value="IN_STOCK">Lo mejor con mi stock</option><option value="ONE_MISSING">Comprando poco</option><option value="FIT">Fit</option><option value="HIGH_PROTEIN">Alto en proteínas</option><option value="BUDGET">Económico</option><option value="QUICK">Rápido</option><option value="FREEZER">Para freezer</option></Select></div><div className="lg:col-span-2"><Label>Quiero usar</Label><Input placeholder="pollo, papa" value={include} onChange={(event) => setInclude(event.target.value)} /></div><div className="lg:col-span-2"><Label>No quiero usar</Label><Input placeholder="cebolla" value={exclude} onChange={(event) => setExclude(event.target.value)} /></div><label className="flex items-center gap-2 text-sm font-semibold lg:col-span-2"><input type="checkbox" checked={expiring} onChange={(event) => setExpiring(event.target.checked)} />Priorizar lo que está por vencer</label><Button className="lg:col-span-2" onClick={search} disabled={loading}>{loading ? "Buscando…" : "Actualizar sugerencias"}<Sparkles className="size-4" /></Button></CardContent></Card>
    {data.summary.exactMatches === 0 && data.results.length > 0 && <div className="mb-7 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><Lightbulb className="mt-0.5 size-5 shrink-0" /><div><strong>No hubo una coincidencia exacta con todos los filtros.</strong><p className="mt-1 text-amber-800">Te mostramos las opciones más cercanas sin ignorar tus preferencias alimentarias ni los ingredientes excluidos.</p></div></div>}
    {now.length > 0 && <RecipeGroup title="Podés cocinar ahora" description="Tenés todo lo necesario en tu despensa." results={now} servings={servings} icon={CookingPot} />}
    {almost.length > 0 && <RecipeGroup title="Te falta muy poco" description="Tenés una parte importante; falta uno o dos ingredientes." results={almost} servings={servings} icon={ChefHat} />}
    {ideas.length > 0 && <RecipeGroup title="Ideas para completar tu cocina" description="Opciones distintas para planificar próximas compras sin quedarte sin inspiración." results={ideas} servings={servings} icon={ShoppingBasket} />}
    {data.results.length === 0 && <Card className="border-dashed"><CardContent className="grid min-h-64 place-items-center p-6 text-center"><div><Sparkles className="mx-auto mb-4 size-11 text-primary" /><h2 className="text-xl font-extrabold">Tus exclusiones no dejan una receta segura</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Probá quitar algún ingrediente de “No quiero usar”. Nunca relajamos alergias, intolerancias ni exclusiones sin avisarte.</p></div></CardContent></Card>}
  </>;
}

function formatMissing(line: MissingLine) {
  const unit = normalizedUnitLabels[line.required.normalizedUnit] ?? "";
  return `${Number(line.missing).toLocaleString("es-AR", { maximumFractionDigits: 1 })} ${unit}`.trim();
}

function RecipeGroup({ title, description, results, servings, icon: Icon }: { title: string; description: string; results: Result[]; servings: number; icon: typeof CookingPot }) {
  return <section className="mb-9"><div className="mb-4"><h2 className="flex items-center gap-2 text-xl font-extrabold"><Icon className="size-5 text-primary" />{title}<Badge>{results.length}</Badge></h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{results.map(({ recipe, compatibility, recommendation }) => <Card key={recipe.id} className="group flex h-full flex-col overflow-hidden"><div className={`h-2 bg-gradient-to-r ${compatibility.canCook ? "from-primary to-emerald-400" : compatibility.missing.length <= 2 ? "from-amber-400 to-orange-300" : "from-sky-400 to-primary"}`} /><CardContent className="flex flex-1 flex-col p-5"><div className="mb-3 flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><Badge tone={compatibility.canCook ? "green" : "amber"}>{compatibility.score}% compatible</Badge>{recommendation.matchesFilters && <Badge>Tu prioridad</Badge>}</div><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{recipe.prepTime + recipe.cookTime} min</span></div><div className="mb-3 flex -space-x-2">{recipe.ingredients.slice(0, 5).map(({ ingredient }) => <IngredientIcon key={ingredient.canonicalName} name={ingredient.canonicalName} category={ingredient.category} size="sm" className="ring-2 ring-card" />)}</div><h3 className="text-xl font-extrabold tracking-tight">{recipe.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{recipe.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{recipe.tags.slice(0, 3).map((tag) => <Badge key={tag}>{tag}</Badge>)}</div><div className="mt-auto pt-5"><div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><UsersRound className="size-4" />{servings} porciones</span><span>{recipe.difficulty === "EASY" ? "Fácil" : recipe.difficulty === "MEDIUM" ? "Media" : "Difícil"}</span></div>{compatibility.missing.length > 0 && <div className="mb-4 space-y-2">{compatibility.missing.slice(0, 3).map((line) => <div key={line.ingredient.canonicalName} className="flex items-center gap-2 text-xs text-amber-800"><IngredientIcon name={line.ingredient.canonicalName} category={line.ingredient.category} size="sm" /><span><strong className="capitalize">{line.ingredient.canonicalName}:</strong> {line.stock > 0 ? `tenés una parte, faltan ${formatMissing(line)}` : `faltan ${formatMissing(line)}`}</span></div>)}{compatibility.missing.length > 3 && <p className="text-xs text-muted-foreground">+ {compatibility.missing.length - 3} ingredientes más</p>}</div>}<Link href={`/recetas/${recipe.slug}?servings=${servings}`} prefetch><Button className="w-full" variant={compatibility.canCook ? "default" : "outline"}>Ver receta y faltantes<ArrowRight className="size-4 transition group-hover:translate-x-1" /></Button></Link></div></CardContent></Card>)}</div></section>;
}
