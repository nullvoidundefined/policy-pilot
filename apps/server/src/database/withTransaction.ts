/**
 * Runs a callback inside a single BEGIN/COMMIT transaction on a dedicated pool
 * client, rolling back and rethrowing on failure and always releasing the client.
 */
import pool from 'app/database/pool.js';
import type { PoolClient } from 'app/database/pool.js';
import { query } from 'app/database/query.js';

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await query('BEGIN', undefined, client);
    const result = await fn(client);
    await query('COMMIT', undefined, client);
    return result;
  } catch (err) {
    await query('ROLLBACK', undefined, client);
    throw err;
  } finally {
    client.release();
  }
}
