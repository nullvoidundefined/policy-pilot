/** Returns the number of documents belonging to the given collection. */
import { query } from 'app/database/query.js';

export async function getCollectionDocumentCount(id: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM documents WHERE collection_id = $1`,
    [id],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}
