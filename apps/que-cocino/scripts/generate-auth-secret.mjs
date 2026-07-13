import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const nextLine = `AUTH_SECRET="${randomBytes(48).toString("base64url")}"`;
let next = /^AUTH_SECRET=.*$/m.test(current)
  ? current.replace(/^AUTH_SECRET=.*$/m, nextLine)
  : `${current.trimEnd()}${current.trim() ? "\n" : ""}${nextLine}\n`;

if (/^AUTH_URL=(?:""|\s*)$/m.test(next)) {
  next = next.replace(/^AUTH_URL=(?:""|\s*)$/m, 'AUTH_URL="http://localhost:3004"');
} else if (!/^AUTH_URL=/m.test(next)) {
  next = `${next.trimEnd()}\nAUTH_URL="http://localhost:3004"\n`;
}

writeFileSync(envPath, next, { encoding: "utf8", mode: 0o600 });
console.log("AUTH_SECRET generado en .env.local (valor oculto).");
