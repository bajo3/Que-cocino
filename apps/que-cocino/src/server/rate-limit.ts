import { HttpError } from "@/server/authz";

const buckets = new Map<string, number[]>();
export function assertRateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) throw new HttpError(429, "Demasiadas solicitudes. Esperá un momento.");
  recent.push(now);
  buckets.set(key, recent);
}
