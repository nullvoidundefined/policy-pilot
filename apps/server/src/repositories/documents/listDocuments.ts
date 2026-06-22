/**
 * Lists all documents for a user, optionally filtered by collection.
 */
import type { Document } from '@repo/types';
import { query } from 'app/database/pool.js';

export async function listDocuments(
  userId: string,
  collectionId?: string,
): Promise<Document[]> {
  if (collectionId) {
    const result = await query<Document>(
      'SELECT * FROM documents WHERE user_id = $1 AND collection_id = $2 ORDER BY created_at DESC',
      [userId, collectionId],
    );
    return result.rows;
  }
  const result = await query<Document>(
    'SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  return result.rows;
}
