import 'dotenv/config';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    setupFiles: ['src/__tests__/integration/setup.ts'],
    env: {
      // Disable Redis in integration tests
      REDIS_URL: '',
      // Disable SSL for CI Postgres (set before pool.ts loads)
      ...(process.env.CI
        ? { DATABASE_SSL_REJECT_UNAUTHORIZED: 'disable' }
        : {}),
    },
  },
  resolve: {
    alias: {
      app: path.resolve(__dirname, 'src'),
    },
  },
});
