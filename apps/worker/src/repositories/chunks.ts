/** Worker-side chunk write: inserts a single embedded chunk row into the pgvector-backed chunks table. */
import type { TextChunk } from '@repo/chunker';
import { query } from 'app/database/query.js';

export async function insertChunk(
  documentId: string,
  userId: string,
  chunk: TextChunk,
  embedding: number[],
): Promise<void> {
  const embeddingStr = `[${embedding.join(',')}]`;
  await query(
    `INSERT INTO chunks (document_id, user_id, chunk_index, content, token_count, embedding)
     VALUES ($1, $2, $3, $4, $5, $6::vector)`,
    [
      documentId,
      userId,
      chunk.index,
      chunk.content,
      chunk.tokenCount,
      embeddingStr,
    ],
  );
}
