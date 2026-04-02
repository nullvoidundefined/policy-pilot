import 'dotenv/config';
import path from 'path';
import { defineConfig } from 'vitest/config';

// Disable Redis/BullMQ in integration tests — we test HTTP routes, not job processing
process.env.REDIS_URL = '';
// Disable SSL for CI Postgres (local Postgres doesn't support SSL)
if (process.env.CI) {
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false';
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__integration__/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    setupFiles: ['src/__integration__/setup.ts'],
  },
  resolve: {
    alias: {
      app: path.resolve(__dirname, 'src'),
    },
  },
});
