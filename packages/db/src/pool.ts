import pg from 'pg';
import { loadEnv } from '@wma/shared';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Lazily create a shared pg Pool from DATABASE_URL.
 * Throws only when a query is actually attempted without configuration,
 * so that importing this module never crashes a service at boot.
 */
export function getPool(): pg.Pool {
  if (pool) return pool;
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — cannot open a Postgres connection.');
  }
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    ssl: env.DATABASE_URL.includes('localhost') ? undefined : { rejectUnauthorized: false },
  });
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as any[]);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
