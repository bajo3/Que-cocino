"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Check, CheckCircle2, Lightbulb, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { IngredientIcon } from "@/components/ingredient-icon";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { acceptedUnits, categoryLabels } from "@/domain/catalog";
import type { ShoppingPlan, ShoppingPlanDays } from "@/domain/shopping-plan";

type Item = {
  id: string;
  customName: string | null;
  quantity: string | number;
  unit: string;
  priority: string;
  source: string;
  completed: boolean;
  ingredient: { canonicalName: string; category: string } | null;
};

const periodLabels: Record<ShoppingPlanDays, string> = {
  7: "Semana",
  15: "15 días",
  30: "30 días",
};

export function ShoppingScreen({
  initialItems,
  unlocks,
  plans,
  householdSize,
}: {
  initialItems: Item[];
  unlocks: Record<string, number>;
  plans: ShoppingPlan[];
  householdSize: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selectedDays, setSelectedDays] = useState<ShoppingPlanDays>(7);
  const [addingPlan, setAddingPlan] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [completing, setCompleting] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<(typeof acceptedUnits)[number]>("unidad");
  const [priority, setPriority] = useState("NORMAL");
  const [location, setLocation] = useState("PANTRY");
  const [expiration, setExpiration] = useState("");
  const groups = useMemo(() => Object.entries(items.filter((item) => !item.completed).reduce<Record<string, Item[]>>((result, item) => {
    const key = item.ingredient ? categoryLabels[item.ingredient.category] : "Otros";
    (result[key] ??= []).push(item);
    return result;
  }, {})), [items]);
  const topUnlocks = Object.entries(unlocks).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const selectedPlan = plans.find((plan) => plan.days === selectedDays) ?? plans[0];

  async function createItem(productName: string, itemQuantity = quantity, itemUnit = unit, itemPriority = priority, source = "MANUAL") {
    const response = await fetch("/api/shopping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: productName, quantity: itemQuantity, unit: itemUnit, priority: itemPriority, source }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error);
      return false;
    }
    setItems((current) => [data.item, ...current]);
    return true;
  }

  async function add() {
    if (!await createItem(name)) return;
    setAddOpen(false);
    setName("");
    toast.success("Agregado a compras");
  }

  async function addSuggestion(ingredient: string, itemQuantity = 1, itemUnit: (typeof acceptedUnits)[number] = "unidad") {
    const response = await fetch("/api/shopping/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ name: ingredient, quantity: itemQuantity, unit: itemUnit, priority: "NORMAL", source: "RECOMMENDED" }] }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error);
    setItems(data.items);
    router.refresh();
    toast.success(`${ingredient} agregado a compras`);
  }

  async function addPlan() {
    if (!selectedPlan?.items.length) return;
    setAddingPlan(true);
    const response = await fetch("/api/shopping/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: selectedPlan.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          priority: "NORMAL",
          source: "RECOMMENDED",
        })),
      }),
    });
    const data = await response.json();
    setAddingPlan(false);
    if (!response.ok) return toast.error(data.error);
    setItems(data.items);
    toast.success(`Compra de ${selectedDays} días agregada a tu lista`);
    window.setTimeout(() => window.location.reload(), 600);
  }

  async function complete() {
    if (!completing) return;
    const response = await fetch(`/api/shopping/${completing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ quantity, unit, location, expirationDate: expiration || null }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.error);
    setItems((current) => current.map((item) => item.id === completing.id ? { ...item, completed: true, quantity, unit } : item));
    setCompleting(null);
    toast.success("Compra agregada a tu despensa");
  }

  async function remove(item: Item) {
    if (!confirm("¿Eliminar este producto de la lista?")) return;
    const response = await fetch(`/api/shopping/${item.id}`, { method: "DELETE" });
    if (response.ok) setItems((current) => current.filter((value) => value.id !== item.id));
  }

  function openComplete(item: Item) {
    setCompleting(item);
    setQuantity(Number(item.quantity));
    setUnit(item.unit as typeof unit);
  }

  return <>
    <PageHeader
      eyebrow="Planificación"
      title="Lista de compras"
      description="Elegí cuántos días querés cubrir y armamos una compra aproximada según tu despensa."
      action={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" />Agregar producto</Button>}
    />

    {selectedPlan && <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-secondary via-card to-card">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-primary"><CalendarRange className="size-5" />Planificador</div>
          <CardTitle className="text-2xl">Compra para {periodLabels[selectedDays].toLocaleLowerCase("es-AR")}</CardTitle>
          <CardDescription>Calculada para {householdSize} {householdSize === 1 ? "persona" : "personas"}, con una comida principal por día. Ya descontamos tu despensa y tu lista actual.</CardDescription>
        </div>
        <div className="flex rounded-2xl bg-card p-1 shadow-sm" aria-label="Período de compra">
          {plans.map((plan) => <Button
            key={plan.days}
            size="sm"
            variant={selectedDays === plan.days ? "default" : "ghost"}
            aria-pressed={selectedDays === plan.days}
            onClick={() => setSelectedDays(plan.days)}
          >{periodLabels[plan.days]}</Button>)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex flex-wrap gap-2">
          <Badge tone="green">{selectedPlan.mealCount} comidas</Badge>
          <Badge>{selectedPlan.items.length} productos por comprar</Badge>
          <Badge>{selectedPlan.recipes.length} recetas distintas</Badge>
        </div>

        {selectedPlan.items.length > 0 ? <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectedPlan.items.map((item) => <div key={item.ingredientId} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <IngredientIcon name={item.name} category={item.category} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold capitalize">{item.name}</p>
                <p className="text-sm font-bold text-primary">{item.quantity.toLocaleString("es-AR")} {item.unit}</p>
                <p className="text-xs text-muted-foreground">Se usa en {item.mealUses} {item.mealUses === 1 ? "comida" : "comidas"}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Sumar ${item.name} a la lista`}
                onClick={() => addSuggestion(item.name, item.quantity, item.unit)}
              ><Plus className="size-4" /></Button>
            </div>)}
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-bold">Menú estimado</p>
              <p className="truncate text-sm text-muted-foreground">{selectedPlan.recipes.slice(0, 6).map((recipe) => `${recipe.name}${recipe.times > 1 ? ` ×${recipe.times}` : ""}`).join(" · ")}{selectedPlan.recipes.length > 6 ? " · …" : ""}</p>
            </div>
            <Button onClick={addPlan} disabled={addingPlan} className="shrink-0">
              <ShoppingBasket className="size-4" />
              {addingPlan ? "Agregando…" : "Agregar compra completa"}
            </Button>
          </div>
        </> : <div className="rounded-2xl bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-10 text-primary" />
          <p className="font-extrabold">Ya tenés cubierto este período</p>
          <p className="mt-1 text-sm text-muted-foreground">Entre la despensa y la lista actual no hace falta agregar productos.</p>
        </div>}
      </CardContent>
    </Card>}

    {topUnlocks.length > 0 && <Card className="mb-6 overflow-hidden border-0 bg-secondary">
      <CardContent className="p-5">
        <div className="mb-1 flex items-center gap-2 font-bold"><Lightbulb className="size-5 text-primary" />Comprando esto desbloqueás más recetas</div>
        <p className="mb-4 text-sm text-muted-foreground">Atajos para sumar variedad sin hacer una compra grande.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topUnlocks.map(([ingredient, count]) => <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm" key={ingredient}>
            <IngredientIcon name={ingredient} />
            <div className="min-w-0 flex-1"><p className="truncate font-extrabold capitalize">{ingredient}</p><p className="text-xs text-muted-foreground">Hasta {count} {count === 1 ? "receta nueva" : "recetas nuevas"}</p></div>
            <Button size="sm" variant="outline" onClick={() => addSuggestion(ingredient)}><Plus className="size-3" />Sumar</Button>
          </div>)}
        </div>
      </CardContent>
    </Card>}

    {groups.length ? <div className="space-y-6">
      {groups.map(([group, groupItems]) => <section key={group}>
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">{group}</h2>
        <Card><CardContent className="divide-y divide-border p-0">
          {groupItems.map((item) => {
            const itemName = item.ingredient?.canonicalName ?? item.customName ?? "Producto";
            return <div key={item.id} className="flex items-center gap-3 p-4">
              <IngredientIcon name={itemName} category={item.ingredient?.category} />
              <button onClick={() => openComplete(item)} aria-label={`Marcar ${itemName} como comprado`} className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-primary text-primary transition hover:bg-primary hover:text-primary-foreground"><Check className="size-4" /></button>
              <div className="min-w-0 flex-1"><p className="truncate font-bold capitalize">{itemName}</p><p className="text-xs text-muted-foreground">{Number(item.quantity).toLocaleString("es-AR")} {item.unit} · {item.source === "MANUAL" ? "Manual" : "Sugerido"}</p></div>
              {item.priority === "HIGH" && <Badge tone="red">Prioridad</Badge>}
              <Button variant="ghost" size="sm" onClick={() => remove(item)} aria-label={`Eliminar ${itemName}`}><Trash2 className="size-4" /></Button>
            </div>;
          })}
        </CardContent></Card>
      </section>)}
    </div> : <Card><CardContent className="grid min-h-64 place-items-center p-6 text-center"><div><ShoppingBasket className="mx-auto mb-4 size-12 text-muted-foreground" /><h2 className="text-xl font-bold">Tu lista está vacía</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Podés sumar un producto manualmente o agregar uno de los planes sugeridos.</p>{topUnlocks.length === 0 && <Button className="mt-5" onClick={() => setAddOpen(true)}><Plus className="size-4" />Agregar el primero</Button>}</div></CardContent></Card>}

    <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Agregar a compras">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Producto</Label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. arroz" /></div>
        <div><Label>Cantidad</Label><Input type="number" min="0.001" step="any" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>
        <div><Label>Unidad</Label><Select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}>{acceptedUnits.map((value) => <option key={value}>{value}</option>)}</Select></div>
        <div className="sm:col-span-2"><Label>Prioridad</Label><Select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="LOW">Baja</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option></Select></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button><Button onClick={add} disabled={!name.trim()}>Agregar</Button></div>
      </div>
    </Modal>

    <Modal open={Boolean(completing)} onClose={() => setCompleting(null)} title="Guardar compra en la despensa" description="Confirmá cuánto compraste y dónde lo vas a guardar.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Cantidad comprada</Label><Input type="number" min="0.001" step="any" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>
        <div><Label>Unidad</Label><Select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}>{acceptedUnits.map((value) => <option key={value}>{value}</option>)}</Select></div>
        <div><Label>Ubicación</Label><Select value={location} onChange={(event) => setLocation(event.target.value)}><option value="FRIDGE">Heladera</option><option value="FREEZER">Freezer</option><option value="PANTRY">Alacena</option></Select></div>
        <div><Label>Vencimiento</Label><Input type="date" value={expiration} onChange={(event) => setExpiration(event.target.value)} /></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="ghost" onClick={() => setCompleting(null)}>Cancelar</Button><Button onClick={complete}>Confirmar compra</Button></div>
      </div>
    </Modal>
  </>;
}
