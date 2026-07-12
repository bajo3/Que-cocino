import { describe, expect, it } from "vitest";
import { parseInventoryText } from "./text-parser";

const ingredient = (canonicalName: string, aliases: string[] = []) => ({ id: canonicalName, canonicalName, aliases, gramsPerUnit: null, density: null, category: "VEGETABLE", defaultUnit: "g", normalizedUnit: "GRAM", createdAt: new Date(), equivalences: [] } as never);
describe("parseInventoryText", () => {
  it("interpreta una lista argentina sin IA", () => {
    const items = parseInventoryText("Tengo 2 kilos de papa, 6 huevos y medio kilo de cebolla", [ingredient("papa"), ingredient("huevo", ["huevos"]), ingredient("cebolla")]);
    expect(items.map((item) => [item.name, item.quantity, item.unit])).toEqual([["papa", 2, "kg"], ["huevo", 6, "unidad"], ["cebolla", 0.5, "kg"]]);
  });
});
