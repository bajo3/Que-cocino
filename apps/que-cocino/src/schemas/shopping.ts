import { z } from "zod";
import { acceptedUnits, locations } from "@/domain/catalog";

export const shoppingInputSchema = z.object({ name: z.string().trim().min(1).max(100), quantity: z.coerce.number().positive(), unit: z.enum(acceptedUnits), priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"), source: z.enum(["MANUAL", "OUT_OF_STOCK", "LOW_STOCK", "RECIPE", "RECOMMENDED"]).default("MANUAL") });
export const completeShoppingSchema = z.object({ quantity: z.number().positive(), unit: z.enum(acceptedUnits), location: z.enum(locations).default("PANTRY"), expirationDate: z.string().date().nullable().optional() });
