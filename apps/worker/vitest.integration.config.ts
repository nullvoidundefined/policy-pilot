/** Vitest configuration for worker integration tests. */
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      app: path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__integration__/**/*.test.ts'],
    testTimeout: 30_000,
    setupFiles: ['src/__integration__/setup.ts'],
    fileParallelism: false,
    passWithNoTests: true,
  },
});
