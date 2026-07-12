import { describe, expect, it } from "vitest";
import { convertToNormalized } from "./units";

describe("convertToNormalized", () => {
  it("convierte unidades exactas", () => expect(convertToNormalized(2, "kg").quantity).toBe(2000));
  it("usa equivalencias específicas por ingrediente", () => {
    const result = convertToNormalized(1, "taza", { normalizedUnit: "GRAM", gramsPerUnit: null, density: null, equivalences: [{ householdUnit: "taza", householdQuantity: 1 as never, normalizedQuantity: 190 as never, normalizedUnit: "GRAM" }] });
    expect(result).toMatchObject({ quantity: 190, unit: "GRAM", approximate: true });
  });
  it("convierte unidades individuales con peso del ingrediente", () => expect(convertToNormalized(2, "unidad", { normalizedUnit: "GRAM", gramsPerUnit: 200 as never, density: null }).quantity).toBe(400));
});
