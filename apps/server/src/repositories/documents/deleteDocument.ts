/**
 * Deletes a document owned by the given user; returns true when a row was removed.
 */
import { query } from 'app/database/query.js';

export async function deleteDocument(
  documentId: string,
  userId: string,
): Promise<boolean> {
  const result = await query(
    'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
    [documentId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
