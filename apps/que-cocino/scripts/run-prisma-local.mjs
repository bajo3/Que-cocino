import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const needsDatabase = args[0] !== "generate";

if (needsDatabase && !process.env.DATABASE_URL?.trim()) {
  console.error(
    "Falta DATABASE_URL en .env.local. Configurá una conexión PostgreSQL real antes de usar la base de datos.",
  );
  process.exit(1);
}

const prismaCli = resolve("node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, ...args], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
