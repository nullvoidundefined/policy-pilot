/**
 * Inserts a new document row and returns the created record.
 */
import type { Document } from '@repo/types';
import { query } from 'app/database/pool.js';
import type { PoolClient } from 'app/database/pool.js';

export async function createDocument(
  userId: string,
  filename: string,
  r2Key: string,
  mimeType: string,
  sizeBytes: number,
  collectionId: string,
  client?: PoolClient,
): Promise<Document> {
  const result = await query<Document>(
    `INSERT INTO documents (user_id, filename, r2_key, mime_type, size_bytes, collection_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, filename, r2Key, mimeType, sizeBytes, collectionId],
    client,
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}
