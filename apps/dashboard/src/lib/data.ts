import 'server-only';
import * as db from '@wma/db';

/** Wrap a DB read so a missing/broken connection renders an empty state
 * instead of a 500. The error is surfaced via the second tuple element. */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<{ data: T; error: string | null }> {
  try {
    return { data: await fn(), error: null };
  } catch (err) {
    return { data: fallback, error: (err as Error).message };
  }
}

export { db };
