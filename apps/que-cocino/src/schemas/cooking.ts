import { z } from "zod";

export const recipeFiltersSchema = z.object({
  servings: z.coerce.number().int().min(1).max(20).default(4), maxTime: z.coerce.number().int().min(5).max(300).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(), mealType: z.enum(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]).optional(),
  mode: z.enum(["IN_STOCK", "ONE_MISSING", "FIT", "HIGH_PROTEIN", "BUDGET", "QUICK", "FREEZER"]).default("IN_STOCK"),
  include: z.array(z.string()).default([]), exclude: z.array(z.string()).default([]), expiringFirst: z.boolean().default(false),
});
export const cookingUsageInputSchema = z.object({ inventoryItemId: z.string().min(1), ingredientId: z.string().min(1), plannedQuantity: z.number().positive(), actualQuantity: z.number().positive() });
export const cookRecipeSchema = z.object({
  recipeId: z.string().min(1), servings: z.number().int().min(1).max(50), usages: z.array(cookingUsageInputSchema).min(1), notes: z.string().trim().max(500).optional(),
  leftover: z.object({ portions: z.number().int().positive().max(50), location: z.enum(["FRIDGE", "FREEZER"]), expirationDate: z.string().date().nullable().optional(), notes: z.string().trim().max(300).optional() }).nullable().optional(),
});
export const generatedRecipeSchema = z.object({
  name: z.string(), description: z.string(), servings: z.number().int().positive(), prepTime: z.number().int().nonnegative(), cookTime: z.number().int().nonnegative(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]), tags: z.array(z.string()),
  ingredients: z.array(z.object({ name: z.string(), quantity: z.number().positive(), unit: z.string(), householdMeasure: z.string().nullable(), optional: z.boolean(), substitutions: z.array(z.string()) })),
  instructions: z.array(z.string()).min(1), estimatedCalories: z.number().int().positive().nullable(), estimatedProtein: z.number().positive().nullable(),
});
