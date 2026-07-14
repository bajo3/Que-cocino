import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { queCocinoPrisma?: PrismaClient };

function getDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", process.env.VERCEL ? "1" : "5");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "10");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function getPrisma() {
  if (!globalForPrisma.queCocinoPrisma) {
    const databaseUrl = getDatabaseUrl();
    globalForPrisma.queCocinoPrisma = new PrismaClient({
      datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.queCocinoPrisma;
}
