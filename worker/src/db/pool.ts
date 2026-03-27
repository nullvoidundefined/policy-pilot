import pg from "pg";

import { logger } from "app/utils/logger.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
      : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" },
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result =
    values !== undefined ? await pool.query<T>(text, values) : await pool.query<T>(text);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== "production") {
    logger.debug({ query: text, duration_ms: duration }, "db query");
  }
  return result;
}

export default pool;
