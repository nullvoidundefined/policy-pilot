/** Inserts a new collection row for the given user and returns the created record. */
import type { Collection } from '@repo/types';
import { query } from 'app/database/query.js';

export async function createCollection(
  userId: string,
  name: string,
  description?: string,
): Promise<Collection> {
  const result = await query<Collection>(
    `INSERT INTO collections (user_id, name, description)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, name, description ?? null],
  );
  return result.rows[0]!;
}
