import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production" || !process.env.DATABASE_URL) {
  console.log("Catalog sync skipped outside Vercel production.");
  process.exit(0);
}

console.log("Synchronizing recipe catalog…");
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["prisma", "db", "seed"], { stdio: "inherit", env: process.env });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
