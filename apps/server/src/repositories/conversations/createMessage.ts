/** Inserts a new message into a conversation and returns the created record. */
import type { Message } from '@repo/types';
import { query } from 'app/database/query.js';

export async function createMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  citedChunkIds: string[] = [],
): Promise<Message> {
  const result = await query<Message>(
    'INSERT INTO messages (conversation_id, role, content, cited_chunk_ids) VALUES ($1, $2, $3, $4) RETURNING *',
    [conversationId, role, content, citedChunkIds],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}
