import { query } from 'app/db/pool/pool.js';
import type { CitedChunk } from 'policy-pilot-common';

interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  filename: string;
  similarity: number;
}

export async function searchChunks(
  embedding: number[],
  userId: string | null,
  topK = 6,
  collectionId?: string,
): Promise<CitedChunk[]> {
  const embeddingStr = `[${embedding.join(',')}]`;

  let sql = `
    SELECT c.id, c.document_id, c.chunk_index, c.content, d.filename,
           1 - (c.embedding <=> $1::vector) AS similarity
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.embedding IS NOT NULL
  `;

  const values: unknown[] = [embeddingStr];

  if (collectionId) {
    values.push(collectionId);
    sql += ` AND d.collection_id = $${values.length}`;
  }

  if (userId) {
    values.push(userId);
    sql += ` AND c.user_id = $${values.length}`;
  }

  values.push(topK);
  sql += ` ORDER BY c.embedding <=> $1::vector LIMIT $${values.length}`;

  const result = await query<ChunkRow>(sql, values);

  return result.rows.map((row) => ({
    id: row.id,
    document_id: row.document_id,
    chunk_index: row.chunk_index,
    content: row.content,
    filename: row.filename,
  }));
}
