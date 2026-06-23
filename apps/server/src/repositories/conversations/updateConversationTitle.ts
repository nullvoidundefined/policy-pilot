/** Updates the title and updated_at timestamp of a conversation. */
import { query } from 'app/database/query.js';

export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  await query(
    'UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2',
    [title, conversationId],
  );
}
