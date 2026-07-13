import { z } from "zod";

export const leftoverUpdateSchema = z.object({
  portions: z.coerce.number().int().min(1).max(50).optional(),
  location: z.enum(["FRIDGE", "FREEZER"]).optional(),
  expirationDate: z.string().date().nullable().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
  consumed: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);
