/** Returns the first demo collection, or null if none exists. */
import type { Collection } from '@repo/types';
import { query } from 'app/database/pool.js';

export async function getDemoCollection(): Promise<Collection | null> {
  const result = await query<Collection>(
    `SELECT * FROM collections WHERE is_demo = true LIMIT 1`,
  );
  return result.rows[0] ?? null;
}
