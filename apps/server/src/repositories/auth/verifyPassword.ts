/** Compares a plain-text password against a stored bcrypt hash, returning true if they match. */
import bcrypt from 'bcrypt';

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
