/**
 * Global setup and teardown for worker integration tests.
 * Loads DATABASE_URL from the shared server .env before importing the pool,
 * then wipes all integration-test fixture rows so each run starts clean.
 */
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../../apps/server/.env') });

// Dynamic import runs after config() so DATABASE_URL is set before the pool constructor fires.
const { default: pool } = await import('app/database/pool.js');

const CLEANUP = [
  "DELETE FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  "DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid'))",
  "DELETE FROM conversations WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  "DELETE FROM documents WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  "DELETE FROM collections WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration-test.invalid')",
  "DELETE FROM users WHERE email LIKE '%@integration-test.invalid'",
];

async function cleanupTestData(): Promise<void> {
  for (const sql of CLEANUP) {
    await pool.query(sql);
  }
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set; skipping worker integration tests');
    return;
  }
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await pool.end();
});
