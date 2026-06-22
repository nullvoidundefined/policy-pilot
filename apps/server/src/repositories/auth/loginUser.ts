/** Deletes all existing sessions for the user and creates a new one, returning the raw session token. */
import { query, withTransaction } from 'app/database/pool.js';

import { createSession } from './createSession.js';

export async function loginUser(userId: string): Promise<string> {
  return withTransaction(async (client) => {
    await query('DELETE FROM sessions WHERE user_id = $1', [userId], client);
    return createSession(userId, client);
  });
}
