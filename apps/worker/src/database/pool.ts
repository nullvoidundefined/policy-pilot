/**
 * Owns the worker's PostgreSQL connection pool singleton, the shared stateful
 * handle that the query helper imports to talk to Neon.
 */
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
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
