/** Looks up a user row by email address, returning the user with password hash or null if not found. */
import { query } from 'app/database/query.js';
import type { User } from 'app/schemas/auth.js';

export async function findUserByEmail(
  email: string,
): Promise<(User & { password_hash: string }) | null> {
  const result = await query<User & { password_hash: string }>(
    'SELECT id, email, first_name, last_name, password_hash, created_at, updated_at FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  return result.rows[0] ?? null;
}
