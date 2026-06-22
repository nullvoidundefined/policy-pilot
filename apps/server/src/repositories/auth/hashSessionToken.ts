/** Hashes a raw session token to its stored SHA-256 id (shared by session repository functions). */
import crypto from 'node:crypto';

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
