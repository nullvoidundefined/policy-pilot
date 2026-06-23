/**
 * Provides environment utility helpers derived from NODE_ENV,
 * giving the rest of the server a single named predicate for production checks.
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
