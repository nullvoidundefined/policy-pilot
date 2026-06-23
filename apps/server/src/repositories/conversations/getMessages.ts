/** Returns all messages in a conversation, ordered by creation time ascending. */
import type { Message } from '@repo/types';
import { query } from 'app/database/query.js';

export async function getMessages(conversationId: string): Promise<Message[]> {
  const result = await query<Message>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId],
  );
  return result.rows;
}
