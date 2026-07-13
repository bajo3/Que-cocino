-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IngredientCategory" AS ENUM ('MEAT', 'VEGETABLE', 'FRUIT', 'DAIRY', 'EGGS', 'GRAINS_PASTA', 'LEGUMES', 'CANNED', 'CONDIMENTS', 'BEVERAGES', 'FROZEN', 'OTHER');

-- CreateEnum
CREATE TYPE "NormalizedUnit" AS ENUM ('GRAM', 'MILLILITER', 'UNIT');

-- CreateEnum
CREATE TYPE "InventoryLocation" AS ENUM ('FRIDGE', 'FREEZER', 'PANTRY');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ShoppingPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "ShoppingSource" AS ENUM ('MANUAL', 'OUT_OF_STOCK', 'LOW_STOCK', 'RECIPE', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('LOSE_FAT', 'MAINTAIN', 'GAIN_MUSCLE', 'EAT_HEALTHIER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" "Goal",
    "dailyCalories" INTEGER,
    "dailyProtein" INTEGER,
    "householdSize" INTEGER NOT NULL DEFAULT 2,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intolerances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dislikedFoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietType" TEXT,
    "cupSizeMl" INTEGER NOT NULL DEFAULT 240,
    "glassSizeMl" INTEGER NOT NULL DEFAULT 250,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "category" "IngredientCategory" NOT NULL,
    "defaultUnit" TEXT NOT NULL,
    "normalizedUnit" "NormalizedUnit" NOT NULL,
    "gramsPerUnit" DECIMAL(12,3),
    "density" DECIMAL(12,5),
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientEquivalence" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "householdUnit" TEXT NOT NULL,
    "householdQuantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "normalizedQuantity" DECIMAL(12,3) NOT NULL,
    "normalizedUnit" "NormalizedUnit" NOT NULL,
    "note" TEXT,

    CONSTRAINT "IngredientEquivalence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "customName" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "normalizedQuantity" DECIMAL(12,3) NOT NULL,
    "normalizedUnit" "NormalizedUnit" NOT NULL,
    "location" "InventoryLocation" NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "minimumStock" DECIMAL(12,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "prepTime" INTEGER NOT NULL,
    "cookTime" INTEGER NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "instructions" JSONB NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedCalories" INTEGER,
    "estimatedProtein" DECIMAL(8,2),
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "normalizedQuantity" DECIMAL(12,3) NOT NULL,
    "normalizedUnit" "NormalizedUnit" NOT NULL,
    "householdMeasure" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "substitutions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "cookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "estimatedCalories" INTEGER,
    "estimatedProtein" DECIMAL(8,2),
    "adjustments" JSONB,

    CONSTRAINT "CookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookingUsage" (
    "id" TEXT NOT NULL,
    "cookingEventId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "plannedQuantity" DECIMAL(12,3) NOT NULL,
    "actualQuantity" DECIMAL(12,3) NOT NULL,
    "normalizedQuantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "CookingUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leftover" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cookingEventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portions" INTEGER NOT NULL,
    "location" "InventoryLocation" NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "notes" TEXT,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Leftover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "customName" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "priority" "ShoppingPriority" NOT NULL DEFAULT 'NORMAL',
    "source" "ShoppingSource" NOT NULL DEFAULT 'MANUAL',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_canonicalName_key" ON "Ingredient"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientEquivalence_ingredientId_householdUnit_householdQ_key" ON "IngredientEquivalence"("ingredientId", "householdUnit", "householdQuantity");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_expirationDate_idx" ON "InventoryItem"("userId", "expirationDate");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_ingredientId_idx" ON "InventoryItem"("userId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_ingredientId_key" ON "RecipeIngredient"("recipeId", "ingredientId");

-- CreateIndex
CREATE INDEX "CookingEvent_userId_cookedAt_idx" ON "CookingEvent"("userId", "cookedAt");

-- CreateIndex
CREATE INDEX "ShoppingItem_userId_completed_idx" ON "ShoppingItem"("userId", "completed");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientEquivalence" ADD CONSTRAINT "IngredientEquivalence_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingEvent" ADD CONSTRAINT "CookingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingEvent" ADD CONSTRAINT "CookingEvent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingUsage" ADD CONSTRAINT "CookingUsage_cookingEventId_fkey" FOREIGN KEY ("cookingEventId") REFERENCES "CookingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingUsage" ADD CONSTRAINT "CookingUsage_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookingUsage" ADD CONSTRAINT "CookingUsage_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leftover" ADD CONSTRAINT "Leftover_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leftover" ADD CONSTRAINT "Leftover_cookingEventId_fkey" FOREIGN KEY ("cookingEventId") REFERENCES "CookingEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
