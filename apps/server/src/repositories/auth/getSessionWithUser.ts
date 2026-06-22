/** Looks up a non-expired session by its raw token and returns the associated user, or null. */
import { query } from 'app/database/pool.js';
import type { User } from 'app/schemas/auth.js';

import { hashSessionToken } from './hashSessionToken.js';

export async function getSessionWithUser(
  sessionId: string,
): Promise<User | null> {
  const idHash = hashSessionToken(sessionId);
  const result = await query<User>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.created_at, u.updated_at
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [idHash],
  );
  return result.rows[0] ?? null;
}
