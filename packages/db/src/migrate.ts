import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from './pool.js';
import { logger } from '@wma/shared';

/**
 * Minimal forward-only migration runner.
 * Applies every *.sql file in supabase/migrations in lexical order,
 * tracking applied files in a `_migrations` table.
 *
 * Override the migrations directory with MIGRATIONS_DIR if needed.
 */
function migrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return resolve(process.env.MIGRATIONS_DIR);
  const here = dirname(fileURLToPath(import.meta.url)); // packages/db/dist
  return resolve(here, '..', '..', '..', 'supabase', 'migrations');
}

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz default now()
    );
  `);

  const dir = migrationsDir();
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows } = await pool.query<{ name: string }>('select name from _migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      logger.info({ migration: file, status: 'skipped' }, 'migration already applied');
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations(name) values ($1)', [file]);
      await client.query('commit');
      logger.info({ migration: file, status: 'applied' }, 'migration applied');
    } catch (err) {
      await client.query('rollback');
      logger.error({ migration: file, err: (err as Error).message }, 'migration failed');
      throw err;
    } finally {
      client.release();
    }
  }
}

// Run when invoked directly (node dist/migrate.js).
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  runMigrations()
    .then(() => closePool())
    .then(() => {
      logger.info('all migrations complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err: (err as Error).message }, 'migration run failed');
      process.exit(1);
    });
}
