import { query } from 'app/db/pool/pool.js';
import type { PoolClient } from 'app/db/pool/pool.js';
import type { Document, DocumentStatus } from 'policy-pilot-common';

export async function createDocument(
  userId: string,
  filename: string,
  r2Key: string,
  mimeType: string,
  sizeBytes: number,
  client?: PoolClient,
): Promise<Document> {
  const result = await query<Document>(
    `INSERT INTO documents (user_id, filename, r2_key, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, filename, r2Key, mimeType, sizeBytes],
    client,
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}

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

export async function listDocuments(userId: string): Promise<Document[]> {
  const result = await query<Document>(
    'SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  return result.rows;
}

export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  extra?: { total_chunks?: number; error?: string },
): Promise<void> {
  const sets = ['status = $2'];
  const values: unknown[] = [documentId, status];
  let idx = 3;

  if (extra?.total_chunks !== undefined) {
    sets.push(`total_chunks = $${idx}`);
    values.push(extra.total_chunks);
    idx++;
  }
  if (extra?.error !== undefined) {
    sets.push(`error = $${idx}`);
    values.push(extra.error);
    idx++;
  }

  await query(`UPDATE documents SET ${sets.join(', ')} WHERE id = $1`, values);
}

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
