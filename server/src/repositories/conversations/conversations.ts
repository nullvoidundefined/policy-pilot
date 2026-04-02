import { query } from 'app/db/pool/pool.js';
import type { Conversation, Message } from 'policy-pilot-common';

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

export async function listConversations(
  userId: string,
): Promise<Conversation[]> {
  const result = await query<Conversation>(
    'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  );
  return result.rows;
}

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

export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  await query(
    'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2',
    [title, conversationId],
  );
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const result = await query<Message>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId],
  );
  return result.rows;
}
