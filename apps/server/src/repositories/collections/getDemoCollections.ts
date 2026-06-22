/** Returns all demo collections ordered by name. */
import type { Collection } from '@repo/types';
import { query } from 'app/database/pool.js';

export async function getDemoCollections(): Promise<Collection[]> {
  const result = await query<Collection>(
    `SELECT * FROM collections WHERE is_demo = true ORDER BY name`,
  );
  return result.rows;
}
