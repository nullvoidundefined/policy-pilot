/** Fetches a single collection by id, accessible to the user or marked as demo. */
import type { Collection } from '@repo/types';
import { query } from 'app/database/pool.js';

export async function getCollectionById(
  id: string,
  userId: string,
): Promise<Collection | null> {
  const result = await query<Collection>(
    `SELECT * FROM collections
     WHERE id = $1 AND (user_id = $2 OR is_demo = true)`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}
