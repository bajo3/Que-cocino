import { describe, expect, it } from "vitest";
import { registrationSchema } from "@/schemas/auth";

describe("registrationSchema", () => {
  it("requiere una cuenta con datos mínimos seguros", () => {
    expect(registrationSchema.safeParse({ name: "Feli", email: "feli@example.com", password: "contraseña-segura" }).success).toBe(true);
    expect(registrationSchema.safeParse({ name: "F", email: "no-es-email", password: "123" }).success).toBe(false);
  });
});
