/** Creates a new conversation row and returns the created record. */
import type { Conversation } from '@repo/types';
import { query } from 'app/database/query.js';

export async function createConversation(
  userId: string,
  title: string,
): Promise<Conversation> {
  const result = await query<Conversation>(
    'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
    [userId, title],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}
