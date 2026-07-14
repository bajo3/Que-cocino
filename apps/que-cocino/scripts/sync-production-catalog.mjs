import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production" || !process.env.DATABASE_URL) {
  console.log("Catalog sync skipped outside Vercel production.");
  process.exit(0);
}

console.log("Synchronizing recipe catalog…");
const command = process.platform === "win32" ? "npx.cmd" : "npx";
let result;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  result = spawnSync(command, ["prisma", "db", "seed"], { stdio: "inherit", env: process.env });
  if (!result.error && result.status === 0) break;
  if (attempt < 3) {
    console.warn(`Catalog sync attempt ${attempt} failed; retrying in 5 seconds...`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
  }
}

if (result?.error) throw result.error;
if (result?.status !== 0) process.exit(result?.status ?? 1);
