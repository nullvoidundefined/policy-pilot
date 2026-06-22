/** Deletes a session row by its raw token and returns true if a row was removed. */
import { query } from 'app/database/pool.js';

import { hashSessionToken } from './hashSessionToken.js';

export async function deleteSession(sessionId: string): Promise<boolean> {
  const idHash = hashSessionToken(sessionId);
  const result = await query(
    'DELETE FROM sessions WHERE id = $1 RETURNING id',
    [idHash],
  );
  return (result.rowCount ?? 0) > 0;
}
