/** Fetches a single conversation by ID scoped to a user, or null if not found. */
import type { Conversation } from '@repo/types';
import { query } from 'app/database/pool.js';

export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<Conversation | null> {
  const result = await query<Conversation>(
    'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
    [conversationId, userId],
  );
  return result.rows[0] ?? null;
}
