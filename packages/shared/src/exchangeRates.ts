import { loadEnv } from './env.js';

export interface DollarBlueRate {
  buy: number;
  sell: number;
  updatedAt: string | null;
  source: string;
}

let cachedRate: { rate: DollarBlueRate; fetchedAt: number } | null = null;

export async function getDollarBlueRate(): Promise<DollarBlueRate> {
  const env = loadEnv();
  const now = Date.now();
  if (cachedRate && now - cachedRate.fetchedAt < env.DOLAR_RATE_CACHE_MS) return cachedRate.rate;

  const primary = await fetchDolarApi(env.DOLAR_API_URL).catch(() => null);
  const rate = primary ?? await fetchArgentinaDatos(env.DOLAR_API_FALLBACK_URL);
  cachedRate = { rate, fetchedAt: now };
  return rate;
}

export async function convertUsdToArs(amountUsd: number): Promise<{ ars: number; rate: DollarBlueRate }> {
  const rate = await getDollarBlueRate();
  return { ars: Math.round(amountUsd * rate.sell), rate };
}

async function fetchDolarApi(url: string): Promise<DollarBlueRate> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`DolarAPI failed with ${response.status}`);
  const data = await response.json() as { compra?: unknown; venta?: unknown; fechaActualizacion?: unknown };
  return parseRate(data.compra, data.venta, data.fechaActualizacion, 'DolarAPI');
}

async function fetchArgentinaDatos(url: string): Promise<DollarBlueRate> {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`ArgentinaDatos failed with ${response.status}`);
  const data = await response.json() as { compra?: unknown; venta?: unknown; fecha?: unknown };
  return parseRate(data.compra, data.venta, data.fecha, 'ArgentinaDatos');
}

function parseRate(compra: unknown, venta: unknown, fecha: unknown, source: string): DollarBlueRate {
  const buy = Number(compra);
  const sell = Number(venta);
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) {
    throw new Error(`Invalid dollar blue response from ${source}`);
  }
  return {
    buy,
    sell,
    updatedAt: typeof fecha === 'string' ? fecha : null,
    source,
  };
}
