/** Vitest configuration for scripts/eval standalone test suite. */
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

const SERVER_MODULES = resolve(
  import.meta.dirname,
  '../../apps/server/node_modules',
);

export default defineConfig({
  resolve: {
    // scripts/eval is not a pnpm workspace package; alias third-party deps to server node_modules.
    alias: {
      '@anthropic-ai/sdk': resolve(
        SERVER_MODULES,
        '@anthropic-ai/sdk/index.mjs',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    root: import.meta.dirname,
    include: ['__tests__/**/*.test.ts'],
  },
});
