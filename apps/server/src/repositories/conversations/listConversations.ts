/** Returns all conversations for a user, ordered by most recently updated. */
import type { Conversation } from '@repo/types';
import { query } from 'app/database/pool.js';

export async function listConversations(
  userId: string,
): Promise<Conversation[]> {
  const result = await query<Conversation>(
    'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  );
  return result.rows;
}
