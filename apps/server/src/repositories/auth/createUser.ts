/** Inserts a new user row with a bcrypt-hashed password and returns the created user. */
import type { PoolClient } from 'app/database/pool.js';
import { query } from 'app/database/query.js';
import type { User } from 'app/schemas/auth.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function createUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  client?: PoolClient,
): Promise<User> {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query<User & { password_hash: string }>(
    'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name, created_at, updated_at',
    [
      email.toLowerCase().trim(),
      password_hash,
      firstName.trim(),
      lastName.trim(),
    ],
    client,
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}
