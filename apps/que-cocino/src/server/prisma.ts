import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { queCocinoPrisma?: PrismaClient };

export function getPrisma() {
  if (!globalForPrisma.queCocinoPrisma) {
    globalForPrisma.queCocinoPrisma = new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"] });
  }
  return globalForPrisma.queCocinoPrisma;
}
