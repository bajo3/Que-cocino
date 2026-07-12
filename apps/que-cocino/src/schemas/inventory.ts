import { z } from "zod";
import { acceptedUnits, locations } from "@/domain/catalog";

export const inventoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.coerce.number().positive().max(1_000_000),
  unit: z.enum(acceptedUnits),
  location: z.enum(locations).default("PANTRY"),
  expirationDate: z.string().date().nullable().optional(),
  opened: z.boolean().default(false),
  minimumStock: z.coerce.number().nonnegative().nullable().optional(),
});
export const inventoryUpdateSchema = inventoryInputSchema.partial().extend({ quantity: z.coerce.number().nonnegative().optional() }).refine((value) => Object.keys(value).length > 0);
export const interpretedItemSchema = z.object({
  name: z.string().trim().min(1).max(100), quantity: z.number().positive(), unit: z.enum(acceptedUnits),
  estimatedGrams: z.number().nonnegative().nullable().optional(), estimatedMilliliters: z.number().nonnegative().nullable().optional(),
  confidence: z.number().min(0).max(1), approximate: z.boolean().default(false),
});
export const interpretationSchema = z.object({ items: z.array(interpretedItemSchema).max(50) });
export const interpretRequestSchema = z.object({ text: z.string().trim().min(2).max(2_000) });
export const confirmInterpretationSchema = z.object({ items: z.array(inventoryInputSchema).min(1).max(50) });
export type InventoryInput = z.infer<typeof inventoryInputSchema>;
export type InterpretedItem = z.infer<typeof interpretedItemSchema>;
