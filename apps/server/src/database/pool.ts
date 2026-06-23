/**
 * Owns the server's PostgreSQL connection pool singleton and the PoolClient type,
 * the shared stateful handle that the query and withTransaction helpers import.
 */
import pg from 'pg';

const { Pool } = pg;

export type PoolClient = pg.PoolClient;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  ssl:
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'disable'
      ? false
      : process.env.NODE_ENV === 'production'
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
          },
});

export default pool;
