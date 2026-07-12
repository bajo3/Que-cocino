import { z } from "zod";

export const preferencesSchema = z.object({
  goal: z.enum(["LOSE_FAT", "MAINTAIN", "GAIN_MUSCLE", "EAT_HEALTHIER"]).nullable().optional(), dailyCalories: z.coerce.number().int().positive().nullable().optional(), dailyProtein: z.coerce.number().int().positive().nullable().optional(), householdSize: z.coerce.number().int().min(1).max(20),
  allergies: z.array(z.string().trim().min(1)).max(30), intolerances: z.array(z.string().trim().min(1)).max(30), dislikedFoods: z.array(z.string().trim().min(1)).max(30), preferences: z.array(z.string().trim().min(1)).max(30),
  dietType: z.string().trim().max(100).nullable().optional(), cupSizeMl: z.coerce.number().int().min(100).max(1000), glassSizeMl: z.coerce.number().int().min(100).max(1000),
});
