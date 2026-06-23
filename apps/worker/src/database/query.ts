/**
 * Runs a parameterized SQL query against the worker's connection pool and logs
 * query timing outside production.
 */
import { logger } from '@repo/logger';
import pool from 'app/database/pool.js';
import type pg from 'pg';

export async function query<T extends pg.QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result =
    values !== undefined
      ? await pool.query<T>(text, values)
      : await pool.query<T>(text);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    logger.debug({ query: text, duration_ms: duration }, 'db query');
  }
  return result;
}
