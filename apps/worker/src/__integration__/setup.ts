/**
 * Global setup and teardown for worker integration tests.
 * Loads environment variables from the shared server .env before the pool
 * module is imported, so DATABASE_URL is set at pool construction time.
 * The beforeAll/afterAll hooks wipe integration-test fixture rows so each
 * run starts from a clean slate and leaves no orphaned data behind.
 */
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../../apps/server/.env') });

// Pool is imported dynamically so dotenv runs before the module is evaluated
// and DATABASE_URL is available when the Pool constructor reads it.
const { default: pool } = await import('app/db/pool.js');

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set; skipping worker integration tests');
    return;
  }

  await pool.query(
    "DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM collections WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM users WHERE email LIKE '%@integration-test.invalid'",
  );
});

afterAll(async () => {
  await pool.query(
    "DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  );
  await pool.query(
    "DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM collections WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  );
  await pool.query(
    "DELETE FROM users WHERE email LIKE '%@integration-test.invalid'",
  );
  await pool.end();
});
