/** Vitest configuration for scripts/eval standalone test suite. */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: import.meta.dirname,
    include: ['__tests__/**/*.test.ts'],
  },
});
