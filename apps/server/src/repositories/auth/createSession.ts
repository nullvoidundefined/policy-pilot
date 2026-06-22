/** Creates a new session row for the given user and returns the raw session token. */
import { SESSION_TTL_MS } from 'app/constants/session.js';
import { query } from 'app/database/pool.js';
import type { PoolClient } from 'app/database/pool.js';
import crypto from 'node:crypto';

import { hashSessionToken } from './hashSessionToken.js';

export async function createSession(
  userId: string,
  client?: PoolClient,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const idHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [idHash, userId, expiresAt],
    client,
  );
  return token;
}
