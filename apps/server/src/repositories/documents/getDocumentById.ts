/**
 * Fetches a single document by id scoped to a user; returns null when not found.
 */
import type { Document } from '@repo/types';
import { query } from 'app/database/pool.js';

export async function getDocumentById(
  documentId: string,
  userId: string,
): Promise<Document | null> {
  const result = await query<Document>(
    'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
    [documentId, userId],
  );
  return result.rows[0] ?? null;
}
