/** Returns all collections visible to the given user (own + demo), newest first. */
import type { Collection } from '@repo/types';
import { query } from 'app/database/query.js';

export async function listCollections(userId: string): Promise<Collection[]> {
  const result = await query<Collection>(
    `SELECT * FROM collections
     WHERE user_id = $1 OR is_demo = true
     ORDER BY is_demo DESC, created_at DESC`,
    [userId],
  );
  return result.rows;
}
